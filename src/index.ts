import { EventEmitter } from 'events';

/**Refer to RWMutex in Golang */
export class RWMutex extends EventEmitter {
  private _rlocks: number = 0;
  private _wlocked: boolean = false;
  private _lockQueue: { res: Function; type: 'R' | 'W' }[] = [];

  state: 'LOCKED' | 'RLOCKED' | 'UNLOCKED' = 'UNLOCKED';

  constructor() {
    super();

    this.setMaxListeners(1000);
    this.on('unlock', () => this._releaseLocks());
  }

  private _releaseLocks() {
    const length = this._lockQueue.length;
    for (let i = 0; i < length; i++) {
      const lock = this._lockQueue.shift()!;

      if (lock.type === 'R') {
        lock.res();
        continue;
      }

      if (i === 0) {
        lock.res();
      } else {
        this._lockQueue.unshift(lock);
      }

      break;
    }
  }

  private async _enqueueLockAndWait(type: 'R' | 'W') {
    return new Promise((res) => {
      this._lockQueue.push({ res, type });
    });
  }

  writeLength() {
    return this._lockQueue.filter((q) => q.type === 'W').length;
  }

  hasNextWrites() {
    return this._lockQueue.filter((q) => q.type === 'W').length > 0;
  }

  hasNextRead() {
    return this._lockQueue.filter((q) => q.type === 'R').length > 0;
  }

  /**Acquire Read Lock. Use it for thread-safe operations */
  async RLock() {
    if (this._wlocked || this._lockQueue.some((lock) => lock.type === 'W')) {
      await this._enqueueLockAndWait('R');
    }

    this._rlocks++;
    this.state = 'RLOCKED';
  }

  /**Acquire Write Lock. Use it for operations that require monopoly resource usage */
  async Lock() {
    if (this._rlocks > 0 || this._wlocked) {
      await this._enqueueLockAndWait('W');
    }

    this._wlocked = true;
    this.state = 'LOCKED';
  }

  /**Release Read Lock */
  RUnlock() {
    if (this._rlocks < 1) {
      throw new Error('Cannot RUnlock not rlocked mutex. Fix race conditions');
    }

    this._rlocks--;

    if (this._rlocks === 0) {
      this.state = 'UNLOCKED';
      this.emit('unlock');
    }
  }

  /**Release Write Lock */
  Unlock() {
    if (!this._wlocked) {
      throw new Error(`Cannot Unlock unlocked mutex. Fix race conditions`);
    }

    this._wlocked = false;
    this.state = 'UNLOCKED';
    setImmediate(() => {
      this.emit('unlock');
    });
  }
}

export async function runWithMutexR<T>(
  mx: RWMutex,
  fnc: (...args: any[]) => Promise<T>
) {
  await mx.RLock();
  try {
    const res = await fnc();
    try {
      mx.RUnlock();
    } catch (err) {
      throw new Error(
        `Cannot RUnlock after the promise was resolved. Error: ${err}`
      );
    }
    return res;
  } catch (err) {
    try {
      mx.RUnlock();
    } catch (err1) {
      throw new Error(
        `Cannot RUnlock after the promise was rejected with error: ${err}. Unlock error: ${err1}`
      );
    }
    throw err;
  }
}

export async function runWithMutexW<T>(
  mx: RWMutex,
  fnc: (...args: any) => Promise<T>
) {
  await mx.Lock();
  try {
    const res = await fnc();
    try {
      mx.Unlock();
    } catch (err) {
      throw new Error(
        `Cannot Unlock after the promise was resolved. Error: ${err}`
      );
    }
    return res;
  } catch (err) {
    try {
      mx.Unlock();
    } catch (err1) {
      throw new Error(
        `Cannot unlock after the promise was rejected with error: ${err}. Unlock error: ${err1}`
      );
    }
    throw err;
  }
}
