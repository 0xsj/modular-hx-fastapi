# Mutation checks after the errors consistency refactor

The added merge test detects a field-loss bug that every earlier contract case
misses in all three implementations.

## Origin and result

On 2026-09-11, reran the original selected faults at their new file locations and
added mutations for the metadata merge behavior and Go's complete public view.
This repository detected **3/3 valid mutations**. Across the family, Go
detected 4/4, Rust 3/3 and Nest 3/3: ten compiled mutants, ten assertion failures,
zero survivors and zero invalid mutants in the completed runs.

| Injected fault | Compiled | Failing scenarios | Result |
| --- | --- | --- | --- |
| Expose Internal data in the public projection | Yes | E04, JS01 | Caught |
| Drop the Nest cause during annotation | Yes | E06 | Caught |
| Replace existing fields instead of merging | Yes | E10 | Caught |

## What this taught us

Changing field enrichment from merging to replacement still passes E01–E09 in
each language. E10 is the only contract case that fails for this fault in all
three. Earlier ownership tests covered input/output aliasing and collisions,
but used one field key; they did not establish that unrelated keys survive.
The added scenario closes that specific gap.

No production correction or new test was needed during this mutation run. The
existing current tests caught every selected fault.

## Method and evidence

Copied the leaf sources, their existing tests and required build configuration
into a temporary workspace. Compiled and ran a green baseline, then changed one
production expression at a time without changing tests. Each mutant compiled
before its behavior run; only an actual named test failure counted as caught.
Restored the copied file after every attempt and reran the green baseline.

SHA-256 checks confirmed both the restored copy and the original workspace files
match the initial snapshot. The working implementations were never mutated.
[Machine-readable evidence](mutations.json) retains the commands, exact
edits, failing case names, exit codes and source/test/configuration hashes.
The temporary harness was adapted to the split files; this is a selected fault
check, not an installed mutation-testing framework.

The first temporary Nest baseline stopped before any mutation: pnpm tried to
reconcile the copied project against the symlinked dependency directory and
refused the mismatch. Invoking the already installed TypeScript and Vitest CLI
entry points directly resolved the harness setup. That failed setup attempt is
not a mutant and is not included in the mutation count.

## Limits

These are hand-selected mutations with implementation visibility, not independent
or implementation-blind tests. Ten caught faults establish sensitivity to those
faults, not comprehensive mutation coverage or a global 100% score. Build
rejections, harness errors and untested behaviors receive no credit.

## Used in

- [The errors contract](../../../../../src/shared/errors/CONTRACT.md), especially E04, E06 and E10.
- [The consistency finding](consistency.md).
- [The earlier mutation evidence](first-slice.md), which describes the
  smaller check before the refactor.
