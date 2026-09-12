import { authPending } from './auth-spec-stub.js';
import type { ID } from '../../../shared/id/index.js';
import type { TokenDigest, TokenPurpose } from './token.js';
export type ChallengeSnapshot = {
  id: ID;
  principalId: ID;
  tokenDigest: TokenDigest;
  passwordVersion: number;
  issuedAtMs: number;
  expiresAtMs: number;
  consumedAtMs?: number;
  invalidatedAtMs?: number;
};
export class Challenge {
  readonly #state: ChallengeSnapshot;
  private constructor(state: ChallengeSnapshot) {
    this.#state = { ...state };
  }
  static issue(
    _id: ID,
    _principalId: ID,
    _digest: TokenDigest,
    _version: number,
    _issued: number,
    _expires: number,
  ) {
    return authPending<Challenge>();
  }
  static restore(_state: ChallengeSnapshot) {
    return authPending<Challenge>();
  }
  snapshot(): ChallengeSnapshot {
    return { ...this.#state };
  }
  consume(_purpose: TokenPurpose, _version: number, _now: number) {
    return authPending<Challenge>();
  }
  invalidate(_now: number) {
    return authPending<Challenge>();
  }
}
