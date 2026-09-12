# JetStream as a real transport replacement

The outbox dispatcher now accepts either the PostgreSQL mailbox publisher or the
JetStream publisher. Its receipt interface and transaction boundary are unchanged.
JetStream delivery transfers into the same durable PostgreSQL mailbox before broker
acknowledgement; consumer effects still commit with the mailbox processed marker.

```text
command transaction → state + outbox
                             │
                       same dispatcher
                             │
                    Publisher capability
                       /             \\
           PostgreSQL mailbox       JetStream PubAck
                       ↑                  │
                       └── durable handoff┘
                             │
                  consumer effects + processed
```

## Start and run

```sh
docker compose up -d --wait postgres nats
DEMO_TOKEN=local-demo EVENTS_TRANSPORT=jetstream \\
DATABASE_URL=postgres://n2f:n2f_local@127.0.0.1:7220/n2f \\
NATS_URL=nats://127.0.0.1:7222 \\
pnpm run events:example
```

Use a dedicated diagnostic database with the event migration ledger, as described
in [the infrastructure guide](INFRASTRUCTURE_BUILD.md). Change only
`EVENTS_TRANSPORT=postgres` to run the original delivery path. Both paths log the
selected transport, dispatch and consumer completion; JetStream also logs transfer.
Payloads and connection strings stay out of those logs. This finite example is not
a permanently running worker or a business audit implementation.

| Setting | Default / rule |
| --- | --- |
| `EVENTS_TRANSPORT` | `postgres`; accepts `postgres` or `jetstream` |
| `NATS_URL` | Required secret with JetStream; one `nats://` or `tls://` endpoint |
| `NATS_STREAM` | `N2F_EVENTS` |
| `NATS_CONSUMER` | `mailbox` |
| `NATS_TIMEOUT_MS` | 1000; range 1..5000 |

Stream/consumer names are 1..40 ASCII letters, digits or underscores. The subject
is `n2f.events.<stream>`. Root explicitly creates or validates resources; incompatible
existing configuration fails without silently updating it. The connection currently
accepts no URL userinfo, query, fragment or path; local Compose runs without auth.
Token/NKey authentication, custom TLS policy and clustered operation need their own
configuration and verification before deployment.

## Persistent local broker

[Compose](compose.yaml) pins `nats:2.14.6-alpine`. The
[server config](config/nats/nats.conf) enables file persistence in a named volume,
256 MiB server file budget, 16 MiB memory budget and `sync_interval: always`.
Monitoring is loopback-only. The container health check explicitly requires JetStream.

Each stream uses file storage, one local replica, limits retention, discard-new,
64 MiB capacity and a two-minute duplicate window. The event envelope stays bounded
at 65536 bytes; the broker permits 131072 bytes to include NATS headers. A full stream
refuses new publication rather than evicting an older pending event. It therefore
needs an eventual retention/cleanup policy; this diagnostic is intentionally finite.

PubAck is durable acceptance by this local broker, not completion of every consumer.
The event UUID is Nats-Msg-Id. Duplicate acknowledgements are checked against the
stored sequence for conflicting content; the durable mailbox remains necessary
because broker deduplication expires. Use immutable event IDs and producer encoding;
a payload edit is a new event. No exactly-once or replicated availability claim.

The durable pull consumer uses explicit acknowledgement, one pending delivery,
one-second ack wait and five broker deliveries. A failed sink or malformed event
stays unacknowledged. Exhausted messages remain inspectable in the limits stream;
they are not automatically copied into a dead-letter queue. An acknowledgement lost
after mailbox commit can redeliver safely into mailbox deduplication. No reconnect
buffer or automatic publish retry is hidden in the adapter; root may reopen it.

## Unique infrastructure ports

All addresses bind to `127.0.0.1`. The effective Compose configurations were resolved
and compared, including any local overrides present during verification.

| Service | Go | Nest | Rust |
| --- | ---: | ---: | ---: |
| PostgreSQL | 7120 | 7220 | 7320 |
| Redis | 7121 | 7221 | 7321 |
| NATS client | 7122 | 7222 | 7322 |
| NATS monitoring | 7123 | 7223 | 7323 |
| Mailpit SMTP | 7125 | 7225 | 7325 |
| Mailpit inbox | 7126 | 7226 | 7326 |
| S3 | 7130 | 7230 | 7330 |
| Grafana | 7140 | 7240 | 7340 |
| OTLP gRPC | 7141 | 7241 | 7341 |
| OTLP HTTP | 7142 | 7242 | 7342 |

No overlaps were found among these 30 ports. Internal container ports may match
because each stack has its own network. Additional clones need unique project names
and all ten host-port overrides. Application HTTP listener ports are separate from
this infrastructure matrix.

## Reproduce the evidence

```sh
python3 tools/verify_jetstream.py
```

The verifier owns an isolated Compose project and fresh databases/streams. It tests
the real dispatcher, PubAck and mailbox handoff, then runs the compiled root with
both transports. It kills and recreates its broker, retrieves an unchanged pending
envelope from disk, and consumes it after restart. It also checks broker outage,
configuration mismatch, conflicting IDs, full-size events and safe failure logs.
It stops only its own fixtures and retains named volumes. The normal development
JetStream services remain available on the ports above.

[Adapter contract](src/shared/events/jetstream/CONTRACT.md),
[language notes](notes/modules/src/shared/events/jetstream/protocol-and-ownership.md),
and [verification notes](notes/modules/src/root/jetstream-verification.md) record the details.
