import { authPending } from './auth-spec-stub.js';
import type { ID } from '../../../shared/id/index.js';
export class AuthState {
  readonly #principalId: ID;
  readonly #epoch: number;
  private constructor(principalId: ID, epoch: number) {
    this.#principalId = principalId;
    this.#epoch = epoch;
  }
  static create(_principalId: ID, _epoch: number) {
    return authPending<AuthState>();
  }
  principalId(): ID {
    return this.#principalId;
  }
  epoch(): number {
    return this.#epoch;
  }
  invalidate(_expected: number) {
    return authPending<AuthState>();
  }
}
