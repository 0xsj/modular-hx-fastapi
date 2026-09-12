/**
 * An implementation of a secret string with runtime-private storage and redaction.
 * This leaf exposes an explicit reveal operation and separate conversion,
 * JSON and Node inspection hooks. Empty strings are valid; env/config owns
 * requiredness. No project module or Nest/Pino dependency belongs in this value.
 * CONTRACT.md defines S01-S11. Runtime APIs, executable tests and logger redaction are implemented.
 * @module shared/secret
 */
export { SecretString } from './value.js';
