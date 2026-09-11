# 0002 — Observability, SMTP and S3 are part of local startup

**Status:** Accepted · **Date:** 2026-09-11

## Context

Observability is a priority for every n2f build. The selected supporting interfaces
are WebSocket for realtime, SMTP for mail, and S3 for objects. Independently usable
clones need the same local services and comparable integration behavior.

## Decision

Extend each default Compose stack with Mailpit, SeaweedFS in single-node mini mode,
and Grafana's OpenTelemetry development stack. Observability starts by default.
Keep project-specific loopback ports and persistent volumes for all three builds.

Use OTLP as the telemetry export boundary. The local stack receives logs, metrics
and traces; application instrumentation is a separate foundation with the
expectations in `OBSERVABILITY.md`.

Use standard WebSocket at the backend transport boundary. Specify message,
authorization, heartbeat, reconnect and resynchronization behavior when the first
realtime feature is built. No independent socket server is required now.

Start event-producing database workflows with an atomic outbox. Outbox recording
and broker delivery have different responsibilities: JetStream may be the later
delivery adapter. Swapping delivery implementations must preserve the agreed
failure, retry, duplicate, ordering and observability behavior. No broker is added
before the first event workflow and its acceptance scenarios.

SeaweedFS supplies the local S3 endpoint with credentials and a pre-created bucket.
Future application storage ports expose needed object operations; provider SDK
types remain inside adapters. SMTP targets Mailpit locally.

## Alternatives

- Keep observability optional: saves resources, but makes it easy to build features
  without inspecting their telemetry. Default startup includes it.
- Separate collector, Grafana and individual telemetry stores: more deployment
  control, but more local configuration. Keep OTLP so deployment topology can change.
- MinIO community: familiar, but its repository is archived and marked unmaintained.
  SeaweedFS provides an actively released S3-compatible development option.
- Treat outbox and JetStream as interchangeable implementations of one publish call:
  hides the database commit boundary. Separate atomic recording from delivery.
- Socket.IO or SSE: the selected initial wire protocol is standard WebSocket.
  Add another protocol only for a demonstrated requirement.

## Consequences

Default startup is heavier. Each clone remains self-contained, with no external
accounts, production credentials, shared service, or paid license needed to run.
The bundled telemetry stack and single-node storage are development configurations.

An available endpoint does not establish application integration or full AWS S3
compatibility. Object operations, presigned URLs and browser CORS need targeted
checks when the adapters and frontend upload flow arrive.

## Verification

Validate Compose with defaults and example overrides, run all three stacks together,
capture local SMTP messages, perform signed S3 operations and check persistence.
Send synthetic OTLP logs, metrics and traces and retrieve them from their stores.
Record actual evidence and limits in `STATUS.md`.

## Sources

- [Grafana development image](https://github.com/grafana/docker-otel-lgtm)
- [MinIO repository status](https://github.com/minio/minio)
- [SeaweedFS quick start](https://github.com/seaweedfs/seaweedfs)

