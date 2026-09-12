import { parse, type ID } from '../id/index.js';
import { reference, validReferenceKind, type Reference } from './reference.js';
export interface IncomingHints {
  correlation?: string;
  causation?: { kind: string; id: string };
}
export type Disposition = 'fresh' | 'continued' | 'restarted';
export interface Issue {
  field: 'correlation' | 'causation';
  reason: 'invalid_id' | 'invalid_kind' | 'missing_correlation';
}
const token = Symbol('incoming');
const known = new WeakSet<object>();
export class IncomingResult {
  readonly #issues: readonly Readonly<Issue>[];
  constructor(
    key: typeof token,
    readonly decision: Disposition,
    readonly correlation: ID | undefined,
    readonly cause: Reference | undefined,
    issues: Issue[],
  ) {
    if (key !== token) throw new TypeError('use inspectIncoming');
    this.#issues = Object.freeze(issues.map((i) => Object.freeze({ ...i })));
    known.add(this);
    Object.freeze(this);
  }
  issues(): Issue[] {
    return this.#issues.map((i) => ({ ...i }));
  }
}
export const validIncoming = (i: unknown): i is IncomingResult =>
  typeof i === 'object' && i !== null && known.has(i);
export function inspectIncoming(h: IncomingHints): IncomingResult {
  let decision: Disposition = 'fresh';
  let correlation: ID | undefined;
  let cause: Reference | undefined;
  const issues: Issue[] = [];
  if (h.correlation === undefined && h.causation === undefined)
    return new IncomingResult(token, decision, correlation, cause, issues);
  decision = 'restarted';
  if (h.correlation !== undefined) {
    const r = parse(h.correlation);
    if (r.ok) {
      correlation = r.value;
      decision = 'continued';
    } else issues.push({ field: 'correlation', reason: 'invalid_id' });
  }
  if (h.causation !== undefined) {
    const c = h.causation;
    if (!c || !validReferenceKind(c.kind))
      issues.push({ field: 'causation', reason: 'invalid_kind' });
    else {
      const r = parse(c.id);
      if (!r.ok) issues.push({ field: 'causation', reason: 'invalid_id' });
      else if (correlation === undefined)
        issues.push({ field: 'causation', reason: 'missing_correlation' });
      else {
        const ref = reference(c.kind, r.value);
        if (ref.ok) cause = ref.value;
      }
    }
  }
  return new IncomingResult(token, decision, correlation, cause, issues);
}
