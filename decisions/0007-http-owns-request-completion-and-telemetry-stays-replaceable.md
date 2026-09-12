# 0007 — HTTP owns request completion and telemetry stays replaceable

**Status:** Accepted · **Date:** 2026-09-11

## Context

The implemented foundations can describe and log local work. The next consumer is
an HTTP request so that trace propagation, request isolation and real OTLP delivery
are exercised through a useful boundary. A shared UUID or logger backend does not
automatically supply distributed trace context.

## Decision

Build telemetry value leaves, HTTP projection/policy leaves, then their observation
lifecycle and concrete adapters. HTTP owns request completion, status mapping and
bounded attribute selection; telemetry owns SDK/provider delivery. Root composes
both and owns configuration, resources and a single shutdown budget. Keep SDK types
out of domain/application and shared value contracts.

Use an RFC 9457 problem profile that preserves the existing safe error projection.
Keep trace, correlation and execution identities separate. Use SDK W3C propagation;
incoming context conveys no authority. Record a refusal as an explicit outcome,
without treating every handled 4xx server response as a failed span.

The first diagnostic HTTP example uses the existing foundations without a product
domain or database. Its contracts precede tests and implementation. Concrete OTel
versions and Rust HTTP/runtime dependencies require a compatibility check and their
own recorded selection before installation.

## Alternatives and costs

Putting telemetry directly into the logger would conflate log delivery, tracing
and request completion. Letting every controller own lifecycle hooks would duplicate
status, cancellation and redaction decisions. A generic universal observability
facade would grow ahead of its consumers; HTTP instead owns a narrow capability.

Automatic instrumentation can provide useful native hooks, but combining two
owners can duplicate server spans and duration samples. Select one owner per signal
and verify actual adapter behavior. An accepted local enqueue cannot substitute
for retrieval evidence from the stores.

## Verification

This is an architectural decision and specification stage. Planned evidence:
pure projection/policy tests, adversarial lifecycle/context tests, real HTTP process
tests, then trace/log/metric retrieval plus outage/recovery/shutdown. No application
OTLP or new HTTP behavior is claimed by this record.
