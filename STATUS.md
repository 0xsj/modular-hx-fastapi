# Status

## 2026-09-12 — Built-in authentication contract

Corrected baseline scope: identity includes authentication, without an account/profile
prerequisite. Added A01–A24, native leaf/capability shapes, a logical schema and the
[staged acceptance plan](AUTHENTICATION.md). ADR 0011 records opaque revocable sessions,
identity-owned credentials and explicit post-commit mail/resend semantics.

The working first client is email/password with browser cookie sessions. Contracts
cover verification/recovery, bounded password hashing, token-purpose separation,
session expiry/revocation, version-guarded atomic writes, CSRF, authenticated
provenance, WebSocket checks and safe audit translation. These are specifications,
not implemented auth endpoints or executable auth tests.

Reviewed current OWASP/NIST primary guidance; sources are in the auth contract.
Common contract/API/schema content and local links were checked across the builds.
Runtime code and dependencies are unchanged; prior suites and mutation checks were
not rerun for this documentation-only stage. Module notes mirror the domain path.

## 2026-09-12 — Identity principal leaves

Defined identity/audit/org ownership and implemented identity I01–I07: human/service
principals, validated display names, owned snapshots, restoration and immutable
suspend/activate transitions with version/time guards. The initial slice provisions
principal values; credentials and sessions are deferred.

Four named leaf tests passed per build after behavioral failures against refusing
stubs. Four selected compiled mutations were caught per build; isolated baseline and
restored runs passed. These implementation-visible checks are not exhaustive.
Go race/vet, Rust clippy with warnings denied, and Nest type checks passed.
See [mirrored notes and evidence](notes/modules/src/modules/identity/domain/README.md).

A review exposed erased TypeScript constructor privacy: Reflect.construct bypassed
the static private constructor. A failing regression test preceded a current-state
validation fix. Go explicitly guards its zero principal; Rust's safe public API
prevents these malformed principal constructions.

Application commands/queries, atomic identity/outbox persistence, domain HTTP,
audit ingestion and org remain planned. The current HTTP adapter is diagnostic
GET/HEAD-only and discards request bodies; registration needs a deliberate contract
extension with bounded body access and an explicit provisioning admission policy.
No new database, broker or end-to-end workflow verification is claimed.

## 2026-09-11 — JetStream validates the publisher replacement

Added persistent NATS JetStream 2.14.6 to each independent Compose stack and a
concrete adapter behind the existing Publisher capability. The outbox dispatcher,
event envelope and database consumer transaction API remain unchanged. Root selects
`EVENTS_TRANSPORT=postgres|jetstream`; broker delivery is acknowledged only after a
matching durable PostgreSQL mailbox receipt. See [the run guide](JETSTREAM.md).

The effective Compose audit found 30 unique loopback TCP host ports: Go 71xx,
Nest 72xx, Rust 73xx. PostgreSQL remains 7120/7220/7320; NATS adds client ports
7122/7222/7322 and monitoring ports 7123/7223/7323. All three normal JetStream
containers are healthy and intentionally left running. Verification containers
are stopped, with their named volumes retained; other user containers are unchanged.

Real adapter/process checks passed for rolled-back enqueue, reclaimed outbox after
lost acknowledgement, PubAck deduplication, conflicting IDs, nondurable sink refusal
and redelivery, mailbox effect deduplication, a full 64 KiB envelope, closed publisher
retaining pending work, both root selections, incompatible-resource refusal, forced
broker recreation with persisted pending delivery, and outage/reopen. Safe logs omit
payload sentinels and connection strings. Full ordinary suites passed; explicit
DB/broker tests skip there and ran separately in the real verifier. Go race/vet,
Rust clippy with warnings denied, and Nest lint/type/build checks passed.

The real swap exposed a pull-subscription mismatch in Rust/Node request multiplexers,
header overhead at the envelope size boundary, and capacity reservations retained by
old fixture streams. These findings and language-specific ownership details are in
[mirrored notes](notes/modules/src/root/jetstream-verification.md). No new mutation score, clustered
availability, fanout, exactly-once, deployment authentication or broker OTLP claim.

