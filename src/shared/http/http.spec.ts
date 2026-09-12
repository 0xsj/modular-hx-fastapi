import { failure, err, ok } from '../errors/index.js';
import { classifyCompletion, normalizeMethod, problemOf } from './index.js';
describe('http leaves', () => {
  it('projects safe problems and normalizes methods', () => {
    const p = problemOf(
      err(
        failure('conflict', 'taken', {
          type: 'account.taken',
          fields: { email: 'already registered' },
        }),
      ),
    );
    expect(p?.status).toBe(409);
    expect(p?.code).toBe('account.taken');
    expect(problemOf(ok(undefined))).toBeUndefined();
    expect(normalizeMethod('get')).toBe('_OTHER');
  });
  it('classifies completion', () => {
    for (const [status, outcome, spanError] of [
      [200, 'success', false],
      [409, 'refused', false],
      [500, 'failed', true],
    ] as const) {
      const r = classifyCompletion({
        status,
        termination: 'response_completed',
      });
      expect(r).toEqual({
        ok: true,
        value: {
          outcome,
          spanError,
          ...(status === 500 ? { errorType: '500' } : {}),
        },
      });
    }
    expect(classifyCompletion({ termination: 'peer_closed' })).toEqual({
      ok: true,
      value: { outcome: 'canceled', spanError: true, errorType: 'canceled' },
    });
  });
});
