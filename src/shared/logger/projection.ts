import {
  causeOf,
  fromCaught,
  kindOf,
  publicInfo,
  type Result,
  type Failure,
  ok,
  err,
} from '../errors/index.js';
import { type Scope } from '../provenance/index.js';
import { validScope } from '../provenance/scope.js';
import { invalid } from './config.js';
export function errorProjection(
  error: unknown,
): Record<string, unknown> | undefined {
  if (error === undefined || error === null) return;
  const kind = kindOf(error);
  const selected = kind === undefined ? undefined : fromCaught(error);
  return {
    classified: kind !== undefined,
    kind: kind ?? 'internal',
    ...(selected?.type ? { type: selected.type } : {}),
    public: publicInfo(error),
    has_cause: causeOf(error) !== undefined,
  };
}
export function scopeProjection(
  scope: Scope,
): Result<Record<string, unknown>, Failure> {
  if (!validScope(scope)) return err(invalid());
  const s = scope.snapshot();
  const w = s.work;
  return ok({
    scope_id: s.scopeId,
    work_id: w.workId,
    correlation_id: w.correlationId,
    correlation_source: w.correlationSource,
    operation: w.operation,
    started_at_ms: s.startedAt.getTime(),
    executor: s.executor,
    attempt: s.attempt,
    attribution: {
      ...(w.attribution.initiator
        ? { initiator: w.attribution.initiator }
        : {}),
      ...(w.attribution.onBehalfOf
        ? { on_behalf_of: w.attribution.onBehalfOf }
        : {}),
      ...(w.attribution.tenant ? { tenant: w.attribution.tenant } : {}),
    },
    ...(w.origin === undefined ? {} : { origin: w.origin }),
    ...(w.depth === undefined ? {} : { depth: w.depth }),
    ...(w.causation === undefined ? {} : { causation: w.causation }),
    ...(s.previousAttempt === undefined
      ? {}
      : { previous_attempt: s.previousAttempt }),
    ...(w.replay === undefined
      ? {}
      : { replay: { run_id: w.replay.runId, source: w.replay.source } }),
  });
}
