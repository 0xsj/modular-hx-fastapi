/**
 * Wall timestamps and monotonic elapsed readings with explicit test control.
 * Domain functions receive timestamps; applications own obtaining them.
 * FakeClock.set changes only wall time; advance moves wall and elapsed together.
 * Dates are copied at the boundary. Elapsed readings are bigint nanoseconds from
 * one instance's private origin. See CONTRACT.md for scenarios and limitations.
 * @module shared/clock
 */
export { FakeClock, SystemClock } from './clock.js';
