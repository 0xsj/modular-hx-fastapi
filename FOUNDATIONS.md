# Runnable foundations example

The full slice is implemented: secret → env parsing → root config; existing
errors/clock/ID → provenance; explicit logger projections → output adapters → root.
Each clone carries its own code, contracts, tests, tooling and notes.

```sh
DEMO_TOKEN=fixture-only pnpm run foundations
```

DEMO_TOKEN is an explicit fixture credential, required even in no-op mode. It has
no access to an external service. Add `LOG_FORMAT=json` for structured records or
`LOG_FORMAT=none` to run the same work silently. Defaults are console/info/auto.
For Nest, build once then use `node dist/foundations.js` for clean captured stdout.

| Setting | Default / accepted values |
| --- | --- |
| DEMO_TOKEN | Required nonempty secret; never an implicit fallback |
| SERVICE_NAME | n2f-foundations; validated service identity |
| SERVICE_NAMESPACE / SERVICE_VERSION | n2f / dev; empty is distinct from absent |
| APP_ENV | development; development/test/production |
| LOG_FORMAT / LOG_LEVEL / LOG_COLOR | console/info/auto; console/json/none, debug/info/warn/error, auto/always/never |
| LOG_CAPACITY | 256 waiting records; 1..65536 |
| LOG_MAX_BYTES | 65536 UTF-8 bytes per record; 256..1048576 |
| LOG_FLUSH_MS | 1000; 1..10000 |
| DEMO_VERBOSE | false; exact true/false, debug example still respects severity |
| NO_COLOR | Nonempty disables auto color; explicit always/never wins |

The demo logs a safe sorted manifest and nested secret, opens startup, prepares
work without starting it, executes attempt 1, simulates Unavailable, and explicitly
retries as attempt 2. Retry preserves work/correlation/cause/depth while replacing
scope identity. It then records success, a handled Conflict and an unknown failure.
Foreign error text is retained in its original value but excluded from automatic
output. Record timestamps and scope start times have distinct lifetimes; elapsed
measurement uses the existing monotonic clock.

Successful handled scenarios exit 0. Invalid config exits 2 with safe key/reason
stderr and no boot event. Unexpected setup/work failure exits 1. Root flushes within
the configured deadline; sink failures or dropped logs use fixed stderr diagnostics
without changing a completed business outcome. There is no delivery retry or audit
promise. Blocked native writes may outlive a close deadline on their worker.

## Source reading order

| Owner | Native files / responsibility |
| --- | --- |
| `src/shared/secret` | value; private storage and explicit disclosure |
| `src/shared/env` | lookup, parse, reader, os; pure readers plus captured OS boundary |
| `src/shared/provenance` | actor, operation, reference, attribution → work/scope/links/incoming → factory |
| `src/shared/logger` | config.ts; fields.ts; projection.ts; delivery.ts; runtime.ts |
| `src/root` | config → logging → demo; settings and process resources |

The source [root contract](src/root/CONTRACT.md) owns F01–F05. Shared contracts remain
beside their modules. Module notes mirror full source directories under notes/modules.
Go uses slog; Rust uses an owned tracing Dispatch/custom subscriber formatter;
TypeScript uses its own console line and Pino JSON. Native APIs intentionally differ.
No application module imports the concrete backend through the value leaves.

```sh
python3 tools/verify_foundations.py
python3 tools/mutations/process.py
```

Verification builds the actual command and checks eleven process scenarios,
including real terminal auto-color, severity, secret redaction, scope relations,
empty values and invalid-config exit. Mutation tooling retains isolated raw evidence;
its finite selected fault set is not a completeness score.

The named demo does not run automatically on production startup. Nest's HTTP greeting
remains separate. OTLP export and retrieval from local observability infrastructure
are the next adapter checkpoint; see [OBSERVABILITY.md](OBSERVABILITY.md). No socket,
broker, database, remote secret or durable audit integration is claimed here.
