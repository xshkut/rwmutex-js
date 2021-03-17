import { RWMutex } from '../index';
import { doesNotReject, strictEqual, throws, deepStrictEqual } from 'assert';

describe('RWMutex', () => {
  it('Unlock should reject if not locked', async () => {
    const rwm = new RWMutex();
    throws(() => rwm.Unlock());
  });
  it('RUnlock should reject if not rlocker', async () => {
    const rwm = new RWMutex();
    throws(() => rwm.RUnlock());
  });
  it('Lock-Unlock calls should be sequental', async () => {
    const rwm = new RWMutex();
    let lockedCount = 0;

    strictEqual(rwm.state, 'UNLOCKED');
    strictEqual(lockedCount, 0);

    await doesNotReject(() =>
      Promise.all([
        new Promise<void>(async (res, rej) => {
          await rwm.Lock();
          lockedCount++;
          await new Promise((res) => setTimeout(res, 2));
          rwm.state === 'LOCKED' || rej();
          lockedCount === 1 || rej();
          await new Promise((res) => setTimeout(res, 2));
          lockedCount--;
          rwm.Unlock();
          rwm.state === 'UNLOCKED' || rej();
          lockedCount === 0 || rej();
          res();
        }),
        new Promise<void>(async (res, rej) => {
          await rwm.Lock();
          lockedCount++;
          await new Promise((res) => setTimeout(res, 2));
          rwm.state === 'LOCKED' || rej();
          lockedCount === 1 || rej();
          await new Promise((res) => setTimeout(res, 2));
          lockedCount--;
          rwm.Unlock();
          rwm.state === 'UNLOCKED' || rej();
          lockedCount === 0 || rej();
          res();
        }),
      ])
    );

    strictEqual(lockedCount, 0);
    strictEqual(rwm.state, 'UNLOCKED');
  });
  it('Read lock should be parallel', async () => {
    const rwm = new RWMutex();
    let lockedCount = 0;
    [1, 2, 3, 4, 5].map(async () => {
      await new Promise((res) => setTimeout(res, 1));
      await rwm.RLock();
      lockedCount++;
      await new Promise((res) => setTimeout(res, 5));
      rwm.RUnlock();
      lockedCount--;
    });

    strictEqual(rwm.state, 'UNLOCKED');
    strictEqual(lockedCount, 0);
    await new Promise((res) => setTimeout(res, 3));
    strictEqual(rwm.state, 'RLOCKED');
    strictEqual(lockedCount, 5);
    await new Promise((res) => setTimeout(res, 5));
    strictEqual(lockedCount, 0);
    strictEqual(rwm.state, 'UNLOCKED');
  });
  it('Read and Write locking should be done in FIFO order ', async () => {
    const rwm = new RWMutex();

    const sequence: { type: 'R' | 'W'; name: string }[] = [];
    sequence.push({ name: 'read1', type: 'R' });
    sequence.push({ name: 'read2', type: 'R' });
    sequence.push({ name: 'read3', type: 'R' });
    sequence.push({ name: 'write1', type: 'W' });
    sequence.push({ name: 'read4', type: 'R' });
    sequence.push({ name: 'write2', type: 'W' });
    sequence.push({ name: 'write3', type: 'W' });
    sequence.push({ name: 'write4', type: 'W' });
    sequence.push({ name: 'read5', type: 'R' });
    sequence.push({ name: 'read6', type: 'R' });
    sequence.push({ name: 'read7', type: 'R' });
    sequence.push({ name: 'write5', type: 'W' });

    const results: string[] = [];

    const run = sequence.map(async (item, i) => {
      /**To ensure valid sequence */
      if (item.type === 'R') {
        await rwm.RLock();
      } else {
        await rwm.Lock();
      }
      results.push(item.name);
      await new Promise((res) => setTimeout(res, 5));
      if (item.type === 'R') {
        rwm.RUnlock();
      } else {
        rwm.Unlock();
      }
    });

    await Promise.all(run);

    deepStrictEqual(
      results,
      sequence.map((s) => s.name)
    );
  });
});
