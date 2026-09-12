# 0006 — Process logging owns projections and bounded delivery

**Status:** Accepted · **Date:** 2026-09-11

## Context

The next runnable example must use the actual secret, env/config, provenance,
clock/ID and error foundations. The desired terminal baseline is a colorized
single line, with no-op and structured alternatives across languages.

## Decision

Use slog handlers in Go, a hand-written console formatter and Pino adapter in
TypeScript, and tracing with tracing-subscriber formatting in Rust. The composition
root chooses the backend and owns resource identity, configuration and shutdown.
Keep module values independent of logger implementations and framework SDKs.

Separate ordinary fields from resource/provenance/error envelopes. Bind owned
snapshots and explicitly project errors. Do not automatically print arbitrary
diagnostic cause strings; preserving a cause and authorizing its disclosure are
different decisions. Keep the existing public error redaction unchanged.

Deliver through a bounded owned queue with observable drops/failures and an explicit
shutdown deadline. The logger never exits the process or changes a business outcome
because delivery failed. Root reports bootstrap/export problems separately.
Config validation precedes resource startup and a successful boot summary.

## Alternatives and costs

A native JSON-only logger is smaller but does not provide the requested terminal
experience. A universal cross-language logging API would hide useful native
facilities; compare output semantics instead. Unbounded buffering hides outages
until memory is exhausted. Synchronous potentially blocking sinks couple business
latency to output; a bounded worker/async queue introduces lifecycle and loss policy.
Raw cause dumping is convenient but can disclose credentials.

Rust's adapter may use an owned record representation before handing the event to
tracing formatting. That keeps dynamic fields and projections consistent at the
cost of encoding work; this is a process adapter, not a new domain logging framework.

## Verification

Contracts and public tests precede implementation. Test filtering, nested redaction,
context ownership, projection, real adapters, queue pressure and shutdown timeout.
Run the foundations command with valid and invalid environment fixtures through
console/JSON/no-op. Record compiler, runtime and selected mutation evidence separately.
This decision does not claim OTLP or persistence integration.
