# Client spans must represent the outbound operation

The concrete wrapper starts a CLIENT span under the current server span and injects
that child's traceparent. Injecting the server span directly would lose the outbound
operation from the causal graph. SDK types stay in this directory and root.

A received 409 is a successful transport result but an errored HTTP client span;
this differs deliberately from the server's expected-refusal classification. The
wrapper records method, received status and error.type, plus duration in seconds.
It omits destination URL, request body and credentials. IDs do not become histogram
labels.

context.with preserves the child through the async native call. try/finally ends the span even if an unexpected exception escapes; normal Result failures record duration and safe error kind. The root must register its AsyncLocalStorage context manager for parentage to survive awaits.

The stored-delivery check retrieves the exact child span from Tempo, compares its
parent with the server completion log, and finds its duration count in Prometheus.
This proves the exercised request, not saturation or every cancellation race.
