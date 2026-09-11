# Specification tests and mutations answer different questions

A scenario states the behavior to preserve; a mutation checks whether the tests
notice a particular way of breaking it.

## Origin

The shared error foundation was specified through public interfaces, implemented
through an initial red-to-green cycle, and then checked with selected faults.
A later merge scenario passed immediately against existing correct behavior but
caught a mutation that earlier scenarios missed. Both kinds of test added value;
only the first sequence was a red-to-green implementation cycle.

## Start with a promise that can be observed

“Immutable errors” is too broad to be one assertion. Split it into specific
questions: can the input map change the error, can a derived error change its
base, and can a returned projection change the error? Separately specify what
annotation preserves and what translation deliberately changes.

Tests should construct inputs, call the public surface and inspect promised
results. They should not duplicate the implementation's traversal or compute an
expected vocabulary by calling the parser being tested. A literal expected result
can be repetitive and still be the clearest independent oracle within the test.

Use these tests for behavior whose violation changes caller decisions: domain
rules, failure/absence distinctions, ownership, disclosure, retries and adapter
promises. A test that merely confirms a directory exists does not serve the same
purpose. Real persistence guarantees eventually need a real adapter check.

## Distinguish three useful forms of evidence

| Evidence | What it can establish | What it does not establish |
| --- | --- | --- |
| Compilation/type checking | The tested code fits the declared type relationships | Correct classification, disclosure or business decisions |
| Passing behavior tests | The current implementation satisfies those examples | Sensitivity to every plausible mistake |
| Caught mutation | The tests reject that selected wrong implementation | Exhaustive correctness or an independent test author |

In Go, an external test package exercises the exported API. In Rust, integration
tests compile as consumers of the library. In TypeScript, tests import the public
barrel. None of those arrangements prevents the author from seeing implementation
code, so none alone makes the tests implementation-blind.

For TypeScript, runtime tests and compiler checks are especially easy to confuse.
A transpiled test can execute while type-level expectations have not been checked.
Retain the explicit type-check step alongside runtime assertions.

## The targeted mutation procedure

1. Copy the relevant sources, unchanged tests and build configuration into an
   isolated workspace, then establish a green baseline.
2. Change one production expression to represent a named fault. Examples include
   exposing Internal data, dropping a cause or replacing a map instead of merging.
3. Compile before running assertions. A deleted guard that leaves an unused Go
   variable is an invalid mutation, not a behavioral detection.
4. If compilation succeeds, run the existing tests and inspect the named failure.
   A crashed runner, missing dependency or timeout is not a successful detection.
5. Restore the copied source, confirm its hash and rerun the green baseline.
   Keep the original working source unchanged.

A survivor can indicate a missing assertion, an equivalent edit, an unspecified
behavior or a faulty harness. Investigate the distinction before changing tests
or production code. Do not weaken a promise just to make a run green.

## Scope the result honestly

“Ten selected faults were caught” is useful evidence. “The module has a 100%
mutation score” suggests a broader search that was not performed. Record the
exact edits, failing tests, invalid attempts, setup failures and restoration
checks so a later reader knows the denominator.

The tests in this exercise were authored with implementation visibility. The
sequence is ordinary specification-first TDD plus regression and targeted
mutation checks, not a blind test protocol.

## Used in and related

Used in shared foundations, domain decisions and important adapter boundaries.
See [metadata tests need distinct keys](metadata-tests-need-distinct-keys.md)
for a concrete fault that required a better fixture.
