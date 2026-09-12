# Telemetry contract

**Stage:** value leaves and concrete OTLP delivery are implemented for HTTP.
The root guide and mirrored notes distinguish measured scenarios from future consumers.

## Ownership

The value leaves own trace identity projection and a small outcome vocabulary.
The telemetry adapter owns SDK providers, processors, exporters and their diagnostics.
HTTP owns HTTP semantics and declares its observation capability at its boundary.
Root supplies that capability, configures resources and sampling, and closes providers.
Telemetry value code imports neither HTTP nor logger, provenance or root.
SDK types may cross between root and the concrete adapters it wires; they must not
escape into shared value contracts, domain code or application ports.

We are not defining a universal span builder, arbitrary metric registry, logging
replacement, event bus or audit facility. Add operation-specific capabilities at
their consumers when an actual use case needs them.

## T01 — Trace identity is a separate value

TraceRef is an immutable owned projection: trace_id (32 lowercase hexadecimal
characters), span_id (16), sampled (boolean). Both IDs must be nonzero. Construction
refuses malformed IDs with invalid / telemetry.invalid_context and no clock,
entropy, logging or network effects. Missing context is explicit absence, never
zero-filled IDs. Snapshots cannot mutate a retained value.

These are tracing identifiers; do not parse or generate them with the shared UUID
module. Scope/work/correlation IDs retain their provenance meaning. Equal-looking
bytes would not establish identity equivalence. The SDK creates trace/span IDs;
this leaf validates projections, not the entire traceparent protocol.

## T02 — Outcome and span status answer different questions

Outcome is the closed vocabulary success, refused, failed, canceled, timed_out.
It describes an observed operation, not whether a transaction committed.
Absent completion is not success. Unknown outcome text refuses with
invalid / telemetry.invalid_outcome; there is no fallback to success.

A transport chooses its outcome from known facts. A generic error kind alone does
not determine every operation's outcome or retry policy. HTTP maps outcome, response
status and transport failure into span status in its own contract.

## T03 — Safe correlation across signals

Root derives logger and telemetry service resources from the same captured config
and generated instance identity. Telemetry must not generate another service instance.
Expose service.name, service.namespace, service.version, service.instance.id and
deployment.environment.name from that single source.

The required logger extension is an explicitly bound, owned trace envelope:
trace { trace_id, span_id, sampled }. Ordinary fields cannot replace it, service,
scope or error. Binding a request snapshot cannot mutate another request or parent
logger. Missing trace context omits trace; no-op telemetry must not invent it.
This extension needs its own logger tests before integration; current L01–L10
do not implement it.

Provenance attaches through an explicit safe projection. The initial request span
may include n2f.scope.id, n2f.work.id and n2f.correlation.id, never actor/tenant
records automatically. No raw errors, exception stacks, credentials, headers,
query strings or bodies are recorded automatically. Owner-designated public error
text can remain in the safe log error projection; it is not a metric label.

## T04 — One completion claim per observation

An observation is active, then finished. The first valid finish attempt wins once;
repeat or competing finish attempts have no second span end, metric sample or
completion-log attempt. This is an in-process lifecycle property, not exactly-once
export. Diagnostics distinguish suppressed repeats from delivery failures.

Completion carries an explicit outcome and the consumer's measured elapsed duration.
Durations use the existing monotonic clock capability; a wall-clock adjustment
cannot produce a negative duration. A negative/nonfinite supplied duration is
instrumentation misuse: omit the sample and report a bounded diagnostic, never
convert it into a successful zero-duration measurement.

## T05 — Sampling does not erase work

Recording/sampling state, valid context and business execution are separate.
A non-recording span can still carry valid correlation. Sampling traces out must
not suppress HTTP duration measurements, completion-log attempts or provenance.
The process chooses a sampler; a remote sampled flag is an input to policy, not
permission to force unlimited recording. Deterministic tests supply the sampling
decision. The first local integration fixture records all of its own test traces.

