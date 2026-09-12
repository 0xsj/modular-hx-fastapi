# Shared foundations

Shared code has a named responsibility and never imports root or product modules.
Third-party types stay inside their owning adapters.

- [errors](errors/README.md): classification, public projection and retained diagnostics.
- [clock](clock/README.md): wall time and monotonic elapsed measurements.
- [id](id/README.md): UUID values and fallible generation.
- [secret](secret/README.md): private strings with explicit reveal and redacted presentation.
- [env](env/README.md): captured lookup, strict parsing and safe manifests.
- [provenance](provenance/README.md): immutable execution/work history and explicit transitions.
- [logger](logger/README.md): console/JSON/no-op output and bounded delivery.

- [telemetry](telemetry/README.md): trace identity, outcomes and owned SDK delivery.
- [http](http/README.md): safe wire errors, request observation and completion.
- [validation](validation/CONTRACT.md): strict scalar checks and bounded safe reports.
- [pagination](pagination/CONTRACT.md): page bounds and query-bound cursor codec.
- [postgres](postgres/CONTRACT.md): pool, migration ledger and explicit transactions.
- [health](health/CONTRACT.md): liveness, readiness and irreversible drain.
- [httpclient](httpclient/CONTRACT.md): bounded outbound attempts and concrete OTel observation.
- [socket](socket/CONTRACT.md): versioned messages and native WebSocket lifetime.
- [events](events/CONTRACT.md): immutable envelopes, outbox and durable publisher seam.
