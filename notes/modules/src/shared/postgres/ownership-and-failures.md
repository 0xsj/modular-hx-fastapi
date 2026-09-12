# A transaction needs an acknowledgement boundary

Origin: PostgreSQL 18 integration tests, including a callback that swallows SELECT
1/0, a failed multi-statement migration, concurrent writes and a delayed query.

node-postgres requires a leased PoolClient throughout a transaction. COMMIT can return command ROLLBACK after a swallowed query error; inspect the receipt. Timeouts destroy the leased client rather than returning it for reuse while a callback still runs. AbortSignal is cooperative for callback code; Promise.race cannot terminate arbitrary JavaScript.

A network error after COMMIT begins is database.commit_uncertain. It is not proof
of rollback and must not automatically trigger a retry. SQL uniqueness maps to
generic database conflict; the domain adapter decides which business condition it
represents. Driver text is deliberately excluded from generic failures because it
can contain SQL and credentials.

Migrations hold a transaction-scoped advisory lock, compare SHA-256 of exact SQL
bytes and apply DDL with its ledger row atomically. Tests observed that failed DDL
did not leave its table. Migration SQL is trusted owner-supplied code, never user input.
Use a disposable empty database for integration tests; verify_infrastructure.py
creates one in its own Compose project.

Dependencies read: [pgx pool](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool),
[SQLx transactions](https://docs.rs/sqlx/0.8.6/sqlx/struct.Transaction.html),
[node-postgres transactions](https://node-postgres.com/features/transactions).
Versions: pgx 5.11.0, SQLx 0.8.6 (Rust 1.86 compatible), pg 8.23.0.
