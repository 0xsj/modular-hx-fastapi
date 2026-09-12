# Logger: implementation walkthrough

The log envelope owns service, scope and error. Ordinary application fields stay
under fields, so a caller cannot overwrite scope_id by using a similarly named key.
Binding owns a snapshot; a child override retains unrelated parent fields and cannot
mutate its parent. Public error projection is separate from diagnostic classification.
The logger never automatically displays a foreign cause, diagnostic message or stack.

Delivery capacity counts waiting records; one additional record can be in flight.
Oversize/full/closed records increment dropped; encoding/sink failure increments
failed. Close stops acceptance, drains and flushes within its caller's deadline.
A deadline is not cancellation of an arbitrary blocking writer. No delivery retry,
file durability, audit or OTLP claim follows from stdout success.

Tests cover actual JSON/console/no-op paths, retained secret neighbors, filtering,
color/control escaping, blocked output, sink and flush failures, invalid timestamps,
oversize/closed records and safe projections. Root uses fixed stderr diagnostics for
delivery problems without changing a completed operation's business result.

## TypeScript mechanics

The console formatter is local; JSON goes through the installed Pino adapter.
No Pino logger or serializer type escapes the facade. Plain object fields are copied
from property descriptors. Accessors, foreign instances, cycles and unsupported
values are refused instead of invoking arbitrary display hooks.

Review found two bugs after the first green suite: fixed-position ISO slicing broke
for expanded years, and Array.map invoked indexed getters. Failing regressions now
cover both. UTC time is derived from milliseconds; array elements must be own data
properties. The earlier suspicion about trailing-newline regular-expression matches
was not reproduced; those boundary tests passed before any parser change.

A single async pump owns sink writes; queue bounds exclude the current in-flight
write. Promise rejection increments failed. Close races completion with a timer and
clears that timer. It cannot preempt a blocked JavaScript event loop. Runtime-private
fields preserve bound logger ownership. The Nest LoggerService bridge stays at root.


JSON string escaping covers C0 controls but is not a complete console policy.
A final regression demonstrated literal DEL/C1 and Unicode line separators.
The console adapter now escapes them in messages, resources and encoded fields;
its own ANSI color is added separately. Structured JSON retains its native encoding.
