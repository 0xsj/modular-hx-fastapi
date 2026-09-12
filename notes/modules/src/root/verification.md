# Verification: root

2026-09-11. The common contract and public-surface tests preceded implementation.
The author had implementation visibility; these are specification-first tests,
not an independent suite. Later boundary tests are ordinary regression tests.

Initial red: module import failure before any tests ran. The [captured tool result](evidence/initial-red.json)
retains exit/output information; truncation is marked and is not a full raw log.
Current module/root coverage: **4 named tests** (including the existing HTTP controller unit test) (scenario groups
may cover several contract IDs). This count excludes other modules and real-process
scenarios. Compiler refusals are counted separately below.

## Selected mutations

1 selected faults built successfully and were caught by tests. No invalid
mutant or harness failure was counted as a catch. Initial and restored baselines
passed; temporary-copy restoration and workspace hashes matched at the run.
[Exact mutations and failing cases](evidence/mutations.json) accompany complete
per-mutant build/test logs in evidence/. This finite fault set is not a coverage
or correctness percentage.

| Fault | Failing case(s) |
| --- | --- |
| summary_loses_retry | src/root/foundations.spec.ts > F02/F03 output choices preserve workflow and scope relations |

The [real process report](evidence/process-scenarios.json) passed all eleven scenarios.
The [JSON example](evidence/foundations-example.jsonl) and safe invalid-config stderr
are captured from actual binaries. No database, broker, socket or OTLP was exercised.

## Full checks and limits

Node 24.19.0 / pnpm 11.22.0: TypeScript compilation, Nest build, 67 unit tests, 1 HTTP end-to-end test, oxlint and changed-source Prettier checks passed.

The separate pnpm peers check reports the existing vite-tsconfig-paths → tsconfck@3.1.6 peer constraint (^5.0.0) against installed TypeScript 6.0.3. Pino introduces no peer conflict. Vite also reports that native tsconfigPaths can replace that plugin. This unrelated test-tool migration was not performed; actual compiler/unit/e2e checks are green.

Fifteen selected mutations passed build validation and were caught. Eleven real-process scenarios passed. The native source/manifests/lockfiles were compared to mutation-run hashes after documentation edits; [the audit](evidence/runtime-hash-audit.json) matched. The final hash audit includes the Unicode console correction; subsequent edits only update notes and status.

No frontend compatibility, OTLP retrieval, WebSocket/event propagation, provider availability, transaction/outbox atomicity or durable audit guarantee was verified. These remain explicit later integration checkpoints.
