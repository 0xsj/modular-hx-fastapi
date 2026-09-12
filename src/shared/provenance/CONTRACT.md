# Provenance contract

**Stage:** core values, transitions, restoration, incoming inspection and links
are implemented and tested. P20–P22/P24 describe later owning adapters and
durability boundaries; this module does not implement those transports or stores.

This contract includes all accepted additions: initiator/executor/delegation,
logical work and execution attempts, explicit start time, additional causal links,
replay ancestry, operation names, WebSocket scope boundaries and incoming-context
disposition. It defines operational attribution and causality. Domain evidence,
recorded outcomes and authorization remain with their owners.

## Values and ownership

A Scope is an immutable account of one execution. WorkContext contains the parts
that remain stable across executions of the same work. A scope can expose its
WorkContext for a later attempt. Preparing queued work creates a WorkContext
without claiming execution has started. Factories open scopes; values never read
a global clock, generate IDs on access, log or authorize anything.

| Value | Meaning and validation |
| --- | --- |
| Actor | Explicit `anonymous`, or `user`, `service`, `system` with a required identity. Anonymous has no identity. Missing initiator means unknown; it is distinct from an explicitly anonymous initiator. |
| Identity / tenant | An opaque technical identifier of 1–128 ASCII bytes from `A-Z a-z 0-9 . _ : / -`. No trimming or case folding. A present empty identity is invalid. Display names and credentials are not identifiers. |
| Operation | A stable application-owned name of 1–128 ASCII bytes matching `[a-z][a-z0-9_.:-]*`, such as `exports.generate`. Syntax validation cannot establish bounded cardinality; callers use static names. |
| Reference | A nonzero shared ID plus target kind `scope`, `work` or `event`. The kind distinguishes execution ancestry from logical work or a produced event. Validation proves neither existence nor ownership. |
| Attribution | Optional initiator, optional represented principal (`onBehalfOf`) and optional tenant. Delegation requires a known named initiator and a different named represented principal. It describes representation, not the resource/account affected. Each execution separately requires a named, non-anonymous executor. |
| Origin | `request`, `schedule`, `replay`, `backfill`, `startup`, or absent when upstream origin is unknown. Locally opened work requires a known origin. The replay constructor owns `replay`. |
| CorrelationSource | `local` or `external`, describing where the correlation identifier originally entered this lineage. It is never a general trust or authorization flag. |
| ReplayInfo | Replay-run ID and the original Reference. The run ID groups a deliberate replay; the source describes why this new lineage exists. |
| LinkSet | Additional typed links on the work/event/audit envelope: `input`, `replay_of`, `previous_attempt`, each targeting a Reference. previous_attempt targets only a scope. Maximum 32 supplied links; exact duplicates coalesce, retaining first occurrence order. Callers with larger batches use an owned batch/manifest reference. |

The base Scope has no arbitrary attributes map or unbounded ancestry list.
LinkSet is a separate immutable value: its references describe the owning record,
and are not automatically copied to every descendant. It does not import an event
module or trace SDK. The event/work owner attaches it beside Scope when useful.

## Scope and WorkContext fields

| Field | Scope | WorkContext / lifetime |
| --- | --- | --- |
| scopeId | Fresh ID for this execution | Absent; an unexecuted work description has no execution identity |
| workId | Logical work identifier | Stable across attempts; an application may supply an existing job/work ID |
| correlationId, correlationSource | Grouping identifier and its source | Stable within this admitted lineage |
| causation | Optional immediate trigger Reference | Stable for attempts of this work; a different cause means new work |
| origin | Known originating trigger, or absent | Inherited through validated local/remote continuations |
| operation | What this work does | Stable across retries; every new child supplies its own operation |
| startedAt | Explicit clock sample for this execution | Absent until execution; never inferred from an ID |
| initiator, onBehalfOf, tenant | Established workflow attribution | Inherited for children/retries; importing correlation does not import attribution |
| executor | Named principal performing this execution | Supplied freshly for every execution |
| attempt | Positive ordinal supplied by the execution owner | Absent until execution; not a distributed counter |
| previousAttempt | Optional prior scope ID | Execution-specific; present for Retry, otherwise absent |
| depth | Known hop count, or absent if ancestry is unknown | New logical child adds one when known; retry preserves it |
| replay | Optional ReplayInfo | Inherited throughout the new replay lineage |

New local root defaults workId and correlationId to its first scopeId, so one ID
is sufficient. A supplied workId replaces only the default workId. Reusing an
event ID as a work ID is an application choice; an event with several consumers
does not by itself identify which consumer's work is being retried. Neither a
work ID nor a correlation ID is a deduplication or idempotency decision.

