import {
  err,
  ok,
  failure,
  type Result,
  type Failure,
} from '../errors/index.js';
import { type ID } from '../id/index.js';
import { invalid, namedActor, type Actor } from './actor.js';
import { type Attribution } from './attribution.js';
import { type Operation } from './operation.js';
import {
  reference,
  validReference,
  validID,
  type Reference,
} from './reference.js';
import {
  type Origin,
  type DraftWork,
  type WorkSnapshot,
  WorkContext,
  validWork,
  restoreWork,
  validateWork,
  validOrigin,
} from './work.js';
import { Scope, validScope, restoreScope, normalizedTime } from './scope.js';
import { IncomingResult, validIncoming } from './incoming.js';
export interface WallClock {
  now(): Date;
}
export interface Generator {
  newId(): Result<ID, Failure>;
}
export interface RootSpec {
  workId?: ID;
  origin: Origin;
  operation: Operation;
  attribution: Attribution;
  executor: Actor;
}
export interface StepSpec {
  workId?: ID;
  operation: Operation;
  executor: Actor;
  cause?: Reference;
}
export interface WorkSpec {
  workId: ID;
  operation: Operation;
  cause?: Reference;
}
export interface ExecutionSpec {
  executor: Actor;
  attempt: number;
}
export interface ReplaySpec {
  source: Reference;
  runId?: ID;
  workId?: ID;
  operation: Operation;
  attribution: Attribution;
  executor: Actor;
}
const generatedError = () =>
  failure('internal', 'invalid generated provenance ID', {
    type: 'provenance.invalid_generated_id',
  });
function rootWork(s: RootSpec): Result<DraftWork, Failure> {
  if (!validOrigin(s.origin) || s.origin === 'replay')
    return err(invalid('invalid_origin'));
  if (s.workId !== undefined && !validID(s.workId))
    return err(invalid('invalid_work'));
  return ok({
    workId: s.workId,
    correlationSource: 'local',
    origin: s.origin,
    operation: s.operation,
    attribution: s.attribution,
    depth: 0,
  });
}
function childWork(
  parent: Scope,
  workId: ID | undefined,
  operation: Operation,
  cause: Reference | undefined,
): Result<DraftWork, Failure> {
  if (!validScope(parent)) return err(invalid('invalid_scope'));
  const s = parent.snapshot();
  if (workId !== undefined && (!validID(workId) || workId === s.work.workId))
    return err(invalid('invalid_work'));
  const w: DraftWork = { ...s.work, workId, operation };
  if (w.depth !== undefined) {
    if (w.depth === 4294967295) return err(invalid('depth_exhausted'));
    w.depth++;
  }
  if (cause === undefined) {
    const r = reference('scope', s.scopeId);
    if (!r.ok) return r;
    w.causation = r.value;
  } else w.causation = cause;
  const e = validateWork(w, true);
  return e ? err(e) : ok(w);
}
export function prepare(
  parent: Scope,
  s: WorkSpec,
): Result<WorkContext, Failure> {
  if (!validScope(parent)) return err(invalid('invalid_scope'));
  if (!validID(s.workId)) return err(invalid('invalid_work'));
  const w = childWork(parent, s.workId, s.operation, s.cause);
  return w.ok ? restoreWork(w.value as WorkSnapshot) : w;
}
export class Factory {
  constructor(
    private readonly clock: WallClock,
    private readonly ids: Generator,
  ) {}
  #emit(
    w: DraftWork,
    executor: Actor,
    attempt: number,
    previousAttempt?: ID,
    forbidden: readonly ID[] = [],
  ): Result<Scope, Failure> {
    if (!namedActor(executor)) return err(invalid('invalid_actor'));
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 4294967295)
      return err(invalid('invalid_attempt'));
    const e = validateWork(w, true);
    if (e) return err(e);
    const ms = normalizedTime(this.clock.now());
    if (ms === undefined) return err(invalid('invalid_time'));
    const next = this.ids.newId();
    if (!next.ok) return next;
    const scopeId = next.value;
    if (!validID(scopeId) || forbidden.includes(scopeId))
      return err(generatedError());
    const work: WorkSnapshot = {
      ...w,
      workId: w.workId ?? scopeId,
      correlationId: w.correlationId ?? scopeId,
      replay:
        w.replay === undefined
          ? undefined
          : { ...w.replay, runId: w.replay.runId ?? scopeId },
    };
    const r = restoreScope({
      work,
      scopeId,
      startedAt: new Date(ms),
      executor,
      attempt,
      previousAttempt,
    });
    return r.ok ? r : err(generatedError());
  }
  open(s: RootSpec): Result<Scope, Failure> {
    const w = rootWork(s);
    return w.ok ? this.#emit(w.value, s.executor, 1) : w;
  }
  child(parent: Scope, s: StepSpec): Result<Scope, Failure> {
    const w = childWork(parent, s.workId, s.operation, s.cause);
    if (!w.ok) return w;
    const forbidden = [parent.snapshot().scopeId];
    if (s.workId === undefined) forbidden.push(parent.snapshot().work.workId);
    return this.#emit(w.value, s.executor, 1, undefined, forbidden);
  }
  execute(work: WorkContext, s: ExecutionSpec): Result<Scope, Failure> {
    return validWork(work)
      ? this.#emit(work.snapshot(), s.executor, s.attempt)
      : err(invalid('invalid_work'));
  }
  retry(previous: Scope, executor: Actor): Result<Scope, Failure> {
    if (!validScope(previous)) return err(invalid('invalid_scope'));
    const s = previous.snapshot();
    if (s.attempt === 4294967295) return err(invalid('attempt_exhausted'));
    return this.#emit(s.work, executor, s.attempt + 1, s.scopeId, [s.scopeId]);
  }
  replay(s: ReplaySpec): Result<Scope, Failure> {
    if (
      !validReference(s.source) ||
      (s.runId !== undefined && !validID(s.runId))
    )
      return err(invalid('invalid_reference'));
    if (
      s.workId !== undefined &&
      (!validID(s.workId) ||
        (s.source.kind === 'work' && s.source.id === s.workId))
    )
      return err(invalid('invalid_work'));
    return this.#emit(
      {
        workId: s.workId,
        correlationSource: 'local',
        origin: 'replay',
        depth: 0,
        operation: s.operation,
        attribution: s.attribution,
        replay: { runId: s.runId, source: s.source },
      },
      s.executor,
      1,
      undefined,
      s.source.kind === 'scope' ? [s.source.id] : [],
    );
  }
  enter(s: RootSpec, i: IncomingResult): Result<Scope, Failure> {
    if (!validIncoming(i)) return err(invalid('invalid_incoming_result'));
    const w = rootWork(s);
    if (!w.ok) return w;
    if (i.decision === 'continued') {
      w.value.correlationId = i.correlation;
      w.value.correlationSource = 'external';
      w.value.causation = i.cause;
      w.value.origin = undefined;
      w.value.depth = undefined;
    }
    return this.#emit(w.value, s.executor, 1);
  }
}
