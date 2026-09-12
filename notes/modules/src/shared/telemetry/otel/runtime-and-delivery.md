# Export acceptance is not stored delivery

**Origin:** SDK installation, source/API inspection and real OTLP process checks
on 2026-09-11. Dependencies are pinned in the local manifest and lockfile.

Node uses SDK 2.11.0 and logs/exporters 0.222.0 on Node 24.19.0. Trace batching and log batching have different constructor APIs; compilation against installed types caught that distinction.

Trace/log queues are bounded SDK queues; metric aggregation has finite dimensions
for this diagnostic registry. Request completion never waits for network export.
The root validates queue/batch bounds, timeout, interval, endpoint, resource and
sampling before listening. The no-op branch constructs no providers.

Generic SDK diagnostic events are not exact dropped-record counts. Outage tests
observed safe diagnostics while all HTTP scenarios still passed. A failed export
is not proof that no backend accepted any data. Retries and shutdown are owned by
the SDK/root; there is no unbounded second application queue.

Root stops HTTP admission and drains admitted work before provider/logger shutdown,
using one remaining budget. Repeated provider close is stable. Node exporter callbacks are observed directly: SDK shutdown can resolve even after an export callback reports failure, so Promise rejection alone is insufficient to report delivery uncertainty.

The retrieval tool asks Tempo for a process trace, Loki for linked completion logs,
and Prometheus for the matching service instance's histogram. It uses event times
instead of an arbitrary last-five-minutes window. The metric's stored name has the
seconds suffix. Sampling-out runs retrieved logs and metrics with non-recording
trace identities.

The recovery fixture initially forwarded an empty Node export: Python's test proxy
read Content-Length while Node sent chunked transfer encoding. The proxy now decodes
chunks and preserves Content-Encoding. The stored-data check caught what an HTTP
200 acceptance check would have missed. After recovery, all three produced stored
telemetry within the same process; pre-recovery lost logs are not claimed recovered.

**Used in:** src/shared/telemetry/otel/ and tools/telemetry/verify_http_delivery.py.

Primary references: [Go exporters](https://opentelemetry.io/docs/languages/go/exporters/),
[Rust SDK](https://docs.rs/opentelemetry_sdk/0.31.0/opentelemetry_sdk/),
[JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/).
