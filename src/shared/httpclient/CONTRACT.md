# Outbound HTTP contract

C01: Root constructs a client for one explicit HTTP(S) origin. URLs have no userinfo,
query or fragment. No environment proxy, cookie jar, redirects or automatic retries.
Requests use an absolute-path reference beginning with one slash; resolution may
not escape the configured origin. Methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS.
C02: One attempt has a total budget (1..30000 ms), caller cancellation, request and
response bounds (1..1048576 bytes), and at most 64 active attempts. Excess concurrent
admission is RateLimited; closed clients refuse. Root closes after draining owners.
No detached retries or guessed idempotency.
C03: Received final status 200..599 is a successful transport result even for 4xx/5xx.
Return owned status/body and selected content-type; do not expose driver objects.
Oversize, truncated transport, timeout and cancellation remain distinct failures.
Network failure after sending a write is not proof the remote effect was rolled back.
C04: Accept/Content-Type are explicitly JSON. Optional bearer credentials are secret
client configuration. Only an explicitly supplied valid traceparent is propagated;
no inbound cookies, baggage, tenant or principal headers are copied automatically.
C05: Errors are safe shared failures, with no URL/query/body/credential/driver text.
Observation belongs at the operation boundary and uses fixed operation/method/outcome
and received status; payloads and arbitrary destinations are not metric dimensions.
Comparable loopback checks cover response statuses, redirect refusal, body bounds,
timeout, cancellation, origin escape, closure and propagation.
