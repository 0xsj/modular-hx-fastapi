# 0011 — Identity includes credentials and revocable sessions

**Status:** Accepted · **Date:** 2026-09-12

## Context

The user expects authentication out of the box. The initial principal implementation
establishes identity values but cannot authenticate a caller. A separate account/
profile module should not be required to turn that foundation into a usable backend.

## Decision

Identity owns email/password credentials, verification/recovery and opaque revocable
sessions alongside principals. Browser cookie sessions are the working first client
adapter. Keep hash/token effects behind identity-owned capabilities; authoritative
PostgreSQL state and an auth epoch determine admission. Preserve domain-free shared
infrastructure and root-owned cross-domain/provenance translation.

State changes and promised safe events commit atomically. Recovery secrets are
stored only as digests; mail is an explicit post-commit best-effort effect with
resend recovery. No secret is placed in the generic event outbox.

The detailed behavior, logical schema, native API map and staged acceptance criteria
are recorded in AUTHENTICATION.md and the identity auth contract. They are specified,
not evidence of a working authentication implementation.

## Alternatives

A separate auth domain now would split principal eligibility and credentials across
a boundary without a demonstrated independent owner. A profile-first dependency
would delay authentication without supplying proof of identity.

Self-contained access JWTs would add expiry/rotation/revocation tradeoffs before
the clients require offline token verification. Opaque sessions favor one current
authority and straightforward logout at the cost of a state lookup.

An external IdP can later supply a different proof adapter, but does not implement
the requested self-contained email/password baseline by itself.

Durable mail retry requires recoverable protected token material or a separate
delivery protocol. Best-effort send plus resend avoids that extra secret-retention
surface initially; a crash after commit can lose the delivery attempt.

## Consequences

Built-in auth is a completion requirement, not an optional later domain. The first
client default does not prove compatibility with all Flover frameworks. API and
cookie integration must be tested with actual clients.

Operational unavailability can refuse authentication. Already-admitted work is not
retroactively canceled by revocation. Password, session and challenge concurrency
requires real database tests; leaf invariants alone cannot prove these guarantees.

## Verification

This record precedes auth implementation. Contracts and repository-local links are
checked in this specification stage. Executable auth tests, crypto interoperability,
database, browser, mail and WebSocket verification remain required, as listed in
AUTHENTICATION.md. Earlier principal tests remain limited to principal behavior.