## T06 — Runtime context has an owner

Propagation adapters associate context with the current execution and restore the
previous context on every exit path. Overlapping requests and nested scopes cannot
share a mutable current-scope singleton. Explicit handles remain usable for tests
without installing a process-global provider.

Detached work needs an explicit captured context and a new execution owner. It
cannot keep the HTTP request's completion handle open or silently inherit its
cancellation lifetime. Broker envelopes and detached-work execution are later
adapters; request concurrency does not verify them.

## T07 — Disabled means no telemetry effects

The no-op observer returns absent TraceRef and accepts completion without SDK
initialization, telemetry clock reads, UUID/entropy consumption, encoding, export
or queued work. HTTP still handles the request, opens provenance and may measure
elapsed time for its logger. Logger filtering/no-op remains independently selected.

## T08 — Instrumentation cannot wait for export

Begin, annotation and finish do not await network delivery. SDK/export failures
cannot replace a response, trigger a business retry or throw through a handler.
Use a separate bounded diagnostic path; do not recursively report an exporter
failure through that same failed exporter. Arbitrary blocking user callbacks and
process termination are outside this guarantee.

## T09 — Root validates before listening

Root captures env once and validates telemetry mode, endpoint, resource, sampling,
queue/batch bounds, export timeout and flush deadline before starting providers or
binding HTTP. Missing defaults and explicitly invalid input remain distinct.
Invalid config reports invalid / telemetry.invalid_configuration with safe key and
reason; endpoints/headers containing credentials are never echoed.

Modes for this slice are none and otlp. Actual setting names/defaults and SDK
versions belong in the root implementation contract before dependencies are added.
Provider construction failure is a startup failure. A collector outage after
valid construction is a bounded delivery failure, not HTTP unavailability.

## T10 — Bounded delivery and honest diagnostics

The SDK adapter owns finite buffering, retry budgets and signal-specific loss
accounting; no second unbounded queue is added around it. Record the actual SDK
limits and units in adapter notes. Trace/log records and aggregated metric points
need not share a queue model or identical counters.

Expose observed failed export attempts and known dropped data separately from
unknown delivery. A local enqueue or successful export response is not durable
storage evidence. No exact dropped-item count may be claimed when the chosen SDK
does not expose it. Saturation tests must demonstrate the actual bound and usable
failure diagnostics before the adapter is considered implemented.

## T11 — Shutdown spends one remaining budget

Root first stops admission and drains/cancels active HTTP work, then flushes signal
providers and the logger within the remaining process deadline. Do not give each
provider a new full timeout. Close is safe to repeat, rejects new telemetry work
and returns a classified timeout / telemetry.flush_timeout or
unavailable / telemetry.export failure when observed. A deadline does not prove a
blocked foreign syscall or worker was forcibly stopped; report residual activity.

## T12 — Verification crosses the real export boundary

Use a deterministic in-memory adapter for identity, sampling, context and lifecycle
tests, but validate OTLP with the real process and local collector. Retrieve a
request trace, its correlated completion log and its duration series from the
actual stores. Inspect stored metric names/units rather than assuming Prometheus
preserves the instrument spelling. Test collector loss, recovery and shutdown
separately. Record acceptance versus retrieval, and selected mutations versus
exhaustive guarantees. None of these checks has run for this package yet.

## Primary references

Read on 2026-09-11. These inform adapter behavior; the policies above are n2f's.

- [W3C Trace Context](https://www.w3.org/TR/trace-context/) defines tracing identity
  and wire propagation; its propagator belongs in an adapter.
- [OpenTelemetry context](https://opentelemetry.io/docs/specs/otel/context/) defines
  immutable execution context and balanced activation.
- [OpenTelemetry trace SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/)
  supplies sampling, processing and provider lifecycle semantics. SDK support and
  defaults must be checked when selecting concrete language versions.
