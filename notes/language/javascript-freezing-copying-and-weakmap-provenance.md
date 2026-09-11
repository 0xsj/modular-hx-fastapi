# Runtime ownership needs copies, freezing and a recognition boundary

TypeScript describes the shape, while JavaScript decides which objects can change
and which values were actually constructed by this module.

## Origin

Review of the failure factory, metadata helpers, WeakMaps and hostile-value tests.
The field-replacement mutation also showed why copying alone does not prove merge
semantics.

## Copy first, then freeze the owned object

```ts
Object.freeze({ ...options.fields })
```

Object spread constructs a new record from enumerable own properties. Freezing
that copy avoids freezing the caller's input. Object.freeze is shallow; it does
not recursively freeze nested objects. Here the record values are strings, so a
copied/frozen record covers the metadata the module owns. Arbitrary causes remain
opaque references. See [Object.freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze).

```ts
Object.freeze({ ...value.fields, ...fields })
```

Spread order expresses the merge policy: later incoming properties replace the
same key; unrelated existing keys remain. `{ ...fields }` would still be a fresh
record but would lose existing keys. Spreading a missing optional fields value
contributes no properties in this use.

There are two owned levels: the failure record and, when present, its fields
record. Freezing only the outer failure would leave a nested fields object
mutable. PublicInfo instead returns a fresh caller-owned projection, including
copied fields; callers may modify their projection without changing the failure.

## Keep private diagnostics off the public-shaped record

```ts
const diagnostics = new WeakMap<object, Diagnostic>();
const carriers = new WeakMap<object, Failure>();
```

The first map associates a constructed failure object with its cause and private
details. The second associates a genuine exception carrier with its failure.
Entries are keyed by identity, so a lookalike or a spread copy is not the same
key. The maps are module-private rather than exported registration APIs.

A WeakMap association does not itself keep an otherwise unreachable key alive;
it is not a registry that must be manually pruned when each error is discarded.
The values are not weak merely because the keys are weak. See [WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap).

This is an in-process construction boundary, not cryptographic provenance or a
security boundary against arbitrary code running in the same process.

## Recognize unknown inputs without inspecting their properties

The recognition helper first distinguishes non-null objects/functions from other
values, then checks WeakMap membership. It does not read foreign kind, message,
cause, prototype or getters. `typeof null === 'object'` is why a separate null
check matters.

The tests pass a Proxy whose get and getPrototypeOf traps throw. Looking up that
proxy by identity in a WeakMap does not require those property/prototype reads.
A trusted AppError is also resolved through the private carrier association,
not by reading its public failure property. Even replacing that property's getter
does not alter the registered association.

This avoids treating deserialized JSON, arbitrary thrown objects or prototype
lookalikes as already classified. They must be translated deliberately at the
owning boundary. A second loaded copy of the module has different private maps;
its objects are not automatically trusted by the first copy.

## What the non-null assertion actually says

```ts
diagnostics.get(value)!
```

The postfix `!` tells TypeScript that this expression is not null or undefined.
It is erased, so it is not a runtime guard. The preceding requireFailure check
establishes the invariant that the exact value was registered. `remember` freezes
a constructed record and registers its diagnostics before returning it.

Breaking that construction path could make the assertion wrong. Keep the check,
registration and ownership helpers together so the invariant can be reviewed.

## Gotchas

A factory typed for trusted application callers is not a general untrusted-data
parser. The factory checks kind, but does not validate every options field at
runtime. Supplied getters may run during object spread. Hostile caught values
enter through fromCaught, which does not spread or probe them.

Also, the failure value itself may contain an Internal message supplied for
diagnostics. Do not serialize it directly. WeakMap storage hides details/cause
from ordinary enumeration; only the publicInfo policy hides Internal message,
Type and fields. A runtime freeze does not make data safe to disclose.

## Used in and related

Used in immutable values with private diagnostics and conservative caught-value
normalization. See [literal types and generic helpers](typescript-literals-generics-and-distributed-unions.md)
for the compile-time half of this design.
