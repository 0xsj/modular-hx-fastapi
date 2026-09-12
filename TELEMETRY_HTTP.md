# Telemetry into HTTP

The diagnostic HTTP slice is implemented: safe problem projection, completion
policy and lifecycle, provenance admission, native request context, protected
trace logging, and concrete OTLP trace/metric/log providers.

Run from this clone:

```sh
DEMO_TOKEN=fixture-only pnpm run http:example
```

The listener defaults to 127.0.0.1:7300. The independent foundations command
continues to demonstrate env parsing, secret redaction and logging without HTTP.

## Dependency and ownership order

1. Errors and telemetry trace/outcome values.
2. HTTP problem projection and completion classification.
3. First-valid completion gate and immutable logger trace binding.
4. [Native HTTP adapter](src/shared/http/nest/): admission, routing, context,
   bounded JSON responses, deadline and transport termination.
5. [OTel HTTP observer](src/shared/http/otel/) implements the consumer's observation
   capability. [Telemetry delivery](src/shared/telemetry/otel/) owns SDK providers.
6. [Composition root](src/root/http.ts)
   validates settings, shares one service instance, listens and drains.

SDK types remain in root and concrete adapters. There is no sibling import.
HTTP reuses telemetry's outcome type. A 409 refusal leaves the server span unset;
an actual 5xx status marks it as an error even when a selected application failure
has a refusal outcome. IDs from provenance and tracing have separate lifetimes.

## Diagnostic routes

GET /_examples/http/success, /conflict, /unavailable and /unknown return
200/409/503/500. HEAD has no body. Unknown paths return 404; unsupported methods
return 405 with Allow: GET, HEAD. Public errors omit private causes and diagnostics.

HTTP_TEST_ROUTES=true adds fixed panic, delay and context fixtures. The process
verifier enables these explicitly; they have no persistence or domain side effects.

## Settings

| Setting | Default / constraint |
| --- | --- |
| HTTP_HOST / HTTP_PORT | 127.0.0.1 / 7300; numeric IP, port 0..65535 |
| HTTP_TIMEOUT_MS | 1000; 1..30000 |
| HTTP_TEST_ROUTES | false; strict boolean |
| SHUTDOWN_MS | 3000; 1..30000; shared remaining budget |
| TELEMETRY_MODE | none or otlp; default none |
| TELEMETRY_ENDPOINT | http://127.0.0.1:7342; credential-free HTTP(S) base URL |
| TELEMETRY_SAMPLING | all or none; default all |
| TELEMETRY_QUEUE / TELEMETRY_BATCH | 256 / 64; batch <= queue <= 65536 |
| TELEMETRY_TIMEOUT_MS | 500; 1..10000 |
| TELEMETRY_INTERVAL_MS | 500; 100..60000 |

The first boundary caps request bodies at 1 MiB and native header handling at
16 KiB, with a one-second body-read deadline. It is a bounded JSON adapter. Header parsing failures before application
admission remain native server behavior. It does not claim streaming, HTTP/2,
WebSocket handoff, client receipt, authentication, durable audit or rollback.

Existing SERVICE_*, APP_ENV and LOG_* settings configure the shared resource and
local logger. DEMO_TOKEN remains the diagnostic profile's required fixture secret.
Use TELEMETRY_MODE=otlp to export to this clone's Compose collector. No-op mode
constructs no providers and invents no trace IDs.

## Verification

```sh
python3 tools/verify_http.py
python3 tools/mutations/http.py
docker compose up -d --wait observability
python3 tools/verify_http.py --mode otlp --evidence /tmp/n2f-http.json
python3 tools/telemetry/verify_http_delivery.py --grafana http://127.0.0.1:7340 --evidence /tmp/n2f-http.json
```

The process verifier covers 48 HTTP requests plus six invalid-config starts.
It checks overlap before/after an async yield, valid/repeated/malformed incoming
context, unknown failures, protocol limits, deadlines, disconnects and one completion
log per admitted request. Add --sampling none to verify non-recording context.
Use --endpoint http://127.0.0.1:1 for a collector outage, or
--recover-via http://127.0.0.1:7342 for outage/recovery within one process.

The retrieval check uses event timestamps and the exact service instance. It reads
stored Tempo spans, trace-linked Loki logs and Prometheus duration histograms.
The mutation runner tests four selected regressions in isolated copies; it is not
an exhaustive mutation score. Tests added during this implementation are ordinary
regression/integration tests, not implementation-blind oracles.

See [HTTP notes](notes/modules/src/shared/http/README.md),
[SDK notes](notes/modules/src/shared/telemetry/otel/runtime-and-delivery.md) and
[root evidence](notes/modules/src/root/http-verification.md).
Flover integration, business modules, persistence, outbound HTTP, auth and sockets
remain separate future consumers.
