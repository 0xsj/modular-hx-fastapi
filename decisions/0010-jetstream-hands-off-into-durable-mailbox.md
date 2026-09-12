# 0010 — JetStream hands off into a durable mailbox

**Status:** Accepted · **Date:** 2026-09-11

## Context

The user asked for a real JetStream setup to validate replaceable core infrastructure.
Decision 0009 separated outbox recording from durable publication. An alternative
publisher alone cannot prove that consumer effects remain safe after redelivery.

## Decision

Keep the existing dispatcher and Publisher receipt contract. Add JetStream PubAck
publication, then a durable pull transfer into the PostgreSQL mailbox. Acknowledge
JetStream only after the mailbox returns a matching durable receipt. Continue using
the existing database consumer transaction for effects and its processed marker.
Root selects transport, validates stream configuration, owns polling and closes it.

Use official NATS connection clients with the documented JetStream request/reply
protocol at the concrete adapter. The small fixed API covers stream/consumer setup,
publish acknowledgements, duplicate reads, pull-one and confirmed acknowledgement.
Broker SDK/protocol types do not appear in the shared envelope or consumer port.

## Alternatives

Calling Core NATS publish without a PubAck cannot satisfy durable acceptance. Running
business effects before broker acknowledgement without a durable deduplication record
can repeat them after a crash. Replacing the PostgreSQL consumer transaction with a
broker acknowledgement does not atomically commit database state. The existing
mailbox already provides the local deduplication and transaction boundary.

High-level JetStream SDK APIs remain a valid adapter implementation choice. The fixed
protocol keeps three consumers comparable but makes response validation, subscription
ownership and compatibility checks our responsibility. Real protocol tests are required.

## Consequences

The switch is executable through root configuration, not an interface-only claim.
One local stream and one durable consumer are not a domain fanout architecture.
The two-minute broker deduplication window does not replace durable mailbox records.
Single-node file storage is local durability, not high availability. Limits retention
and discard-new preserve existing messages but require later operational cleanup.

Normal infrastructure ports remain disjoint: Go 71xx, Nest 72xx, Rust 73xx. Broker
client/monitoring ports end in 22/23. Local authentication and deployment TLS/cluster
policy are separate future concerns, not inferred from successful local tests.

## Verification

Real Postgres/JetStream scenarios exercise lease recovery after lost outbox ack,
duplicate/conflicting IDs, failed sink redelivery, no repeated consumer effects,
full-size envelopes, closed publisher retaining pending state, incompatible-resource
refusal, and persisted pending delivery after forced broker recreation. Compiled
root examples pass with both transport selections. See [the run guide](../JETSTREAM.md).
