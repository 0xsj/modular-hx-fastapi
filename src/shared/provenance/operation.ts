import { err, ok, type Result, type Failure } from '../errors/index.js';
import { invalid } from './actor.js';
declare const operationBrand: unique symbol;
export type Operation = string & { readonly [operationBrand]: true };
export const validOperation = (s: unknown): s is Operation =>
  typeof s === 'string' && /^[a-z][a-z0-9_.:-]{0,127}$/.test(s);
export function operation(s: string): Result<Operation, Failure> {
  return validOperation(s) ? ok(s) : err(invalid('invalid_operation'));
}
