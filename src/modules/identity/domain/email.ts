import { authPending } from './auth-spec-stub.js';
import { SecretString } from '../../../shared/secret/index.js';
export class Email extends SecretString {
  private constructor(value: string) {
    super(value);
  }
  static parse(_input: string) {
    return authPending<Email>();
  }
}
