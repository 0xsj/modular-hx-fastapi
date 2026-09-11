import { describe, expect, it } from 'vitest';
import { FakeClock } from '../clock/index.js';
import {
  causeOf,
  publicInfo,
  type Failure,
  type Result,
} from '../errors/index.js';
import { parse, version, unixMillis, V7, Sequence, type ID } from './index.js';
const tick = 0x0123456789ab;
const first = '01234567-89ab-7000-8000-000000000000';
function unwrap<T>(r: Result<T, Failure>): T {
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
function failure<T>(
  r: Result<T, Failure>,
  kind: Failure['kind'],
  type: string,
): Failure {
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error('expected refusal');
  expect(r.error.kind).toBe(kind);
  expect(r.error.type).toBe(type);
  return r.error;
}
const zeros = (b: Uint8Array): void => {
  b.fill(0);
};
describe('id contract', () => {
  it('I01 parse', () => {
    for (const s of [
      'F81D4FAE-7DEC-41D0-A765-00A0C91E6BF6',
      '01234567-89ab-f000-8000-000000000000',
      '01234567-89ab-0000-8000-000000000000',
    ]) {
      expect(unwrap(parse(s))).toBe(s.toLowerCase());
    }
    for (const s of [
      undefined,
      null,
      5,
      {},
      '',
      first + ' ',
      ' ' + first,
      first.replaceAll('-', ''),
      '{' + first + '}',
      'urn:uuid:' + first,
      '01234567_89ab-7000-8000-000000000000',
      '01234567-89ab-7000-8000-00000000000g',
      '00000000-0000-0000-0000-000000000000',
      '01234567-89ab-7000-0000-000000000000',
      '01234567-89ab-7000-c000-000000000000',
      '01234567-89ab-7000-f000-000000000000',
      first + '\n',
    ]) {
      expect(failure(parse(s), 'invalid', 'id.invalid').message).toBe(
        'invalid ID',
      );
    }
  });
  it('I02 value and time', () => {
    const v = unwrap(parse('017F22E2-79B0-7CC3-98C4-DC0C0C07398F'));
    const map = new Map<ID, string>([[v, 'found']]);
    expect(map.get(unwrap(parse(v)))).toBe('found');
    expect(version(v)).toBe(7);
    expect(unixMillis(v)).toBe(1645557742000);
    expect(
      unixMillis(unwrap(parse('f81d4fae-7dec-41d0-a765-00a0c91e6bf6'))),
    ).toBeUndefined();
    expect(JSON.stringify({ id: v })).toBe(
      '{"id":"017f22e2-79b0-7cc3-98c4-dc0c0c07398f"}',
    );
  });
  it('I03 exact v7 bytes', () => {
    const c = new FakeClock(new Date(tick));
    const g = new V7(c, (b) => {
      expect(b.length).toBe(10);
      b.set([7, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
    });
    expect(unwrap(g.newId())).toBe('01234567-89ab-77ff-bfff-ffffffffffff');
    expect(unwrap(new V7(c, zeros).newId())).toBe(first);
  });
  it('I04 ordering and rollback', () => {
    const c = new FakeClock(new Date(tick));
    let calls = 0;
    const g = new V7(c, (b) => {
      b.fill(++calls === 1 ? 255 : 0);
    });
    const a = unwrap(g.newId());
    const b = unwrap(g.newId());
    c.set(new Date(tick - 100));
    const d = unwrap(g.newId());
    expect(a < b && b < d).toBe(true);
    expect(b).toBe('01234567-89ab-7800-8000-000000000000');
    expect(unixMillis(d)).toBe(tick);
    c.set(new Date(tick + 1));
    const e = unwrap(g.newId());
    expect(e > d).toBe(true);
    expect(e).toBe('01234567-89ac-7000-8000-000000000000');
  });
  it('I05 exhaustion and recovery', () => {
    const c = new FakeClock(new Date(tick));
    let calls = 0;
    const g = new V7(c, (b) => {
      calls++;
      zeros(b);
    });
    let last = '';
    for (let i = 0; i < 4096; i++) {
      const v = unwrap(g.newId());
      expect(v > last).toBe(true);
      last = v;
    }
    for (let i = 0; i < 2; i++)
      failure(g.newId(), 'unavailable', 'id.exhausted');
    expect(calls).toBe(4096);
    c.set(new Date(tick - 1));
    failure(g.newId(), 'unavailable', 'id.exhausted');
    c.set(new Date(tick + 1));
    expect(unwrap(g.newId()) > last).toBe(true);
  });
  it('I06 entropy failure atomicity', () => {
    const c = new FakeClock(new Date(tick));
    const sentinel = new Error('private entropy diagnostic');
    let fail = true;
    const g = new V7(c, (b) => {
      if (fail) throw sentinel;
      zeros(b);
    });
    const e = failure(g.newId(), 'unavailable', 'id.entropy');
    expect(causeOf(e)).toBe(sentinel);
    expect(publicInfo(e).message).not.toContain('private');
    fail = false;
    expect(unwrap(g.newId())).toBe(first);
    c.set(new Date(tick + 100));
    fail = true;
    failure(g.newId(), 'unavailable', 'id.entropy');
    fail = false;
    c.set(new Date(tick));
    expect(unwrap(g.newId())).toBe('01234567-89ab-7001-8000-000000000000');
    for (const cause of [undefined, null, 'offline']) {
      const g = new V7(c, () => {
        throw cause;
      });
      expect(causeOf(failure(g.newId(), 'unavailable', 'id.entropy'))).toBe(
        cause,
      );
    }
  });
  it('I07 time range', () => {
    let wall = new Date(0);
    let calls = 0;
    const g = new V7({ now: () => wall }, (b) => {
      calls++;
      zeros(b);
    });
    expect(unwrap(g.newId())).toBe('00000000-0000-7000-8000-000000000000');
    for (const t of [-1, 2 ** 48, NaN]) {
      wall = new Date(t);
      failure(g.newId(), 'invalid', 'id.time_range');
    }
    expect(calls).toBe(1);
    wall = new Date(2 ** 48 - 1);
    expect(unixMillis(unwrap(g.newId()))).toBe(2 ** 48 - 1);
  });
  it('I08 sequence', () => {
    const a = unwrap(parse(first));
    const b = unwrap(parse('01234567-89ab-7001-8000-000000000000'));
    const items = [a, b];
    const s = new Sequence(items);
    items[0] = b;
    expect(unwrap(s.newId())).toBe(a);
    expect(unwrap(s.newId())).toBe(b);
    for (let i = 0; i < 2; i++)
      failure(s.newId(), 'unavailable', 'id.sequence_exhausted');
    failure(new Sequence([]).newId(), 'unavailable', 'id.sequence_exhausted');
  });
  it('I09 system entropy and sequential uniqueness', () => {
    const c = new FakeClock(new Date(tick));
    expect(version(unwrap(new V7(c).newId()))).toBe(7);
    const g = new V7(c, zeros);
    const seen = new Set<ID>();
    for (let i = 0; i < 1000; i++) {
      const v = unwrap(g.newId());
      expect(seen.has(v)).toBe(false);
      seen.add(v);
    }
    expect(seen.size).toBe(1000);
  });
});
