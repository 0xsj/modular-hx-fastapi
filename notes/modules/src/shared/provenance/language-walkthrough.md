# Provenance: implementation walkthrough

ScopeSnapshot now nests WorkSnapshot. This makes the different lifetimes visible:
retry preserves the whole work snapshot and changes execution fields. Prepare
produces work without consuming time or IDs; execute supplies attempt and executor.
A supplied correlation hint grants no authority and cannot supply actor, tenant,
scope ID, attempt, origin or known depth.

Pure validation runs before clock/ID effects. The factory reads its clock once,
then calls the generator once; the generator can independently read its own clock.
Clock rollback changes wall start time without changing retry identity rules.
Counter overflow refuses before effects; failed ID generation retains its original
failure. A supplied explicit cause cannot hide a generated parent-scope collision.

The first core tests were written before implementations. The later collision
regression was added with implementation visibility during review. P20–P22/P24
remain obligations of future transport/envelope/audit owners, not implemented
persistence or socket guarantees.

## TypeScript mechanics

A branded string helps operation/ID type checking; it is not a runtime decoder.
Constructed Actor/Reference/Attribution values are frozen and tracked by WeakSet.
Scope/WorkContext/IncomingResult use a module-private construction token plus
runtime provenance checks, so a cast cannot make an arbitrary object valid.

Freezing a Date does not stop setTime. Scope stores milliseconds and returns a fresh
Date from snapshot. Optional records remain unknown rather than fabricated defaults.
Attempt/depth use Number.isInteger plus explicit u32 bounds. Failed generator
Results are forwarded with their existing error identity.

