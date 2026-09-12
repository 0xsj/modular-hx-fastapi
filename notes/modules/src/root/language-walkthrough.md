# Process composition: implementation walkthrough

Configuration is validated before generating process identity or constructing
logging resources. DEMO_TOKEN has no implicit default, including when output is
disabled. Only the named foundations command runs this example; simulated
Unavailable/Conflict/unknown failures do not claim real adapter calls.

The operation owner permits one retry because the fixture performs no external
write. Unavailable alone is not a reusable retry policy. Startup, prepared work,
first execution and retry retain distinct lifetimes. Root owns the logger close
deadline and reports safe bootstrap or delivery failures.

tools/verify_foundations.py builds this clone's actual command and checks eleven
process scenarios. It parses JSON relationships and redaction, checks no-op/severity,
invalid-config exit, empty values, and runs real pseudo-terminals for auto-color.
Each clone carries the same checks without a sibling dependency.

## TypeScript mechanics

The root unwraps setup Results into AppError only to abort composition; its catch
prints a fixed safe message. Business values keep their own Result vocabulary.
A finally block closes the runtime. The stdout adapter resolves/rejects from the
Writable callback and keeps an error listener through teardown, so EPIPE does not
become an uncaught EventEmitter error.

process.stdout.isTTY supplies the terminal fact. The framework bridge maps verbose
to debug and fatal to error; Nest stack parameters are not automatically printed.
The bridge is unit tested while the independent HTTP greeting keeps its existing
bootstrap. pnpm run foundations builds first; direct node dist/foundations.js gives
clean structured stdout for scripts.

