# Readiness can fail while the process is alive

Origin: real HTTP process checks with PostgreSQL stopped and restarted. /livez
remained 200 while /readyz became 503, then recovered to 200. Public errors did
not contain the fixture token or connection URL. No collector is a required check.

Drain is irreversible and state is checked again after asynchronous probes; a
probe that started before drain cannot publish a stale ready result. One admitted
evaluation bounds concurrent dependency checks. Go and JavaScript retain the busy
slot until a non-cooperative callback ends, even after the caller times out. Rust
drops the owned future on timeout; no spawned probe survives it. These are deliberate
runtime differences with the same bound on admitted work.

Used by the root HTTP composition. Root enables the database requirement only with
DATABASE_ENABLED=true and a secret DATABASE_URL. A PostgreSQL startup ping must
succeed before the process announces a listener. This does not establish schema
compatibility or readiness for future identity/org dependencies.
