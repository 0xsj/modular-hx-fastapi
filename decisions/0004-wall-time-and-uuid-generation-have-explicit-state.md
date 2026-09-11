# 0004 — Wall time and UUID generation have explicit state

**Status:** Accepted · **Date:** 2026-09-11

## Context

The next leaf foundations must make time and identity controllable before
provenance, logging or event delivery uses them. The three builds need comparable
semantics without forcing one language's ownership model onto another.

## Decision

Separate clock and id modules. Keep wall time distinct from monotonic elapsed
readings. Supply production clocks and manually controlled fakes; defer timers.
Use UUIDv7 for new IDs, while parsing canonical UUID syntax independently of the
generation version. Require the standard variant, accepting opaque version nibbles.
Use an explicitly injected wall capability and cryptographic entropy. A 12-bit
counter, seeded in its low 11 bits per new millisecond, orders calls within one
generator. Hold the timestamp during rollback; return a classified refusal on
counter exhaustion. Commit state only after successful entropy. Sequence fakes
serve finite, explicit fixture lists. Keep domain ID wrappers with their owners.

## Alternatives

Direct runtime calls scatter effects and make rollback/failure tests harder.
A combined time-and-ID service couples unrelated consumers. UUIDv4 remains valid
input but does not provide time locality for new IDs. Library-owned generation
policies would hide the precise injected-clock, failure and exhaustion contract;
this small RFC-defined layout stays inside id, with OS randomness delegated to
the runtime (Go/Node) or getrandom 0.4 (Rust). No custom random algorithm is added.
Advancing logical milliseconds on counter exhaustion avoids refusal but invents
future timestamps. Sleeping conceals latency and needs cancellation policy.

## Consequences

Applications can test exact stamps and identities. The custom counter policy
requires bit fixtures, rollback, exhaustion and failure atomicity tests in every
build. Refusal means callers must choose whether/when to retry. Randomness still
matters across instances; IDs cannot establish global order or authorization.
Rust gains one direct dependency for a portable OS entropy source. Its private
adapter prevents third-party types leaking into consumers.

## Verification

Acceptance scenarios and public interface specifications are written before the
implementation. Current run results belong in STATUS.md and mirrored module notes;
this decision does not claim tests, integration or mutation checks have passed.
