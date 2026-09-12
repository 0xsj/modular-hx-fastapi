import { err, ok, type Result, type Failure } from '../errors/index.js';
import { type ID } from '../id/index.js';
import { invalid } from './actor.js';
import { type Attribution, validAttribution } from './attribution.js';
import { type Operation, validOperation } from './operation.js';
import { type Reference, validReference, validID } from './reference.js';
export type Origin = 'request' | 'schedule' | 'replay' | 'backfill' | 'startup';
export type CorrelationSource = 'local' | 'external';
export interface ReplayInfo {
  runId: ID;
  source: Reference;
}
export interface WorkSnapshot {
  workId: ID;
  correlationId: ID;
  correlationSource: CorrelationSource;
  causation?: Reference;
  origin?: Origin;
  operation: Operation;
  attribution: Attribution;
  depth?: number;
  replay?: ReplayInfo;
}
export type DraftWork = Omit<
  WorkSnapshot,
  'workId' | 'correlationId' | 'replay'
> & {
  workId?: ID;
  correlationId?: ID;
  replay?: { runId?: ID; source: Reference };
};
export const validOrigin = (v: unknown): v is Origin =>
  ['request', 'schedule', 'replay', 'backfill', 'startup'].includes(
    v as string,
  );
export function validateWork(
  w: DraftWork,
  defaults = false,
): Failure | undefined {
  if (!w || typeof w !== 'object') return invalid('invalid_work');
  if (
    (w.workId === undefined ? !defaults : !validID(w.workId)) ||
    (w.correlationId === undefined ? !defaults : !validID(w.correlationId)) ||
    !['local', 'external'].includes(w.correlationSource)
  )
    return invalid('invalid_work');
  if (!validOperation(w.operation)) return invalid('invalid_operation');
  if (!validAttribution(w.attribution)) return invalid('invalid_attribution');
  if (w.origin !== undefined && !validOrigin(w.origin))
    return invalid('invalid_origin');
  if ((w.replay !== undefined) !== (w.origin === 'replay'))
    return invalid('invalid_origin');
  if (w.causation !== undefined) {
    if (!validReference(w.causation)) return invalid('invalid_reference');
    if (w.causation.kind === 'work' && w.causation.id === w.workId)
      return invalid('invalid_work');
  }
  if (w.depth !== undefined) {
    if (
      !Number.isInteger(w.depth) ||
      w.depth < 0 ||
      w.depth > 4294967295 ||
      (w.correlationSource === 'local' &&
        w.depth === 0 &&
        w.causation !== undefined) ||
      (w.depth > 0 && w.causation === undefined)
    )
      return invalid('invalid_depth');
  }
  if (w.replay !== undefined) {
    if (
      !w.replay ||
      !validReference(w.replay.source) ||
      (w.replay.runId === undefined ? !defaults : !validID(w.replay.runId))
    )
      return invalid('invalid_reference');
    if (w.replay.source.kind === 'work' && w.replay.source.id === w.workId)
      return invalid('invalid_work');
  }
}
export function copyWork(w: WorkSnapshot): WorkSnapshot {
  return { ...w, replay: w.replay === undefined ? undefined : { ...w.replay } };
}
const token = Symbol('work');
const known = new WeakSet<object>();
export class WorkContext {
  readonly #data: WorkSnapshot;
  constructor(key: typeof token, data: WorkSnapshot) {
    if (key !== token) throw new TypeError('use restoreWork');
    this.#data = Object.freeze({
      ...copyWork(data),
      replay:
        data.replay === undefined
          ? undefined
          : Object.freeze({ ...data.replay }),
    });
    known.add(this);
    Object.freeze(this);
  }
  snapshot(): WorkSnapshot {
    return copyWork(this.#data);
  }
}
export const validWork = (v: unknown): v is WorkContext =>
  typeof v === 'object' && v !== null && known.has(v);
export function restoreWork(w: WorkSnapshot): Result<WorkContext, Failure> {
  const e = validateWork(w);
  return e ? err(e) : ok(new WorkContext(token, w));
}