startedAt is UTC Unix time with millisecond precision, normalized independently of
the generator's embedded timestamp. This operational slice accepts Unix milliseconds
`0..281474976710655`, matching the existing generator's supported era. The range
is for opening current execution scopes; it imposes no historical-date restriction
on domain events. Epoch zero is valid. A clock correction may make a child's start
time earlier than its parent's. Causality follows references, not timestamp order.
Elapsed time and completion timestamps belong to the operation/telemetry record.

Depth and attempt use the inclusive range `0..4294967295`, except attempt starts
at 1. Unknown depth is absent, never 0. Checked increments refuse overflow; they
never wrap or silently saturate. Depth measures known logical hops, not retries.
There is no hard-coded workflow depth limit and no promise to detect cycles.
The worker owns retry/depth budgets, including its handling of unknown depth.

## Transitions

| Action | What it does |
| --- | --- |
| Open | Admit local root work. One fresh scope ID; correlation defaults to it, source local, depth 0, attempt 1, no cause or previous attempt. Require operation, named executor and origin; accept explicit workflow attribution and optional work ID. |
| Child | Execute new logical work caused by a parent. Fresh scope ID and default work ID, inherited correlation/source/origin/initiator/delegation/tenant/replay, supplied operation/executor, attempt 1, depth parent+1 when known. Cause defaults to the parent scope; an explicit Reference supports event/task causes. No previous-attempt link. |
| Prepare | Describe queued child work from a parent plus an explicit work ID, operation and optional explicit cause. Apply the Child inheritance rules, without sampling time or minting an execution ID. This alone does not publish or execute the work. |
| Execute | Open an execution of a prepared WorkContext. Fresh scope ID, supplied executor and positive attempt, current startedAt; all WorkContext fields preserved. No previous-attempt claim unless a concrete previous scope is supplied through Retry. |
| Retry | Execute a previous Scope's WorkContext again. Fresh scope ID/time, supplied executor, attempt+1, previousAttempt set to the prior scopeId. Preserve work/correlation/cause/operation/depth/attribution/replay. No child hop. Concurrent retries can share an ordinal while still having distinct scope IDs. |
| Replay | Deliberate new intervention. Fresh scope/correlation, source local, depth 0, attempt 1, origin replay, new attribution/operation/executor. ReplayInfo names the original Reference; the replay-run ID is supplied or defaults to this new root scope ID. Old initiator, tenant, time and failure outcome are never silently inherited. |
| Enter | Open inbound work using a separately inspected correlation hint. Rules below distinguish a new, continued or restarted chain. Local authentication/application policy supplies attribution; hints cannot set it. |

An explicit work ID on Child/Prepare must differ from the parent's work ID; use
Retry/Execute for another attempt of the same work. Replay rejects a supplied
work ID equal to a source work Reference's ID. The owner must also ensure new work
identity when replaying a scope/event whose original work it knows; a bare Reference
does not reveal that original work ID or prove freshness across unseen history.

There are no post-construction WithActor/WithTenant/Adopt mutators on Scope. New
workflow attribution is admitted at a new root/replay or through a separately
validated WorkContext. Changing one party after validating delegation must never
leave a contradictory pair. Child cannot silently switch tenants or initiators.
This structural rule does not itself authorize a root or cross-tenant workflow.

## Multiple causes and replay links

A primary cause answers what triggered this unit. Additional `input` links can
name other contributing work/events, including different correlations. No parent
is selected from list order and no attribution is merged from linked records.
Join policy belongs to the operation: it may designate a primary trigger or open
a new root linked to all inputs. The graph need not be a tree.

A replay's primary cause is absent at its new root; ReplayInfo preserves the
original source as a separate relationship. Descendants keep ReplayInfo as chain
context, without claiming each child replays the same original unit. When an
envelope emits a `replay_of` or `previous_attempt` link derived from Scope, the
projection must agree with ReplayInfo/previousAttempt. LinkSet validates reference
shape only; the envelope owner validates consistency with its scope and inputs.

Link targets use shared IDs. External non-UUID message IDs need an adapter-owned
mapping or external evidence field; parsing them as internal IDs is not implied.
A missing linked record remains missing. Scope/LinkSet constructors never look it
up or fabricate a placeholder record.

## Incoming hints versus authenticated continuation

InspectIncoming is pure. It accepts only optional correlation text and optional
causation kind/ID text. Presence is explicit: absent is different from present
empty. Parse IDs through the existing shared parser; accept v4 as well as v7 and
normalize text. Reject unknown reference kinds. No raw value is echoed in a
report or public error. Fixed issue fields/reasons provide diagnostics.

