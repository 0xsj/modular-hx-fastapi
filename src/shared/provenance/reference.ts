import { parse, type ID } from '../id/index.js';
import { err, ok, type Result, type Failure } from '../errors/index.js';
import { invalid } from './actor.js';
export type ReferenceKind = 'scope' | 'work' | 'event';
export interface Reference {
  readonly kind: ReferenceKind;
  readonly id: ID;
}
const known = new WeakSet<object>();
export function validID(value: unknown): value is ID {
  const r = parse(value);
  return r.ok && r.value === value;
}
export const validReferenceKind = (k: unknown): k is ReferenceKind =>
  k === 'scope' || k === 'work' || k === 'event';
export function reference(
  kind: ReferenceKind,
  id: ID,
): Result<Reference, Failure> {
  if (!validReferenceKind(kind) || !validID(id))
    return err(invalid('invalid_reference'));
  const r = Object.freeze({ kind, id });
  known.add(r);
  return ok(r);
}
export const validReference = (r: unknown): r is Reference =>
  typeof r === 'object' && r !== null && known.has(r);
