# Recording and delivery are separate promises

A #raw field is runtime-private; TypeScript private alone would be ordinary JavaScript property access after compilation. The constructor copies bytes and decode reconstructs normalized data. Work and nested input objects are validated before becoming a frozen envelope. The Publisher structural interface requires only the consumed capability.

The envelope keeps producer WorkContext, including initiator/represented principal,
tenant, causation, depth and replay links. An execution scope is not serialized as
the event's durable identity. The future domain consumer opens its own execution
from admitted stored work. The finite diagnostic currently logs its root scope.

Publisher belongs to the dispatcher that consumes it. A receipt must be durable
and name the same event; a successful call with the wrong receipt leaves delivery
unacknowledged. Offline and wrong-receipt test doubles exercise this seam. They do
not prove NATS behavior. The [JetStream adapter](jetstream/protocol-and-ownership.md)
now has real PubAck, restart, redelivery and mailbox-handoff checks; a Core NATS
fire-and-forget write is not an equivalent adapter.

The [PostgreSQL note](postgres/atomicity-and-leases.md) records actual storage and
consumer atomicity. Mailbox is one local delivery destination. Three future domains
do not automatically imply three subscribers to this one processed marker. Fanout
needs consumer-specific delivery/deduplication state before multiple domains share
an event. Audit records and their retention rules remain owned by the audit domain.
