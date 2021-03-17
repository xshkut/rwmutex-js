# RW-MUTEX-TS

Read-write mutex is inspired by the one from Golang.
Written in Typescript.
Easy to use, flexible. Includes helper functions.

## Install

```
import { RWMutex } from 'rw-mutex-ts'
```

## Concept

The RWMutex is a unit which prevents parallel conflicting operations (which mutate same parts of an object. Basically, but not necessary, "write" operations), but allows parallel non-conflicting operations ("read" operations or "write" operations over independent parts of the object).

## Usage

```ts
import { RWMutex } from 'rw-mutex-ts';

const rwmutex = new RWMutex();

const user = {
  name: 'John',
  age: 20,
};

async function waitRandomTime() {
  await new Promise((res) => setTimeout(res, Math.floor(Math.random() * 1000)));
}

async function updateUser(name: string, age: number) {
  await rwmutex.Lock();
  console.log(`Locked for write. Adjusting user: ${name} - ${age}`);
  await waitRandomTime();
  user.name = name;
  await waitRandomTime();
  user.age = age;
  console.log(`Write unlocked. Adjusted user: ${name} - ${age}`);
  rwmutex.Unlock();
}

async function getUserInfo(tag: string) {
  await rwmutex.RLock();
  console.log(
    `locking for read. Getting user info (${tag}): ${user.name} - ${user.age}`
  );
  await waitRandomTime();
  console.log(
    `Read unlocked. Getting same user info (${tag}): ${user.name} - ${user.age}`
  );
  rwmutex.RUnlock();
}

// Run all in parallel. See what happens
updateUser('Anna', 20);
updateUser('John', 30);
getUserInfo('first try');
getUserInfo('second try');
updateUser('Alex', 40);
getUserInfo('third try');
```

Output:

```
Locked for write. Adjusting user: Anna - 20
Write unlocked. Adjusted user: Anna - 20
Locked for write. Adjusting user: John - 30
Write unlocked. Adjusted user: John - 30
locking for read. Getting user info (first try): John - 30
locking for read. Getting user info (second try): John - 30
Read unlocked. Getting same user info (second try): John - 30
Read unlocked. Getting same user info (first try): John - 30
Locked for write. Adjusting user: Alex - 40
Write unlocked. Adjusted user: Alex - 40
locking for read. Getting user info (third try): Alex - 40
Read unlocked. Getting same user info (third try): Alex - 40
```

If your opeartion can fail after getting a lock, use helper functions to ensure the unlock. Will you async function (or promise) either complete or fail, the mutex will still be unlocked:

```ts
await runWithMutexW(rwmutex, async () => {
  /**Some stuff which can fail */
});

await runWithMutexR(rwmutex, async () => {
  /**Some stuff which can fail */
});
```
