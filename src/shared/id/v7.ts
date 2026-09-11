import { randomFillSync } from 'node:crypto';
import {
  err,
  failure,
  ok,
  type Failure,
  type Result,
} from '../errors/index.js';
import { encodeV7, type ID } from './value.js';

/** This consumer needs wall time only. */
export interface WallClock {
  now(): Date;
}
/** Fill every byte synchronously or throw; injected production sources must be cryptographic. */
export type Entropy = (bytes: Uint8Array) => void;
const osEntropy: Entropy = (bytes) => {
  randomFillSync(bytes);
};

/** Ordering belongs to this instance in one isolate. Dependency callbacks must not reenter. */
export class V7 {
  #last: number | undefined;
  #counter = 0;
  constructor(
    private readonly clock: WallClock,
    private readonly entropy: Entropy = osEntropy,
  ) {}
  newId(): Result<ID, Failure> {
    let ms = this.clock.now().getTime();
    if (!Number.isSafeInteger(ms) || ms < 0 || ms > 281474976710655)
      return err(
        failure('invalid', 'ID timestamp out of range', {
          type: 'id.time_range',
        }),
      );
    const fresh = this.#last === undefined || ms > this.#last;
    let counter = 0;
    if (!fresh) {
      ms = this.#last!;
      if (this.#counter === 4095)
        return err(
          failure('unavailable', 'ID counter exhausted', {
            type: 'id.exhausted',
          }),
        );
      counter = this.#counter + 1;
    }
    const random = new Uint8Array(10);
    try {
      this.entropy(random);
    } catch (cause) {
      return err(
        failure('unavailable', 'ID entropy unavailable', {
          type: 'id.entropy',
          cause,
        }),
      );
    }
    if (fresh) counter = ((random[0] << 8) | random[1]) & 0x07ff;
    const value = encodeV7(ms, counter, random.subarray(2));
    this.#last = ms;
    this.#counter = counter;
    return ok(value);
  }
}
