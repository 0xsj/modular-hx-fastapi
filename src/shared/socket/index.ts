/** Versioned bounded envelope; domains own message meanings. */
import {
  err,
  failure,
  ok,
  type Result,
  type Failure,
} from '../errors/index.js';
export type Message = {
  v: 1;
  id: string;
  type: string;
  payload: Record<string, unknown>;
};
const invalid = () =>
  failure('invalid', 'invalid socket message', { type: 'socket.invalid' });
export function decode(raw: Uint8Array): Result<Message, Failure> {
  if (raw.byteLength > 65536) return err(invalid());
  try {
    const m: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(raw),
    );
    if (!m || typeof m !== 'object' || Array.isArray(m)) return err(invalid());
    const x = m as Record<string, unknown>;
    if (
      Object.keys(x).length !== 4 ||
      x.v !== 1 ||
      typeof x.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(x.id) ||
      typeof x.type !== 'string' ||
      !/^[a-z0-9_.]{1,64}$/.test(x.type) ||
      !x.payload ||
      typeof x.payload !== 'object' ||
      Array.isArray(x.payload)
    )
      return err(invalid());
    return ok(x as Message);
  } catch {
    return err(invalid());
  }
}
export function encode(m: Message): Result<Uint8Array, Failure> {
  try {
    const raw = Buffer.from(JSON.stringify(m));
    const valid = decode(raw);
    return valid.ok ? ok(raw) : valid;
  } catch {
    return err(invalid());
  }
}