## 2026-09-11 — Infrastructure before identity, audit and org

Completed validation/pagination, PostgreSQL, readiness, outbound HTTP, WebSockets
and events, in the requested leaf-first order. Contracts are local to each owner;
[the run guide](INFRASTRUCTURE_BUILD.md) describes the implemented diagnostics.
Publisher remains a replaceable durable-receipt seam, with a real PostgreSQL mailbox
adapter and explicit JetStream requirements. No domain was created.

Real PostgreSQL checks passed for migrations, rollback, uncertain-safe failure
mapping, concurrent writes, deadlines and close; event checks passed for duplicate
and conflicting reuse, wrong receipts, stale leases, poison retention, consumer
savepoint rollback, concurrent claims and a near-limit envelope roundtrip. The
compiled event example completed with safe logs. Database outage/recovery changed
readiness while liveness remained healthy; shutdown stayed within its budget.

All three builds passed the native outbound/socket process matrix. Stored outbound
CLIENT spans retain server parentage and propagated child context, and duration
metrics were retrieved. The existing sampled HTTP regression passed 48 requests,
48 completion logs and six invalid-config starts per build; its spans, logs and
metrics were retrieved again after the root changes. Prior unsampled/outage matrices
were not repeated in this pass.

Full ordinary suites passed. Nest type checking, lint, build and the existing HTTP end-to-end test passed; the full unit suite passed 85 tests with the two explicit DB tests skipped there and exercised separately.
Six selected infrastructure mutations were caught per build (18/18 across the
comparison). These are implementation-visible targeted checks, not an exhaustive
mutation score. See [mirrored notes and evidence](notes/modules/src/root/infrastructure-verification.md).

Corrections worth retaining: SQLx commit receipt ambiguity needed a pre-commit
transaction usability check; Node cannot kill an arbitrary Promise on timeout;
Rust needed explicit oversized-frame closure; and jsonb output formatting could
expand a valid envelope past the wire budget. The final storage uses validated
text plus semantic JSON duplicate comparison. Dedicated socket/event OTLP signals,
broker fanout, NATS integration and business audit policy remain subsequent work.

## 2026-09-11 — HTTP and telemetry realigned and integrated

Completed the value/API corrections, shared outcomes, once-only request lifecycle,
protected trace logging, native HTTP adapters and bounded OTLP providers. Root now
owns diagnostic routes, provenance admission, explicit context, validated settings
and shared shutdown. Mirrored notes describe the language-specific choices.

The final comparison passed five modes with 48 requests and six invalid-config
starts each. Stored spans, trace/provenance-linked logs and duration metrics were
retrieved, including unsampled and post-recovery signals. Four selected mutations
per build were caught. See [verification](notes/modules/src/root/http-verification.md)
and the [run guide](TELEMETRY_HTTP.md). Older entries below describe historical stages.


## 2026-09-11 — Create HTTP core leaves

Implemented `src/shared/http` projection and completion leaves from H01–H08: runtime safe public problems, status/title mapping, method normalization and completion policy. TypeScript compilation and focused Vitest pass.

Framework ingress, correlation headers, request context, once-only observation,
trace logger binding, OTel providers and live HTTP/collector integration remain
pending. No framework dependency was added.

## 2026-09-11 — Implemented telemetry value leaves

Implemented `src/shared/telemetry/index.ts` trace identity and outcome leaves from
T01–T02: runtime validation, owned snapshots, sampling preservation and exact
outcome parsing. The telemetry spec file has 4 tests; TypeScript compilation and
the focused Vitest run passed.

T03–T12, SDK providers, HTTP observation and OTLP delivery remain pending.


## 2026-09-11 — Specify telemetry into HTTP, leaf first

Added [the slice plan](TELEMETRY_HTTP.md), telemetry T01–T12 and HTTP H01–H14
contracts, native API/leaf maps and portable completion facts. Native package/module
entries are documentation-only. ADR 0007 records request-completion and provider
ownership; prior accepted ADR bodies remain unchanged.

