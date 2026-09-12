# Trace identity does not replace work identity

**Historical design note:** the implementation and verification now live in this
module's README and root HTTP verification notes; future tense below records the
original plan, not current status.

**Origin:** review of the implemented provenance/logger notes and W3C/OpenTelemetry
documentation on 2026-09-11. This is design reasoning, not measured adapter behavior.

Provenance gives an execution a Scope and lets logical work survive retries.
Tracing may sample that execution out while its work still exists. Reusing a UUID
as trace identity would couple these lifetimes and conceal the possibility of
valid non-recording context. A logger field also cannot create an active SDK span.

The first leaves therefore validate an owned trace projection and a finite outcome
vocabulary. HTTP supplies the consumer that makes lifecycle/export decisions concrete.
A handled conflict can be refused without setting a server span to Error.
Delivery diagnostics are independently lossy and must not be mistaken for audit.

## TypeScript / Nest techniques to test

A literal union provides static cases; parseOutcome still validates unknown
runtime input. A brand cast can be forged by a caller, so trace construction and
binding need runtime checks. readonly does not deep-freeze objects: own the
snapshot and protect nested mutable data explicitly.

The Result branch preserves constructor success/failure even for absent-looking
foreign input. Keep Nest decorators and injection tokens out of these value
files; interfaces disappear at runtime and root owns their registrations.

**Used in:** the [contract](../../../../../src/shared/telemetry/CONTRACT.md) and
[native leaf plan](../../../../../src/shared/telemetry/API.md). Runtime checks and selected mutations
remain pending.

The Nest suite validates runtime inputs rather than relying on brands: malformed,
zero, uppercase and invalid-length projections are refused, and each outcome is
checked exactly. The Result branch preserves failure for absent-looking input.
