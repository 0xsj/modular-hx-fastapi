# Real JetStream replacement verification

Date: 2026-09-11. Implementation-visible integration tests, not blind specification
tests. [Run guide](../../../../JETSTREAM.md).

The existing outbox dispatcher and Publisher contract remain unchanged. Root selects
PostgreSQL or JetStream and, for the latter, transfers into the existing durable
mailbox. That extra handoff preserves database consumer effects and deduplication.
A broker acknowledgement does not replace a PostgreSQL transaction.

## Checked with actual adapters

[Machine-readable evidence](jetstream-evidence.json).

The self-contained verify_jetstream.py runner creates an isolated PostgreSQL and
NATS Compose project with fresh databases and streams. It verifies:

- Rolled-back enqueue cannot dispatch.
- Lost outbox acknowledgement leads to broker deduplication on a reclaimed lease.
- Same ID with changed payload refuses; nondurable sink receipt cannot acknowledge.
- Failed handoff redelivers and the database consumer produces no duplicate effect.
- A full 65536-byte event survives protocol headers, broker storage and mailbox handoff.
- A closed publisher retains pending outbox state.
- Compiled root selects and completes both PostgreSQL and JetStream delivery.
- Incompatible stream settings cause safe failure without automatic rewriting.
- A pending envelope survives SIGKILL and forced container recreation byte-for-byte,
  then transfers and consumes through the restarted root.
- Broker outage produces safe failure; a subsequent root run can reopen and complete.

The normal Go, Nest and Rust NATS services run simultaneously on their own ports.
The effective Compose port audit found 30 unique loopback TCP mappings, with no
cross-stack duplicates. [Retained port audit](jetstream-ports.json).
Verification fixture projects are stopped; their volumes remain. Normal development
JetStream containers are intentionally left running.

Full ordinary suites passed after dependency and root changes; explicit DB/broker
tests skip in those ordinary runs and were exercised by the real verifier. Go race
checks/vet, Rust clippy and Nest lint/type/build checks are recorded in STATUS.md.
Existing HTTP stored-telemetry and mutation matrices were not repeated for this
slice. No new mutation-score claim is made.

## Deliberate limits

One local file-backed replica, one durable pull destination and a finite root example.
No fanout, global ordering, broker reconnect service, deployment authentication,
cluster failover or exactly-once guarantee. Exhausted broker deliveries remain in
the limits stream; there is no automatic dead-letter queue or alert. Scoped local
logs show selection, dispatch, handoff and consumption; dedicated broker OTLP
instrumentation remains separate work.
