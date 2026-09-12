import { authPending } from './auth-spec-stub.js';
import type { ID } from '../../../shared/id/index.js';
import type { SecretString } from '../../../shared/secret/index.js';
import type { Email } from './email.js';
export type CredentialSnapshot = {
  principalId: ID;
  email: Email;
  passwordHash: SecretString;
  verifiedAtMs?: number;
  passwordVersion: number;
  createdAtMs: number;
  changedAtMs: number;
};
export class PasswordCredential {
  readonly #state: CredentialSnapshot;
  private constructor(state: CredentialSnapshot) {
    this.#state = { ...state };
  }
  static restore(_state: CredentialSnapshot) {
    return authPending<PasswordCredential>();
  }
  snapshot(): CredentialSnapshot {
    return { ...this.#state };
  }
}
