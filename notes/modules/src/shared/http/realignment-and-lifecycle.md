# Completion needs two independent classifications

**Origin:** the cross-build review and executable regressions on 2026-09-11.
The earlier tests passed while several public APIs and failure cases were wrong.

A handled application conflict normally means refused, and a 409 server span stays
unset. That does not imply every refused outcome has an unset span: if the actual
server status is 503, the span must still be an error. The regression combines
503 with a conflict kind to prevent outcome and span status from collapsing again.
Error type follows termination, selected timeout/canceled, exact 5xx text, then
handler_error. Rust's old generic "5xx" lost the actual server status.

Absence is also a separate question from error classification.
TypeScript uses the Result discriminant to preserve failure presence. Both
err(undefined) and err(null) mean an unknown failure; ok(undefined) means success.
A truthiness check cannot express that distinction. The prior function accepted a
raw exception even though its public API described a Result. HTTP now imports the
shared Outcome union rather than maintaining a parallel vocabulary.

The first-valid completion gate validates facts and monotonic duration before
consuming its terminal state. A rejected negative duration can be corrected; a
second valid finish produces no output. Each callback gets one attempt even when
another callback fails. Tests inspect these callbacks independently rather than
letting a fake observer silently deduplicate them.

#done is private runtime state, whereas readonly is only a type-system restriction.
The event loop executes the synchronous finish check/set atomically; async outputs
are deliberately outside this callback contract. BigInt represents monotonic
nanoseconds exactly, with conversion only when emitting milliseconds/seconds.
Object.freeze and copied facts keep callbacks from mutating later observations.

**Used in:** src/shared/http/policy, problem and lifecycle; ordinary regression tests
were written with implementation visibility. The four selected mutations probe
these lessons; they do not establish an exhaustive mutation score.
