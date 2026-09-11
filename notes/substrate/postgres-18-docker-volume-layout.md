# PostgreSQL 18 changed the Docker data-volume boundary

Mount the persistent volume at `/var/lib/postgresql` so it contains the image's
versioned data directory.

**Origin:** Read the [official image documentation](https://hub.docker.com/_/postgres),
then checked `postgres:18.6-alpine` on 2026-09-11.

**What and why:** PostgreSQL 18's Docker image defaults to
`PGDATA=/var/lib/postgresql/18/docker`. The older
`/var/lib/postgresql/data` mount does not cover that default directory.
Copying a previous major's Compose configuration therefore needs a layout review.

**Example:**

```yaml
volumes:
  - postgres_data:/var/lib/postgresql
```

**Evidence:** `SHOW data_directory` returned the versioned path. Docker inspection
showed the named volume mounted at its parent. A written row survived forced
container recreation. The old mount and major-version upgrades were not tested.

**Gotchas:** Initialization variables act on an empty data directory; they do not
reconfigure an existing cluster. Correct mounting is not an upgrade or backup
strategy.

**Used in:** Local development Compose configurations for PostgreSQL 18.

