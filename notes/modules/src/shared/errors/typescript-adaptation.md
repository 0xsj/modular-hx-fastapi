# Typed failure values still need runtime boundaries

A Result signature and readonly metadata express intent without eliminating
JavaScript throws or aliases to mutable data.

## Origin

Design review on 2026-09-11 while mirroring the Go draft. These are documented
language behaviors used to shape a proposed contract, not measured guarantees
of an implemented n2f errors module.

## What and why

JavaScript can throw values of any type; TypeScript's
[unknown catch variables](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html#defaulting-to-the-unknown-type-in-catch-variables-useunknownincatchvariables)
make the need to inspect them explicit. A thrown null or undefined is still a
failure. Copying Go's nil-preserving wrapping rule into a catch normalizer could
therefore turn a failed operation into apparent success.

The first implementation keeps modeled refusals in Result values, and gives actual caught values
a separate normalization path at the boundary that handles them. A typed Result
does not prevent a programming error or dependency rejection from escaping. The
normalizer must preserve that distinction and use a safe fallback for values it
cannot inspect.

TypeScript's [readonly properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties)
do not change runtime behavior or make nested values immutable. An input record
can still be changed through another reference. The proposed constructors copy
owned metadata and avoid returning mutable aliases. Opaque foreign causes remain
diagnostic references; freezing somebody else's Error object would change its
owner's behavior and still would not define a useful disclosure policy.

## Gotchas

Runtime recognition now uses module-private weak maps. An object merely containing
kind and message fields is not automatically trusted public data. The
[first-slice tests](first-slice.md) exercise safe projection, metadata
isolation and caught values. A future [Nest exception filter](https://docs.nestjs.com/exception-filters)
will also need an explicit mapping for the proposed exception carrier; the
framework's default response does not establish the common wire contract.

## Used in

- [Draft errors module contract](../../../../../src/shared/errors/index.ts), especially
  caught-value normalization, metadata ownership and framework-edge exceptions.
