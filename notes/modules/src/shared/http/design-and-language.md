# Completion has several observations, but one owner

**Historical design note:** the implementation and verification now live in this
module's README and root HTTP verification notes; future tense below records the
original plan, not current status.

**Origin:** design review of the foundations, public error APIs and HTTP/runtime
documentation on 2026-09-11. These are prospective tests, not observed guarantees.

A handler result, a committed status and a response-body completion describe
different moments. If a handler succeeds and the peer disconnects, telemetry must
retain what it knows without claiming rollback or client receipt. Several callbacks
may observe the same end; putting the completion guard in the test recorder would
hide a duplicate-emission bug in production.

Safe error projection is a second boundary: unknown failures stay failures even
when their native representation is absent-looking. In TypeScript, throw undefined
cannot become a successful empty response; the Result branch carries failure
presence. Rust public_info(None) likewise means an unclassified failure. Go's nil
error means absence. Matching scenarios need explicit native inputs, not identical
null conventions.

## TypeScript / Nest techniques to test

A literal union gives compile-time exhaustive cases; constructors still validate
unknown runtime input. readonly is not deep runtime immutability. Bind owned frozen
snapshots, especially fields maps and trace/provenance projections.

Use AsyncLocalStorage.run or the chosen SDK's scoped context manager instead of
a global current-request variable. Promise overlap must be tested, not inferred
from single-request examples. Node response finish indicates handoff to the
underlying system, not client receipt; close may also occur on normal completion.
One guard must reconcile response events and exception/filter finalization.
[Node HTTP](https://nodejs.org/api/http.html#class-httpserverresponse) and
[async context](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
inform these pending adapter tests. Nest interfaces do not provide DI tokens at
runtime; tokens and registrations remain at root.

**Used in:** [H01–H14](../../../../../src/shared/http/CONTRACT.md) and the
[portable completion shapes](../../../../../src/shared/http/SHAPES.md). The diagnostic process
must verify actual writer/body hooks before claiming adapter parity.
