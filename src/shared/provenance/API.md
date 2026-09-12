# Nest / TypeScript provenance API

## Data shapes

These are implemented values and operations. The [contract](CONTRACT.md) owns
their semantics. ScopeSnapshot contains nested `work: WorkSnapshot`; fields
are not flattened. Native properties use camelCase.

| Shape | Fields |
| --- | --- |
| Actor | kind; identity only for a named actor |
| Attribution | optional initiator, optional onBehalfOf, optional tenant |
| Reference | kind (`scope`, `work`, `event`), shared ID |
| ReplayInfo | runId, source Reference |
| WorkSnapshot | workId, correlationId, correlationSource, optional causation, optional origin, operation, Attribution, optional depth, optional ReplayInfo |
| ScopeSnapshot | WorkSnapshot, scopeId, startedAt, named executor, positive attempt, optional previousAttempt |
| RootSpec | optional workId, known non-replay origin, operation, Attribution, named executor |
| StepSpec | optional workId, operation, named executor, optional explicit cause |
| WorkSpec | required workId, operation, optional explicit cause |
| ExecutionSpec | named executor, positive owner-supplied attempt |
| ReplaySpec | source Reference, optional runId/workId, operation, Attribution, named executor; origin is selected by Replay |
| IncomingHints | optional correlation text; optional cause with kind text and ID text |
| IncomingResult | fresh/continued/restarted decision, accepted correlation/cause when applicable, ordered bounded issue values |
| Link | relation (`input`, `replay_of`, `previous_attempt`), Reference |
| LinkSet | immutable bounded collection; previous_attempt requires a scope Reference |

Input/snapshot records are not proof of valid construction. RestoreScope and
RestoreWork validate before creating values and do not authorize the claims.
Scope/WorkContext are constructed values with controlled read access. An exported
snapshot is an owned copy. No source actor, tenant, operation or replay data can
be changed through it.

Scope exposes all ScopeSnapshot fields through native read access plus a
WorkContext view/copy. WorkContext exposes all WorkSnapshot fields. Zero/missing
Scope and WorkContext are invalid. A default Attribution with all optional fields
absent means unknown initiator, no represented principal, no tenant; it does not
mean a known anonymous actor. Anonymous is constructed explicitly.

RestoreScope validates all work fields plus execution fields: positive attempt,
valid start time/executor, no self-cause/previous-attempt, and no previousAttempt
on attempt 1. An attempt greater than 1 may have no known previous attempt.
A replay origin and ReplayInfo must appear together. Known local depth 0 has no
primary cause; positive known depth requires one. Publicly adopted external
correlation has unknown origin/depth. A valid snapshot is still only a claim
until its adapter applies producer and application policy.

Prepare creates a child WorkContext without dependencies; Child is its immediate
execution convenience with attempt 1. Scope.workContext retains the same work;
it is not Prepare and does not add a hop. Retry uses that existing work context.

Root/Step/Replay work IDs and run IDs, when supplied, must be nonzero valid shared
IDs. Replay rejects a workId equal to a source work Reference's ID. A source
scope ID can be checked for generated execution collision; a bare Reference does
not expose an original correlation or a complete ancestry history.

## Native shape

This is an ordinary TypeScript module with no Nest imports or decorators.
Factories receive narrow capabilities. Module-created frozen values carry private
construction provenance (or equivalent runtime validation), so a TypeScript cast
alone cannot make a plain object a valid Scope/WorkContext/IncomingResult.

```ts
// Public signature summary; bodies live in the native source files.
interface WallClock { now(): Date }
interface Generator { newId(): Result<ID, Failure> }

class Factory {
  constructor(clock: WallClock, ids: Generator);
  open(spec: RootSpec): Result<Scope, Failure>;
  child(parent: Scope, spec: StepSpec): Result<Scope, Failure>;
  execute(work: WorkContext, spec: ExecutionSpec): Result<Scope, Failure>;
  retry(previous: Scope, executor: Actor): Result<Scope, Failure>;
  replay(spec: ReplaySpec): Result<Scope, Failure>;
  enter(spec: RootSpec, incoming: IncomingResult): Result<Scope, Failure>;
}
function prepare(parent: Scope, spec: WorkSpec): Result<WorkContext, Failure>;
function actor(kind: ActorKind, identity: string): Result<Actor, Failure>;
function anonymous(): Actor;
function attribution(spec?: AttributionSpec): Result<Attribution, Failure>;
function operation(name: string): Result<Operation, Failure>;
function reference(kind: ReferenceKind, id: ID): Result<Reference, Failure>;
function linkSet(links: readonly Link[]): Result<LinkSet, Failure>;
function inspectIncoming(hints: IncomingHints): IncomingResult;
function restoreWork(snapshot: WorkSnapshot): Result<WorkContext, Failure>;
function restoreScope(snapshot: ScopeSnapshot): Result<Scope, Failure>;
```

This is a signature summary, not a compilable example. Scope exposes snapshot()
and workContext(); WorkContext exposes snapshot(); LinkSet.values() returns an
owned array. Actor/reference/attribution records are frozen and module-branded. Root/Step/Execution/Replay specs are typed trusted application
inputs; general JSON/HTTP decoding still belongs at its boundary.

Use optional properties/undefined for absence, with an explicit anonymous Actor
variant. Empty strings and supplied null values are invalid where an optional
value's type excludes them; wire decoders must not silently turn them into absence.
Incoming hints retain field presence, including an empty supplied string.

Dates need special ownership: freeze does not prevent Date.setTime(). Store an
immutable millisecond number internally and return fresh Dates or owned snapshots
at every boundary. Copy arrays and nested attribution/reference records before
freezing them. Attempt/depth require Number.isInteger and explicit u32 range
checks; JavaScript numbers do not enforce unsigned integer types.

Factory methods are synchronous within one isolate; workers do not share this
state automatically. Return classified validation failures through Result and
forward the generator's failed Result/error value without stripping diagnostic
metadata. Bad typed adapter behavior is not a general unknown-input decoder.
Runtime context storage, Nest providers, WebSocket objects and tracing context
are separately owned adapters with their own integration checkpoints.
