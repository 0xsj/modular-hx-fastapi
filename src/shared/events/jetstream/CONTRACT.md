# JetStream delivery adapter

J01: Implements the existing Publisher capability; no change to the outbox's
transaction or receipt API. A successful receipt requires a JetStream PubAck with
the configured stream and a positive sequence. Core fire-and-forget is insufficient.
The adapter uses the official NATS connection client's request/reply API for the
documented JetStream JSON protocol; broker types stay inside this adapter.
J02: Root supplies URL, stream, durable consumer and a 1..5000 ms operation budget.
Names are ASCII letters/digits/underscore, 1..40 bytes. Subject is derived from the
stream: n2f.events.<stream>. Root explicitly provisions or validates configuration;
an incompatible existing stream/consumer refuses without rewriting it.
J03: File storage, one replica for local development, limits retention, discard-new,
64 MiB maximum, 131072-byte broker messages (including headers), 65536-byte event
envelopes and a two-minute duplicate window. This is local
durability, not replicated availability. Nats-Msg-Id is the immutable event UUID.
A duplicate PubAck is checked against the stored sequence's semantic JSON content;
conflicting ID reuse refuses. Beyond the duplicate window, redelivery is possible.
J04: Durable pull consumer has explicit ack, one pending delivery, one-second ack
wait and five broker deliveries. Transfer one message into a supplied durable
Publisher (the PostgreSQL mailbox at root), validate its matching receipt, then
double-ack JetStream. Never acknowledge before the destination commits. Timeout
after either commit is uncertain and can redeliver; mailbox deduplication is durable.
J05: Empty pull is distinct from transport failure. Invalid envelopes or sink refusal
remain unacknowledged; max-delivery rows remain in the limits stream for inspection.
No hidden polling worker, automatic publication retry, reconnect buffer or external
effects in a database transaction. Root owns calls, logs, stop and close. Caller
cancellation is explicit (context/signal or dropping the Rust future).
J06: Tests use the unchanged real Postgres dispatcher with either publisher, prove
rollback/no publication, durable publication, duplicate/conflicting reuse, transfer
failure and retry, no duplicate consumer effects, stopped broker refusal and persisted
delivery after server recreation. No fanout, global ordering, unlimited retention,
exactly-once processing or operator alerting claim.
