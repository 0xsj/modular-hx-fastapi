import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import { Active } from '../lifecycle.js';
import { normalizeMethod, type Termination } from '../policy.js';
import { problemOf } from '../problem.js';
import {
  failure,
  err,
  ok,
  kindOf,
  type Result,
  type Failure,
} from '../../errors/index.js';
import {
  inspectIncoming,
  type IncomingResult,
  type Scope,
} from '../../provenance/index.js';
import type { Logger } from '../../logger/index.js';
import type { Observer } from './observer.js';
export interface RequestContext {
  readonly scope: Scope;
  readonly log: Logger;
  readonly signal: AbortSignal;
}
export interface Route {
  readonly path: string;
  readonly operation: string;
  readonly handler: (
    context: RequestContext,
  ) => Promise<Result<unknown, unknown>> | Result<unknown, unknown>;
}
interface State {
  active: Active;
  log: Logger;
  scope?: Scope;
  selected?: { error: unknown };
  route?: Route;
  termination: Termination;
  abort: AbortController;
}
export interface Config {
  routes: readonly Route[];
  observer: Observer;
  log: Logger;
  open: (operation: string, incoming: IncomingResult) => Result<Scope, Failure>;
  now: () => bigint;
  timeoutMs: number;
  maxBody: number;
  maxActive: number;
}
export class Server {
  readonly #contexts = new AsyncLocalStorage<RequestContext>();
  readonly #states = new WeakMap<Request, State>();
  readonly #routes = new Map<string, Route>();
  readonly #workers = new Set<Promise<unknown>>();
  constructor(readonly config: Config) {
    if (
      !Number.isInteger(config.timeoutMs) ||
      config.timeoutMs < 1 ||
      config.maxBody < 1 ||
      config.maxActive < 1
    )
      throw new Error('invalid HTTP configuration');
    for (const route of config.routes) {
      if (this.#routes.has(route.path)) throw new Error('duplicate route');
      this.#routes.set(route.path, route);
    }
  }
  current(): RequestContext | undefined {
    return this.#contexts.getStore();
  }
  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const method = normalizeMethod(req.method),
      observation = this.config.observer.start(
        method,
        req.secure ? 'https' : 'http',
        req.headers,
      );
    const state: State = {
      log: this.config.log,
      termination: 'response_completed',
      abort: new AbortController(),
      active: undefined as unknown as Active,
    };
    state.active = new Active(this.config.now, [
      (c) =>
        observation.finish(c, state.route?.path, state.scope, state.selected),
      (c) => {
        const fields = {
          method,
          ...(state.route ? { route: state.route.path } : {}),
          ...(c.facts.status === undefined ? {} : { status: c.facts.status }),
          outcome: c.classification.outcome,
          termination: c.facts.termination,
          elapsed_ms: Number(c.elapsedNs) / 1e6,
        };
        const log = state.selected
          ? state.log.withError(state.selected.error)
          : state.log;
        if (c.classification.outcome === 'failed')
          log.error('http.request.completed', fields);
        else if (['canceled', 'timed_out'].includes(c.classification.outcome))
          log.warn('http.request.completed', fields);
        else log.info('http.request.completed', fields);
      },
    ]);
    this.#states.set(req, state);
    const finish = (closed: boolean) => {
      if (closed && !res.writableFinished) {
        state.termination = 'peer_closed';
        state.abort.abort();
      }
      const kind = state.selected
        ? (kindOf(state.selected.error) ?? 'internal')
        : undefined;
      state.active.finish({
        ...(res.headersSent ? { status: res.statusCode } : {}),
        ...(kind ? { failureKind: kind } : {}),
        termination: state.termination,
      });
    };
    res.once('finish', () => finish(false));
    res.once('close', () => finish(true));
    res.once('error', () => {
      state.termination = 'write_error';
      finish(false);
    });
    state.route = this.#routes.get(req.path);
    const values: string[] = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2)
      if (req.rawHeaders[i].toLowerCase() === 'x-correlation-id')
        values.push(req.rawHeaders[i + 1]);
    const scope = this.config.open(
      state.route?.operation ?? 'http.unmatched',
      inspectIncoming(
        values.length
          ? { correlation: values.length === 1 ? values[0] : '' }
          : {},
      ),
    );
    if (!scope.ok) {
      state.selected = { error: scope.error };
      observation.run(next);
      return;
    }
    state.scope = scope.value;
    const bound = state.log.withScope(scope.value);
    if (bound.ok) state.log = bound.value;
    if (observation.trace) {
      const traced = state.log.withTrace(observation.trace);
      if (traced.ok) state.log = traced.value;
    }
    const snap = scope.value.snapshot();
    res.setHeader('X-Request-ID', snap.scopeId);
    res.setHeader('X-Correlation-ID', snap.work.correlationId);
    const context = Object.freeze({
      scope: scope.value,
      log: state.log,
      signal: state.abort.signal,
    });
    observation.run(() => this.#contexts.run(context, next));
  };
  async handle(req: Request, res: Response): Promise<void> {
    const state = this.#states.get(req);
    if (!state) {
      res.status(500).end();
      return;
    }
    let protocol: number | undefined;
    if (!state.selected && !state.route)
      state.selected = {
        error: failure('not_found', 'route not found', {
          type: 'http.not_found',
        }),
      };
    if (!state.selected && !['GET', 'HEAD'].includes(req.method)) {
      state.selected = {
        error: failure('invalid', 'method not allowed', {
          type: 'http.method_not_allowed',
        }),
      };
      protocol = 405;
      res.setHeader('Allow', 'GET, HEAD');
    }
    let result: Result<unknown, unknown> = ok({ ok: true });
    try {
      if (
        !state.selected &&
        ((req.headers['content-length'] ?? '0') !== '0' ||
          req.headers['transfer-encoding'])
      ) {
        if (
          req.headers['content-type']?.split(';')[0].trim() !==
          'application/json'
        ) {
          state.selected = {
            error: failure('invalid', 'unsupported media type', {
              type: 'http.unsupported_media_type',
            }),
          };
          protocol = 415;
        } else {
          const rejected = await readBody(req, this.config.maxBody);
          if (rejected) {
            protocol = rejected;
            state.selected = {
              error: failure(
                'invalid',
                rejected === 408
                  ? 'request body timed out'
                  : rejected === 413
                    ? 'request body too large'
                    : 'invalid request body',
                {
                  type:
                    rejected === 408
                      ? 'http.request_timeout'
                      : rejected === 413
                        ? 'http.body_too_large'
                        : 'http.invalid_body',
                },
              ),
            };
            if (rejected === 408) state.termination = 'deadline';
            res.setHeader('Connection', 'close');
          }
        }
      }
      if (!state.selected) {
        if (this.#workers.size >= this.config.maxActive)
          state.selected = {
            error: failure('unavailable', 'server busy', { type: 'http.busy' }),
          };
        else {
          const context = Object.freeze({
            scope: state.scope!,
            log: state.log,
            signal: state.abort.signal,
          });
          const work = Promise.resolve()
            .then(() =>
              this.#contexts.run(context, () => state.route!.handler(context)),
            )
            .catch((error) => err(error));
          this.#workers.add(work);
          void work.finally(() => this.#workers.delete(work));
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<Result<unknown, unknown>>((resolve) => {
            timer = setTimeout(() => {
              state.termination = 'deadline';
              state.abort.abort();
              resolve(
                err(
                  failure('timeout', 'request timed out', {
                    type: 'http.timeout',
                  }),
                ),
              );
            }, this.config.timeoutMs);
          });
          try {
            result = await Promise.race([work, timeout]);
          } finally {
            clearTimeout(timer);
          }
          if (!result.ok) state.selected = { error: result.error };
        }
      }
      if (res.destroyed) return;
      if (state.selected) {
        const problem = problemOf(err(state.selected.error))!;
        const body = {
          ...problem,
          ...(protocol
            ? {
                status: protocol,
                title:
                  protocol === 405
                    ? 'Method Not Allowed'
                    : protocol === 408
                      ? 'Request Timeout'
                      : protocol === 413
                        ? 'Payload Too Large'
                        : 'Unsupported Media Type',
              }
            : {}),
          ...(state.scope
            ? {
                request_id: state.scope.snapshot().scopeId,
                correlation_id: state.scope.snapshot().work.correlationId,
              }
            : {}),
        };
        res
          .status(body.status)
          .type('application/problem+json')
          .send(JSON.stringify(body));
      } else
        res
          .status(200)
          .type('application/json')
          .send(JSON.stringify(result.ok ? result.value : null));
    } catch (error) {
      state.selected = { error };
      if (res.headersSent) {
        state.termination = 'handler_error';
        res.destroy();
        return;
      }
      res
        .status(500)
        .type('application/problem+json')
        .send(JSON.stringify(problemOf(err(error))));
    }
  }
  async drain(remainingMs: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled(this.#workers),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, Math.max(0, remainingMs));
      }),
    ]);
    clearTimeout(timer);
  }
}

function readBody(req: Request, max: number): Promise<number | undefined> {
  return new Promise((resolve) => {
    let size = 0,
      done = false;
    const finish = (status?: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      req.off('data', data);
      req.off('end', end);
      req.off('aborted', aborted);
      if (status) req.pause();
      resolve(status);
    };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) finish(413);
    };
    const end = () => finish(),
      aborted = () => finish(400);
    const timer = setTimeout(() => finish(408), 1000);
    req.on('data', data);
    req.once('end', end);
    req.once('aborted', aborted);
    req.once('error', () => finish(400));
  });
}
