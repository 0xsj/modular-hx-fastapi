# Infrastructure verification and runtime comparison

Date: 2026-09-11. Contracts were added before implementation. Tests were written
with implementation visibility; none is claimed independent or blind.

The authorized sequence was validation/pagination, PostgreSQL, readiness, outbound
HTTP, WebSockets, then events. No identity, audit or org domain was created.
The [run guide](../../../../INFRASTRUCTURE_BUILD.md) lists commands, defaults and current limitations.

## Evidence

[Machine-readable summary](infrastructure-evidence.json).

- The final sampled HTTP regression passed 48 requests and 48 completion logs,
  plus six invalid-config starts. All selected SERVER spans, linked logs and
  duration series were retrieved after the root changes.

- Full ordinary suite passed; real database tests are opt-in and were exercised
  separately against isolated PostgreSQL 18.6 databases.
- Real DB checks cover checksummed migration reruns/drift, failed DDL rollback,
  committed and refused callbacks, swallowed SQL error, concurrent writes, deadlines
  and closed pools. Event checks include leases, receipts, duplicates, savepoints,
  poison retention, concurrent claims and near-limit envelope storage.
- Compiled event example enqueues, dispatches, consumes, logs completion and exits.
- Real HTTP readiness changes 200 → 503 → 200 around a required DB outage; liveness
  stays 200. Root shuts down within its configured budget and logs omit credentials.
- Real socket checks cover admission, message scope identity, control frames, close
  codes and an open connection during process shutdown. Outbound fixtures cover
  one-attempt status, deadline, cancellation, redirect and body-bound behavior.
- Stored outbound CLIENT span has the expected server parent and forwarded child
  traceparent. A received 409 remains a response value and an errored client span.
  Its duration histogram is retrievable and contains no request/trace IDs as labels.
- Six selected infrastructure mutations were caught: report overflow, wrong cursor
  anchor, reopened drain, wrong receipt, stale lease and surviving consumer effects.
  [Retained report](infrastructure-mutations.json) gives source hashes and exact cases.

Nest passed the full unit suite, type checking, lint, build and the existing HTTP end-to-end test. Node 24 and pnpm are required as documented. AbortSignal communicates cancellation, while a Promise can still run after a timeout; adapters destroy or retain ownership of leased resources accordingly.

## What the evidence does not establish

The selected mutations are not exhaustive. No JetStream adapter, broker fanout,
domain authorization, audit retention, frontend compatibility, deployment TLS,
heartbeat-loss soak or saturation benchmark is claimed. Socket/event diagnostics
have scoped local logs; dedicated OTLP instrumentation and dead-row alerts remain
subsequent work. PostgreSQL diagnostics use disposable schemas and explicit test
credentials, never an existing application's database.
