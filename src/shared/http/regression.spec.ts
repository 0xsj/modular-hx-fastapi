import { describe, it, expect } from 'vitest';
import { ok, err, failure } from '../errors/index.js';
import {
  problemOf,
  classifyCompletion,
  type CompletionFacts,
} from './index.js';
describe('HTTP contract regressions', () => {
  it('preserves Result presence including thrown undefined/null', () => {
    expect(problemOf(ok(undefined))).toBeUndefined();
    expect(problemOf(err(failure('conflict', 'taken')))?.status).toBe(409);
    for (const caught of [undefined, null, new Error('private')])
      expect(problemOf(err(caught))).toMatchObject({
        status: 500,
        detail: 'internal error',
      });
  });
  it('keeps actual 5xx and bounded error classifications', () => {
    for (const [status, failureKind, errorType] of [
      [503, 'conflict', '503'],
      [500, 'internal', '500'],
      [503, 'unavailable', '503'],
      [200, 'internal', 'handler_error'],
      [503, 'timeout', 'timeout'],
    ] as const) {
      expect(
        classifyCompletion({
          status,
          failureKind,
          termination: 'response_completed',
        }),
      ).toMatchObject({ ok: true, value: { spanError: true, errorType } });
    }
  });
  it('refuses invalid failure kinds and completion facts', () => {
    for (const failureKind of ['bogus', '', 255, null]) {
      expect(
        classifyCompletion({
          status: 200,
          termination: 'response_completed',
          failureKind,
        } as CompletionFacts),
      ).toMatchObject({
        ok: false,
        error: { type: 'http.invalid_completion' },
      });
    }
  });
});
