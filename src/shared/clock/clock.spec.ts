import { describe, expect, it } from 'vitest';
import { FakeClock, SystemClock } from './index.js';

describe('clock contract', () => {
  it('C01 initial and stable', () => {
    const c = new FakeClock(new Date(123));
    for (let i = 0; i < 2; i++) {
      expect(c.now().getTime()).toBe(123);
      expect(c.elapsed()).toBe(0n);
    }
  });
  it('C02 advance', () => {
    const c = new FakeClock(new Date(0));
    c.advance(123);
    expect(c.now().getTime()).toBe(123);
    expect(c.elapsed()).toBe(123000000n);
    c.advance(0);
    expect(c.elapsed()).toBe(123000000n);
  });
  it('C03 wall correction', () => {
    const c = new FakeClock(new Date(0));
    c.advance(1000);
    for (const wall of [3600000, -3600000]) {
      c.set(new Date(wall));
      expect(c.now().getTime()).toBe(wall);
      expect(c.elapsed()).toBe(1000000000n);
    }
    c.advance(2000);
    expect(c.now().getTime()).toBe(-3598000);
    expect(c.elapsed()).toBe(3000000000n);
  });
  it('C04 refusal is atomic', () => {
    const c = new FakeClock(new Date(0));
    for (const d of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => c.advance(d)).toThrow(RangeError);
      expect(c.now().getTime()).toBe(0);
      expect(c.elapsed()).toBe(0n);
    }
    expect(() => new FakeClock(new Date(NaN))).toThrow(RangeError);
    expect(() => c.set(new Date(NaN))).toThrow(RangeError);
    expect(c.now().getTime()).toBe(0);
    c.set(new Date(8640000000000000));
    expect(() => c.advance(1)).toThrow(RangeError);
    expect(c.now().getTime()).toBe(8640000000000000);
    expect(c.elapsed()).toBe(0n);
  });
  it('C05 system', () => {
    const c = new SystemClock();
    const before = Date.now();
    const wall = c.now().getTime();
    const after = Date.now();
    expect(wall).toBeGreaterThanOrEqual(before);
    expect(wall).toBeLessThanOrEqual(after);
    const a = c.elapsed();
    expect(a).toBeGreaterThanOrEqual(0n);
    expect(c.elapsed()).toBeGreaterThanOrEqual(a);
  });
  it('C06 Date ownership', () => {
    const input = new Date(123);
    const c = new FakeClock(input);
    input.setTime(999);
    c.now().setTime(999);
    expect(c.now().getTime()).toBe(123);
    const next = new Date(456);
    c.set(next);
    next.setTime(999);
    expect(c.now().getTime()).toBe(456);
  });
});
