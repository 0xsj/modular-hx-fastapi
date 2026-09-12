# Infrastructure before domains

Status: implemented and verified. This is the authorized order across the three
independent blueprints; a checked item requires executable evidence, not a folder.

1. [x] Validation and pagination leaves.
2. [x] PostgreSQL configuration, migrations, pool and explicit transaction ownership.
3. [x] Liveness/readiness and draining, with bounded required-dependency checks.
4. [x] Outbound HTTP with deadlines, bounded bodies and explicit propagation.
5. [x] WebSocket connection/message lifetime, admission and bounded delivery.
6. [x] Versioned events, transactional outbox and replaceable delivery.
7. Identity, audit and org are the subsequent domain work, outside this change.

## Rules for this slice

Contracts precede implementation. Build and verify each stage across all three
before the next. Diagnostic consumers demonstrate real I/O without inventing
identity, tenancy or authorization policy. Tests use comparable scenarios;
ordinary implementation-visible tests are not described as blind specification
tests. Notes mirror full source directories.

Root owns resources, config, observation and shutdown. Domain/application ports
remain consumer-owned; database, HTTP, WebSocket and broker types stay in adapters.
No generic repository or cross-module imports. Every external effect has a finite
budget. A timeout after a write is not proof of rollback.

## Deliberate boundaries

Validation produces bounded, safe field issues; domain invariants stay in domains.
Pagination owns page limits and a versioned opaque cursor codec; callers own stable
ordering, tie breakers and query/tenant binding. Cursor encoding is not encryption,
authentication or authorization.

Postgres owns connection pooling, a checksummed forward migration ledger and an
explicit transaction callback. The caller owns the command boundary. No automatic
transaction retry. Commit acknowledgement failure is explicitly uncertain.
Credentials are disclosed only to the driver, never logs or public errors.

Health separates process liveness from readiness. Readiness is false while starting
or draining and checks only dependencies required for serving. Collector availability
does not gate readiness. Public health replies omit dependency diagnostics.

Outbound HTTP owns one attempt, a caller-provided cancellation/deadline, bounded
request/response bytes and explicit destination policy. HTTP non-2xx is a received
response, not a network failure. Redirects and retries are not automatic.
Credentials and provenance are not copied from inbound headers indiscriminately.

WebSocket upgrades have their own transport owner; they are not JSON HTTP responses.
Origin admission, frame/message limits, heartbeat, disconnect and shutdown are
explicit. A successful local write is not proof a client processed a message.
Connection context does not authorize tenant membership. Application commands and
subscriptions remain domain-owned.

Events have immutable IDs, versioned type names, occurrence time and stable work
provenance. Outbox insertion uses the same transaction as its owner's state change.
Delivery has a replaceable publisher capability: acknowledgement means the selected
adapter accepted responsibility, not that every consumer finished. At-least-once
delivery requires consumer deduplication in the same transaction as consumer effects.
Retries, leases, poison handling and shutdown are observable and bounded. A NATS /
JetStream adapter must satisfy the same receipt semantics; a Core NATS fire-and-forget
publish cannot substitute for a durable acknowledgement. Outbox and transport are
complementary, not competing implementations of atomicity.

## Verification scope

Pure malformed/boundary/ownership scenarios; real Postgres commit, rollback,
migration drift and concurrent operations; health startup/dependency failure/drain;
loopback HTTP status/deadline/size/cancel/redirect cases; real WebSocket handshake,
message bounds and close; outbox rollback, delivery failure, lease recovery and
duplicate delivery. Retain targeted mutation results and language-specific findings.

## Run the diagnostics

Use this clone's normal toolchain and installed dependencies. HTTP keeps database
integration opt-in; existing HTTP examples can still start without Postgres.

```sh
docker compose up -d --wait postgres
DEMO_TOKEN=local-demo DATABASE_ENABLED=true \
DATABASE_URL=postgres://n2f:n2f_local@127.0.0.1:7220/n2f \
pnpm run http:example
```

