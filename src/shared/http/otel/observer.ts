import {
  ROOT_CONTEXT,
  trace,
  SpanKind,
  SpanStatusCode,
  type Attributes,
} from '@opentelemetry/api';
import type { ContextManager } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import type { IncomingHttpHeaders } from 'node:http';
import { publicInfo } from '../../errors/index.js';
import { traceRef } from '../../telemetry/index.js';
import type { Runtime } from '../../telemetry/otel/runtime.js';
import { Noop, type Observer, type Observation } from '../nest/observer.js';
export class OTelObserver implements Observer {
  readonly #context: ContextManager | undefined;
  readonly #duration;
  constructor(
    readonly runtime: Runtime,
    contexts?: ContextManager,
  ) {
    this.#context = contexts;
    this.#duration = runtime.metrics
      ?.getMeter('n2f.http')
      .createHistogram('http.server.request.duration', {
        unit: 's',
        advice: {
          explicitBucketBoundaries: [
            0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5,
            7.5, 10,
          ],
        },
      });
  }
  close(): void {
    this.#context?.disable();
  }
  start(
    method: string,
    scheme: 'http' | 'https',
    headers: IncomingHttpHeaders,
  ): Observation {
    if (!this.runtime.traces) return new Noop().start();
    const carrier: Record<string, string> = {};
    for (const name of ['traceparent', 'tracestate']) {
      const v = headers[name];
      if (typeof v === 'string' && !(name === 'traceparent' && v.includes(',')))
        carrier[name] = v;
    }
    const parent = new W3CTraceContextPropagator().extract(
      ROOT_CONTEXT,
      carrier,
      { keys: (c) => Object.keys(c), get: (c, k) => c[k] },
    );
    const name = method === '_OTHER' ? 'HTTP' : method;
    const span = this.runtime.traces
      .getTracer('n2f.http')
      .startSpan(name, { kind: SpanKind.SERVER }, parent);
    const context = trace.setSpan(parent, span),
      sc = span.spanContext(),
      ref = traceRef(sc.traceId, sc.spanId, (sc.traceFlags & 1) !== 0);
    return {
      ...(ref.ok ? { trace: ref.value } : {}),
      run: (callback) =>
        this.#context ? this.#context.with(context, callback) : callback(),
      finish: (c, route, scope, failure) => {
        const attrs: Attributes = {
          'http.request.method': method,
          'url.scheme': scheme,
          'n2f.outcome': c.classification.outcome,
        };
        if (route) {
          attrs['http.route'] = route;
          span.updateName(name + ' ' + route);
        }
        if (c.facts.status !== undefined)
          attrs['http.response.status_code'] = c.facts.status;
        if (c.classification.errorType)
          attrs['error.type'] = c.classification.errorType;
        span.setAttributes(attrs);
        if (c.classification.spanError)
          span.setStatus({ code: SpanStatusCode.ERROR });
        this.#duration?.record(Number(c.elapsedNs) / 1e9, attrs, context);
        const severity =
          c.classification.outcome === 'failed'
            ? 17
            : ['canceled', 'timed_out'].includes(c.classification.outcome)
              ? 13
              : 9;
        const logAttrs: Attributes = {};
        if (scope) {
          const s = scope.snapshot();
          Object.assign(logAttrs, {
            'n2f.scope_id': s.scopeId,
            'n2f.work_id': s.work.workId,
            'n2f.correlation_id': s.work.correlationId,
            'n2f.operation': s.work.operation,
          });
        }
        if (failure) {
          const p = publicInfo(failure.error);
          Object.assign(logAttrs, {
            'n2f.error.kind': p.kind,
            'n2f.error.message': p.message,
            ...(p.type ? { 'n2f.error.code': p.type } : {}),
          });
        }
        this.runtime.logs?.getLogger('n2f.http').emit({
          context,
          body: 'http.request.completed',
          severityNumber: severity,
          attributes: {
            ...attrs,
            ...logAttrs,
            termination: c.facts.termination,
            elapsed_ms: Number(c.elapsedNs) / 1e6,
          },
        });
        span.end();
      },
    };
  }
}