The specifications separate trace identity from provenance, retain explicit
failure presence across languages, define safe problem responses and bounded
request attributes, and assign completion one owner. Root must connect sanitized
logs to a real ingestion path and share service identity and a shutdown budget.
Notes mirror the full source paths; current architecture/observability inventories
were corrected to acknowledge implemented logging and provenance.

TypeScript no-emit compilation passed; Prettier passed for the two documentation
entry files.
Documentation links resolved and the common contracts/completion shapes matched
across all three clones. Existing source/dependency hashes matched except the
Rust shared-module documentation declarations; no SDK dependency was added.

No new executable spec tests, behavioral implementation, mutation run, live HTTP
integration or application OTLP export/retrieval is claimed. Existing runtime tests
were not repeated for this documentation-only change. Next: public leaf tests,
implementation and selected mutations, then native adapters and real process checks.

## 2026-09-11 — Implemented process foundations

Implemented secret, captured env parsing, root-owned config, provenance values and
transitions, explicit log projections, console/JSON/no-op adapters and the named
foundations command. The shared contract preceded tests and implementations;
initial missing-surface failures are recorded distinctly from behavioral regressions.
ADR 0006 records logger projection and bounded delivery ownership before dependencies.

Node 24.19.0 / pnpm 11.22.0: TypeScript compilation, Nest build, 67 unit tests, 1 HTTP end-to-end test, oxlint and changed-source Prettier checks passed.

All eleven process scenarios passed, including actual pseudo-terminal auto-color,
redaction, malformed configuration, output severity and retry identity relations.
All 15 selected mutations were caught after successful builds; restored baselines
and copied/workspace hashes matched. These are selected faults, not an exhaustive
mutation score. No invalid or harness-failing mutation was counted as a catch.

Notes mirror full source directories, with walkthroughs, initial-red captures and
per-module mutation evidence. [Root verification](notes/modules/src/root/verification.md)
links the process report and actual JSON example. [FOUNDATIONS.md](FOUNDATIONS.md)
describes run commands, config defaults and remaining integration checkpoints.

The separate pnpm peers check reports the existing vite-tsconfig-paths → tsconfck@3.1.6 peer constraint (^5.0.0) against installed TypeScript 6.0.3. Pino introduces no peer conflict. Vite also reports that native tsconfigPaths can replace that plugin. This unrelated test-tool migration was not performed; actual compiler/unit/e2e checks are green.

No application OTLP export, remote secret provider, database/broker/socket adapter,
frontend compatibility or durable audit behavior is claimed. The Nest HTTP greeting
remains independent of this named example. No existing Compose resources were changed.


## 2026-09-11 — Identify the next leaves for the foundations demo

Added [FOUNDATIONS.md](FOUNDATIONS.md) with native file paths and dependency order:
secret value first, then env lookup/parsing and logger level/color policy;
reader/output adapters, provenance consumers, root config and demo wiring follow.
Runtime paths in that map are planned and have not been created as empty stubs.
The target uses actual foundations through no-op, colorized console and structured
outputs, including config validation, nested secret redaction, work/retry identity
and representative errors.

Added the [secret contract](src/shared/secret/CONTRACT.md) and native module docs.
S01–S10 define applicable leaf requirements; S11 is reserved for real logger
adapters. A constructed empty secret still redacts; config owns requiredness.
The [design note](notes/modules/src/shared/secret/redaction-and-requiredness.md)
records that boundary and why native formatting routes need separate checks.
Module notes retain the full 1:1 source-directory mapping.

The secret entry point passed Prettier and the full TypeScript no-emit check.
Local documentation links, clone independence, matching secret contracts and
module-note ownership were checked. Existing runtime source, tests, dependency
files and Compose configuration are unchanged; Rust only registers the new
documentation module. No secret runtime APIs, executable spec tests, mutation
results or runnable demo are claimed. Application/infra suites were not rerun.
Next is the public secret specification test file identified in the file map,
followed by its value implementation.


