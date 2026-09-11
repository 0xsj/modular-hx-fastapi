# OTLP metric names can change on ingestion

Query the stored metric name, including unit suffixes, rather than assuming it is
identical to the instrument name.

**Origin:** Observed on 2026-09-11 with `grafana/otel-lgtm:0.32.1` and confirmed
against [Prometheus's OTLP guide](https://prometheus.io/docs/guides/opentelemetry/).

**What and why:** A synthetic OTLP gauge named `n2f.infra.smoke`, with unit `1`,
was accepted by the collector. The first query for `n2f_infra_smoke` was empty.
Inspecting series showed `n2f_infra_smoke_ratio`. The default translation escapes
dots and appends unit/type suffixes. The namespace and service name also formed
the `job` label as `n2f/<service>`.

**Example:** Query the resulting `n2f_infra_smoke_ratio` series and check its
service label. For an older single-sample probe, use a range covering its timestamp.

**Gotchas:** Translation policy can change with backend configuration. Successful
OTLP acceptance does not prove retrieval, nor does an empty instant query prove
loss after its lookback expires.

**Used in:** Local telemetry probes and the queries used to validate them.

