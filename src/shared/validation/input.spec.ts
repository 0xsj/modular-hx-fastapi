import { describe, expect, it } from 'vitest';
import * as v from './index.js';
import * as p from '../pagination/index.js';
describe('input leaves', () => {
  it('checks scalars and strict decimals', () => {
    for (const s of [
      '',
      '00',
      '01',
      '+1',
      '-1',
      '1.0',
      ' 1',
      '1 ',
      '1\n',
      '١',
      '2147483648',
      '12345678901',
    ])
      expect(v.decimal(s, 0, 2147483647).ok, s).toBe(false);
    for (const s of ['0', '1', '2147483647'])
      expect(v.decimal(s, 0, 2147483647).ok).toBe(true);
    for (const [s, n] of [
      ['😀', 1],
      ['é', 2],
      ['\u00a0', 1],
    ] as const)
      expect(v.text(s, n, n, true).ok).toBe(true);
    for (const s of ['', ' \t\n', '\ud800'])
      expect(v.text(s, 0, 10, true).ok).toBe(false);
    expect(v.text('a', 2, 1, false).ok).toBe(false);
  });
  it('bounds and owns reports', () => {
    const r = new v.Report();
    expect(r.result().ok).toBe(true);
    for (let i = 0; i < 32; i++)
      expect(r.add(`f${i}`, 'required').ok).toBe(true);
    r.add('f0', 'other');
    expect(r.truncated).toBe(false);
    const snapshot = r.issues();
    snapshot[0] = { field: 'f0', code: 'mutated' };
    r.add('overflow', 'invalid');
    expect(r.truncated).toBe(true);
    expect(r.issues()).toHaveLength(32);
    expect(r.issues()[0].code).toBe('required');
    expect(r.result().ok).toBe(false);
    expect(r.add('password', 'secret value').ok).toBe(false);
    expect(r.add('bad/name', 'required').ok).toBe(false);
  });
  it('rejects malformed and cross-scope cursors', () => {
    expect(p.size()).toEqual({ ok: true, value: 25 });
    for (const s of ['', '0', '101', '01', '1.1', '1\n'])
      expect(p.size(s).ok).toBe(false);
    const wire = p.encode('org:1/name', '😀/42');
    if (!wire.ok) throw Error('fixture');
    expect(p.decode(wire.value, 'org:1/name')).toEqual({
      ok: true,
      value: '😀/42',
    });
    expect(p.decode(wire.value, 'org:2/name').ok).toBe(false);
    for (const raw of [
      '[2,"s","p"]',
      '[1,"s",null]',
      '[1,"s","\\ud800"]',
      '[1,"s","\\udc00"]',
      '[1,"s","\\n"]',
      '[1,"s",""]',
      '[1,"s","p",0]',
      '[1,"s","p"] {}',
    ])
      expect(
        p.decode(Buffer.from(raw).toString('base64url'), 's').ok,
        raw,
      ).toBe(false);
    for (const raw of [
      '[1.0,"s","p"]',
      '[1,"s","\\ud83d\\ude00"]',
      '[1,"s","\\\\ud800"]',
    ])
      expect(
        p.decode(Buffer.from(raw).toString('base64url'), 's').ok,
        raw,
      ).toBe(true);
    for (const bad of [wire.value + '=', wire.value + '\n', 'a', '_x'])
      expect(p.decode(bad, 'org:1/name').ok).toBe(false);
  });
  it('anchors on the last returned row and owns the window', () => {
    const rows = ['a', 'b', 'c'];
    const page = p.window(rows, 2, 's', (s) => s);
    if (!page.ok) throw Error('fixture');
    expect(page.value.items).toEqual(['a', 'b']);
    expect(page.value.hasMore).toBe(true);
    expect(p.decode(page.value.nextCursor!, 's')).toEqual({
      ok: true,
      value: 'b',
    });
    page.value.items[0] = 'mutated';
    expect(rows[0]).toBe('a');
    expect(p.window([], 2, 's', String)).toEqual({
      ok: true,
      value: { items: [], hasMore: false },
    });
    expect(p.window(rows, 1, 's', (s) => s).ok).toBe(false);
  });
});
