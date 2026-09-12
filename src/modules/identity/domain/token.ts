import { authPending } from './auth-spec-stub.js';
export type TokenPurpose =
  'session' | 'email_verification' | 'password_reset' | 'websocket_upgrade';
export const parseTokenPurpose = (_value: string) =>
  authPending<TokenPurpose>();
export class TokenDigest {
  readonly #purpose: TokenPurpose;
  readonly #data: Uint8Array;
  private constructor(purpose: TokenPurpose, data: Uint8Array) {
    this.#purpose = purpose;
    this.#data = data.slice();
  }
  static parse(_purpose: TokenPurpose, _data: Uint8Array) {
    return authPending<TokenDigest>();
  }
  purpose(): TokenPurpose {
    return this.#purpose;
  }
  bytes(): Uint8Array {
    return this.#data.slice();
  }
}
