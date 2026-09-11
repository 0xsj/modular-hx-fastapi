# n2f-nest

The NestJS member of **nine to five**: backend blueprints with familiar ownership,
explicit dependencies, and a record of what we learn while building. Each blueprint
stands on its own. Shared behavior will make them useful comparisons and future
backends for Flover; that compatibility has not been demonstrated yet.

This is a light foundation. The generated `GET /` endpoint still returns
`Hello World!` and exercises Nest composition and HTTP wiring. There are no business
modules, persistence adapters, authentication, provenance, or logger foundations yet.
The HTTP smoke example can be replaced when the first real feature arrives.

The first leaf foundation is [shared/errors](src/shared/errors/index.ts): immutable
failure values, public projection, Result helpers and a framework-free exception
carrier. Its [contract](src/shared/errors/CONTRACT.md) and
[specification tests](src/shared/errors/errors.spec.ts) describe the implemented
behavior. No Nest error filter or frontend mapping is connected yet.

[Clock](src/shared/clock/README.md) and [ID](src/shared/id/README.md) provide
production/manual clocks, immutable UUID values, controlled UUIDv7 generation and
finite fixture sequences. They use Node runtime facilities and add no npm packages.

## Start

The [errors implementation guide](src/shared/errors/README.md) maps the APIs across Go,
Rust and Nest, explains intentional differences, and points to the local example.

Use the Node.js version in [.nvmrc](.nvmrc) and pnpm. Validation of this foundation
used pnpm 12.3.4. The committed lockfile records the dependency resolution.

```sh
pnpm install --frozen-lockfile
pnpm run start:dev
```

The server listens on `PORT`, defaulting to `3000`. No external service credentials
are needed. For a compiled run:

```sh
pnpm run build
pnpm run start:prod
```

## Local infrastructure

PostgreSQL 18, Redis, Mailpit, S3-compatible storage and observability run through
this repository's [compose.yaml](compose.yaml):

```sh
docker compose up -d --wait
```

See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for ports, optional environment overrides,
data lifecycle, and selected events/WebSocket direction.
[OBSERVABILITY.md](OBSERVABILITY.md) contains the synthetic telemetry example and
shared instrumentation expectations. Application adapters are not connected yet.

## Layout

```text
src/main.ts       process entry point
src/root/         Nest composition and the temporary HTTP smoke example
src/modules/      future business modules, organized by domain ownership
src/shared/       errors, clock and ID foundations; future owned infrastructure
test/             tests that exercise the assembled application
notes/            discoveries, techniques, and unresolved questions
decisions/        consequential choices and their alternatives
STATUS.md         current state and verification limits
```

Read [ARCHITECTURE.md](ARCHITECTURE.md) for dependency direction and the module
shape. Read [AGENTS.md](AGENTS.md) before changing the project. Keep learning in
[notes](notes/README.md), consequential choices in [decisions](decisions/README.md),
and the [current status](STATUS.md) accurate.

## Verify

```sh
pnpm run build
pnpm run lint
pnpm exec tsc --noEmit --incremental false
pnpm run test
pnpm run test:e2e
```

The tests cover errors, clocks, IDs and the generated greeting. The HTTP test opens
a local socket. For just the leaf contract, run `pnpm exec tsc -p tsconfig.errors.json`
and `pnpm exec vitest run src/shared/errors`.
[example.spec.ts](src/shared/errors/example.spec.ts) demonstrates a refusal reaching
an exception boundary with a safe public projection. These checks do not establish
business workflows, architecture conformance or Flover compatibility.

## Targeted foundation mutations

After installing the normal toolchain/dependencies, run:

```sh
python3 tools/mutations/foundations.py
```

The runner builds and tests isolated temporary copies, retaining logs and hashes.
Its selected mutations probe clock/ID contracts; they are not an exhaustive score.
See the [notes index](notes/README.md) for language walkthroughs and recorded evidence.
