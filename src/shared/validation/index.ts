/** Safe field reports and strict scalar checks; see CONTRACT.md. */
import {
  err,
  failure,
  ok,
  type Failure,
  type Result,
} from '../errors/index.js';
const invalid = (code: string) =>
  failure('invalid', 'invalid input', { type: `validation.${code}` });

export function text(
  value: string,
  min: number,
  max: number,
  required: boolean,
): Result<void, Failure> {
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min < 0 ||
    max < min
  )
    return err(invalid('policy'));
  if (typeof value !== 'string' || /[\uD800-\uDFFF]/u.test(value))
    return err(invalid('text'));
  const n = [...value].length;
  return n < min || n > max || (required && /^[ \t\r\n]*$/.test(value))
    ? err(invalid('text'))
    : ok(undefined);
}
export function decimal(
  value: string,
  min: number,
  max: number,
): Result<number, Failure> {
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min < 0 ||
    max < min ||
    max > 2147483647
  )
    return err(invalid('policy'));
  if (
    typeof value !== 'string' ||
    value.length > 10 ||
    !/^(0|[1-9][0-9]*)$/.test(value)
  )
    return err(invalid('decimal'));
  const n = Number(value);
  return n < min || n > max ? err(invalid('decimal')) : ok(n);
}
export type Issue = Readonly<{ field: string; code: string }>;
/** Operation-local mutable builder; snapshots and failures own their field data. */
export class Report {
  #issues = new Map<string, string>();
  #truncated = false;
  add(field: string, code: string): Result<void, Failure> {
    if (
      typeof field !== 'string' ||
      typeof code !== 'string' ||
      !/^[A-Za-z0-9_.[\]-]{1,128}$/.test(field) ||
      !/^[a-z0-9_.]{1,64}$/.test(code)
    )
      return err(invalid('issue'));
    if (this.#issues.has(field)) return ok(undefined);
    if (this.#issues.size === 32) this.#truncated = true;
    else this.#issues.set(field, code);
    return ok(undefined);
  }
  issues(): Issue[] {
    return [...this.#issues].map(([field, code]) => ({ field, code }));
  }
  get truncated(): boolean {
    return this.#truncated;
  }
  result(): Result<void, Failure> {
    return this.#issues.size === 0
      ? ok(undefined)
      : err(
          failure('invalid', 'validation failed', {
            type: 'validation.failed',
            fields: Object.fromEntries(this.#issues),
          }),
        );
  }
}
