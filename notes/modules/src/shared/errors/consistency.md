# A common public shape still needs different absence semantics

An unknown failure needs a safe public fallback, while success must remain
outside error projection.

## Origin

Comparing the three first implementations exposed a practical gap: Go had only
individual public accessors, while Rust and TypeScript already returned a
complete view. Adding Go's complete projection required keeping the existing
nil-versus-unknown distinction explicit.

## What and why

The new Go presence boolean answers whether an error exists. The classification
boolean answers whether its kind is recognized. Reusing classification success as
projection presence would silently drop foreign failures. Treating every absent
classification as success would do the same in Rust and TypeScript.

For example, Go `Public(nil)` reports absence, but `Public(foreignError)`
returns the Internal fallback. Rust `public_info(None)` runs on an actual Err
path and returns that fallback. A caught JavaScript `undefined` is also a real
failure; it must not disappear just because Go uses nil for success.

The comparison also checked metadata collisions and source replacement together:
new keys win without removing unrelated keys, public Type remains stable, and
private operation details survive. Rust consumes the old value; Go and
TypeScript leave the original occurrence intact. The same assertions do not
require the same ownership mechanism.

## Gotchas

A public projection is deliberately lossy. Do not feed its fallback back into
recovery logic as evidence that the original error was classified Internal.
A Go Kind is not automatically a JSON kind name; Rust and TypeScript also need
an explicit transport contract before claiming wire compatibility.

These cases check observable behavior with implementation visibility. The added
merge/source cases passed the existing implementations; they are regression
coverage, not a new red-to-green cycle. The new Go projection test failed against
a compilable placeholder before its body was completed.

## Used in

- [The local implementation guide](../../../../../src/shared/errors/README.md).
- [The executable contract](../../../../../src/shared/errors/CONTRACT.md), particularly E03, E04 and E10.
- [The first-slice findings](first-slice.md) for the earlier TDD and mutation
  evidence; those mutation runs predate this refactor.
