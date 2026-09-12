# 0008 — Explicit diagnostic HTTP processes and bounded OTLP adapters

Status: accepted, 2026-09-11.

The first HTTP consumer is an explicitly launched diagnostic process. It uses
net/http in Go, Nest with its Express adapter in TypeScript, and Axum with Tokio
in Rust. Shared completion policy and provenance stay independent of these runtimes.
SDK types belong in concrete telemetry/HTTP adapters and the composition root.

Use OTLP over HTTP with protobuf for traces, metrics and logs. Go uses the aligned
1.46.0 / logs 0.22.0 SDK release, Node uses 2.11.0 / 0.222.0, and Rust uses the
0.31.0 SDK family compatible with the installed Rust 1.86 toolchain. Rust SDK
export workers use the blocking HTTP client on SDK-owned threads. Pin direct
dependencies and lock transitive resolution. Native SDK parsing owns W3C trace
context; baggage is not admitted.

The root explicitly selects TELEMETRY_MODE=none|otlp (default none), sampling
all|none, a credential-free HTTP(S) base endpoint, service resource, queue capacity,
batch size, export timeout and collection interval. The none path constructs no
providers and creates no trace identity. A sampled-out request still has a valid
trace context and contributes completion logs and duration metrics.

Defaults: queue 256, batch 64, export timeout 500 ms, interval 500 ms. Validate
queue 1..65536, batch 1..queue, export timeout 1..10000 ms, interval 100..60000 ms
before opening the listener. The root owns a 3000 ms shutdown budget, configurable
1..30000 ms, shared by HTTP draining, providers and logging. SDK failures produce
bounded safe diagnostics; do not report inferred exact queue drops.

HTTP binds loopback by default on 7100 (Go), 7200 (Rust), 7300 (Nest); port zero
is allowed for process tests. The diagnostic profile accepts bounded JSON with a
1 MiB body cap, 16 KiB header cap and 1000 ms handler deadline. Root settings are
validated before listening. Four example routes plus native unmatched/method
handling exercise safe success, conflict, unavailable and unknown failure.

These dependencies solve native request execution and interoperable delivery.
Hand-written OTLP encoding or a universal framework wrapper would increase protocol
and lifecycle ownership without serving the blueprint. A synchronous exporter in
the request path is rejected because collector outages must not change responses.

Acceptance requires native HTTP checks, context overlap/cleanup, selected regression
mutations, and retrieving process-generated logs/traces/metrics from the local
collector stack. SDK installation alone is not evidence of delivery.
