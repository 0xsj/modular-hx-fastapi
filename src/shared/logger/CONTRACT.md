# Logger contract

The process selects console, structured JSON or no-op output. Go uses slog handlers;
TypeScript uses a hand-written console formatter or Pino; Rust uses tracing with
a custom tracing-subscriber formatter. The owning adapter contains external types.
Runtime APIs below follow native naming; this contract defines observable meaning.

## Records and immutable binding

Structured records contain timestamp_ms (UTC Unix milliseconds), level
(debug/info/warn/error), message, service resource, fields, and optional scope/error.
Console uses UTC HH:MM:SS.mmm, severity and service/message plus readable fields.
One event occupies one physical line. User-controlled text is escaped, including
newlines and terminal control sequences. JSON never contains ANSI formatting.

App fields are nested under fields. Service, scope, error, severity, timestamp and
message are owned envelope fields; a caller's similarly named ordinary field cannot
overwrite them. Child/bound loggers own copies. New ordinary field values win
within their own group without dropping unrelated keys or changing a parent.
Natively wrapped secrets redact when nested while public neighbors remain visible.
An unsupported/cyclic field must be refused or safely represented, never exposed
by falling back to an arbitrary object's raw display.

Provenance projection is explicit and preserves scope/work/correlation, operation,
attempt and known depth/origin/cause/replay/attribution. It does not generate IDs,
change provenance, infer unknown origin/depth, or claim trace/span identity.
Service name/namespace/version/instance/environment belong to process resources.

Error projection records classified versus unclassified, category, the selected
diagnostic Type when known, safe public projection and whether a cause is retained.
Raw diagnostic messages/stacks/causes are not printed automatically: they may carry
credentials. Public and diagnostic projections stay separate. This policy still
retains the original source in the error value for an explicitly authorized consumer.
A nil/absent error creates no failure record. Native unknown failures remain failures.

## Filtering, color and effects

Severity is an inclusive floor. Invalid configured text refuses; no silent fallback
for an explicitly invalid level/format/color. Defaults are console/info/auto.
Color supports auto/always/never. Auto requires a terminal and no nonempty NO_COLOR;
explicit always/never wins. Root captures these facts; pure policy functions do no I/O.
No-op and filtered events do not read time, encode records or call the output.
Ordinary work still runs when output is disabled.

Clock is supplied, and the record samples it once when emitted, separately from
Scope.startedAt. Invalid time (outside 0..281474976710655 ms) drops the record and
increments failure diagnostics. Clock/serializer callbacks must return normally;
the logger cannot preempt arbitrary application code or a blocked JavaScript event
loop. Those are not sink-delivery guarantees.

## Output ownership

An owned bounded queue delivers encoded lines to a supplied writer/sink. Default
capacity is 256 waiting records and maximum encoded record size is 65536 UTF-8
bytes. A full queue, oversized record or emission after close is dropped and
counted. No-op counts no records. No unbounded spool or hidden delivery retry exists.
Serialization or sink failure increments failures; logging does not throw a
business failure or exit the process. Counters expose accepted/written/dropped/failed.

Close stops acceptance, drains queued output and flushes the owned sink within a
caller-supplied deadline. A deadline returns timeout / logger.flush_timeout; an
observed sink failure returns unavailable / logger.sink. Root decides how to report
it without changing the completed operation's business outcome. A permanently
blocked native writer may outlive the deadline on its worker; close does not claim
that its underlying syscall was canceled. No file durability or audit guarantee.

Initial logger errors are invalid / logger.invalid_configuration, including invalid
format/level/color/queue bounds or missing required capabilities. Synchronous caller
misuse of native SDK types is outside the expected failure vocabulary.

## Comparable scenarios

| ID | Requirement |
| --- | --- |
| L01 | Exact level/color parsing and inclusive severity filtering. |
| L02 | No-op and filtered events consume no clock/encoding/writer effects. |
| L03 | Nested secrets redact; neighboring fields and immutable bound contexts survive. |
| L04 | Scope/resource identities cannot be overwritten by ordinary record fields. |
| L05 | Classified, Internal and unknown errors retain safe, distinct projections without raw causes. |
| L06 | Console color policy works; controls stay escaped; JSON has no ANSI. |
| L07 | Sink/flush failure is observable and cannot throw from ordinary logging. |
| L08 | Queue capacity bounds pending work; shutdown deadline returns while a sink is blocked. |
| L09 | Invalid config/time, oversized records and logging after close have defined outcomes. |
| L10 | Actual native console/JSON/no-op adapters produce the same record semantics. |

The foundations command is the first consumer. OTLP export/retrieval, trace carriers,
WebSocket handlers and durable audit adapters remain later integration checkpoints.
