# Foundations process contract

F01: Read and validate the captured environment before creating IDs or output resources.
DEMO_TOKEN is required, nonempty, and always a secret. Missing differs from empty;
neither receives an implicit credential. LOG_FORMAT/LEVEL/COLOR are exact enums.
SERVICE_NAME defaults to n2f-foundations and must be a valid named service identity.
APP_ENV is development/test/production. Logger capacity, record bytes and flush
milliseconds are bounded positive integers; all invalid keys/reasons are collected.

F02: The explicit foundations command composes real clock, UUIDv7, provenance and
logger modules. Open startup, prepare a distinct work ID without starting it,
execute attempt 1, simulate Unavailable, and explicitly retry that work as attempt 2.
Work/correlation/cause/depth stay stable while execution identity changes. There
is one successful work result, one handled Conflict and one observed unknown
failure. All dependency failures are fixtures, never claims of actual adapter I/O.

F03: Log a safe sorted config manifest, nested wrapped secret with public neighbor,
service/build/process identity, explicit scope/error projections and monotonic
elapsed milliseconds. Configured output is console/info/auto by default. JSON,
console and none perform the same work. DEMO_VERBOSE enables a debug example.

F04: Successful demonstration including handled refusals exits 0. Configuration
refusal exits 2, writes only safe key/reason diagnostics to stderr, and writes no
boot event. Unexpected setup/work failure exits 1 with a fixed safe stderr message.
Close always drains within LOG_FLUSH_MS. Sink failure or dropped records is reported
through fixed stderr diagnostics without changing a completed business outcome.

F05: This is a named example executable. Nest's HTTP greeting remains independent.
No database, broker, WebSocket, OTLP, remote secret provider or durable audit claim.
The native entry owns environment capture, terminal/NO_COLOR facts and exit status.


## Diagnostic HTTP composition

The separate HTTP executable follows the HTTP and telemetry module contracts.
Root validates typed settings before constructing providers or listening, shares
one service instance between SDK resources and the logger, declares finite route
names and explicit anonymous ingress attribution, and owns the remaining shutdown
budget. It stops admission and drains HTTP before telemetry and local logging.
Test-only routes require HTTP_TEST_ROUTES=true. See TELEMETRY_HTTP.md at repository
root for settings, commands and recorded integration evidence.
