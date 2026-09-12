import {
  err,
  failure,
  type Result,
  type Failure,
} from '../../../shared/errors/index.js';
// Deliberately refusing red-stage scaffold. Not wired into any process.
export const authPending = <T>(): Result<T, Failure> =>
  err(
    failure('internal', 'auth leaf not implemented', {
      type: 'identity.auth_not_implemented',
    }),
  );