## 2026-09-11 — Provenance contract and native API proposal

Specified all accepted additions in [src/shared/provenance](src/shared/provenance/README.md): workflow
attribution and per-execution executor, logical work versus fresh execution IDs,
start time, retries and replay, bounded additional causal links, operation names,
incoming-context disposition and WebSocket message boundaries. Prepared work has
no execution ID/time until execution starts. Restore operations validate complete
snapshots; accepting a correlation hint does not establish upstream attribution,
origin, hop count or authority.

The matching contract defines P01–P24 acceptance requirements, worked scenarios
and a native API proposal. These are not executable specification tests. Socket,
event, audit and projection requirements explicitly remain with later adapters.
Decision 0005 records the design. Design notes live under
[notes/modules/src/shared/provenance](notes/modules/src/shared/provenance/README.md), mirroring the source directory.

The full TypeScript no-emit check and provenance entry-point formatting check passed.
Documentation links and module-note paths were checked; the three contracts and
worked-scenario documents match. Existing implementation, tests, dependencies and
Compose files are unchanged, apart from Rust's documentation module registration.
No provenance runtime operations, executable spec tests or mutation checks have
been completed. Application and infrastructure suites were not rerun for this
documentation slice. Next is the executable leaf specification before implementation.


## 2026-09-11 — Clock and ID leaf foundations

Implemented separate [src/shared/clock](src/shared/clock/README.md) and
[src/shared/id](src/shared/id/README.md) modules after local contracts, native module docs
and public specification tests. Initial red runs stopped on missing APIs/imports;
those were build/import failures, not executed assertion failures. The same author
wrote the specs and implementation with reference visibility.

Clock separates wall timestamps from monotonic elapsed readings. Its fake allows
wall correction without changing elapsed time and refuses invalid advances before
mutation. IDs parse standard-variant UUIDs independently of generation version;
V7 uses injected wall time and OS entropy, a guarded counter and failure-atomic
state. Rollback holds the timestamp; exhaustion returns a classified refusal until
wall time advances. Sequence owns finite fixtures. Timers and transport/storage
integration remain future work.

`pnpm run build`, full strict `tsc --noEmit --incremental false`, oxlint,
Prettier checks and 30 Vitest tests passed on Node 24.19.0. No npm dependencies
were added. Vite still reports the pre-existing tsconfig-paths plugin advisory.
The generated HTTP e2e test and local infrastructure were not rerun for this leaf
change; application wiring is unchanged.

The isolated mutation runner caught 8/8 selected valid faults in this clone,
25/25 across the three builds. Each counted mutant compiled and failed a named
runtime expectation. Baselines before/after passed; source/test/config hashes
confirmed restored copies and unchanged originals. This is targeted evidence,
not an exhaustive mutation score or independent test authoring.

The first counter-seed mutation produced a generic Error from the test's success
helper, so the conservative harness declined to count it. An explicit success
assertion fixed the test reporting; production code was unchanged. The completed
run caught all eight valid faults.

Added language walkthroughs, initial-red records and mutation evidence under
`notes/modules/src/shared/clock/` and `notes/modules/src/shared/id/`, preserving the 1:1
source-directory mapping. Decision 0004 records the state and ordering policy.
Local documentation links and module-note ownership were checked. Infrastructure,
logger/provenance integration, persistence uniqueness and Flover compatibility
are not established by these leaf checks.


## 2026-09-11 — Module notes mirror their source directories

Moved the error module's six notes/evidence files under
[notes/modules/src/shared/errors/](notes/modules/src/shared/errors/README.md), matching
the repository-relative source directory exactly. Removed the redundant
errors- filename prefix and added a local module index.

Updated the notes guide and AGENTS.md with the directory-mirroring convention,
including nested owners and source roots. Rebased incoming links and all relative
links inside moved notes. Historical status entries and accepted decision records
received link-target repairs; their decision prose was preserved.

