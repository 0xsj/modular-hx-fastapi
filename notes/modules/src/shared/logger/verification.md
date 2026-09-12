# Verification: logger

2026-09-11. The common contract and public-surface tests preceded implementation.
The author had implementation visibility; these are specification-first tests,
not an independent suite. Later boundary tests are ordinary regression tests.

Initial red: missing exported constructor/function failures; not completed behavioral assertions. The [captured tool result](evidence/initial-red.json)
retains exit/output information; truncation is marked and is not a full raw log.
Current module/root coverage: **12 named tests** (scenario groups
may cover several contract IDs). This count excludes other modules and real-process
scenarios. Compiler refusals are counted separately below.

## Selected mutations

5 selected faults built successfully and were caught by tests. No invalid
mutant or harness failure was counted as a catch. Initial and restored baselines
passed; temporary-copy restoration and workspace hashes matched at the run.
[Exact mutations and failing cases](evidence/mutations.json) accompany complete
per-mutant build/test logs in evidence/. This finite fault set is not a coverage
or correctness percentage.

| Fault | Failing case(s) |
| --- | --- |
| exclusive_floor | src/root/foundations.spec.ts > F02/F03 output choices preserve workflow and scope relations, src/root/logger.adapter.spec.ts > routes Nest severity and context without printing raw framework errors, src/shared/logger/boundary.spec.ts > L09 maximum supported time keeps the UTC console clock shape, src/shared/logger/boundary.spec.ts > L03 unsupported array accessors are refused without invoking them, src/shared/logger/logger.spec.ts > L01/L02 inclusive filtering and no-op effects, src/shared/logger/logger.spec.ts > L03/L10 immutable fields, nested redaction and real JSON output, src/shared/logger/logger.spec.ts > L06 explicit color and control escaping, src/shared/logger/logger.spec.ts > L07 failure cannot throw from log emission, src/shared/logger/logger.spec.ts > L08 bounded queue and close deadline, src/shared/logger/logger.spec.ts > L09 invalid config/time/size and closed emission, src/shared/logger/logger.spec.ts > L03 safely refuses cyclic fields without raw display |
| noop_emits | src/root/foundations.spec.ts > F02/F03 output choices preserve workflow and scope relations, src/shared/logger/logger.spec.ts > L01/L02 inclusive filtering and no-op effects |
| ignores_no_color | src/shared/logger/logger.spec.ts > L06 explicit color and control escaping |
| queue_exceeds_capacity | src/shared/logger/logger.spec.ts > L08 bounded queue and close deadline |
| cause_presence_inverted | src/shared/logger/logger.spec.ts > L04/L05 safe scope and failure projections |


Two post-implementation regression failures were observed and fixed: expanded-year
console time slicing and indexed array getters invoked during snapshotting.

A final shared regression exposed literal DEL/C1 controls and Unicode line
separators in console output. [Failing cases](evidence/unicode-controls-red.json)
preceded a formatter correction in all three builds. Console messages and field
text now escape those characters before adding owned ANSI formatting. The full
15-fault set and eleven process checks were rerun after that correction.
