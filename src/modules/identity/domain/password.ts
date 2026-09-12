import { authPending } from './auth-spec-stub.js';
import { SecretString } from '../../../shared/secret/index.js';
export class NewPassword {
  readonly #value: SecretString;
  private constructor(value: SecretString) {
    this.#value = value;
  }
  static parse(_input: SecretString) {
    return authPending<NewPassword>();
  }
  secret(): SecretString {
    return this.#value;
  }
}
export class PasswordInput {
  readonly #value: SecretString;
  private constructor(value: SecretString) {
    this.#value = value;
  }
  static parse(_input: SecretString) {
    return authPending<PasswordInput>();
  }
  secret(): SecretString {
    return this.#value;
  }
}
