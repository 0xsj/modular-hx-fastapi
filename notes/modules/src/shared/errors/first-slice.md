# The first errors slice: specification, execution and fault checks

The contract can guide multiple language implementations without pretending their
representations or verification evidence are identical.

## Origin

Implemented on 2026-09-11 from the local package documentation and the concrete
[scenario contract](../../../../../src/shared/errors/CONTRACT.md). Interfaces and placeholder bodies
were declared, tests were written against the public surface, then the initial
run was recorded before completing the behavior.

The initial Vitest run loaded the declared API and all eleven contract tests failed against placeholder behavior.

## What changed

TypeScript uses immutable Failure values, typed Result helpers and a plain
AppError carrier. Module-private weak maps recognize constructed values and keep
diagnostics separate. Normalizing a caught value reads no foreign getters and
does not mistake caught null/undefined for success.

A full TypeScript check found an existing extensionless import of
supertest/types in the generated HTTP test. The installed declaration exists,
but NodeNext needs its .js subpath spelling. Changing it to an explicit type-only
import fixed the check without changing runtime behavior.

Runtime recognition uses weak maps rather than property-shape guessing. Copies,
deserialized objects and values from another loaded copy of the module are
untrusted until an owning boundary reconstructs them. This is value recognition,
not an authorization mechanism. Both selected valid mutations compiled, were
detected, and were restored before a green baseline rerun.

## Evidence and limits

Review removed an unnecessary assertion about vocabulary enumeration order.
The contract promises membership and stable names, so those are now checked
without preventing harmless reordering.

Thirteen tests pass: eleven contract cases, one usage example and the existing greeting unit test. Build, lint, focused error type-checking and full-project type-checking passed.

Selected faults: Exposing the Internal projection; losing a diagnostic cause during enrichment. The final result was 2/2 valid mutations detected.
Compilation was checked separately; a build failure is not a test kill. Only the
mutated file was restored from bytes read immediately before each mutation, and
its hash was checked after restoration.

This was ordinary specification-first TDD with implementation visibility
available to the author. There was no separate test author, enforced information
barrier or claim of blind testing. The small mutation sample measures sensitivity
to those faults; it is not a completeness or correctness proof.

## Used in

- [failure.ts](../../../../../src/shared/errors/failure.ts) and its public specification tests.
- [CONTRACT.md](../../../../../src/shared/errors/CONTRACT.md) for the exact first-slice scope.
