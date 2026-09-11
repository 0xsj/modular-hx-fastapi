# 0001 — Each blueprint owns its local infrastructure

**Status:** Accepted · **Date:** 2026-09-10

## Context

Each n2f backend must be usable from an independent clone. The builds also need
to run side by side to compare behavior. The initial infrastructure requested is
PostgreSQL 18 and Redis; a shared monorepo infra directory can be reconsidered later.

## Decision

Each repository carries a root `compose.yaml` and `.env.example`. PostgreSQL 18
is the initial relational store and Redis is available for cache and ephemeral
coordination adapters as those consumers arrive.

The Compose contract is the same in each build: services named `postgres` and
`redis`, a repository-specific default project name and host ports, loopback-only
published ports, readiness checks, and project-scoped persistent volumes. There
are no fixed container names or external networks. Environment overrides allow
another clone to use its own project name and ports.

Compose starts dependencies; application processes continue to run with their
language's local tooling. Database drivers, migrations, cache APIs, broker
semantics, and application startup dependencies remain separate implementation
choices. Infrastructure availability does not establish a working adapter.

## Alternatives

- A central infra directory makes shared maintenance easier, but introduces a
  dependency outside an independent clone. Defer that topology.
- Shared database and Redis containers use fewer resources, but couple the builds'
  data and lifecycle unless additional isolation is maintained. Prefer isolation.
- Starting an events broker and a full telemetry stack immediately expands runtime
  scope before their contracts exist. Document those candidates and add them with
  their first integration.

## Consequences

Each repository is self-contained and can be started or stopped independently.
Equivalent configuration is duplicated deliberately and changes must be compared
across the family. Running all builds consumes more resources.

The provided credentials and network settings serve local development. PostgreSQL
initialization settings apply to a new data directory; changing environment values
does not migrate existing data or change an existing database password.

## Verification

Before recording this implementation as verified, resolve each Compose file,
start all three stacks together, exercise PostgreSQL and Redis, and check that
written data survives container recreation. Use disposable verification projects.
Record results and remaining limits in `STATUS.md`; the decision itself does not
claim that these checks have already passed.

