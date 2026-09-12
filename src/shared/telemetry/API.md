# Telemetry native surface

Trace identity and Outcome are implemented SDK-free value leaves.
traceRef returns Result<TraceRef, Failure>; module-owned WeakMap identity prevents foreign forged values.
snapshot returns a copy. parseOutcome accepts exact names; Logger.withTrace returns a derived logger Result.

The concrete otel directory implements validated provider configuration and bounded
SDK batch delivery for traces/logs, periodic metrics and repeat-safe shutdown.
Root supplies service resources and a remaining deadline. None mode constructs no
providers. SDK failures do not become HTTP/business failures.

HTTP owns the consumer-specific observation capability. SDK Span, Context, provider
and exporter types do not enter these value leaves or application contracts.
See the root [run/settings guide](../../../TELEMETRY_HTTP.md).
