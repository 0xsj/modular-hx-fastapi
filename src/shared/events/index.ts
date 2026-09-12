/** Owned durable envelopes; publisher receipts do not mean subscriber completion. */
import {
  err,
  failure,
  ok,
  AppError,
  type Failure,
  type Result,
} from '../errors/index.js';
import { parse, type ID } from '../id/index.js';
import * as p from '../provenance/index.js';
const invalid = () =>
  failure('invalid', 'invalid event envelope', { type: 'events.invalid' });
function value<T>(r: Result<T, Failure>): T {
  if (!r.ok) throw new AppError(r.error);
  return r.value;
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new AppError(invalid());
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  if (typeof v !== 'string') throw new AppError(invalid());
  return v;
}
function keys(v: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new AppError(invalid());
}
function actorIn(v: unknown): p.Actor | undefined {
  if (v === undefined || v === null) return undefined;
  const a = object(v);
  keys(a, ['kind', 'identity']);
  return value(
    p.actor(
      str(a.kind) as p.ActorKind,
      a.identity == null ? '' : str(a.identity),
    ),
  );
}
function refIn(v: unknown): p.Reference | undefined {
  if (v === undefined || v === null) return undefined;
  const r = object(v);
  keys(r, ['kind', 'id']);
  return value(
    p.reference(str(r.kind) as p.ReferenceKind, value(parse(str(r.id)))),
  );
}
function workIn(v: unknown): p.WorkContext {
  const w = object(v),
    a = object(w.attribution);
  const replay = w.replay == null ? undefined : object(w.replay);
  keys(w, [
    'work_id',
    'correlation_id',
    'correlation_source',
    'operation',
    'attribution',
    'causation',
    'origin',
    'depth',
    'replay',
  ]);
  keys(a, ['initiator', 'on_behalf_of', 'tenant']);
  if (replay) keys(replay, ['run_id', 'source']);
  return value(
    p.restoreWork({
      workId: value(parse(str(w.work_id))),
      correlationId: value(parse(str(w.correlation_id))),
      correlationSource: str(w.correlation_source) as p.CorrelationSource,
      operation: value(p.operation(str(w.operation))),
      attribution: value(
        p.attribution({
          initiator: actorIn(a.initiator),
          onBehalfOf: actorIn(a.on_behalf_of),
          tenant: a.tenant == null ? undefined : str(a.tenant),
        }),
      ),
      causation: refIn(w.causation),
      origin: w.origin == null ? undefined : (str(w.origin) as p.Origin),
      depth: w.depth == null ? undefined : (w.depth as number),
      replay: replay
        ? {
            runId: value(parse(str(replay.run_id))),
            source: refIn(replay.source)!,
          }
        : undefined,
    }),
  );
}
function workOut(work: p.WorkContext): unknown {
  const w = work.snapshot();
  return {
    work_id: w.workId,
    correlation_id: w.correlationId,
    correlation_source: w.correlationSource,
    operation: w.operation,
    attribution: {
      initiator: w.attribution.initiator,
      on_behalf_of: w.attribution.onBehalfOf,
      tenant: w.attribution.tenant,
    },
    causation: w.causation,
    origin: w.origin,
    depth: w.depth,
    replay: w.replay
      ? { run_id: w.replay.runId, source: w.replay.source }
      : undefined,
  };
}
export class Envelope {
  #raw: Uint8Array;
  private constructor(
    readonly id: ID,
    raw: Uint8Array,
    readonly work: p.WorkContext,
  ) {
    this.#raw = raw;
    Object.freeze(this);
  }
  bytes(): Uint8Array {
    return this.#raw.slice();
  }
  static create(
    id: ID,
    type: string,
    occurredAtMs: number,
    work: p.WorkContext,
    payload: Record<string, unknown>,
  ): Result<Envelope, Failure> {
    try {
      return Envelope.decode(
        Buffer.from(
          JSON.stringify({
            v: 1,
            id,
            type,
            occurred_at_ms: occurredAtMs,
            work: workOut(work),
            payload,
          }),
        ),
      );
    } catch {
      return err(invalid());
    }
  }
  static decode(raw: Uint8Array): Result<Envelope, Failure> {
    if (raw.byteLength > 65536) return err(invalid());
    try {
      const w = object(
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)),
      );
      if (
        Object.keys(w).length !== 6 ||
        !['v', 'id', 'type', 'occurred_at_ms', 'work', 'payload'].every((k) =>
          Object.hasOwn(w, k),
        ) ||
        w.v !== 1 ||
        typeof w.type !== 'string' ||
        w.type.length > 128 ||
        !/^[a-z0-9_.-]{1,120}\.v[1-9][0-9]{0,5}$/.test(w.type) ||
        typeof w.occurred_at_ms !== 'number' ||
        !Number.isSafeInteger(w.occurred_at_ms) ||
        w.occurred_at_ms < 0 ||
        w.occurred_at_ms > 253402300799999
      )
        return err(invalid());
      object(w.payload);
      const id = value(parse(str(w.id))),
        work = workIn(w.work);
      const normalized = Buffer.from(
        JSON.stringify({ ...w, id, work: workOut(work) }),
      );
      return normalized.byteLength > 65536
        ? err(invalid())
        : ok(new Envelope(id, Uint8Array.from(normalized), work));
    } catch {
      return err(invalid());
    }
  }
}
export type Receipt = { eventId: ID; durable: boolean };
/** Owned by the dispatcher. Adapter honors cancellation and has a finite I/O budget. */
export interface Publisher {
  publish(
    event: Envelope,
    signal?: AbortSignal,
  ): Promise<Result<Receipt, Failure>>;
}
