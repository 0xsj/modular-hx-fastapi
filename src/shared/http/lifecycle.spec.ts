import { it, expect } from 'vitest';
import { Active } from './lifecycle.js';
it('first valid finish isolates output failures and rejects a reversed clock', () => {
  let now = 1_000_000_000n;
  let calls = 0;
  const a = new Active(
    () => now,
    [
      () => {
        throw new Error('private');
      },
      (c) => {
        expect(c.elapsedNs).toBe(1_000_000_000n);
        calls++;
      },
    ],
  );
  const facts = { status: 200, termination: 'response_completed' } as const;
  now = 0n;
  expect(a.finish(facts).ok).toBe(false);
  now = 2_000_000_000n;
  expect(a.finish(facts)).toEqual({ ok: true, value: true });
  expect(a.finish(facts)).toEqual({ ok: true, value: false });
  expect(calls).toBe(1);
  expect(a.failedAttempts).toBe(1);
});
