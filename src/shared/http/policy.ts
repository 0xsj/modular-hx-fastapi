import {
  err,
  ok,
  type Result,
  failure,
  type Failure,
  parseKind,
  type Kind,
} from '../errors/index.js';
import type { Outcome } from '../telemetry/index.js';
export type { Outcome } from '../telemetry/index.js';
export type Termination =
  | 'response_completed'
  | 'peer_closed'
  | 'deadline'
  | 'handler_error'
  | 'write_error'
  | 'abandoned';
export type CompletionFacts = Readonly<{
  status?: number;
  failureKind?: Kind;
  termination: Termination;
}>;
export type Classification = Readonly<{
  outcome: Outcome;
  spanError: boolean;
  errorType?: string;
}>;
export function normalizeMethod(value: string): string {
  return [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'DELETE',
    'CONNECT',
    'OPTIONS',
    'TRACE',
    'PATCH',
  ].includes(value)
    ? value
    : '_OTHER';
}
export function classifyCompletion(
  f: CompletionFacts,
): Result<Classification, Failure> {
  const invalid = () =>
    err(
      failure('invalid', 'invalid HTTP completion', {
        type: 'http.invalid_completion',
      }),
    );
  if (!f || typeof f !== 'object') return invalid();
  if (
    f.status !== undefined &&
    (!Number.isInteger(f.status) || f.status < 200 || f.status > 599)
  )
    return invalid();
  if (f.failureKind !== undefined && parseKind(f.failureKind) === undefined)
    return invalid();
  if (f.termination === 'response_completed' && f.status === undefined)
    return invalid();
  let outcome: Outcome;
  let errorType: string | undefined;
  switch (f.termination) {
    case 'peer_closed':
      outcome = 'canceled';
      errorType = 'canceled';
      break;
    case 'deadline':
      outcome = 'timed_out';
      errorType = 'timeout';
      break;
    case 'handler_error':
    case 'write_error':
    case 'abandoned':
      outcome = 'failed';
      errorType = f.termination;
      break;
    case 'response_completed':
      if (f.failureKind === 'timeout') {
        outcome = 'timed_out';
        errorType = 'timeout';
      } else if (f.failureKind === 'canceled') {
        outcome = 'canceled';
        errorType = 'canceled';
      } else if (
        f.failureKind === 'internal' ||
        f.failureKind === 'unavailable'
      )
        outcome = 'failed';
      else if (f.failureKind !== undefined) outcome = 'refused';
      else
        outcome =
          f.status! >= 500
            ? 'failed'
            : f.status! >= 400
              ? 'refused'
              : 'success';
      break;
    default:
      return invalid();
  }
  const spanError =
    f.termination !== 'response_completed' ||
    (f.status !== undefined && f.status >= 500) ||
    ['failed', 'canceled', 'timed_out'].includes(outcome);
  if (errorType === undefined && spanError)
    errorType =
      f.status !== undefined && f.status >= 500
        ? String(f.status)
        : 'handler_error';
  return ok(
    Object.freeze({
      outcome,
      spanError,
      ...(errorType === undefined ? {} : { errorType }),
    }),
  );
}
