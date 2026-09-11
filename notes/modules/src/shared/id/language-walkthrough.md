# TypeScript IDs: brands are compile-time promises

**Origin:** I01–I09, strict type checking, and the entropy-boundary mutation run.

`declare const idBrand: unique symbol` introduces a type-only marker. The
intersection `string & { readonly [idBrand]: true }` distinguishes an ID from an
ordinary string in typed code; it allocates no wrapper at runtime. `parse(unknown)`
establishes the actual validation. A cast can bypass the brand, so it is never an
input-validation or security mechanism. See [unique symbol](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol).

Canonical strings give value equality, natural Map keys and ordinary JSON output.
A length check accompanies the regex because JavaScript's `$` can match before a
final newline. I01 includes that newline case. `version` and `unixMillis` accept
already validated IDs; they do not reparse arbitrary input.

JavaScript bitwise number operators work on 32-bit values. The 48-bit timestamp
therefore uses safe integer arithmetic and hexadecimal formatting, while small
counter and suffix fields use masks. BigInt is unnecessary for this timestamp
range; it remains useful for the separate clock's elapsed nanoseconds.

The entropy callback fills a Uint8Array synchronously. `catch (cause)` can catch
anything, including undefined or null, and the shared failure preserves that
exact cause. `Result` forces callers to narrow `ok` before using the value.
Only the final assignments commit generation state. Array spread gives Sequence
its own list; ID strings themselves are immutable.

The first mutation run exposed a test-reporting detail: the successful-result
helper threw a generic Error on refusal, which the conservative harness did not
count as an assertion failure. Adding `expect(r.ok).toBe(true)` made the expectation
explicit. The generator did not change. The completed run catches all eight faults.

**Read:** [value](../../../../../src/shared/id/value.ts), [generator](../../../../../src/shared/id/v7.ts),
[sequence](../../../../../src/shared/id/sequence.ts), [public tests](../../../../../src/shared/id/id.spec.ts),
[worked example](../../../../../src/shared/id/example.spec.ts), [mutation evidence](mutations.md).
