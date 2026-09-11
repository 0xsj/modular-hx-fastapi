import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AppError,
  KINDS,
  causeOf,
  detailsOf,
  err,
  failure,
  fromCaught,
  kindOf,
  mapError,
  ok,
  parseKind,
  publicInfo,
  withCause,
  withDetails,
  withFields,
} from './index.js';
import type { Failure } from './index.js';

const internal = { kind: 'internal', message: 'internal error' };

describe('errors specification', () => {
  it('E01: has the ten stable kind names and rejects unknown names', () => {
    const names = [
      'internal',
      'invalid',
      'not_found',
      'conflict',
      'unauthenticated',
      'forbidden',
      'rate_limited',
      'unavailable',
      'timeout',
      'canceled',
    ];
    expect(KINDS).toHaveLength(names.length);
    expect(new Set(KINDS)).toEqual(new Set(names));
    for (const name of names) expect(parseKind(name)).toBe(name);
    for (const unknown of ['', 'INTERNAL', 'not-found', 'other', null, 1])
      expect(parseKind(unknown)).toBeUndefined();
    expect(Object.isFrozen(KINDS)).toBe(true);
  });

  it('E02: constructs deliberate public data and preserves a literal case', () => {
    const e = failure('invalid', 'email is required', {
      type: 'account.email_required',
      fields: { email: 'required' },
    });
    expect(kindOf(e)).toBe('invalid');
    expect(publicInfo(e)).toEqual({
      kind: 'invalid',
      message: 'email is required',
      type: 'account.email_required',
      fields: { email: 'required' },
    });
    expectTypeOf(e.kind).toEqualTypeOf<'invalid'>();
    expectTypeOf(e.type).toEqualTypeOf<'account.email_required' | undefined>();
    expect(publicInfo(failure('conflict', '')).message).toBe('request failed');
  });

  it('E03: preserves success and keeps unknown distinct from Internal', () => {
    const result = ok(42);
    const mapped = mapError(result, () => {
      throw new Error('success entered error branch');
    });
    expect(mapped).toEqual({ ok: true, value: 42 });
    for (const value of [
      null,
      undefined,
      new Error('PRIVATE'),
      { kind: 'internal', message: 'PRIVATE' },
    ])
      expect(kindOf(value)).toBeUndefined();
    expect(kindOf(failure('internal', 'unexpected'))).toBe('internal');
    const condition = failure('conflict', 'email taken', {
      type: 'account.email_taken',
    });
    const failed = mapError(err(condition), (e) =>
      withDetails(e, { operation: 'register' }),
    );
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(detailsOf(failed.error)).toEqual({ operation: 'register' });
      expectTypeOf(failed.error.kind).toEqualTypeOf<'conflict'>();
    }
  });

  it('E04: projects only explicitly public information', () => {
    const secret = failure('internal', 'PRIVATE message', {
      type: 'PRIVATE.type',
      fields: { PRIVATE: 'field' },
      details: { sql: 'PRIVATE SQL' },
      cause: new Error('PRIVATE cause'),
    });
    for (const value of [
      secret,
      new Error('PRIVATE'),
      { kind: 'invalid', message: 'PRIVATE' },
    ])
      expect(publicInfo(value)).toEqual(internal);
    expect(detailsOf(secret)).toEqual({ sql: 'PRIVATE SQL' });
    for (const kind of KINDS.filter((k) => k !== 'internal')) {
      expect(
        publicInfo(
          failure(kind, 'safe message', {
            type: 'module.condition',
            fields: { input: 'problem' },
          }),
        ),
      ).toEqual({
        kind,
        message: 'safe message',
        type: 'module.condition',
        fields: { input: 'problem' },
      });
    }
    expect(JSON.stringify(publicInfo(secret))).not.toContain('PRIVATE');
  });

  it('E05: isolates input, derived and projected metadata at runtime', () => {
    const fields = { email: 'required' },
      details = { operation: 'insert' };
    const base = failure('invalid', 'invalid input', { fields, details });
    fields.email = 'MUTATED';
    details.operation = 'MUTATED';
    expect(publicInfo(base).fields).toEqual({ email: 'required' });
    expect(detailsOf(base)).toEqual({ operation: 'insert' });
    const derived = withDetails(withFields(base, { email: 'malformed' }), {
      operation: 'register',
    });
    const view = publicInfo(derived),
      diagnostic = detailsOf(derived);
    expect(view.fields).toEqual({ email: 'malformed' });
    if (!view.fields) throw new Error('missing fields');
    view.fields.email = 'MUTATED';
    diagnostic.operation = 'MUTATED';
    expect(publicInfo(derived).fields).toEqual({ email: 'malformed' });
    expect(detailsOf(derived)).toEqual({ operation: 'register' });
    expect(publicInfo(base).fields).toEqual({ email: 'required' });
    expect(detailsOf(base)).toEqual({ operation: 'insert' });
    expect(Object.isFrozen(base)).toBe(true);
    expect(Object.isFrozen(base.fields)).toBe(true);
  });

  it('E06: preserves the local condition and cause through enrichment', () => {
    const cause = new Error('PRIVATE database detail');
    const condition = failure('conflict', 'email taken', {
      type: 'account.email_taken',
    });
    const occurrence = withCause(condition, cause);
    const annotated = withDetails(occurrence, { operation: 'register' });
    expect(publicInfo(annotated)).toEqual(publicInfo(condition));
    expect(kindOf(annotated)).toBe('conflict');
    expectTypeOf(annotated.type).toEqualTypeOf<
      'account.email_taken' | undefined
    >();
    expect(causeOf(annotated)).toBe(cause);
    expect(causeOf(condition)).toBeUndefined();
    expect(detailsOf(condition)).toEqual({});
  });

  it('E07: translation owns its whole projection and retains the cause', () => {
    const inner = failure('conflict', 'inner', {
      type: 'inner.type',
      fields: { inner: 'field' },
      details: { inner: 'detail' },
    });
    const outer = withCause(failure('unavailable', 'try later'), inner);
    expect(publicInfo(outer)).toEqual({
      kind: 'unavailable',
      message: 'try later',
    });
    expect(detailsOf(outer)).toEqual({});
    expect(causeOf(outer)).toBe(inner);
    const replacement = new Error('replacement');
    expect(causeOf(withCause(outer, replacement))).toBe(replacement);
    expect(causeOf(outer)).toBe(inner);
  });

  it('E08: preserves classified cancellation/deadline without inferring from text', () => {
    for (const kind of ['timeout', 'canceled'] as const) {
      expect(
        kindOf(
          withDetails(failure(kind, 'operation stopped'), {
            operation: 'register',
          }),
        ),
      ).toBe(kind);
    }
    const foreign = new Error('context canceled');
    foreign.name = 'TimeoutError';
    expect(kindOf(foreign)).toBeUndefined();
    expect(kindOf(fromCaught(foreign))).toBe('internal');
  });

  it('E09: aggregate order never selects a branch as the summary', () => {
    const known = failure('unavailable', 'try later', {
      type: 'dependency.offline',
    });
    const unknown = new Error('PRIVATE unknown');
    for (const items of [
      [known, unknown],
      [unknown, known],
    ]) {
      const aggregate = new AggregateError(items, 'PRIVATE aggregate');
      expect(kindOf(aggregate)).toBeUndefined();
      expect(publicInfo(aggregate)).toEqual(internal);
      const summary = withCause(
        failure('unavailable', 'batch interrupted'),
        aggregate,
      );
      expect(kindOf(summary)).toBe('unavailable');
      expect(causeOf(summary)).toBe(aggregate);
      expect(aggregate.errors).toEqual(items);
    }
  });

  it('JS01: normalizes caught nullish, primitive and hostile values as real failures', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('getter');
        },
        getPrototypeOf() {
          throw new Error('prototype');
        },
      },
    );
    for (const value of [null, undefined, 'PRIVATE', 42, hostile]) {
      const normalized = fromCaught(value);
      expect(kindOf(normalized)).toBe('internal');
      expect(publicInfo(normalized)).toEqual(internal);
      expect(causeOf(normalized) === value).toBe(true);
    }
  });

  it('JS02: recognizes only genuine carriers and retains their trusted failure', () => {
    const cause = new Error('PRIVATE cause');
    const condition = failure('conflict', 'email taken', {
      type: 'account.email_taken',
      cause,
    });
    const carrier = new AppError(condition);
    expect(fromCaught(condition)).toBe(condition);
    expect(fromCaught(carrier)).toBe(condition);
    expect(kindOf(carrier)).toBe('conflict');
    expect(causeOf(carrier)).toBe(cause);
    Object.defineProperty(carrier, 'failure', {
      get() {
        throw new Error('foreign getter');
      },
    });
    expect(fromCaught(carrier)).toBe(condition);
    expect(kindOf(Object.create(AppError.prototype))).toBeUndefined();
    expect(
      () => new AppError({ kind: 'invalid', message: 'untrusted' } as Failure),
    ).toThrow(TypeError);
  });
});

