# PostgreSQL is the atomic boundary

Enqueue accepts the caller's leased transaction. The command writes domain state
and the outbox row through that same transaction; no network publish happens before
commit. Claim uses FOR UPDATE SKIP LOCKED and commits its 30-second lease before
publication. Ack and release require the current unexpired token, preventing a slow
old worker from completing a reclaimed lease.

Publication inserts into a durable mailbox in another transaction. If the process
dies after this commit but before outbox ack, delivery repeats. Identical event ID
and content is idempotent; conflicting reuse fails. The mailbox retains a single
copy and does not reset a processed row to pending.

The consumer locks one row and runs local effects inside a savepoint. Failure rolls
back those effects, then records retry/dead state in the outer transaction. Success
commits effects and processed state together. The five-attempt policy counts committed
attempt metadata: a lost connection or whole-transaction timeout can roll that
metadata back. It is not a strict maximum on physical callback invocations.

Callbacks await their database operations and return without committing manually,
starting detached work or invoking external effects. Those actions cannot be made
atomic by this API. Non-acknowledged commit remains uncertain; there is no hidden
transaction retry.

A real regression exposed an encoding boundary: jsonb inserts whitespace when
rendering text. A compact array of 30,000 zeroes fits the 64 KiB envelope but its
jsonb rendering does not. Store the validated wire as text with an octet-length
check; use jsonb comparison only for duplicate equivalence. The real integration
test now sends that payload through enqueue, dispatch and consume.

Migration SQL is owned under this adapter's migrations directory. Root supplies its
ordered version in the application ledger. Exact checksums reject edits and missing
history. The diagnostic migration is not an automatic migration strategy for every
future domain database.
