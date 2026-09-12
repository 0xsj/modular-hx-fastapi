# One completion feeds three signals

**Origin:** native process exports retrieved from Tempo, Loki and Prometheus on
2026-09-11, including sampling-out and collector recovery.

The HTTP adapter supplies normalized method, a registered template, final facts
and one monotonic duration. The OTel observer uses the same facts for the SERVER
span and http.server.request.duration in seconds. Unmatched routes omit http.route;
raw path/query/header values are never fallback dimensions.

The completion log links the active trace/span and carries safe n2f scope/work/
correlation identifiers plus the public error projection. These identifiers and
messages are log attributes, never metric dimensions. The local logger independently
binds its protected scope/error/trace envelopes.

Sampling all/none belongs to root. A valid non-recording span still yields trace
identity; metrics and completion logs remain enabled. The real verifier sends a
remote unsampled parent and checks that local sampling policy is applied, while
valid trace identity continues with a fresh span ID.

A private AsyncLocalStorageContextManager.with was insufficient: it preserved the
explicit callback context but SDK context.active() still saw the default global
manager. Root now owns registration and cleanup. The context fixture reads the
actual SDK span before and after await, and compares it with the completion log.
This was found by implementation review; the earlier explicit-log checks could
not prove downstream SDK instrumentation would inherit the request.

**Used in:** src/shared/http/otel/, src/root/http and the stored-delivery verifier.
