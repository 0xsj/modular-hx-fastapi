# Selected clock mutations

**Origin:** 2026-09-11, contracts and public tests followed by implementation and
fault injection. The completed run caught 2/2 valid selected faults for this module.

| Fault | Failing public scenario |
| --- | --- |
| wall set resets elapsed | `src/shared/id/example.spec.ts > example: elapsed time and UUID order survive wall correction`, `src/shared/clock/clock.spec.ts > clock contract > C03 wall correction` |
| advance loses elapsed | `src/shared/clock/clock.spec.ts > clock contract > C02 advance`, `src/shared/clock/clock.spec.ts > clock contract > C03 wall correction`, `src/shared/id/example.spec.ts > example: elapsed time and UUID order survive wall correction` |

Every counted mutant compiled before its test run and failed a named runtime
expectation. Initial and restored baselines passed. Hashes confirmed the copied
source/test/config files were restored and their workspace originals were unchanged.
The runner changes temporary copies only; Nest reuses installed node_modules
through a symlink and invokes the compiler/test CLI directly.

Run from this clone with `python3 tools/mutations/foundations.py` and its normal
language toolchain on PATH. Rust's runner is offline and needs the locked packages
cached; Nest needs its installed dependencies. Raw logs and a combined report are
written to the temporary directory printed by the runner. The runner exits nonzero
for survivors, invalid mutants, setup failures or changed originals.

[Evidence](mutations.json) records the exact replacements, commands and hashes.
[Initial red run](initial-red.json) records the missing-API failure before bodies
existed. Those first runs stopped at compilation/import, so they were not runtime
assertion failures. These are same-author, contract-driven tests with reference
implementation visibility, not independent or blind tests.

This is a hand-selected fault check, not an exhaustive mutation score. It does not
establish global uniqueness, OS entropy failure recovery, timer behavior, other
operating systems, database constraints or frontend compatibility.

The first pass classified the counter-seed test failure as a harness error because
its helper threw a generic Error. An explicit success assertion corrected the
test helper; the production code was unchanged. The final run has no invalid
mutants or survivors.
