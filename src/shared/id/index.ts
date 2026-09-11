/**
 * Immutable UUID values, explicit generation effects, and finite test sequences.
 * Parsing accepts standard-variant canonical UUID syntax independently of version.
 * V7 consumes only a wall capability; successful calls order within one instance.
 * Exhaustion/entropy failures are Results, and failures commit no generator state.
 * See CONTRACT.md for exact fixtures, time range, ownership and native differences.
 * @module shared/id
 */
export { parse, version, unixMillis, type ID } from './value.js';
export { V7, type WallClock, type Entropy } from './v7.js';
export { Sequence } from './sequence.js';
