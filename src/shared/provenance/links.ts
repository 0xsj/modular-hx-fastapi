import { err, ok, type Result, type Failure } from '../errors/index.js';
import { invalid } from './actor.js';
import { validReference, type Reference } from './reference.js';
export type Relation = 'input' | 'replay_of' | 'previous_attempt';
export interface Link {
  relation: Relation;
  target: Reference;
}
const token = Symbol('links');
export class LinkSet {
  readonly #values: readonly Readonly<Link>[];
  constructor(key: typeof token, values: Link[]) {
    if (key !== token) throw new TypeError('use linkSet');
    this.#values = Object.freeze(values.map((l) => Object.freeze({ ...l })));
    Object.freeze(this);
  }
  values(): Link[] {
    return this.#values.map((l) => ({ ...l }));
  }
}
export function linkSet(input: readonly Link[]): Result<LinkSet, Failure> {
  if (!Array.isArray(input)) return err(invalid('invalid_reference'));
  if (input.length > 32) return err(invalid('too_many_links'));
  const values: Link[] = [];
  const seen = new Set<string>();
  for (const l of input) {
    if (
      !l ||
      !validReference(l.target) ||
      !['input', 'replay_of', 'previous_attempt'].includes(l.relation) ||
      (l.relation === 'previous_attempt' && l.target.kind !== 'scope')
    )
      return err(invalid('invalid_reference'));
    const key = `${l.relation}:${l.target.kind}:${l.target.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      values.push({ ...l });
    }
  }
  return ok(new LinkSet(token, values));
}
