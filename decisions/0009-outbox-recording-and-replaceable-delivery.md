# 0009 — Outbox recording and replaceable delivery

**Status:** Accepted · **Date:** 2026-09-11

## Context

The user selected infrastructure before identity, audit and org and required events
to remain replaceable underneath, including possible NATS. Database atomicity and
broker acceptance are separate promises. The common contracts were written before
implementation; this record captures the completed choice and its observed costs.

## Decision

Use the caller's PostgreSQL transaction to record state and the immutable event.
The dispatcher owns a narrow Publisher capability: a durable receipt must name the
same event. Use a PostgreSQL mailbox as the first concrete delivery destination.
Claim/lease commits before publication; stale or expired leases cannot acknowledge.
At-least-once redelivery is expected. Mailbox insertion deduplicates IDs and the
consumer's local effects and processed marker commit together.

Store validated envelope bytes as text with a 65536-byte check. Compare duplicate
JSON semantically using jsonb casts, without reformatting the persisted bytes.
Keep migration checksums exact and forward-only; root owns the complete ledger.

## Alternatives

Publishing directly in the state transaction does not atomically commit a remote
broker and PostgreSQL. Broker-only publication cannot replace the outbox guarantee.
An in-memory queue or Core NATS publish cannot satisfy a durable receipt. JetStream
is a credible future adapter, but an interface and test double are not proof of its
acknowledgement, recovery or deduplication behavior. Storing only jsonb expanded
compact envelopes on retrieval and could violate the codec's byte limit.

## Consequences

No domain needs to know the transport SDK. A JetStream publisher can replace durable
publication while preserving the outbox transaction boundary. Its subscriber/inbox
adapter still needs separate implementation and real tests. The current mailbox is
one local destination, not fanout, ordered streams, or a durable audit domain.

Five committed failed attempts retain a dead row; crashes or aborted transactions
can roll back consumer attempt metadata. No global exactly-once or physical invocation
limit is claimed. Operators can inspect retained rows; automated alerting is not yet
implemented. No automatic database retry hides a possibly committed write.

## Verification

Real PostgreSQL tests cover rollback, migration drift and failed DDL, duplicate and
conflicting reuse, publisher refusal, wrong receipt, stale lease, poison handling,
consumer savepoint rollback and concurrent claims. A compact near-limit payload
survives outbox and mailbox storage. A compiled root diagnostic exercises the chain.
See [the guide](../INFRASTRUCTURE_BUILD.md) for commands and limits.
