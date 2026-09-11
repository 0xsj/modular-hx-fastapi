# Literal inference keeps a failure specific through generic helpers

The type machinery preserves the caller's known case; it does not establish that
an arbitrary runtime object is a valid failure.

## Origin

Review of KINDS, Failure, the factory and expectTypeOf assertions in the error
specification. The shortened snippets illustrate the same syntax as the module.

## Derive a union from a value

```ts
const KINDS = Object.freeze(['internal', 'invalid', 'conflict'] as const);
type Kind = (typeof KINDS)[number];
```

`as const` preserves the literal entries and a readonly tuple shape at compile
time. `typeof KINDS` in a type position asks for the type of the value; it does
not run JavaScript's typeof operator. Indexing that type with `[number]` obtains
the union of its element types: here `'internal' | 'invalid' | 'conflict'`.

A const binding only prevents reassignment of the variable. `as const` supplies
a compile-time view, while Object.freeze separately restricts runtime mutation.
The runtime array remains available to parse external names; the Kind type does
not exist as a runtime validator.

## Decode the Failure alias

```ts
type Failure<K extends Kind = Kind, T extends string = string> =
  K extends Kind
    ? Readonly<{
        kind: K;
        message: string;
        type?: T;
        fields?: Readonly<Record<string, string>>;
      }>
    : never;
```

| Syntax | Meaning here |
| --- | --- |
| `K extends Kind` in the parameter list | Constrain the permitted kind argument |
| `= Kind` | Use the entire Kind union when K is omitted |
| `T extends string = string` | Preserve an optional narrow identifier, defaulting to any string |
| `type?: T` | The property may be absent; reading it can yield undefined |
| `Record<string, string>` | A string-keyed dictionary with string values |
| `Readonly<...>` | Reject writes through that type at compile time |
| `... ? ... : never` | Select a type with a conditional, not a runtime if |

The second `K extends Kind` appears redundant after the constraint, but K is a
bare type parameter on the left of a conditional type. That makes the conditional
distribute over a union. Failure<'invalid' | 'conflict'> becomes a union of two
object cases, each with its own literal kind. This is useful when narrowing or
selecting a particular case with other type utilities. See [distributive
conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types).

This does not automatically constrain which domain Type string belongs to each
Kind. A domain can define that narrower union where it owns the vocabulary.

## Preserve literals at construction and enrichment

The factory declares `failure<K extends Kind, const T extends string = string>`.
K comes from the supplied kind. The const type parameter asks inference to retain
a narrow identifier from an inline options object when possible, instead of
widening it to string. It does not freeze the options object. This feature is
explained in the [TypeScript 5.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#const-type-parameters).

```ts
const refused = failure('conflict', 'email taken', {
  type: 'account.email_taken',
});
const annotated = withDetails(refused, { operation: 'register' });
```

This excerpt uses the module's factory/helpers. The return type of an enrichment
helper is F, with `F extends Failure`: the helper retains the supplied specific
failure type instead of widening the result to the broad Failure union. It may
add metadata without losing the known kind and Type.

If an identifier was already widened in a separate variable, inference cannot
recover a literal from its past runtime value. Preserving precision starts at the
caller's declaration as well as at the factory.

## Type assertions are promises by the implementation

Generic defaults such as `T = string` operate at compile time. The factory's
`options = {}` is a different kind of default: it creates the runtime fallback
when the argument is omitted or undefined. Generic precision and runtime
initialization solve different parts of constructing the value.

`as Failure<K, T>` tells the checker how to interpret the constructed object.
It neither checks data nor changes the object. The factory builds the required
shape and validates the kind before making this assertion.

The parser temporarily widens the tuple to `readonly string[]` so includes can
accept an arbitrary string. After membership succeeds, `value as Kind` records
that checked conclusion. Removing the runtime check would leave a cast that
looks safe to TypeScript but accepts invalid input.

## Gotchas

Readonly is shallow; it also does not stop changes through a mutable alias.
Nested field records need their own readonly type and runtime ownership policy.
These limitations are described in [TypeScript's object-type documentation](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties).

Record describes the value type; it does not prove that a particular runtime key
exists. Without noUncheckedIndexedAccess, an arbitrary indexed lookup may be
typed as string even when its runtime value is undefined. Check presence when
absence changes the caller's decision.
The [noUncheckedIndexedAccess reference](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)
shows how that compiler option represents the possible absence.

## Used in and related

Used in typed failure unions and enrichment helpers that must preserve known
cases. Continue with [runtime ownership and WeakMap provenance](javascript-freezing-copying-and-weakmap-provenance.md)
and [Results, caught values and exception edges](typescript-results-unknown-and-exception-edges.md).