it('E10: merges metadata and preserves meaning while replacing the source', () => {
  const first = new Error('PRIVATE first');
  const second = new Error('PRIVATE second');
  const base = failure('invalid', 'invalid input', {
    type: 'account.invalid',
    fields: { email: 'required', name: 'required' },
    details: { operation: 'insert', attempt: '1' },
    cause: first,
  });
  const derived = withCause(
    withDetails(withFields(base, { email: 'malformed', age: 'positive' }), {
      operation: 'register',
      worker: 'signup',
    }),
    second,
  );
  expect(publicInfo(derived)).toEqual({
    kind: 'invalid',
    message: 'invalid input',
    type: 'account.invalid',
    fields: { email: 'malformed', name: 'required', age: 'positive' },
  });
  expect(detailsOf(derived)).toEqual({
    operation: 'register',
    attempt: '1',
    worker: 'signup',
  });
  expect(causeOf(derived)).toBe(second);
  expect(causeOf(base)).toBe(first);
  expect(publicInfo(base).fields).toEqual({
    email: 'required',
    name: 'required',
  });
  expect(detailsOf(base)).toEqual({ operation: 'insert', attempt: '1' });
  expectTypeOf(derived.kind).toEqualTypeOf<'invalid'>();
  expectTypeOf(derived.type).toEqualTypeOf<'account.invalid' | undefined>();
  const emptyType = withDetails(failure('conflict', '', { type: '' }), {
    operation: 'register',
  });
  expect(publicInfo(emptyType)).toEqual({
    kind: 'conflict',
    message: 'request failed',
  });
});