Verification: every module-note directory maps to an existing source directory;
all old flat note paths are gone and no stale filename references remain. Local
Markdown links resolve within their own clone. Moved note text is unchanged apart
from link targets; mutation evidence is byte-identical. Production, tests and
configuration hashes are unchanged, so application suites were not rerun.


## 2026-09-11 — Language review notes for the error foundation

Added a [code walkthrough](notes/modules/src/shared/errors/language-walkthrough.md), three
language notes and two reusable testing-technique notes. Topics cover literal inference and distributive generic unions; copying/freezing and WeakMap recognition; Results, caught unknown values, exception carriers and ESM imports.
Each explanation connects syntax to the ownership or behavior it supports,
includes examples and gotchas, and links to primary documentation where relevant.

The walkthrough provides the local source/test links; transferable language and
technique notes stay independent of repository-specific paths. Updated the notes
index and errors implementation guide to make the reading order discoverable.
The testing notes explain public-interface scenarios, type checks versus runtime
assertions, mutation evidence and why preserved metadata keys need explicit tests.

Verification: extracted the complete worked program from each language's
walkthrough, compiled and ran all three, and compared stdout with the documented
output. Go used the local module, Rust an offline temporary consumer crate, and
TypeScript the installed compiler with strict NodeNext settings followed by Node.
All three matched. Checked local Markdown links and clone independence; the
shared technique copies match. Existing source, test and configuration hashes
are unchanged.

This was documentation work. Full application suites, infrastructure checks and
mutation runs were not repeated. Short declaration/method excerpts are explained
as fragments; the complete walkthrough programs are the examples executed here.


## 2026-09-11 — Mutation checks on the current errors implementation

Ran selected mutations in isolated temporary copies of the current implementation
and tests. This build caught 3/3 valid faults; the three builds caught 10/10
in total. Every counted mutant compiled and failed a named assertion. There were
no survivors or invalid mutants in the completed runs. Initial and restored
baselines passed, and source/test/configuration hashes confirmed the working
files were unchanged.

The added E10 case alone catches replacing fields instead of merging them in all
three languages. No implementation or test changes were needed. See the
[mutation findings](notes/modules/src/shared/errors/mutations.md) and
[machine-readable results](notes/modules/src/shared/errors/mutations.json) for exact edits,
failing cases and limits. The initial pnpm invocation failed before any mutation in the temporary copy; direct installed compiler/runner entry points completed the check. That setup failure is excluded from mutation counts.

These selected checks are not an exhaustive mutation score. No infrastructure or
transport integration was exercised.


## 2026-09-11 — Align the errors implementations

Separated kind vocabulary and ordinary Result helpers from failure ownership.
Frozen failures, private diagnostic/provenance maps, projection, normalization
and AppError remain together, with the existing public barrel preserved.
E10 now checks metadata collisions, source replacement, preserved literal types
and empty Type/message behavior. Its runtime assertions passed the existing
implementation before the refactor.

Fourteen tests pass: twelve error contract cases, one comparable usage example
and the existing greeting unit test. Nest build, lint, focused error type-check,
full-project type-check and formatting checks pass. Vitest still emits the
existing vite-tsconfig-paths advisory; no test fails. The socket-based e2e suite
was not rerun for this framework-free change.

Each clone carries a local [implementation guide](src/shared/errors/README.md) with the
cross-language API comparison and a matching registration-refusal example.
The [consistency note](notes/modules/src/shared/errors/consistency.md) explains why public
fallback and classification are separate questions.

The common contract text is aligned across the three builds. Local Markdown
links were checked. No new dependencies or transport integrations were added;
HTTP/WebSocket encoding and Flover compatibility remain unverified. Earlier
targeted mutation results belong to the first slice and were not rerun here.
Infrastructure was not started.


## 2026-09-11 — First errors implementation through spec tests

Implemented [the first errors contract](src/shared/errors/CONTRACT.md) with shared scenarios
E01-E09 and language-specific ownership/inspection behavior.

