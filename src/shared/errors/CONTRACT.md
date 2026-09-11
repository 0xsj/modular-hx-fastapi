# Errors: first implementation contract

This slice turns the package documentation into executable behavior. The public
surface is small enough to test without accessing representation details. The
package/module documentation remains the context for ownership and future work.

## Comparable scenarios

| ID | Observable promise |
| --- | --- |
| E01 | The ten documented kinds have stable names; unknown names are rejected. |
| E02 | Construction preserves deliberately supplied classification and public data. |
| E03 | Success/absence is distinct from an existing unclassified failure. |
| E04 | Public projection hides the message, Type and fields of Internal and unknown failures. |
| E05 | Supplied metadata, derived values and public projections cannot mutate another error. |
| E06 | Adding diagnostic context preserves the local condition and its original cause. |
| E07 | Explicit translation selects the outer public data together and retains the diagnostic cause. |
| E08 | Classified cancellation and timeout survive annotation; arbitrary text does not classify errors. |
| E09 | Independent failures do not acquire the first branch's classification; an explicit summary can retain all outcomes. |
| E10 | Metadata merges keep unrelated keys, new values replace collisions, and source replacement preserves the complete meaning and diagnostic frame. |

The unknown-plus-transient case belongs to E09. There is no retry predicate in this
slice. Enumeration order is not a compatibility promise; membership and names are.
Recovery, idempotency and commit uncertainty remain operation concerns.
Logging discipline and dependency direction are review rules, not behavior claims
proved by this suite.

Inputs and outputs are tested through the public surface. Metadata means maps of
strings to strings. Empty Type means no identifier. Missing public messages on
non-Internal failures become `request failed`; Internal/unknown become
`internal error`. Diagnostic details remain available to internal callers.

Adding a source deliberately creates a new occurrence with that source, replacing
any source on the template. It preserves the condition and metadata. It does not
append unrelated causes into an aggregate. Annotation preserves the current
source instead. Foreign causes are opaque references/owned values; this package
does not make arbitrary external objects deeply immutable.

Each implementation exposes a complete public view (kind, message, optional Type
and fields) selected from one classification frame. Empty Type is absent even
after annotation. This is a transport-neutral value; JSON names, status codes and
HTTP/WebSocket envelopes belong to later adapters.

## Test procedure

Tests are written against this contract and the declared API before method bodies
are completed. Compile-ready placeholders allow an initial run to demonstrate
behavioral assertion failures. Record that run, then implement and refactor.

This is ordinary specification-first TDD with implementation visibility available
to the author. It is not an independently authored or implementation-blind suite.
Targeted mutation checks supplement the green run; they measure only the selected
faults and do not establish completeness.

## TypeScript surface

`KINDS`, `Kind` and `parseKind` define the vocabulary.
`failure(kind, message, options)` creates a trusted, frozen Failure with optional
literal `type` and fields. `withFields`, `withDetails` and `withCause` derive
values while retaining the input's kind/type specialization. Arbitrary additional
domain payload belongs in its owning union and is mapped at the boundary.

Private weak maps associate constructed values with copied diagnostic details
and an opaque cause. They recognize values created by this module without
inspecting arbitrary getters or accepting lookalike objects. This is internal
value bookkeeping, not external registration of domain cases. Public fields are
copied/frozen on construction; publicInfo and detailsOf return independent copies.

`Result<T, E>`, `ok`, `err` and `mapError` retain explicit outcomes.
`AppError` is a framework-free exception carrier for a trusted Failure.
`kindOf`, `publicInfo`, `detailsOf` and `causeOf` recognize trusted values
and carriers. publicInfo is called on an actual failure path; it always returns a
failure projection and never decides whether an operation succeeded.

`fromCaught(unknown)` preserves a recognized Failure/carrier, otherwise constructs
Internal with the caught value as a private cause. Caught null/undefined are
failures. No foreign getter, stack, name, serializer or cause chain needs to be
read. Native Error/AggregateError values remain unclassified until an adapter
translates them. No Nest filter or HTTP/WebSocket response is implemented here.
