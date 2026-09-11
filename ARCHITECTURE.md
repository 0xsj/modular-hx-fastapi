# Architecture

Build a modular monolith with boundaries around domain ownership. Keep the useful
responsibilities familiar across the nine to five family while using TypeScript
and NestJS where they fit. Folder similarity alone establishes neither behavioral
compatibility nor the ability to extract a module into a service.

These are review-held rules. There is no architecture checker yet. The initial
runtime is only Nest's greeting example, now composed in `src/root/`; the domain and
application boundaries below become concrete with the first business module.

## Dependency direction

`domain` owns business values, invariants, and lifecycle rules. `app` depends on
that domain and declares the ports its use cases need. Both are ordinary TypeScript
without Nest decorators, HTTP request objects, database drivers, or SDK types.

`infra` implements application ports. `transport` translates external requests into
use-case inputs and results into caller-facing responses. These edges can depend on
the application and domain; the application and domain cannot depend on the edges.

`root` selects implementations and assembles the process. Keep Nest module
registration, provider bindings, injection tokens, and factory providers here, with
controllers and infrastructure providers at their owning edges. Construct plain
application objects through explicit factories. A TypeScript interface describes
a dependency; it is not a runtime injection token.

## A business module

Create only the directories a real feature needs:

```text
src/modules/<name>/
  domain/            values, invariants, lifecycle rules
  app/
    command/         state-changing use cases and their consequences
    query/           reads and projections
  infra/             concrete adapters, with storage details owned here
  transport/         module-local HTTP or other protocol handling
```

A module owns its application interfaces and storage translation. A persistence
adapter should keep its queries, mapping, and migrations together when those exist.
Queries may use dedicated read models; they need not reconstruct aggregates only to
return a projection. The command/query split is an organization convention and
does not require separate databases or buses.

Modules do not import peer modules, including their public application surfaces.
A consumer declares the capability it needs; `root` composes an adapter against the
other module's deliberate application surface. Cross-domain workflows and composed
reads must make that coordination visible. Add events only when a real interaction
establishes their contract.

## Shared foundations and effects

`src/shared/` is reserved for capabilities with a named responsibility and concrete
consumer, which may be the process itself. Separate framework-free shared values
from infrastructure integrations as they appear. Avoid a catch-all utilities
directory or a base abstraction that makes
unrelated domains depend on one another. Logger, provenance, errors, configuration,
and storage are future work, not implemented guarantees.

Clocks, identifier generation, persistence, and publishing belong in explicit use-case
dependencies when needed. Make success and failure meaningful at the application
boundary, then translate them at transport boundaries without exposing internal
details.

Before introducing a command that both writes state and publishes an event, define
its transaction owner, commit boundary, and delivery guarantee. A decorator or a
sequence of awaited calls does not itself make the two effects atomic. A database
transaction, durable event recording, retries, and receipts each need concrete
implementation and verification before callers can rely on them. None exists here
yet.

## Process and evidence

`src/main.ts` owns entering the process; `src/root/` owns construction and wiring.
As resources and workers arrive, make startup validation and shutdown ownership
explicit there. Product rules belong in their business modules, not in bootstrap
or global Nest middleware.

Keep unit tests near their subject and assembled HTTP checks in `test/`. Add checks
for the guarantees introduced by a feature, including meaningful failure paths.
Comparable scenarios across backends matter more than matching implementation
details. Real Flover integrations will establish which compatibility assumptions
hold.

Record discoveries in [notes](notes/README.md), durable choices in
[decisions](decisions/README.md), and implemented behavior and verification limits in
[STATUS.md](STATUS.md). Update this document when an accepted boundary changes.

## Local dependency topology

[Compose](compose.yaml) owns this clone's PostgreSQL, Redis, Mailpit, S3 and
observability containers, network and data volumes. [INFRASTRUCTURE.md](INFRASTRUCTURE.md) describes local operation.
Applications run separately for now. Adding a container does not select a driver,
create a migration, or supply an application port implementation.

## Selected foundation boundaries

[Observability](OBSERVABILITY.md) is a first-class process responsibility, with OTLP
as the export boundary and shared meaning across logs, traces and metrics. WebSocket
is the chosen realtime transport. SMTP and S3 clients live in owned infrastructure
adapters. Their SDK types must not become domain APIs.

For state-changing event workflows, atomically record the event in an outbox. Keep
delivery separately owned so JetStream or a simpler dispatcher can be supplied
without moving the transaction boundary. Swapping adapters requires equivalent
failure/retry/duplicate scenarios; an interface alone does not establish parity.
The first event and WebSocket implementations still need concrete wire contracts.
