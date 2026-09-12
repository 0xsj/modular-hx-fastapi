# 0005 — Provenance separates logical work from its executions

**Status:** Accepted · **Date:** 2026-09-11

## Context

The errors, clock and ID leaves now exist. Provenance must supply shared meaning
for later logs, events and audit records across Go, Rust and Nest. The accepted
scope includes attribution roles, retry identity, explicit start time, replay and
multiple causes, operation/socket scope boundaries and incoming-context disposition.

## Decision

Model immutable Scope executions and reusable WorkContext separately. Mint a new
scope for each execution while retaining logical work across attempts. Capture
start time explicitly through the existing clock capability. Preserve initiator,
executor and represented principal as distinct roles, with explicit tenant and
inheritance rules. Keep unknown attribution distinct from known anonymous work.

Replay opens a new chain with new attribution and explicit source/run references.
Bounded typed links describe additional relationships beside an owning envelope.
An incoming correlation hint is inspected separately from a full persisted work
snapshot: fresh, continued and restarted contexts have different diagnostic meaning.
Public hints cannot supply actors, tenants or execution control fields. An unknown
upstream origin/depth remains unknown. Operational records do not grant authority.

Record behavior and native API proposals before tests or implementation. All these
additions belong to the specification; transport, broker, tracing, serialization
and durable audit adapters remain distinct owners with their own later checks.

## Alternatives

Reusing an execution ID for retries obscures concurrent attempts. A single actor
loses either the initiating principal or the current executor. Automatically
inheriting all metadata across every transition can misattribute replays and
cross tenant boundaries. A single causal parent cannot express joins.

A generic metadata map makes propagation convenient but leaves ownership,
validation and disclosure to each caller. Carrying transport or tracing types in
the core couples the three builds to unrelated runtime choices. Treating all
incoming or stored context as equally authoritative launders claims into facts.

## Consequences

More explicit values and constructors make lifetime rules reviewable and testable.
Native API shapes can differ while scenarios remain comparable. ID failures remain
visible to callers; provenance adds no hidden retries. Bounded links require a
manifest for larger batches. Immutable ownership adds copying where languages
otherwise expose mutable Dates, slices or arrays. References and depth do not prove
record existence, global ordering, cycle detection, a commit or durable publication.

## Verification

The module contract records P01–P24 and worked examples. Current documentation and
build checks belong in STATUS.md. No executable provenance tests, mutation score,
adapter integration or application behavior is claimed by this decision.
