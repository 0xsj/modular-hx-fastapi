# Identity domain: principal leaves

Status: principal leaves implemented. Credentials and sessions belong to identity
and are required baseline scope; AUTH_CONTRACT.md specifies that next stage.
Persistence and transport remain separate owners; a principal value grants no access.

I01: A principal has a nonzero validated shared UUID, kind (human or service), display
name, status (active or suspended), created-at and updated-at Unix milliseconds,
and a positive version. Display name is presentation, not a unique identifier.
I02: Display names contain 1..100 Unicode scalar values and no C0/DEL control
characters. ASCII-whitespace-only input refuses. No trimming, case folding or Unicode
normalization occurs; supplied spelling is retained. Invalid Unicode refuses where
representable in the host language. Errors contain stable safe codes, not raw input.
I03: Registration takes explicit identity and occurrence time; it does not read a
clock or generate IDs. Time lies in 0..253402300799999. A new principal is active,
created-at equals updated-at, and version is 1. Unknown kind/invalid fields refuse.
I04: Restore validates all invariants: known kind/status, valid display name and ID,
positive version within 1..2147483647, updated-at >= created-at and bounded times.
Registration and restore are separate operations; restore must not reset stored state.
I05: Suspend and activate are immutable transitions. They require the supplied
expected version to equal the current version, reject an already-reached status,
reject backward/out-of-range time and version overflow, preserve ID/kind/name/created
at, and increment version exactly once. Equal timestamps are allowed. A refusal
leaves the original value unchanged. Persistence must still enforce this expected
version atomically; a pure transition alone does not prevent concurrent lost updates.
I06: Snapshots are caller-owned; modifying a returned snapshot cannot mutate the
principal. Shared immutable ID/string values may be copied by value. The Go zero
value and forged TypeScript inputs must fail public transition validation.
I07: Failure vocabulary: invalid principal data -> Invalid identity.principal_invalid;
stale expected version -> Conflict identity.version_conflict; same-state transition
-> Conflict identity.state_conflict; exhausted version -> Conflict identity.version_exhausted.
Validation of current state precedes transition evaluation; expected-version refusal
precedes same-state refusal. Transport selects wire status, never this package.
I08: Registration facts will use identity.principal.registered.v1, carrying principal
ID/kind and stable producer work. Display names and credentials do not belong in a
generic event log or audit projection. Event envelope encoding stays in the owning
application/persistence adapter; this pure principal does not publish.
