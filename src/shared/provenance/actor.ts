import {
  failure,
  err,
  ok,
  type Result,
  type Failure,
} from '../errors/index.js';
export const invalid = (code: string): Failure =>
  failure('invalid', 'invalid provenance', { type: `provenance.${code}` });
export type ActorKind = 'anonymous' | 'user' | 'service' | 'system';
export interface Actor {
  readonly kind: ActorKind;
  readonly identity?: string;
}
const actors = new WeakSet<object>();
export const identityValid = (s: unknown): s is string =>
  typeof s === 'string' && /^[A-Za-z0-9._:/-]{1,128}$/.test(s);
export function actor(
  kind: ActorKind,
  identity: string,
): Result<Actor, Failure> {
  if (
    (kind === 'anonymous' && identity !== '') ||
    (kind !== 'anonymous' &&
      (!['user', 'service', 'system'].includes(kind) ||
        !identityValid(identity)))
  )
    return err(invalid('invalid_actor'));
  const a = Object.freeze(kind === 'anonymous' ? { kind } : { kind, identity });
  actors.add(a);
  return ok(a);
}
export function anonymous(): Actor {
  const a: Actor = Object.freeze({ kind: 'anonymous' });
  actors.add(a);
  return a;
}
export const validActor = (a: unknown): a is Actor =>
  typeof a === 'object' && a !== null && actors.has(a);
export const namedActor = (a: unknown): a is Actor =>
  validActor(a) && a.kind !== 'anonymous';
