# Trace binding is an owned envelope

**Origin:** logger regression tests and HTTP exports on 2026-09-11.

Trace identity is projected explicitly into trace_id, span_id and sampled.
Ordinary fields named trace cannot replace the protected envelope, and deriving a
traced child does not modify its parent. The regression writes both records and
inspects their actual JSON. A non-recording trace keeps sampled=false.

withTrace validates module-owned TraceRef identity, then creates a frozen projection. Every child constructor path must preserve the bound trace: with, withScope and withError. A type annotation alone would not make nested values immutable.

Local logger delivery and OTLP log export are separate adapters with separate
failure accounting. Neither is durable audit. Shared logger code imports telemetry
values, not its SDK delivery submodule.
