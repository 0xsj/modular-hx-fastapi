# PostgreSQL contract

D01: Root supplies a secret connection URL, pool size 1..64 and operation budget
1..30000 ms. No ambient env reads in this adapter. Validate config before I/O;
startup must actually ping. Public failures never contain URLs, SQL or driver text.
Driver types are allowed only in root and concrete infrastructure consumers.
D02: Every operation uses a finite budget; transactions set local statement and
idle-in-transaction timeouts. Root stops admission and drains owners before closing
the pool. Closing is bounded and prevents subsequent admission.
D03: Transaction callbacks use one leased connection. Success commits once; returned
failure, throw/panic or cancellation before commit rolls back / discards the session.
No automatic retry. Callbacks must await all work and must not retain handles,
commit manually, start detached work or perform external effects.
D04: A commit error not known to be a server refusal is database.commit_uncertain
(Unavailable); it must never be called rolled back. Server serialization/deadlock
refusals remain Conflict without automatic retry. SQL uniqueness is Conflict with a
generic database code, not a guessed domain error. Missing rows stay optional at
their consuming query boundary.
D05: Root supplies ordered migrations (positive increasing integer version and
nonempty SQL). A transactional advisory lock serializes migration runners. The
ledger stores SHA-256 of exact SQL bytes. Refuse changed, missing or reordered
history. Apply unapplied migrations and ledger records in one transaction; failure
rolls back both. No automatic down migration, schema drop or domain table.
D06: Observation uses operation names and safe outcome categories, never SQL,
parameters or DSNs. The diagnostic consumer must verify startup, migration re-run,
drift, commit, rollback, failed statement and concurrency against PostgreSQL 18.
