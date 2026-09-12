# The native transport owns termination

**Origin:** real diagnostic HTTP runs, including 48 requests per process with
overlap, panic, deadline and disconnect fixtures, on 2026-09-11.

The adapter starts observation before selecting a registered route. Incoming
X-Request-ID is ignored; X-Correlation-ID is accepted only as one valid UUID.
Repeated/empty/malformed hints restart local correlation. The public executor is
the named service with explicit anonymous attribution. Traceparent admission is
independent and delegated to the SDK's W3C parser.

Nest delegates bounded response handling to its Express/Node adapter. A middleware
starts observation before the controller's dispatch; response finish and close can
both fire, so the lifecycle gate owns deduplication. AsyncLocalStorage.run scopes
request values across promises without a global mutable current-request field.
AbortSignal requests cooperative cancellation. A timed-out Promise can keep running;
the adapter tracks at most 64 such handler promises and root drains that set.
The entry point exits after root shutdown, so leftover SDK timers cannot extend the
process budget. The independent starter greeting is still a separate process path.

The native callback establishes server-side handoff/completion, not client receipt.
Early disconnects may lack a final status. The examples do no persistence, so a
canceled response never claims rollback. Header parse failures before application
admission are native server behavior and have no fabricated provenance scope.
The contract covers bounded JSON, not streaming, upgrades or WebSocket ownership.

**Used in:** src/shared/http/nest/ and src/root/http; tools/verify_http.py.

A late review added a stalled-body scenario: handler timeouts begin after admission,
so they do not bound a client that stops sending its declared body. The native
boundary now owns a one-second body-read deadline and returns a safe 408. Node's
generic requestTimeout checks are not used as a substitute for that owned timer.
