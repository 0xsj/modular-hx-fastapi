import { it, expect } from 'vitest';
import { Principal, type Kind, type Snapshot } from './principal.js';
import { parse, type ID } from '../../../shared/id/index.js';
import type { Result, Failure } from '../../../shared/errors/index.js';
function value<T>(r: Result<T, Failure>): T {
  if (!r.ok) throw Error(r.error.type);
  return r.value;
}
const id = value(parse('00000000-0000-4000-8000-000000000001'));
const code = <T>(r: Result<T, Failure>) => (r.ok ? undefined : r.error.type);
it('registers and owns snapshots', () => {
  for (const kind of ['human', 'service'] as const) {
    const p = value(Principal.register(id, kind, ' Ada 🌱 ', 1000));
    const expected = {
      id,
      kind,
      displayName: ' Ada 🌱 ',
      status: 'active',
      createdAtMs: 1000,
      updatedAtMs: 1000,
      version: 1,
    };
    expect(p.snapshot()).toEqual(expected);
    const s = p.snapshot();
    s.displayName = 'changed';
    expect(p.snapshot()).toEqual(expected);
  }
});
it('refuses invalid names, forged types and times', () => {
  for (const name of [
    '',
    ' ',
    '\t',
    'a\n',
    'a\x7f',
    '\ud800',
    '🌱'.repeat(101),
  ])
    expect(code(Principal.register(id, 'human', name, 0))).toBe(
      'identity.principal_invalid',
    );
  for (const name of ['a', '🌱'.repeat(100), 'e\u0301'])
    expect(Principal.register(id, 'human', name, 0).ok).toBe(true);
  expect(Principal.register('bad' as ID, 'human', 'a', 0).ok).toBe(false);
  expect(Principal.register(id, 'robot' as Kind, 'a', 0).ok).toBe(false);
  for (const ms of [-1, NaN, Infinity, 0.5, 253402300800000])
    expect(Principal.register(id, 'human', 'a', ms).ok).toBe(false);
});
it('transitions immutably with version and time guards', () => {
  const p = value(Principal.register(id, 'human', 'Ada', 1000)),
    original = p.snapshot(),
    s = value(p.suspend(1, 1000));
  expect(s.snapshot()).toEqual({
    ...original,
    status: 'suspended',
    version: 2,
  });
  expect(p.snapshot()).toEqual(original);
  expect(value(s.activate(2, 2000)).snapshot()).toEqual({
    ...original,
    status: 'active',
    updatedAtMs: 2000,
    version: 3,
  });
  expect(code(s.suspend(1, 1000))).toBe('identity.version_conflict');
  expect(code(s.suspend(2, 1000))).toBe('identity.state_conflict');
  expect(code(s.activate(2, 999))).toBe('identity.principal_invalid');
  // TypeScript's private constructor is erased; JavaScript can bypass it.
  const forged = Reflect.construct(Principal, [
    { ...original, version: 0 },
  ]) as Principal;
  expect(code(forged.suspend(0, 1000))).toBe('identity.principal_invalid');
  const full = value(
    Principal.restore({ ...s.snapshot(), version: 2147483647 }),
  );
  expect(code(full.activate(2147483647, 1000))).toBe(
    'identity.version_exhausted',
  );
});
it('restores without resetting history and validates corrupt snapshots', () => {
  const s = {
    ...value(Principal.register(id, 'human', 'Ada', 1000)).snapshot(),
    status: 'suspended' as const,
    version: 8,
    updatedAtMs: 2000,
  };
  expect(value(Principal.restore(s)).snapshot()).toEqual(s);
  for (const changes of [
    { status: 'other' },
    { version: 0 },
    { version: 2147483648 },
    { updatedAtMs: 999 },
    { createdAtMs: -1 },
    { displayName: undefined },
  ])
    expect(code(Principal.restore({ ...s, ...changes } as Snapshot))).toBe(
      'identity.principal_invalid',
    );
});
