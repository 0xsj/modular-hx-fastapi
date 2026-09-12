import { authPending } from './auth-spec-stub.js';
import type { ID } from '../../../shared/id/index.js';
import type { TokenDigest } from './token.js';
export type SessionSnapshot = {
  id: ID;
  principalId: ID;
  tokenDigest: TokenDigest;
  authEpoch: number;
  issuedAtMs: number;
  lastSeenAtMs: number;
  absoluteExpiresAtMs: number;
  idleExpiresAtMs: number;
  revokedAtMs?: number;
};
export class Session {
  readonly #state: SessionSnapshot;
  private constructor(state: SessionSnapshot) {
    this.#state = { ...state };
  }
  static issue(
    _id: ID,
    _principalId: ID,
    _digest: TokenDigest,
    _epoch: number,
    _issued: number,
    _absolute: number,
    _idle: number,
  ) {
    return authPending<Session>();
  }
  static restore(_state: SessionSnapshot) {
    return authPending<Session>();
  }
  snapshot(): SessionSnapshot {
    return { ...this.#state };
  }
  check(_now: number) {
    return authPending<void>();
  }
  touch(_now: number, _idleTtl: number) {
    return authPending<Session>();
  }
  revoke(_now: number) {
    return authPending<Session>();
  }
}
