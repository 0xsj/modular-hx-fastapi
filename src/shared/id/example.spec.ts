import { expect, it } from 'vitest';
import { FakeClock } from '../clock/index.js';
import { V7 } from './index.js';

it('example: elapsed time and UUID order survive wall correction', () => {
  const c = new FakeClock(new Date(0x0123456789ab));
  // Deterministic entropy belongs only in tests/examples.
  const g = new V7(c, (bytes) => {
    bytes.fill(0);
  });
  const a = g.newId();
  if (!a.ok) throw new Error(a.error.message);
  c.advance(25);
  c.set(new Date(0x0123456789aa));
  const b = g.newId();
  if (!b.ok) throw new Error(b.error.message);
  const output = [a.value, b.value, `${c.elapsed() / 1000000n}ms`];
  expect(output).toEqual([
    '01234567-89ab-7000-8000-000000000000',
    '01234567-89ab-7001-8000-000000000000',
    '25ms',
  ]);
});
