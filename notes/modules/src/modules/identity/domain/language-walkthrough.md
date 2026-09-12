# TypeScript: runtime invariants behind static types

**Origin:** implementing the principal tests and a subsequent runtime-forgery review.

String unions describe kind/status to TypeScript callers, but casts, JSON and plain
JavaScript bypass them. Branded IDs similarly require runtime parsing. Restore
checks each boundary and normalizes the parsed UUID.

`#state` is an ECMAScript private field; `private constructor` is only a TypeScript
restriction. A regression test using `Reflect.construct` created a version-zero
principal and showed that the initial transition implementation accepted it.
The test failed before the fix. Transitions now validate current state before
version/status evaluation, matching the Go zero-value refusal.

`Readonly` alone is static. The constructor copies and freezes its snapshot;
`snapshot()` returns another shallow copy. This suffices because all current fields
are primitives. Nested mutable fields would require a new ownership policy.

JavaScript numbers include fractions, NaN and infinity. `Number.isSafeInteger`
checks integer representation before common time/version bounds. String iteration
counts code points, while shared validation rejects lone surrogate values so the
accepted names use the same scalar semantics as Go and Rust.

`Result<Principal, Failure>` and the `ok` discriminator keep expected refusals in
ordinary control flow. Domain code imports no Nest decorators or framework types.

**Used in:** principal.ts and principal.spec.ts.
See [invariants and evidence](README.md).

