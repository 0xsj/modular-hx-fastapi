# Local infrastructure

This repository owns its [Compose setup](compose.yaml). Docker with Compose v2
is the only prerequisite for these dependencies; the application still runs
with its own language tooling. The services run locally; application adapters and instrumentation are not connected yet.

## Start and inspect

Run from this repository:

```sh
docker compose up -d --wait
docker compose ps
docker compose logs -f
```

Defaults work without an environment file. To customize them, copy
[`.env.example`](.env.example) to `.env` and edit it before starting.
These are Compose variables; copying the file does not configure the application.

| Service | Image | Address from your host | Address inside this Compose network |
| --- | --- | --- | --- |
| PostgreSQL | `postgres:18.6-alpine` | `127.0.0.1:7220` | `postgres:5432` |
| Redis | `redis:8.10.1-alpine` | `127.0.0.1:7221` | `redis:6379` |
| Mailpit SMTP | `axllent/mailpit:v1.31.1` | `127.0.0.1:7225` | `mailpit:1025` |
| Mailpit inbox | same container | `http://127.0.0.1:7226` | `mailpit:8025` |
| S3 (SeaweedFS) | `chrislusf/seaweedfs:4.46` | `http://127.0.0.1:7230` | `http://s3:8333` |
| Grafana | `grafana/otel-lgtm:0.32.1` | `http://127.0.0.1:7240` | `http://observability:3000` |
| OTLP gRPC | same container | `127.0.0.1:7241` | `observability:4317` |
| OTLP HTTP | same container | `http://127.0.0.1:7242` | `http://observability:4318` |

PostgreSQL defaults: database `n2f`, user `n2f`, password `n2f_local`.
The user is an initialization superuser for local development. Redis has no
password in this local setup. Published ports bind to loopback. These defaults
are not deployment credentials.

Default connection strings for tools running on your host:

```text
postgresql://n2f:n2f_local@127.0.0.1:7220/n2f?sslmode=disable
redis://127.0.0.1:7221/0
```

Health checks probe database readiness, Redis PING, Mailpit readiness, the S3
health endpoint, and all six components of the telemetry image. They do not
check application integration or schema migrations.

Open a database shell or check Redis using the clients already in the images:

```sh
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec redis redis-cli ping
```

## Data and lifecycle

Named volumes belong to the Compose project, whose default name is `n2f-nest`.
Each n2f build uses different default host ports and a different project name.
For two copies of this same blueprint, override `COMPOSE_PROJECT_NAME` and
all eight published port variables in `.env.example`. Changing only the project
name isolates volumes and networks but does not avoid host port conflicts.

```sh
docker compose stop       # Stop processes; keep containers and data.
docker compose start     # Start the stopped containers.
docker compose down      # Remove containers and network; keep named volumes.
docker compose up -d --wait  # Recreate containers using the retained data.
```

Explicitly discard this project's local data only when a reset is intended:

```sh
docker compose down --volumes
docker compose up -d --wait
```

PostgreSQL 18 mounts at `/var/lib/postgresql`; see the
[data-layout note](notes/substrate/postgres-18-docker-volume-layout.md).
Initialization variables only apply to a fresh database directory. Changing
`N2F_POSTGRES_PASSWORD` does not rotate an existing database password. Changing
image majors is not a database migration.

Redis uses an append-only file on its volume with `appendfsync everysec`.
Container recreation should retain its data; a crash can still lose roughly the
last second of writes. AOF is not a backup or an event-delivery guarantee.
See [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).

Image versions are explicit so the three builds use the same release. Tags are
not immutable digests; update and recheck them together. Docker logs rotate at
10 MB with three files per container. The telemetry backend has its own data
volume. Application instrumentation is future work.

## Observability

The default stack includes the OpenTelemetry Collector, Grafana, Loki, Tempo,
Prometheus and Pyroscope in one development image. Grafana is at
`http://127.0.0.1:7240`; local login is `n2f` / `n2f_local` unless overridden.
It is provisioned with its data sources, including links between logs and traces.

[OBSERVABILITY.md](OBSERVABILITY.md) gives the application expectations, exporter
settings, synthetic signal example and steps to find the signals. Collector
acceptance and successful retrieval are different checks. Ordinary Docker stdout
is not automatically collected into Loki by this setup.

The bundled image is intended for development and testing. OTLP allows later
replacement of the telemetry backend without changing domain APIs. Infrastructure
exporters for PostgreSQL/Redis and application dashboards are not installed yet.
For backend component startup failures, temporarily set `ENABLE_LOGS_ALL=true`
on the `observability` service to forward its internal logs to Docker logs.

## Local mail

Configure an SMTP adapter with host `127.0.0.1`, port `7225`, no TLS, and no
SMTP authentication for this local service. Containerized clients use `mailpit:1025`.
The inbox is at `http://127.0.0.1:7226`. Mailpit captures messages locally;
no relay is configured. Its SQLite inbox persists in `mailpit_data`, with a limit
of 1,000 messages. [Mailpit Docker documentation](https://mailpit.axllent.org/docs/install/docker/).

## Local objects

SeaweedFS mini supplies the S3-compatible endpoint. Defaults for a host application:

```text
endpoint=http://127.0.0.1:7230
region=us-east-1
access_key=n2f_access
secret_key=n2f_secret_local
bucket=n2f-local
force_path_style=true
```

The bucket is created at startup; ordinary uploads do not auto-create other
buckets. S3 clients in Compose use `http://s3:8333`. Browser-facing presigned URLs
must use the host-reachable endpoint when signing; changing a signed URL's host
can invalidate its signature. Configure bucket CORS with explicit Flover origins
when the direct-upload feature arrives. That flow is not implemented yet.

Credentials bootstrap SeaweedFS's persisted identity; `.env` is not a credential
rotation API. The `s3_data` volume contains object data and metadata. SMTP, S3 and
Grafana credentials here serve local development only. WebDAV and the storage
admin UI are disabled; use an S3 client for objects.

SeaweedFS was selected as the maintained local equivalent because the
[MinIO community repository](https://github.com/minio/minio) is archived and marked
unmaintained. [SeaweedFS quick start](https://github.com/seaweedfs/seaweedfs).
This is a local S3 adapter target, not a claim of complete AWS feature parity.

## Events and realtime

WebSocket is the selected realtime protocol. Its endpoint belongs in each
backend's transport layer; no extra socket container is needed. The first feature
must define authorization, message envelopes, heartbeat, slow-consumer limits,
and reconnect/resynchronization behavior.

An outbox will record promised events in the same transaction as their state
change. A worker owns delivery and retries; JetStream can supply durable broker
transport later. Outbox and broker are complementary responsibilities, and an
adapter swap must preserve the observable contract. Neither event machinery nor
a WebSocket endpoint is implemented by this Compose change.

See [the foundation decision](decisions/0002-observability-smtp-and-s3-join-local-startup.md).
