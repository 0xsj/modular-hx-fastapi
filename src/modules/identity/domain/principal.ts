/** Principal values and lifecycle; see CONTRACT.md. */
import {
  err,
  ok,
  failure,
  type Result,
  type Failure,
} from '../../../shared/errors/index.js';
import { parse, type ID } from '../../../shared/id/index.js';
import { text } from '../../../shared/validation/index.js';
export type Kind = 'human' | 'service';
export type Status = 'active' | 'suspended';
export type Snapshot = {
  id: ID;
  kind: Kind;
  displayName: string;
  status: Status;
  createdAtMs: number;
  updatedAtMs: number;
  version: number;
};
const invalid = () =>
  failure('invalid', 'invalid principal', {
    type: 'identity.principal_invalid',
  });
export class Principal {
  readonly #state: Readonly<Snapshot>;
  private constructor(state: Snapshot) {
    this.#state = Object.freeze({ ...state });
  }
  static register(
    id: ID,
    kind: Kind,
    displayName: string,
    at: number,
  ): Result<Principal, Failure> {
    return Principal.restore({
      id,
      kind,
      displayName,
      status: 'active',
      createdAtMs: at,
      updatedAtMs: at,
      version: 1,
    });
  }
  static restore(s: Snapshot): Result<Principal, Failure> {
    if (
      !s ||
      !parse(s.id).ok ||
      !['human', 'service'].includes(s.kind) ||
      !['active', 'suspended'].includes(s.status) ||
      !Number.isSafeInteger(s.createdAtMs) ||
      !Number.isSafeInteger(s.updatedAtMs) ||
      s.createdAtMs < 0 ||
      s.updatedAtMs < s.createdAtMs ||
      s.updatedAtMs > 253402300799999 ||
      !Number.isSafeInteger(s.version) ||
      s.version < 1 ||
      s.version > 2147483647 ||
      !text(s.displayName, 1, 100, true).ok ||
      [...s.displayName].some(
        (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
      )
    )
      return err(invalid());
    const normalized = parse(s.id);
    if (!normalized.ok) return err(invalid());
    return ok(new Principal({ ...s, id: normalized.value }));
  }
  snapshot(): Snapshot {
    return { ...this.#state };
  }
  private transition(
    status: Status,
    expected: number,
    at: number,
  ): Result<Principal, Failure> {
    if (!Principal.restore(this.#state).ok) return err(invalid());
    if (expected !== this.#state.version)
      return err(
        failure('conflict', 'principal transition refused', {
          type: 'identity.version_conflict',
        }),
      );
    if (status === this.#state.status)
      return err(
        failure('conflict', 'principal transition refused', {
          type: 'identity.state_conflict',
        }),
      );
    if (
      !Number.isSafeInteger(at) ||
      at < this.#state.updatedAtMs ||
      at > 253402300799999
    )
      return err(invalid());
    if (this.#state.version === 2147483647)
      return err(
        failure('conflict', 'principal transition refused', {
          type: 'identity.version_exhausted',
        }),
      );
    return ok(
      new Principal({
        ...this.#state,
        status,
        version: this.#state.version + 1,
        updatedAtMs: at,
      }),
    );
  }
  suspend(expected: number, at: number): Result<Principal, Failure> {
    return this.transition('suspended', expected, at);
  }
  activate(expected: number, at: number): Result<Principal, Failure> {
    return this.transition('active', expected, at);
  }
}