TypeScript uses immutable Failure values, typed Result helpers and a plain
AppError carrier. Module-private weak maps recognize constructed values and keep
diagnostics separate. Normalizing a caught value reads no foreign getters and
does not mistake caught null/undefined for success.

The initial Vitest run loaded the declared API and all eleven contract tests failed against placeholder behavior.

Thirteen tests pass: eleven contract cases, one usage example and the existing greeting unit test. Build, lint, focused error type-checking and full-project type-checking passed. Two valid targeted mutations were detected after separate
compilation checks, and the restored baseline passed. Formatting and local
documentation links were checked. See the
[TDD note](notes/modules/src/shared/errors/first-slice.md) for findings and limitations.

No new runtime dependency, logger, provenance, retry engine, transport adapter, HTTP
problem envelope or WebSocket error mapping was added. No database, broker or
frontend integration was verified. Existing infrastructure services were not
started for this pure error-value slice.

The generated HTTP test received only a corrected type import. Its socket-based
runtime test was not repeated; the full TypeScript check covers the correction.

## 2026-09-11 — Draft errors module contract

Added [src/shared/errors/index.ts](src/shared/errors/index.ts) with package-level
documentation and an empty module export. It mirrors the Go draft's ten kinds,
stable Type identifiers, public disclosure rules, annotation/translation
distinction, aggregate handling and recovery ownership. TypeScript-specific
guidance proposes discriminated Failure/Result values, runtime metadata isolation,
unknown-value normalization and a framework-free exception carrier at the edge.
The recognition and enrichment APIs remain open before implementation.

Updated navigation and recorded the
[TypeScript adaptation findings](notes/modules/src/shared/errors/typescript-adaptation.md).
The complete draft lives locally. No failure types, functions, Nest filters,
dependencies or behavior tests were added; the greeting application is unchanged.

Verification using Node 24.19.0 and the existing installed dependencies:

- `pnpm run build` and `pnpm run lint` passed.
- Prettier checking passed for `src/shared/errors/index.ts`.
- The ten kind names, order and definitions match the Go and Rust drafts.
  Local links in the changed Markdown documentation resolve.

No TypeScript documentation generator is configured; the contract is readable in
source. The existing greeting unit/HTTP tests were not rerun because this pass
adds only documentation and an unimported empty module. Build and lint do not
establish the proposed error behavior, transport handling or frontend compatibility.

## 2026-09-11 — Observability, mail, objects and selected interfaces

Expanded default Compose startup with Mailpit 1.31.1, SeaweedFS 4.46 in single-node
mini mode, and Grafana OTEL LGTM 0.32.1. Each has project-scoped persistence and
loopback ports. The telemetry health check probes live collector and store endpoints.
Mailpit captures SMTP locally. SeaweedFS initializes local S3 credentials and a
bucket; unused WebDAV, admin UI and table catalog endpoints are disabled.

Added [OBSERVABILITY.md](OBSERVABILITY.md) with the shared instrumentation
expectations and a standalone, standard-library Python OTLP probe. Updated the
architecture and decision records to select standard WebSocket, SMTP and S3
boundaries and to distinguish transactional outbox recording from replaceable
broker delivery. No application SDK or language dependency was added.

Verification on Docker 27.4.0 / Compose v2.31.0-desktop.2:

- All three Compose files resolved with defaults and example environment overrides.
- All 15 containers ran healthy together using the intended separate ports.
- Each stack captured a local SMTP message and accepted signed S3 PUT/GET requests.
  The distinct object contents matched their own blueprint; anonymous GET returned 403.
- Each blueprint's synthetic probe exported OTLP HTTP logs, metrics and traces.
  Authenticated Grafana data-source queries retrieved the trace, the log matching
  its trace ID, and the expected metric series from the respective stores.
- The first metric query failed because Prometheus normalized the name and appended
  a unit suffix. Inspecting the actual series resolved this; the probe output,
  guide and substrate note now use `n2f_infra_smoke_ratio`.
