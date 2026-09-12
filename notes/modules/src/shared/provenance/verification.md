# Verification: provenance

2026-09-11. The common contract and public-surface tests preceded implementation.
The author had implementation visibility; these are specification-first tests,
not an independent suite. Later boundary tests are ordinary regression tests.

Initial red: missing exported constructor/function failures; not completed behavioral assertions. The [captured tool result](evidence/initial-red.json)
retains exit/output information; truncation is marked and is not a full raw log.
Current module/root coverage: **10 named tests** (scenario groups
may cover several contract IDs). This count excludes other modules and real-process
scenarios. Compiler refusals are counted separately below.

## Selected mutations

4 selected faults built successfully and were caught by tests. No invalid
mutant or harness failure was counted as a catch. Initial and restored baselines
passed; temporary-copy restoration and workspace hashes matched at the run.
[Exact mutations and failing cases](evidence/mutations.json) accompany complete
per-mutant build/test logs in evidence/. This finite fault set is not a coverage
or correctness percentage.

| Fault | Failing case(s) |
| --- | --- |
| retry_skips_ordinal | src/root/foundations.spec.ts > F02/F03 output choices preserve workflow and scope relations, src/shared/provenance/provenance.spec.ts > P03 P04 P05 P06 P07 P08 P09 transitions |
| child_loses_depth | src/root/foundations.spec.ts > F02/F03 output choices preserve workflow and scope relations, src/shared/provenance/collision.spec.ts > P23 explicit cause cannot hide reused execution identity, src/shared/provenance/provenance.spec.ts > P03 P04 P05 P06 P07 P08 P09 transitions, src/shared/provenance/provenance.spec.ts > P10 P11 bounds and wall corrections, src/shared/provenance/provenance.spec.ts > P12 P23 validates before effects and forwards failures, src/shared/provenance/provenance.spec.ts > P14 replay |
| cause_without_correlation | src/shared/provenance/provenance.spec.ts > P15 P16 P17 incoming dispositions |
| collision_guard_removed | src/shared/provenance/collision.spec.ts > P23 explicit cause cannot hide reused execution identity |