HTTP settings extend [the existing HTTP guide](TELEMETRY_HTTP.md):

| Setting | Default / meaning |
| --- | --- |
| `DATABASE_ENABLED` | `false`; when true, DB startup and readiness are required |
| `DATABASE_URL` | Required secret when DB is enabled |
| `DATABASE_MAX_CONNECTIONS` | 8; range 1..64 |
| `DATABASE_TIMEOUT_MS` | 1000; range 1..30000 |
| `OUTBOUND_ORIGIN` | Optional one HTTP(S) origin; diagnostic calls `/probe` |
| `WS_ORIGIN` | `http://localhost:3000`; exact allowed browser Origin |

`/livez` reports process liveness; `/readyz` reports serving state and required
DB availability. A database outage makes readiness 503 without making liveness fail.
`/_examples/outbound` returns the upstream status and body byte count.
`/_examples/socket` requires subprotocol `n2f.v1`; send
`{"v":1,"id":"one","type":"ping","payload":{}}` for a pong with fresh scope IDs.
These endpoints demonstrate infrastructure and do not authenticate users.

Run the finite event producer/dispatcher/consumer against a **dedicated diagnostic
database**. It installs event migration 1 and requires a compatible migration ledger;
do not point it at an unrelated application's migration history.

```sh
DEMO_TOKEN=local-demo \
DATABASE_URL=postgres://n2f:n2f_local@127.0.0.1:7220/n2f \
pnpm run events:example
```

The event process logs enqueue, dispatch, consumption and completion, then closes its
resources. It is not a background worker service. Root supplies polling and stop
budgets; domain consumers will supply their own effects and execution provenance.

## Contracts and evidence

- [validation](src/shared/validation/CONTRACT.md).
- [pagination](src/shared/pagination/CONTRACT.md).
- [postgres](src/shared/postgres/CONTRACT.md).
- [health](src/shared/health/CONTRACT.md).
- [httpclient](src/shared/httpclient/CONTRACT.md).
- [socket](src/shared/socket/CONTRACT.md).
- [events](src/shared/events/CONTRACT.md).
- [Runtime and language notes](notes/modules/src/root/infrastructure-verification.md).
- [Durability decision](decisions/0009-outbox-recording-and-replaceable-delivery.md).

```sh
python3 tools/verify_infrastructure.py
python3 tools/verify_transports.py
python3 tools/mutations/infrastructure.py
```

The database verifier creates isolated Compose projects and fresh test databases,
checks transaction/migration and event behavior, runs the compiled event example,
and stops/restarts its own DB to exercise readiness. It stops its containers on
exit; named volumes are retained. Standalone unit suites skip the explicit real-DB
tests unless their disposable database prerequisite is supplied.

For stored outbound telemetry, start local observability and set
`N2F_VERIFY_OTLP_ENDPOINT` and `N2F_VERIFY_GRAFANA` when running the transport verifier.
It checks the propagated child span, stored CLIENT kind/parent/status, and bounded
histogram labels. The verifier uses Compose's default local Grafana credentials.

Observation today: HTTP server and client traces/metrics, server OTLP logs, and
scoped local socket/event diagnostic logs. Dedicated socket/event OTLP instrumentation,
operational dashboards and automated dead-row alerts remain future work. The six
selected mutations per build are targeted fault evidence, not an exhaustive score.

## JetStream replacement validated

The [JetStream slice](JETSTREAM.md) now supplies a second real publisher and a
pull-consumer handoff into the PostgreSQL mailbox. The existing outbox dispatcher
and database consumer APIs are unchanged. Root selects `EVENTS_TRANSPORT=postgres`
or `jetstream`. Restart, duplicate, conflicting-ID, failed-handoff and outage checks
exercise the actual broker; this extends the earlier PostgreSQL-only evidence.