- Mail, object contents and all three telemetry signals remained retrievable after
  forced recreation of the three new services in every stack. This also verified
  the final SeaweedFS options with the table catalog endpoints disabled.
- Shell syntax, Python syntax/CLI help and documentation links were checked.
- Temporary `n2f-*-infra-check-20260911` containers, networks and all their volumes
  were removed. The regular development stacks are not left running.

The local integration harness was created with implementation visibility and is
not an independent or blind test. Docker/network checks required approved access
outside the sandbox. Language application suites were not repeated because their
code and dependencies were unchanged.

Not implemented or verified: application OTel SDKs, WebSocket endpoints, outbox or
JetStream delivery, infrastructure exporters, application dashboards/alerts,
profiling, collector outage behavior under application load, OTLP gRPC export,
S3 presigning/browser CORS, full S3 feature parity, crash recovery or deployment
hardening. Synthetic acceptance and retrieval demonstrate local infrastructure,
not application instrumentation or Flover integration.

## 2026-09-11 — Local PostgreSQL and Redis

Added independent `compose.yaml` and `.env.example` files with PostgreSQL 18.6
and Redis 8.10.1, loopback ports, readiness checks, project-scoped volumes,
Redis AOF, and bounded Docker logs. The equivalent setup in each n2f repository
uses its own default project name and host ports.

[INFRASTRUCTURE.md](INFRASTRUCTURE.md) records operation, reset behavior and
proposed next integrations. Added the local-infrastructure ownership decision and
a substrate note about PostgreSQL 18's versioned Docker data layout. The current
README and architecture distinguish running dependencies from implemented adapters.

Verification on Docker 27.4.0 and Compose v2.31.0-desktop.2:

- All three files resolved with defaults and with their `.env.example` files.
- All six services ran together and became healthy on their distinct loopback ports.
- PostgreSQL reported 18.6 and `/var/lib/postgresql/18/docker`; Redis reported 8.10.1.
- Authenticated PostgreSQL TCP writes and Redis writes succeeded. Each build stored
  a distinct marker, and every marker survived forced recreation of its containers.
- Inspection confirmed the PostgreSQL named volume covers the versioned data path.
- Disposable `n2f-*-verify-20260910-c1a7` projects, containers, networks and volumes
  were removed after checking. The normal development stacks were not left running.

The initial Docker socket check and one database check were refused by the sandbox;
rerunning with approved Docker access succeeded. Application code and dependencies
were unchanged, so language build/test suites were not repeated. No application
integration, crash recovery, database upgrade, backup/restore, events, socket
transport or telemetry pipeline was tested or implemented in this pass.

## 2026-09-10 — Initial scaffold

The n2f family starts with independent Go, NestJS and Rust directories. This
pass establishes module ownership and the notes/decision workflow. Current
runtime behavior and commands are documented in [README.md](README.md).

No product domain, shared logger, provenance module, persistence or authentication
has been added. Architecture rules and decision immutability are held by review.

Moved the generated Nest module, controller, service and controller test into
`src/root/`. `src/main.ts` enters that root; `src/modules/` and `src/shared/`
document the future domain and shared foundation boundaries. The existing
`GET /` greeting remains a disposable HTTP smoke example.

Removed the generated Observe configuration and instrumentation from startup.
The original dependency set and lockfile are retained, including the now-unused
Observe package and the existing Mau deployment dependency. Optional removal of
the Observe dependency stalled during pnpm's supply-chain verification and was
canceled; no dependency upgrades or new packages were introduced.

Added `.nvmrc` for the checked Node runtime and ignored TypeScript build metadata.

Verification:

- `pnpm run build` passed.
- `pnpm run lint` passed.
- The changed source files passed Prettier checking.
- `pnpm run test` passed: one controller test.
- `pnpm run test:e2e` passed: one HTTP test. The test required permission to open
  its local socket outside the sandbox; the initial sandbox refusal was an
  environment restriction, not an application failure.

These tests exercise the greeting and its wiring. They do not establish domain
behavior, backend compatibility or enforcement of the documented architecture.
