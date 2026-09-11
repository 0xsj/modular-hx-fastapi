# Result handles expected outcomes; unknown handles the throwing edge

A discriminated union keeps ordinary failure in the return type, while a small
Error subclass carries a trusted failure across a boundary that must throw.

## Origin

Review of Result helpers, fromCaught, AppError, E03 and the example test. The
module contains no Nest imports or decorators: its runtime behavior is plain
TypeScript/JavaScript even though its consumer is a Nest application.

## Read the Result union

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

The literal boolean ok is the discriminant. After checking `if (result.ok)`, the
checker knows which payload property is available. A leading `|` formats the
union; it is a type operator, not JavaScript boolean OR.

`ok<T>(value): Result<T, never>` says the helper creates only success.
`err<E>(error): Result<never, E>` creates only failure. `never` denotes a type with
no values; it is different from undefined, which is a real runtime value and can
be a legitimate success payload.

```ts
return result.ok ? result : err(fn(result.error));
```

This mapError body is a runtime conditional. It returns an existing success
unchanged and only invokes fn on failure. The generics `<T, E, F>` preserve the
success type while changing the error type from E to F. The test's callback
throws if mistakenly called for success, making that branch distinction visible.

## Caught values are unknown, not necessarily Error

JavaScript can throw undefined, null, strings and objects as well as Error
instances. A catch binding typed unknown requires narrowing before property
access; any would opt out of that check. fromCaught preserves a recognized
failure, otherwise creates Internal and retains the exact caught value as cause.

```ts
trusted(value) ?? failure('internal', 'unexpected failure', { cause: value })
```

`??` evaluates the fallback only when the left side is null or undefined.
Other expressions in the implementation intentionally use truthiness: empty
Type is omitted, and `message || 'request failed'` gives an empty string the
public fallback. These operators are not interchangeable in general.

A caught undefined is an actual failure here. It must not be confused with a
successful `ok(undefined)` or Go's nil error convention.

## Read the exception carrier syntax

```ts
class AppError<F extends Failure = Failure> extends Error {
  constructor(readonly failure: F) {
    requireFailure(failure);
    super(failure.message, { cause: causeOf(failure) });
    this.name = 'AppError';
    carriers.set(this, failure);
  }
}
```

This is a class excerpt using the surrounding private helpers. `extends Error`
provides the native error shape. `readonly failure: F` in the constructor is a
TypeScript parameter property: it both accepts an argument and declares/stores a
property. Readonly is a compile-time restriction, not Object.freeze.

`super(...)` calls the Error constructor with its cause option. It must run before
accessing this. The earlier requireFailure call is allowed because it only uses
the parameter. Assigning name improves diagnostics. Registering the carrier makes
normalization independent of a mutable public property or a spoofed prototype.

The class bridges a throwing edge; ordinary operations can still return Result.
A Nest exception filter or HTTP/WebSocket encoder is a separate future adapter.
No framework injection is needed to construct these values.

## Imports, exports and the .js suffix

`import type { Failure } ...` imports only a type and is erased from emitted
JavaScript. Ordinary imports carry runtime values such as failure and AppError.
The index file re-exports the supported surface so moving private files need not
change callers.

With package type module and NodeNext module resolution, relative imports use
the runtime `.js` path even though the source file is `.ts`. TypeScript resolves
the source during checking, while emitted JavaScript keeps the path Node needs.
See the [TypeScript module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html).

## Type assertions need a type-checking run

`expectTypeOf(...).toEqualTypeOf<...>()` expresses a compile-time expectation.
A normal Vitest execution transforms TypeScript to runnable JavaScript; it does
not by itself establish those type relationships. The project's separate tsc
checks are part of the evidence. Runtime expect assertions separately verify
freezing, identity, normalization and metadata. See [Vitest's type-testing guide](https://vitest.dev/guide/testing-types).

## Used in and related

Used when application operations return explicit outcomes and an outer framework
expects thrown exceptions. See [runtime ownership and recognition](javascript-freezing-copying-and-weakmap-provenance.md)
for the private invariants behind the carrier.
