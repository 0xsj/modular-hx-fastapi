# Health contract

H01: State starts Starting. Start moves to Serving once; Drain is irreversible.
Liveness means the process can answer and does not ping infrastructure.
H02: Readiness requires Serving and all root-selected required checks succeeding
within one total budget (1..5000 ms, at most 16 checks). Collector availability is
not a required check. State is rechecked after asynchronous checks.
H03: One readiness evaluation is admitted at a time. Overlap refuses readiness
rather than accumulating probes. Timeout/cancellation returns not-ready; a
non-cooperative callback must not cause growing detached work across requests.
Checks must honor cancellation and must not perform writes.
H04: Public endpoints GET /livez and /readyz return safe status-only success or
a generic 503 problem. Dependency names, errors and connection strings are private.
Root starts readiness only after startup succeeds and drains before HTTP shutdown.
