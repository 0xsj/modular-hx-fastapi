import { err, ok, type Result, type Failure } from '../errors/index.js';
import {
  invalid,
  identityValid,
  validActor,
  namedActor,
  type Actor,
} from './actor.js';
export interface AttributionSpec {
  initiator?: Actor;
  onBehalfOf?: Actor;
  tenant?: string;
}
export type Attribution = Readonly<AttributionSpec>;
const known = new WeakSet<object>();
export function attribution(
  s: AttributionSpec = {},
): Result<Attribution, Failure> {
  if (s.initiator !== undefined && !validActor(s.initiator))
    return err(invalid('invalid_attribution'));
  if (
    s.onBehalfOf !== undefined &&
    (!namedActor(s.initiator) ||
      !namedActor(s.onBehalfOf) ||
      (s.initiator.kind === s.onBehalfOf.kind &&
        s.initiator.identity === s.onBehalfOf.identity))
  )
    return err(invalid('invalid_attribution'));
  if (s.tenant !== undefined && !identityValid(s.tenant))
    return err(invalid('invalid_attribution'));
  const a = Object.freeze({
    initiator: s.initiator,
    onBehalfOf: s.onBehalfOf,
    tenant: s.tenant,
  });
  known.add(a);
  return ok(a);
}
export const validAttribution = (a: unknown): a is Attribution =>
  typeof a === 'object' && a !== null && known.has(a);
