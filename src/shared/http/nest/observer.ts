import type { IncomingHttpHeaders } from 'node:http';
import type { Scope } from '../../provenance/index.js';
import type { TraceRef } from '../../telemetry/index.js';
import type { Completion } from '../lifecycle.js';
export interface Observation {
  readonly trace?: TraceRef;
  run<T>(callback: () => T): T;
  finish(
    completion: Completion,
    route?: string,
    scope?: Scope,
    failure?: { error: unknown },
  ): void;
}
export interface Observer {
  start(
    method: string,
    scheme: 'http' | 'https',
    headers: IncomingHttpHeaders,
  ): Observation;
}
export class Noop implements Observer {
  start(): Observation {
    return { run: (fn) => fn(), finish: () => {} };
  }
}