| Incoming state | Report | Enter behavior |
| --- | --- | --- |
| Both fields absent | `fresh` | Apply Open with the supplied local origin/attribution |
| Valid correlation, optional valid cause | `continued` | Adopt correlation/cause, source external; fresh scope/default work ID, attempt 1, unknown origin and depth |
| Valid correlation, invalid cause | `continued` plus cause issue | Preserve correlation; omit the unusable cause |
| Correlation absent/invalid while any hint was supplied | `restarted` plus issue(s) | Apply Open; drop the cause because its chain was not admitted |

Issues use fields `correlation` or `causation` and reasons `invalid_id`,
`invalid_kind` or `missing_correlation`. For an invalid cause shape report that
shape issue; use missing_correlation for an otherwise valid cause without an
accepted correlation. Report issues in correlation-then-causation order. Malformed
optional hints do not refuse otherwise valid work. Enter still returns local
construction, clock or ID-generation errors normally.

IncomingResult is a constructed, immutable value. Inspect it before attempting
Enter, so diagnostics remain available even if ID generation subsequently fails.
A continued correlation does not establish the upstream origin, hop count,
initiator or authority. Enter uses locally established attribution for the work
being admitted; it makes no claim about an unknown upstream principal. Local
entry/transport information belongs to the boundary's record. Never infer root
status by comparing a caller-controlled correlation with a minted ID.

Persisted/remote WorkContext is a different boundary. RestoreWork validates a
complete typed work snapshot; RestoreScope additionally validates an execution
snapshot when a real previous execution is available. These operations restore
metadata claims, not their authenticity. Unlike InspectIncoming, they refuse
invalid snapshots rather than falling back to a new root on corruption.
The receiving adapter must verify the producer and authorize the operation before
executing them. Public hints expose no actor, tenant, work ID, depth, attempt,
executor, timestamp or replay fields. This module supplies no middleware,
credential verification, wire codec or automatic header propagation.

## Scope boundaries and propagation

A WebSocket connection has an adapter-owned connection ID. Each received message
opens distinct work/execution, even on the same connection; the connection ID
belongs beside provenance in transport records. Reconnect creates a new connection
identity. A resumed message may retain logical work/correlation only through an
explicit continuation/deduplication protocol. It still gets a new execution scope.
A handshake scope is not an ambient parent for every unrelated user interaction.

Log/error/event projections are separate consumers. Public responses may expose
request/scope and correlation IDs under the later transport contract. Actor,
tenant, extra links and replay metadata are not automatically exported to clients
or third-party services. Trace/span IDs and W3C propagation remain owned by the
tracing adapter. Neither untrusted hints nor tracing baggage confer authority.

Events own occurredAt; storage/audit records own recordedAt; both remain distinct
from Scope.startedAt. Service instance/build version belong to the observability
resource or relevant durable record. Outcomes, idempotency, policy/model versions,
resource subjects, transaction atomicity and durable audit retention belong to
application/domain/envelope owners. These fields are not lost by keeping their
ownership explicit. None is an arbitrary extension bag on Scope.

## Failure and ownership guarantees

Validate pure inputs before calling dependencies. An opening operation then reads
the injected wall clock once, validates/normalizes it and requests exactly one ID.
Prepare, RestoreWork, RestoreScope, InspectIncoming, accessors and LinkSet
construction consume neither clock nor IDs. Failed pure validation/overflow consumes neither dependency;
invalid sampled time consumes no ID. A generator failure is propagated with its
classification, type and diagnostic cause intact. Do not relabel unavailable ID
entropy as internal provenance failure or retry it inside provenance.

A returned zero ID, or a locally detectable generated-ID collision that violates
transition/snapshot invariants, is `internal / provenance.invalid_generated_id`.
This includes a directly known parent/previous scope ID and any resulting
self-cause or forbidden reuse of work identity. Replay additionally checks a
source-scope ID when its source Reference names a scope. The generator still owns
freshness across unseen history; the module cannot prove global uniqueness.
Dependency effects already performed cannot be rolled back.

Other failures are `invalid` with stable types `provenance.invalid_actor`,
`provenance.invalid_attribution`, `provenance.invalid_operation`,
`provenance.invalid_reference`, `provenance.invalid_origin`,
`provenance.invalid_work`, `provenance.invalid_scope`, `provenance.invalid_time`,
`provenance.invalid_attempt`,
`provenance.invalid_depth`, `provenance.attempt_exhausted`,
`provenance.depth_exhausted`, `provenance.too_many_links` or
`provenance.invalid_incoming_result`. Unsupported link relations are invalid
references. Literal missing Go factory dependencies use
`provenance.invalid_configuration`; language-level impossible or deliberately
forged adapter values remain programmer misuse. No failure echoes input values.
Storage adapters may translate invalid stored snapshots into an internal corruption
failure while retaining the cause; the pure validator does not guess the source.

