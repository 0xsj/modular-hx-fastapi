import { it, expect } from 'vitest';
import { Reader, map } from './index.js';
it('V01 presence', () => {
  const r = new Reader(map({ EMPTY: '', SET: 'yes' }));
  expect(r.string('ABSENT', 'default')).toBe('default');
  expect(r.string('EMPTY', 'default')).toBe('');
  expect(r.required('SET')).toBe('yes');
  expect(r.check().ok).toBe(true);
  r.secret('MISSING');
  expect(r.check().ok).toBe(false);
});
it('V02 parsers', () => {
  for (const s of [
    '',
    ' 2',
    '2 ',
    '+2',
    '02',
    '1e2',
    '1.5',
    '9007199254740992',
  ]) {
    const r = new Reader(map({ N: s }));
    r.int('N', 2, -9007199254740991, 9007199254740991);
    expect(r.check().ok, s).toBe(false);
  }
  const r = new Reader(map({ N: '-3', B: 'false', E: 'json' }));
  expect(r.int('N', 2, -3, 3)).toBe(-3);
  expect(r.boolean('B', true)).toBe(false);
  expect(r.enumeration('E', 'console', ['console', 'json'])).toBe('json');
  expect(r.check().ok).toBe(true);
  const b = new Reader(map({ B: 'TRUE', E: ' json' }));
  b.boolean('B', false);
  b.enumeration('E', 'console', ['console', 'json']);
  const e = b.check();
  expect(e.ok).toBe(false);
  if (!e.ok) expect(Object.keys(e.error.fields ?? {})).toHaveLength(2);
});
it('V03 definitions', () => {
  const r = new Reader(() => {
    throw new Error('invalid definition read source');
  });
  r.int('N', 20, 0, 10);
  r.enumeration('E', 'bad', ['ok']);
  expect(r.check().ok).toBe(false);
});
it('V04 failures', () => {
  const r = new Reader(map({ N: 'private-SENTINEL', EMPTY: '' }));
  r.int('N', 1, 0, 10);
  r.required('EMPTY');
  const e = r.check();
  expect(e.ok).toBe(false);
  if (!e.ok) {
    expect(Object.keys(e.error.fields ?? {})).toHaveLength(2);
    expect(JSON.stringify(e.error)).not.toContain('private-SENTINEL');
  }
  expect(r.manifest().ok).toBe(false);
});
it('V05 manifest', () => {
  const input = { TOKEN: 'private-SENTINEL', NAME: 'visible' };
  const r = new Reader(map(input));
  input.TOKEN = 'changed';
  expect(r.secret('TOKEN').reveal()).toBe('private-SENTINEL');
  r.required('NAME');
  r.int('COUNT', 3, 0, 10);
  const v = r.manifest();
  expect(v.ok).toBe(true);
  if (v.ok) {
    expect(v.value.map((x) => [x.key, x.value, x.source])).toEqual([
      ['COUNT', '3', 'default'],
      ['NAME', 'visible', 'environment'],
      ['TOKEN', '[REDACTED]', 'environment'],
    ]);
    v.value[2].value = 'oops';
    const again = r.manifest();
    if (again.ok) expect(again.value[2].value).toBe('[REDACTED]');
  }
});
it('V06 duplicate', () => {
  const r = new Reader(map({}));
  r.string('A', 'a');
  r.string('A', 'b');
  const e = r.check();
  expect(e.ok).toBe(false);
  if (!e.ok) expect(e.error.fields?.A).toBe('duplicate_key');
});
