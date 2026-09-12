import { type ID } from '../id/index.js';
import { err, ok, type Result, type Failure } from '../errors/index.js';
import { invalid, namedActor, type Actor } from './actor.js';
import { validID } from './reference.js';
import { restoreWork, WorkContext, type WorkSnapshot } from './work.js';
export interface ScopeSnapshot {
  work: WorkSnapshot;
  scopeId: ID;
  startedAt: Date;
  executor: Actor;
  attempt: number;
  previousAttempt?: ID;
}
export function normalizedTime(t: Date): number | undefined {
  if (!(t instanceof Date)) return;
  const ms = Date.prototype.getTime.call(t);
  if (Number.isSafeInteger(ms) && ms >= 0 && ms <= 281474976710655) return ms;
}
const token = Symbol('scope');
const known = new WeakSet<object>();
export class Scope {
  readonly #work: WorkContext;
  readonly #data: Omit<ScopeSnapshot, 'work' | 'startedAt'>;
  readonly #started: number;
  constructor(
    key: typeof token,
    s: ScopeSnapshot,
    work: WorkContext,
    started: number,
  ) {
    if (key !== token) throw new TypeError('use restoreScope');
    this.#work = work;
    this.#data = Object.freeze({
      scopeId: s.scopeId,
      executor: s.executor,
      attempt: s.attempt,
      previousAttempt: s.previousAttempt,
    });
    this.#started = started;
    known.add(this);
    Object.freeze(this);
  }
  snapshot(): ScopeSnapshot {
    return {
      ...this.#data,
      work: this.#work.snapshot(),
      startedAt: new Date(this.#started),
    };
  }
  workContext(): WorkContext {
    return this.#work;
  }
}
export const validScope = (s: unknown): s is Scope =>
  typeof s === 'object' && s !== null && known.has(s);
export function restoreScope(s: ScopeSnapshot): Result<Scope, Failure> {
  if (!s || !validID(s.scopeId)) return err(invalid('invalid_scope'));
  const w = restoreWork(s.work);
  if (!w.ok) return w;
  if (!namedActor(s.executor)) return err(invalid('invalid_actor'));
  if (!Number.isInteger(s.attempt) || s.attempt < 1 || s.attempt > 4294967295)
    return err(invalid('invalid_attempt'));
  if (
    s.previousAttempt !== undefined &&
    (!validID(s.previousAttempt) ||
      s.previousAttempt === s.scopeId ||
      s.attempt === 1)
  )
    return err(invalid('invalid_scope'));
  if (s.work.causation?.kind === 'scope' && s.work.causation.id === s.scopeId)
    return err(invalid('invalid_scope'));
  const ms = normalizedTime(s.startedAt);
  if (ms === undefined) return err(invalid('invalid_time'));
  return ok(new Scope(token, s, w.value, ms));
}
