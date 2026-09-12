# Identity and attribution have different lifetimes

**Origin:** review of the existing reference provenance implementation and the
accepted n2f additions, 2026-09-11. These are design findings; executable provenance
tests have not yet been written.

A single request identifier becomes ambiguous when an event is redelivered.
Keeping workId stable and giving each execution a fresh scopeId lets two workers
be distinguished even when both report attempt 2. A number is an ordinal supplied
by an owner, not evidence that all previous deliveries were observed. Retry adds
an explicit previousAttempt only when that actual scope is available.

An initiating user can remain the same while the executor changes from an API to
a worker. Delegation represents a principal, which differs from the account or
resource affected. Keeping these roles separate avoids rewriting history when a
worker performs the action. Unknown attribution also differs from known anonymous
attribution. Scope exposes no independent actor replacement that can invalidate
an already validated delegation pair.

A queued work description must not claim it started running when it was merely
prepared. WorkContext therefore excludes execution ID/time/executor/attempt.
Execute supplies those values. This also makes broker recovery possible without
inventing a previous execution that the consumer never observed.

Causality can contain joins and replay relationships. A primary cause alone cannot
express every input. Bounded LinkSet values belong beside their owning envelope,
while replay context describes the new lineage's reason. Neither copies an entire
history into every context nor chooses a parent from list order. Missing linked
records remain missing; references do not establish durable audit evidence.

A valid external UUID proves syntax, not its sender's identity or a complete
upstream history. Fresh/continued/restarted inspection results preserve what the
boundary actually did. Unknown depth and origin remain absent after public
correlation adoption. Authenticated persisted work uses a separate full validation
path; malformed stored context must not silently become unrelated new work.

The existing ID generator is fallible and can hold its timestamp during rollback.
Provenance must preserve those failures and obtain its start time explicitly.
Factory construction cannot promise to roll back entropy or clock effects; it can
promise no partial Scope or mutation of inputs. These are distinct guarantees.

**Used in:** [the contract](../../../../../src/shared/provenance/CONTRACT.md),
[native interface proposal](../../../../../src/shared/provenance/API.md) and [worked scenarios](../../../../../src/shared/provenance/SCENARIOS.md).
Runtime propagation, envelope consistency, record timestamps and commit/audit
semantics have named future owners and must not be claimed by pure value tests.
