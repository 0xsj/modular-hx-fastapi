import {
  err,
  ok,
  failure,
  type Result,
  type Failure,
} from '../errors/index.js';
import { SecretString } from '../secret/index.js';
import { type Lookup } from './lookup.js';
import { integer, validKey } from './parse.js';
export interface Var {
  key: string;
  value: string;
  source: 'environment' | 'default';
  secret: boolean;
}
export class Reader {
  readonly #seen = new Set<string>();
  readonly #problems = new Map<string, string>();
  readonly #resolved: Var[] = [];
  constructor(private readonly lookup: Lookup) {}
  #problem(key: string, why: string) {
    this.#problems.set(validKey(key) ? key : '<key>', why);
  }
  #read(
    key: string,
  ): { valid: true; value: string | undefined } | { valid: false } {
    if (!validKey(key)) {
      this.#problem(key, 'invalid_key');
      return { valid: false };
    }
    if (this.#seen.has(key)) {
      this.#problem(key, 'duplicate_key');
      return { valid: false };
    }
    this.#seen.add(key);
    const value = this.lookup(key);
    if (value !== undefined && typeof value !== 'string') {
      this.#problem(key, 'invalid_source');
      return { valid: false };
    }
    return { valid: true, value };
  }
  #record(key: string, value: string, present: boolean, secret = false) {
    this.#resolved.push({
      key,
      value: secret ? '[REDACTED]' : value,
      source: present ? 'environment' : 'default',
      secret,
    });
  }
  string(key: string, fallback: string): string {
    const r = this.#read(key);
    if (!r.valid) return '';
    const v = r.value ?? fallback;
    this.#record(key, v, r.value !== undefined);
    return v;
  }
  required(key: string): string {
    const r = this.#read(key);
    if (!r.valid) return '';
    if (r.value === undefined || r.value === '') {
      this.#problem(key, 'required');
      return '';
    }
    this.#record(key, r.value, true);
    return r.value;
  }
  secret(key: string): SecretString {
    const r = this.#read(key);
    if (!r.valid) return new SecretString('');
    if (r.value === undefined || r.value === '') {
      this.#problem(key, 'required');
      return new SecretString('');
    }
    this.#record(key, r.value, true, true);
    return new SecretString(r.value);
  }
  int(key: string, fallback: number, min: number, max: number): number {
    if (
      ![fallback, min, max].every(Number.isSafeInteger) ||
      min > max ||
      fallback < min ||
      fallback > max
    ) {
      this.#problem(key, 'invalid_definition');
      return 0;
    }
    const r = this.#read(key);
    if (!r.valid) return 0;
    const v = r.value === undefined ? fallback : integer(r.value);
    if (v === undefined) {
      this.#problem(key, 'invalid_integer');
      return 0;
    }
    if (v < min || v > max) {
      this.#problem(key, 'out_of_range');
      return 0;
    }
    this.#record(key, String(v), r.value !== undefined);
    return v;
  }
  boolean(key: string, fallback: boolean): boolean {
    const r = this.#read(key);
    if (!r.valid) return false;
    let v = fallback;
    if (r.value !== undefined) {
      if (r.value !== 'true' && r.value !== 'false') {
        this.#problem(key, 'invalid_boolean');
        return false;
      }
      v = r.value === 'true';
    }
    this.#record(key, String(v), r.value !== undefined);
    return v;
  }
  enumeration(
    key: string,
    fallback: string,
    allowed: readonly string[],
  ): string {
    const choices = new Set(allowed);
    if (
      choices.size !== allowed.length ||
      choices.has('') ||
      !choices.has(fallback)
    ) {
      this.#problem(key, 'invalid_definition');
      return '';
    }
    const r = this.#read(key);
    if (!r.valid) return '';
    const v = r.value ?? fallback;
    if (!choices.has(v)) {
      this.#problem(key, 'invalid_choice');
      return '';
    }
    this.#record(key, v, r.value !== undefined);
    return v;
  }
  check(): Result<void, Failure> {
    return this.#problems.size
      ? err(
          failure('invalid', 'invalid configuration', {
            type: 'env.invalid',
            fields: Object.fromEntries(this.#problems),
          }),
        )
      : ok(undefined);
  }
  manifest(): Result<Var[], Failure> {
    const r = this.check();
    return r.ok
      ? ok(
          this.#resolved
            .map((v) => ({ ...v }))
            .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
        )
      : r;
  }
}
