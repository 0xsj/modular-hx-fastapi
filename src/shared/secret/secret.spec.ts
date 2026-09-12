import { describe, it, expect, expectTypeOf } from 'vitest';
import { inspect } from 'node:util';
import { SecretString } from './index.js';

describe('secret contract', () => {
  it('S01 S02 S03 S07 preserves input and redacts conversions', () => {
    for (const raw of ['', ' credential-SENTINEL ', '\n\0秘密']) {
      const value = new SecretString(raw);
      expect(value.reveal()).toBe(raw);
      expect(value.reveal()).toBe(raw);
      expect(String(value)).toBe('[REDACTED]');
      expect(`${value}`).toBe('[REDACTED]');
      expect(inspect(value)).toBe('[REDACTED]');
    }
  });
  it('S04 S05 S06 preserves public fields through JSON and inspection', () => {
    const secret = new SecretString('credential-SENTINEL');
    const record = { secret, public: 'visible' };
    expect(JSON.stringify(secret)).toBe('"[REDACTED]"');
    expect(JSON.stringify(record)).toBe(
      '{"secret":"[REDACTED]","public":"visible"}',
    );
    expect(inspect(record)).toContain('visible');
    expect(inspect(record)).toContain('[REDACTED]');
    expect(inspect(record)).not.toContain('credential-SENTINEL');
    expect(
      inspect(secret, { customInspect: false, showHidden: true }),
    ).not.toContain('credential-SENTINEL');
  });
  it('S08 S09 keeps private storage and absence distinct', () => {
    const secret = new SecretString('credential-SENTINEL');
    expect(Object.values(secret)).not.toContain('credential-SENTINEL');
    expect(JSON.stringify(null)).toBe('null');
    expect(JSON.stringify(new SecretString(''))).toBe('"[REDACTED]"');
    expectTypeOf<SecretString>().not.toMatchTypeOf<string>();
  });
  it('S10 rejects runtime misuse without coercion', () => {
    const hostile = {
      toString() {
        throw new Error('credential-SENTINEL');
      },
    };
    for (const value of [null, undefined, 123, hostile]) {
      expect(() => new SecretString(value as unknown as string)).toThrow(
        'secret requires a string',
      );
    }
  });
});
