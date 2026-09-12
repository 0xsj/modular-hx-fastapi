# HTTP and telemetry verification

**Date:** 2026-09-11. Evidence comes from actual local runs, not inferred from
installed SDKs. [Machine-readable summary](http-evidence.json).

## Completed slice

The implementation order was value corrections, first-valid completion, protected
trace logging, native request ownership, then concrete providers and real delivery.
All three builds reuse the telemetry Outcome vocabulary and distinguish an absent
failure from an unknown failure. The earlier passing leaf suites missed real API
and classification defects; new regressions reproduced them before correction.

The local executable composes env/config, clocks, IDs, provenance, safe errors,
local logging and OTLP providers. It exposes four normal diagnostic routes and
three explicitly enabled test fixtures. There is no persistence side effect.

## Checks run

- Nest: 78 unit tests, TypeScript compilation, production build and the independent greeting E2E test pass. The pre-existing vite-tsconfig-paths/tsconfck warning remains a separate toolchain issue; the new code's lint warning was corrected.
- Five native process scenarios: no-op, sampled OTLP, unsampled OTLP, unreachable
  collector, and outage/recovery within the same running process.
- Each scenario runs 48 HTTP requests and six invalid-config starts:
  240 requests and 30 safe refusals per repository in the final matrix.
- Requests cover all four example results, fresh/continued/restarted correlation,
  ignored external request IDs, HEAD/405/404, body size/media/read deadlines,
  caught panic, handler deadline, peer disconnect and overlapping scope/SDK context.
- Every admitted request emits one local completion log. Context before/after an
  async yield matches both the response request ID and active SDK span ID.
- Sampled delivery retrieves every selected stored SERVER span and checks its
  status/outcome/method/route. Loki logs retain trace and provenance linkage.
  Prometheus histogram series use bounded attributes without request/trace IDs.
- Unsampled delivery retrieves 48 linked logs and duration metrics. Recovery
  retrieves the 44 post-recovery logs plus spans/metrics; the four initial failed
  exports are not claimed recovered. Counts are isolated by service instance.
- Four selected mutations were caught: success-becomes-failure, duplicate-completion, omit-trace-envelope, coarse-status-error.
  The runner verifies an unmodified baseline, mutates temporary copies, and retains
  command logs plus source hashes.

The final matrix observed shutdown in 8–18 ms with a 2500 ms configured budget.
That is evidence for these scenarios, not a universal latency guarantee. Generic
SDK diagnostics do not establish exact dropped-record counts.

## Corrections discovered during implementation

Tests needed to separate presence from classification, preserve exact 5xx error
types and check protected logger envelopes. Node needed root registration of its
OTel async context manager, not only a private explicit context binding.
A test proxy needed chunked transfer decoding for Node exports. Retrieval needed
the exact event range and service instance, and had to wait for complete ingestion
rather than accepting the first nonempty query result.

The collector used a temporary Compose project, n2f-http-verification-go, with
explicit endpoint overrides for comparison. No repository imports its sibling.
The original user containers were not changed. Temporary verification containers
are stopped after checking; their data volume is retained.

## Scope and limits

This completes the first bounded diagnostic HTTP/telemetry consumer. It does not
prove Flover compatibility, business transactions, authentication, audit durability,
TLS termination, HTTP/2, streaming, sockets or outbound HTTP behavior. SDK queue
saturation is bounded by configuration; no exhaustive stress or mutation score is
claimed. Header parse rejection before application admission is native behavior.
Cancellation stops observation or polling; it is not a transaction rollback.
