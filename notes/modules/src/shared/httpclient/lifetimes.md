# One outbound attempt, with owned lifetime

A received 409 is a response value. A timeout is a transport failure and does not
establish whether the remote application committed. Retrying belongs with the
operation that understands idempotency, not this generic client.

An AbortSignal is an explicit argument. A finite timer covers the request and response; destroy aborts the native socket. Event callbacks funnel through one settlement path so response, error, timeout and abort cannot settle twice. Promise cancellation is cooperative; an arbitrary Promise is not killed by Promise.race.

The origin is construction-time policy. Relative input cannot redirect to another
origin, and redirects are returned without following them. Environment proxies,
cookies and inbound authorization are not silently inherited. Bearer credentials
are disclosed only to the native request adapter. Response bytes are bounded even
when Content-Length is absent or misleading.

Explicit trace propagation is the only cross-request context carried by the leaf.
See [the concrete OTel note](otel/parent-and-completion.md) for SDK ownership.
Loopback tests cover statuses, redirects, oversized responses, deadline, cancellation,
origin escape, explicit propagation and close. They do not establish arbitrary
upstream retry safety or internet TLS deployment policy.
