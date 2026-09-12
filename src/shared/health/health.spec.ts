import { expect, it } from 'vitest';
import { Gate } from './index.js';
import { ok } from '../errors/index.js';
it('owns startup, drain and a bounded hanging probe', async () => {
  const g = new Gate(10, []);
  expect(await g.ready()).toBe(false);
  expect(g.start()).toBe(true);
  expect(g.start()).toBe(false);
  expect(await g.ready()).toBe(true);
  g.drain();
  expect(await g.ready()).toBe(false);
  expect(g.start()).toBe(false);
  let calls = 0;
  let release!: () => void;
  const h = new Gate(10, [
    async () => {
      calls++;
      await new Promise<void>((r) => {
        release = r;
      });
      return ok(undefined);
    },
  ]);
  h.start();
  expect(await h.ready()).toBe(false);
  expect(await h.ready()).toBe(false);
  expect(calls).toBe(1);
  release();
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  let unblock!: () => void;
  const d = new Gate(1000, [
    async () => {
      entered();
      await new Promise<void>((r) => {
        unblock = r;
      });
      return ok(undefined);
    },
  ]);
  d.start();
  const task = d.ready();
  await started;
  d.drain();
  unblock();
  expect(await task).toBe(false);
});
