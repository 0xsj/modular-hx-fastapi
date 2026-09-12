import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import { Client as Native, type Request, type Response } from '../index.js';
import { traceRef } from '../../telemetry/index.js';
import type { Runtime } from '../../telemetry/otel/runtime.js';
import type { Failure, Result } from '../../errors/index.js';
export class Client {
  readonly #duration;
  constructor(
    private readonly native: Native,
    private readonly runtime: Runtime,
  ) {
    this.#duration = runtime.metrics
      ?.getMeter('n2f.httpclient')
      .createHistogram('http.client.request.duration', { unit: 's' });
  }
  async do(
    input: Request,
    signal?: AbortSignal,
  ): Promise<Result<Response, Failure>> {
    if (!this.runtime.traces) return this.native.do(input, signal);
    const span = this.runtime.traces
      .getTracer('n2f.httpclient')
      .startSpan('HTTP outbound', { kind: SpanKind.CLIENT }, context.active());
    const child = trace.setSpan(context.active(), span);
    const sc = span.spanContext();
    const ref = traceRef(sc.traceId, sc.spanId, (sc.traceFlags & 1) !== 0);
    const start = performance.now();
    try {
      return await context.with(child, async () => {
        const result = await this.native.do(
          { ...input, ...(ref.ok ? { trace: ref.value } : {}) },
          signal,
        );
        const method = [
          'GET',
          'HEAD',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'OPTIONS',
        ].includes(input.method)
          ? input.method
          : '_OTHER';
        const attrs: Attributes = { 'http.request.method': method };
        let errorType: string | undefined;
        if (!result.ok) errorType = result.error.kind;
        else {
          attrs['http.response.status_code'] = result.value.status;
          if (result.value.status >= 400)
            errorType = String(result.value.status);
        }
        if (errorType) {
          attrs['error.type'] = errorType;
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        span.setAttributes(attrs);
        this.#duration?.record(
          (performance.now() - start) / 1000,
          attrs,
          child,
        );
        return result;
      });
    } finally {
      span.end();
    }
  }
}
