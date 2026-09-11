# Reading the Nest error leaf as TypeScript and JavaScript

The error module has no Nest dependency; its main lessons are type precision,
runtime ownership and the boundary between returned failures and thrown values.

## Origin and reading order

Written from the current factory, Result helpers, carrier and specification tests.
The notes distinguish TypeScript checks from JavaScript behavior and use official
language/runtime references for further reading. The project runtime/configuration
are in [.nvmrc](../../../../../.nvmrc), [package.json](../../../../../package.json) and
[tsconfig.json](../../../../../tsconfig.json).

| Read | What to notice | Review note |
| --- | --- | --- |
| [kind.ts](../../../../../src/shared/errors/kind.ts) | as const, typeof in a type, indexed access and checked assertions | [Literal inference and generic unions](../../../../language/typescript-literals-generics-and-distributed-unions.md) |
| [failure.ts](../../../../../src/shared/errors/failure.ts), type declarations | Generic defaults, const inference, distribution, Readonly and Record | [Literal inference and generic unions](../../../../language/typescript-literals-generics-and-distributed-unions.md) |
| [failure.ts](../../../../../src/shared/errors/failure.ts), runtime helpers | Spread order, shallow freezing, WeakMap membership and non-null assertions | [Runtime ownership and provenance](../../../../language/javascript-freezing-copying-and-weakmap-provenance.md) |
| [result.ts](../../../../../src/shared/errors/result.ts) | A discriminated union, never, narrowing and mapError | [Results and exception edges](../../../../language/typescript-results-unknown-and-exception-edges.md) |
| [index.ts](../../../../../src/shared/errors/index.ts) | Type-only exports, runtime exports and a stable import surface | [Results and exception edges](../../../../language/typescript-results-unknown-and-exception-edges.md) |
| [errors.spec.ts](../../../../../src/shared/errors/errors.spec.ts) | Runtime assertions alongside separately checked expectTypeOf calls | [Specification and mutation technique](../../../../techniques/specification-tests-and-targeted-mutations.md) |

## Follow one failure

This complete review example assumes a file at the repository root so the relative
import resolves. The [existing example test](../../../../../src/shared/errors/example.spec.ts)
also demonstrates the exception boundary.

```ts
import {
  AppError, causeOf, err, failure, fromCaught, mapError, publicInfo, withDetails,
} from './src/shared/errors/index.js';

const cause = new Error('PRIVATE database constraint');
const outcome = err(failure('conflict', 'email already registered', {
  type: 'account.email_taken',
  fields: { email: 'taken' },
  cause,
}));
const contextual = mapError(outcome, (e) =>
  withDetails(e, { operation: 'register' }),
);

if (!contextual.ok) {
  try {
    throw new AppError(contextual.error);
  } catch (caught: unknown) {
    const normalized = fromCaught(caught);
    const view = publicInfo(normalized);
    console.log(view.kind, view.type);
    console.log(view.fields?.email);
    console.log(causeOf(normalized) === cause);
  }
}
```

Expected output:

```text
conflict account.email_taken
taken
true
```

The factory retains the literal kind and Type, copies public fields and registers
private diagnostics. mapError runs the enrichment only for failure. The carrier
provides a throwing shape; fromCaught recovers its registered failure. publicInfo
returns the safe public view. `?.` is optional chaining: reading email stops and
returns undefined if fields is absent instead of throwing on that absence.

## Compare the other implementations

Go uses standard error returns and sentinel matching. Rust uses ownership moves
and a generic typed context. TypeScript's objects stay structurally typed at
compile time, so it also needs explicit runtime ownership and recognition rules.
A boolean Result discriminant does not make the underlying object frozen, and a
frozen object does not validate its public meaning. The local
[implementation guide](../../../../../src/shared/errors/README.md) maps the common contract.

## Evidence and limits

E02 checks literal precision through tsc, E05 checks runtime isolation, E06 checks
cause retention, JS01/JS02 exercise caught-value recognition, and E10 checks
merging. The [mutation report](mutations.md) identifies which faults they
caught. These notes do not change the [contract](../../../../../src/shared/errors/CONTRACT.md).

## Related reading

- [Metadata merges need a preserved-key assertion](../../../../techniques/metadata-tests-need-distinct-keys.md).
- [Typed failure values still need runtime boundaries](typescript-adaptation.md).
