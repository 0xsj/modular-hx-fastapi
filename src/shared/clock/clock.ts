import { hrtime } from 'node:process';

/** Production wall time and monotonic nanoseconds from a private origin. */
export class SystemClock {
  readonly #origin = hrtime.bigint();
  now(): Date {
    return new Date();
  }
  elapsed(): bigint {
    return hrtime.bigint() - this.#origin;
  }
}

function validMillis(value: Date): number {
  const ms = value.getTime();
  if (!Number.isFinite(ms)) throw new RangeError('clock: invalid wall time');
  return ms;
}

/** Manually controlled within one isolate. All Dates crossing the boundary copy. */
export class FakeClock {
  #wall: number;
  #elapsed = 0n;
  constructor(start: Date) {
    this.#wall = validMillis(start);
  }
  now(): Date {
    return new Date(this.#wall);
  }
  elapsed(): bigint {
    return this.#elapsed;
  }
  set(wall: Date): void {
    this.#wall = validMillis(wall);
  }
  /** Whole nonnegative milliseconds; a refused advance changes neither reading. */
  advance(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new RangeError('clock: invalid advance');
    }
    const wall = this.#wall + milliseconds;
    if (!Number.isSafeInteger(wall) || Math.abs(wall) > 8640000000000000) {
      throw new RangeError('clock: invalid advance');
    }
    this.#wall = wall;
    this.#elapsed += BigInt(milliseconds) * 1000000n;
  }
}