Construction/derivation/failed restoration must leave all inputs unchanged.
Snapshots, input arrays and returned views must not mutate a Scope, WorkContext,
Actor, IncomingResult or LinkSet. Go copies slices and any optional pointed-to
values; Rust uses ownership/borrowing; TypeScript copies Dates and arrays and
freezes owned records. Readonly typing alone is insufficient in TypeScript.
Snapshot validation checks the complete combination of fields, not just each field
individually. Replay origin and ReplayInfo must appear together. Known local
depth 0 has no primary cause; positive known depth requires one. A scope cannot
name itself as its scope cause or previous attempt, and work cannot name itself
as its work cause. An event cause may share a work ID when the application uses
that event ID for its work. Attempt 1 has no previousAttempt; a greater attempt
may have none when the previous execution is unknown. A valid start time, named
executor and consistent delegation are required. A missing Go value or forged
TypeScript object cannot silently become a valid anonymous/root scope.

No API depends on a logger, context carrier, framework, event bus, database or root
module. Factories use consumer-owned clock and ID capabilities. Runtime context
propagation and persistence are subsequent adapters to this accepted contract.

## Acceptance scenarios for specification tests

These are requirements, not tests that have run. Use the same scenario IDs in all
three builds, with native assertions and separate adapter tests when adapters exist.

| ID | Observable scenario |
| --- | --- |
| P01 | Named actors, explicit anonymous and unknown initiator remain distinct; invalid identities and executor anonymity are refused. |
| P02 | Delegation records both principals, refuses absent/anonymous/same-principal representation, and cannot be invalidated by later actor replacement. |
| P03 | Local root mints one scope ID, defaults work/correlation to it, starts at attempt 1/depth 0 and records explicit operation/time. |
| P04 | Supplied job/work identity survives construction without replacing scope/correlation; it grants no deduplication guarantee. |
| P05 | Child regenerates execution/work identity, supplies operation/executor, inherits stable attribution/correlation, and links its parent. |
| P06 | Explicit event/work cause is retained without importing any event or broker type. |
| P07 | Prepare consumes no dependencies and claims no execution time/ID; Execute retains prepared work while opening a fresh execution. |
| P08 | Retry preserves logical work/cause/depth and replaces scope/time/executor; previousAttempt identifies the prior execution. |
| P09 | Two executions may share work and ordinal but have distinct scope IDs; no inferred total delivery count. |
| P10 | Checked attempt/depth overflow refuses without dependencies or mutation; unknown depth remains unknown through children. |
| P11 | Wall correction can move startedAt backward; clock and ID timestamps may disagree without changing causal references. |
| P12 | Invalid pure input consumes no dependencies; invalid time consumes no ID; an ID failure retains its original classification/type/cause and yields no scope. |
| P13 | Multi-input LinkSet preserves typed references, copies ownership, coalesces exact duplicates and enforces its bound without selecting a parent. |
| P14 | Replay opens fresh work/correlation with new attribution and retained original source/run; children/retries retain replay context. |
| P15 | Fresh, continued, partially accepted and restarted incoming context remain distinguishable; no rejected raw values leak. |
| P16 | A valid correlation with bad cause keeps correlation; a cause without admitted correlation cannot create a disconnected adopted edge. |
| P17 | Public hints cannot set attribution/work/depth/attempt/time/replay; adoption changes no already issued Scope. |
| P18 | RestoreWork/RestoreScope reject invalid field combinations without fallback or partial mutation; syntactic validity is not producer authentication. |
| P19 | Mutating supplied/returned arrays, snapshots or Dates cannot rewrite existing provenance; Rust borrowed access cannot escape mutation. |
| P20 | Same-connection WebSocket messages have separate scopes; reconnect and explicit resumption preserve only protocol-approved work identity. Adapter scenario. |
| P21 | Extra links/replay/previous-attempt projections agree with their owning record; missing targets remain absent and different input correlations are not silently merged. Envelope scenario. |
| P22 | occurredAt, recordedAt and startedAt remain distinct; public, log and durable projections have explicit field allowlists. Adapter/envelope scenario. |
| P23 | Zero/forged values, unsupported kinds and locally detectable generated-ID collisions are refused without exposing a partial scope. |
| P24 | Preparing/executing work or recording provenance does not claim a commit, publish, successful outcome or durable audit write. |

Scope transitions P01–P19/P23 and pure LinkSet behavior are the next leaf test
slice. P20–P22/P24 also name obligations for later concrete adapters; pure tests
must not be reported as evidence of WebSocket, broker, storage or audit integration.
