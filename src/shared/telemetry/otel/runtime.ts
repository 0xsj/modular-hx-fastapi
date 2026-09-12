import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  AlwaysOnSampler,
  AlwaysOffSampler,
} from '@opentelemetry/sdk-trace-base';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import {
  failure,
  err,
  ok,
  type Result,
  type Failure,
} from '../../errors/index.js';
export interface Config {
  mode: string;
  endpoint: string;
  sampling: string;
  resource: Record<string, string>;
  queue: number;
  batch: number;
  timeoutMs: number;
  intervalMs: number;
}
export function validate(c: Config): Result<void, Failure> {
  let endpoint: URL;
  try {
    endpoint = new URL(c.endpoint);
  } catch {
    return err(
      failure('invalid', 'invalid telemetry configuration', {
        type: 'env.invalid',
      }),
    );
  }
  if (
    !['none', 'otlp'].includes(c.mode) ||
    !['all', 'none'].includes(c.sampling) ||
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !c.resource['service.name'] ||
    !c.resource['service.instance.id'] ||
    !Number.isInteger(c.queue) ||
    c.queue < 1 ||
    c.queue > 65536 ||
    !Number.isInteger(c.batch) ||
    c.batch < 1 ||
    c.batch > c.queue ||
    !Number.isInteger(c.timeoutMs) ||
    c.timeoutMs < 1 ||
    c.timeoutMs > 10000 ||
    !Number.isInteger(c.intervalMs) ||
    c.intervalMs < 100 ||
    c.intervalMs > 60000
  )
    return err(
      failure('invalid', 'invalid telemetry configuration', {
        type: 'env.invalid',
      }),
    );
  return ok(undefined);
}
/** Explicit providers; no global tracing or request instrumentation registration. */
export class Runtime {
  readonly traces?: NodeTracerProvider;
  readonly metrics?: MeterProvider;
  readonly logs?: LoggerProvider;
  #closing?: Promise<Result<void, Failure>>;
  #failedExports = 0;
  get failedExports(): number {
    return this.#failedExports;
  }
  constructor(c: Config) {
    const valid = validate(c);
    if (!valid.ok) throw new Error('invalid telemetry configuration');
    if (c.mode === 'none') return;
    const resource = resourceFromAttributes(c.resource),
      base = c.endpoint.replace(/\/$/, '');
    const batch = {
      maxQueueSize: c.queue,
      maxExportBatchSize: c.batch,
      scheduledDelayMillis: c.intervalMs,
      exportTimeoutMillis: c.timeoutMs,
    };
    this.traces = new NodeTracerProvider({
      resource,
      sampler:
        c.sampling === 'all' ? new AlwaysOnSampler() : new AlwaysOffSampler(),
      spanProcessors: [
        new BatchSpanProcessor(
          observed(
            new OTLPTraceExporter({
              url: base + '/v1/traces',
              timeoutMillis: c.timeoutMs,
              concurrencyLimit: 1,
            }),
            () => {
              this.#failedExports++;
            },
          ),
          batch,
        ),
      ],
    });
    this.metrics = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: observed(
            new OTLPMetricExporter({
              url: base + '/v1/metrics',
              timeoutMillis: c.timeoutMs,
              concurrencyLimit: 1,
            }),
            () => {
              this.#failedExports++;
            },
          ),
          exportIntervalMillis: c.intervalMs,
          exportTimeoutMillis: Math.min(c.intervalMs, c.timeoutMs),
        }),
      ],
    });
    this.logs = new LoggerProvider({
      resource,
      processors: [
        new BatchLogRecordProcessor({
          exporter: observed(
            new OTLPLogExporter({
              url: base + '/v1/logs',
              timeoutMillis: c.timeoutMs,
              concurrencyLimit: 1,
            }),
            () => {
              this.#failedExports++;
            },
          ),
          ...batch,
        }),
      ],
    });
  }
  close(remainingMs: number): Promise<Result<void, Failure>> {
    if (this.#closing) return this.#closing;
    this.#closing = new Promise((resolve) => {
      const timer = setTimeout(
        () =>
          resolve(
            err(
              failure('timeout', 'telemetry flush timed out', {
                type: 'telemetry.flush_timeout',
              }),
            ),
          ),
        Math.max(0, remainingMs),
      );
      void Promise.allSettled([
        this.traces?.shutdown(),
        this.metrics?.shutdown(),
        this.logs?.shutdown(),
      ]).then((results) => {
        clearTimeout(timer);
        resolve(
          this.#failedExports > 0 ||
            results.some((r) => r.status === 'rejected')
            ? err(
                failure('unavailable', 'telemetry export unavailable', {
                  type: 'telemetry.export',
                }),
              )
            : ok(undefined),
        );
      });
    });
    return this.#closing;
  }
}

function observed<
  T extends {
    export(batch: never, callback: (result: ExportResult) => void): void;
  },
>(exporter: T, failed: () => void): T {
  const emit = exporter.export.bind(exporter);
  exporter.export = (batch, callback) =>
    emit(batch, (result) => {
      if (result.code !== ExportResultCode.SUCCESS) failed();
      callback(result);
    });
  return exporter;
}
