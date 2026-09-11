# Errors implementation guide

For a syntax-by-syntax review, start with the
[language walkthrough](../../../notes/modules/src/shared/errors/language-walkthrough.md).

All three blueprints implement the same meaning, disclosure and ownership
contract. The vocabulary and examples are comparable; local control flow stays
idiomatic.

| Responsibility | Go | Rust | Nest / TypeScript |
| --- | --- | --- | --- |
| Construct a classified failure | `New(kind, message)` | `Failure::new(kind, message)` | `failure(kind, message, options)` |
| Stable domain identifier | `WithType` | `with_type` | `options.type` |
| Public input problems | `WithField(s)` | `with_field(s)` | `options.fields`, `withFields` |
| Private diagnostics | `WithDetail(s)` | `with_detail(s)` | `options.details`, `withDetails` |
| Retain or replace a source | `WithCause` | `with_source` | `options.cause`, `withCause` |
| Add context without translating | `fmt.Errorf("operation: %w", err)` | `Context::new(operation, err)` | `withDetails(err, { operation })` |
| Inspect classification | `KindOf` | `Classified::classification` | `kindOf` |
| Project public meaning | `Public` | `public_info` | `publicInfo` |
| Inspect diagnostic source | `errors.Unwrap/Is/As` | `Error::source` | `causeOf` |
| Carry ordinary outcomes | `error` / `nil` | standard `Result<T, E>` | `Result<T, E>` |
| Match a local condition | sentinel identity with `errors.Is` | a domain-owned enum variant | a narrowed kind/type discriminator |

Public projections contain the same four concepts: kind, message, optional domain
identifier and field problems. Explicit outer classification owns these together;
missing outer metadata is never filled from a cause. Internal and unclassified
failures expose only the Internal fallback. Private details and sources remain
available for internal inspection.

The example in each build models an email already registered, attaches a private
database cause and operation context, and produces this public meaning:

| Value | Result |
| --- | --- |
| kind | `conflict` |
| message | `email already registered` |
| Type | `account.email_taken` |
| fields.email | `taken` |

This is a shared semantic shape, not a JSON contract. Go carries an enum Kind,
Rust calls the optional identifier `error_type`, and TypeScript uses `type`.
Transport adapters will choose encoding and status/envelope conventions.

## Differences that preserve the contract

- Go's `Public` returns a presence boolean: false for a literal nil error
  interface. Its `KindOf` boolean instead reports recognized classification.
  A non-nil unknown failure has a public fallback and no recognized kind.
- Rust calls `public_info` on an Err path. An absent classification there means
  an existing unknown failure. Go nil, Rust Ok and TypeScript `{ ok: true }`
  remain success; TypeScript caught null/undefined remain actual failures.
- Go copies metadata when deriving errors, Rust moves owned data with consuming
  builders, and TypeScript copies and freezes records. Foreign causes are opaque.
- Rust delegates classification explicitly through `Classified`; a source
  chain alone does not supply it. TypeScript recognizes module-created failures
  and carriers without inspecting foreign getters. Go follows a single unwrap
  chain and stops before aggregate branches.
- Error display is diagnostic. Go may include cause text; Rust preserves sources
  separately; TypeScript uses an Error carrier only at a throwing boundary.
  Public output always goes through the projection API.

## Local implementation

| File | Responsibility |
| --- | --- |
| [kind.ts](kind.ts) | Stable classification vocabulary |
| [failure.ts](failure.ts) | Frozen values, private diagnostics, projection and exception carrier |
| [result.ts](result.ts) | Framework-free ordinary outcome helpers |
| [index.ts](index.ts) | Public exports and module context |
| [errors.spec.ts](errors.spec.ts) | E01–E10 and JavaScript-specific boundary cases |
| [example.spec.ts](example.spec.ts) | The comparable registration refusal |

Failure ownership, normalization and the exception carrier remain together so
they share private provenance maps without an exposed registration helper.

Run `pnpm exec tsc -p tsconfig.errors.json` and
`pnpm exec vitest run src/shared/errors` from the repository root.

See the [scenario contract](CONTRACT.md) and the
[consistency finding](../../../notes/modules/src/shared/errors/consistency.md).
