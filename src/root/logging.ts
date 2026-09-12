import { create, type Sink } from '../shared/logger/index.js';
import { type Config } from './config.js';
export function logging(
  config: Config,
  clock: { now(): Date },
  sink: Sink,
  terminal: boolean,
) {
  return create({
    resource: config.resource,
    format: config.format,
    level: config.level,
    color: config.color,
    capacity: config.capacity,
    maxRecordBytes: config.maxBytes,
    noColor: config.noColor,
    clock,
    sink,
    terminal,
  });
}
