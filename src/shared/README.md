# Shared foundations

Reserve this directory for capabilities with a named responsibility and a concrete
consumer, which may be the process itself.
Keep shared values independent of NestJS and concrete integrations separate from
those values. Prefer a focused package for a demonstrated need over a generic
utilities collection.

The first foundation lives in [errors/index.ts](errors/index.ts), with package-level
documentation and a [concrete contract](errors/CONTRACT.md). Failure values,
diagnostics, Result helpers and an exception carrier are implemented and tested.
No Nest filter or wire mapping is connected yet.

[Clock](clock/README.md) separates wall time from monotonic elapsed readings.
[ID](id/README.md) provides UUID values, controlled generation and finite fixtures.
Both have public contract scenarios and language walkthroughs.

Logger, provenance and configuration remain subsequent work. Nothing here should
depend on a business module or the composition root.
