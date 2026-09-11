/**
 * The foundation for describing failures across domain, application,
 * infrastructure and transport boundaries.
 *
 * The first implementation covers classification, safe public projection,
 * immutable failure values and diagnostic preservation. CONTRACT.md records
 * concrete interfaces and comparable scenarios E01-E10, with JavaScript-specific
 * normalization/carrier checks. The complete contract lives in this repository.
 *
 * ## Why this module comes first
 *
 * A domain must explain a refusal without knowing its database, logger or
 * transport. An adapter must translate a dependency failure without requiring
 * callers to understand that dependency. A small shared vocabulary supports both.
 *
 * This is a leaf module: language/runtime primitives only, no imports from other
 * project modules, NestJS, drivers or SDKs. It performs no I/O, configuration,
 * registration or background work. Logging, provenance and transport may depend
 * on errors; errors must not depend on them. Request IDs and trace IDs belong to
 * the observing boundary. Request objects, AbortSignals and active spans are not
 * retained as failure metadata. No Nest module or injectable service is needed.
 *
 * ## Three different questions
 *
 * Kind answers "what category of failure is this?" It is a small closed
 * vocabulary shared across modules and backend blueprints.
 *
 * Type answers "which particular condition occurred?" It is an optional, stable
 * machine-readable string owned by the module defining the condition, such as
 * `account.email_taken`. The property name `type` follows the frontend vocabulary;
 * it does not identify a TypeScript type or JavaScript constructor. Changing a
 * published Type can break consumers. Messages are prose, never identifiers.
 *
 * A domain-owned discriminated union answers "which local case can this caller
 * handle?" Consumers narrow explicit cases. A shared Kind does not replace those
 * cases, and this module does not own every domain's failure definitions. Do not
 * compare object references or messages to identify a domain condition. Adding
 * context must preserve its discriminant and actionable data.
 *
 * ## Initial kinds
 *
 * Start with these meanings. Wire status codes belong to transports.
 *
 * - `invalid`: input fails validation; field problems may explain corrections.
 * - `not_found`: a required resource does not exist or is not visible to this caller.
 * - `conflict`: the operation conflicts with current state or a uniqueness rule.
 * - `unauthenticated`: acceptable authentication is absent or invalid.
 * - `forbidden`: the caller is not permitted to perform the operation.
 * - `rate_limited`: an applicable rate or usage limit currently refuses the request.
 * - `unavailable`: a capability needed by the operation is currently unavailable.
 * - `timeout`: the operation's allowed time elapsed; completion may be uncertain.
 * - `canceled`: the operation was canceled; completion may be uncertain.
 * - `internal`: an explicitly classified unexpected failure.
 *
 * Kind is a union of these lower snake case strings, not numeric HTTP statuses.
 * Add a Kind only for a distinct shared meaning with a concrete caller; use a
 * domain Type or union case for a more specific rule. Preconditions and richer
 * validation categories can follow a real contract that needs them.
 *
 * A foreign error remains unclassified until an owning boundary recognizes it.
 * Presentation falls back to internal without pretending classification was
 * supplied. Adapters map known cancellation and timeout outcomes explicitly;
 * an error name, message substring or unrelated aborted signal is insufficient
 * evidence. Annotation preserves the classification once established.
 *
 * ## Public information and private diagnostics
 *
 * Failure carries kind, optional type, a public message, public
 * field problems, private diagnostic details and an optional cause. Fields map
 * input names to safe explanations. Details provide operator context and are
 * not additional response fields. A raw cause may be any JavaScript value.
 *
 * Error messages, stacks and causes are diagnostics, not response bodies. Never
 * return a Failure object directly or serialize its causal chain. A transport
 * constructs the public projection explicitly and adds correlation information.
 * A class name, non-enumerable property or TypeScript visibility modifier is not
 * the disclosure policy.
 *
 * Public projection yields `internal error`, no type and no fields for internal
 * and unclassified failures. A classified non-internal failure exposes only its
 * owner's explicitly public message, type and fields; an empty message falls
 * back to `request failed`. A successful Result has no failure projection.
 * Missing public metadata must never be filled from an inner cause.
 *
 * Public messages and field problems must not contain secrets or implementation
 * details. Private data can still be unsafe to log: avoid collecting secrets and
 * let the observing boundary apply redaction. Diagnostics never determine public
 * data. Runtime objects and arbitrary caught values are not public field bags.
 *
 * ## Values inward, exceptions at the framework edge
 *
 * Domain and application operations return a small discriminated Result for
 * modeled failures. Async operations return Promise<Result<T, E>>. E stays owned
 * by the operation; the shared Failure vocabulary does not require widening every
 * local union or importing another module's cases.
 *
 * The implemented outcome shape is:
 *
 * ```ts
 * type Result<T, E> =
 *   | { readonly ok: true; readonly value: T }
 *   | { readonly ok: false; readonly error: E };
 * ```
 *
 * Expected refusals stay in the error branch. An adapter catches dependency
 * exceptions where it can interpret them and returns the declared failure.
 * Unexpected throws and rejected promises can still happen: TypeScript Result
 * signatures do not establish a no-throw guarantee. Do not catch every exception
 * throughout the application and disguise programming failures as domain refusals.
 *
 * A framework-free AppError may carry a trusted Failure through a framework's
 * exception path. Construct it only where that path is needed, normally at a
 * transport boundary. A future Nest filter translates it to the wire and observes
 * unexpected exceptions. HttpException, WsException, decorators and filter
 * registration belong to transport/root, not this leaf. No filter is added by
 * this specification, and Nest's default response is not the proposed envelope.
 *
 * ## Construct, annotate, translate
 *
 * Construction creates a failure with deliberate public meaning. Domains own
 * specific cases and their stable type identifiers. They may use shared factories
 * or define a narrower union and map it at an owned boundary.
 *
 * Annotation adds private operation context while preserving kind, type, public
 * data, the local case and the original cause. Annotation of a Result changes
 * only its error branch. Do not replace a failure with a new message-only Error
 * and lose the data callers need to handle it.
 *
 * Translation deliberately changes public meaning. An adapter can recognize a
 * uniqueness violation as an email-taken domain case while retaining the original
 * failure privately. It must preserve both that case and its diagnostic cause;
 * a joined/aggregate error is not a substitute for this relationship.
 *
 * The outermost explicit classification wins. Its kind, type, message and fields
 * are selected together; missing metadata is not filled from inner causes. An
 * annotation wrapper delegates this projection instead of assigning a guessed
 * kind. Inspecting an inner cause and selecting current public meaning answer
 * different questions.
 *
 * Owned failure data is immutable after construction. Enrichment returns an
 * independent value with the same local discriminant. Copy incoming field and
 * detail records; getters/projections must not expose mutable internal records.
 * Replacing a key affects only the derived value, with the new value winning.
 * Readonly types alone do not provide runtime isolation. Do not freeze or mutate
 * an externally owned cause to manufacture immutability; retain it as an opaque
 * diagnostic reference and make no deep-immutability promise about foreign data.
 *
 * ## TypeScript surface and unknown values
 *
 * Implemented roles:
 *
 * ```text
 * Kind / Failure               shared category and discriminated failure values
 * Result<T, E> / ok / err      explicit operation outcomes; keep E specific
 * failure factories            create trusted values with public meaning
 * withFields / withDetails     derive metadata while preserving the local case
 * withCause                    construct an occurrence with a replacement cause
 * kindOf(value): Kind | undefined   inspect recognized classification
 * publicInfo                   project the safe message, type and fields
 * AppError                     optional Error carrier at exception boundaries
 * fromCaught(value: unknown)   normalize an actual caught failure at an edge
 * ```
 *
 * Factories retain kind/type literals through enrichment. Other domain payload
 * stays in its owning union and is mapped explicitly. Private weak maps recognize
 * constructed Failure values and AppError carriers without reading foreign
 * getters. An object merely containing kind and message is not trusted public
 * data. No schema library, result framework or registry of domain cases is needed.
 *
 * Classification returns undefined for an unrecognized value. It is not the
 * internal Kind. Predicates cannot mistake success or absence for an internal
 * failure. fromCaught serves a different purpose: its input is known to come
 * from a failure path, even when the value is null or undefined. It must produce
 * a real failure, preserving trusted classification or creating a safe internal
 * failure with the original unknown value retained privately.
 *
 * Normalization must not itself throw while inspecting foreign values. Handle
 * throwing property access and opaque objects with the internal fallback; do not
 * invoke arbitrary serialization or recursively chase causes without cycle
 * protection. A Result success is established by its discriminant, never by the
 * truthiness of a caught value or the absence of an Error instance.
 *
 * ## Multiple failures and partial outcomes
 *
 * A cause chain describes one failure. AggregateError or several item outcomes
 * can represent independent failures and do not acquire a kind from the first
 * branch. Single-failure accessors treat an unclassified aggregate as unclassified.
 * A deliberately classified outer summary may retain every underlying outcome.
 * Do not merge unrelated public fields or private details into one map.
 *
 * The initial module offers no batch classifier, flattened diagnostic view or
 * aggregate retry predicate. A future contract must retain item identity, unknown
 * failures and partial successes, and define ordering. Reordering items must not
 * change the public summary. Unknown failures are not harmless branches.
 *
 * ## Ownership of recovery and observation
 *
 * Kinds describe failures; they do not authorize retries. Rate-limited,
 * unavailable and timeout outcomes may inform policy, but the operation owner
 * decides whether repetition is safe, whether a write already committed, and
 * what budget remains. Cancellation normally stops the canceled operation.
 * Backoff, idempotency, retry schedules and dead-letter decisions are outside
 * this module. Timeout or cancellation is not evidence of rollback.
 *
 * Lower layers return context; the boundary handling the failure owns observation.
 * Propagating layers do not each log it. This module neither logs nor assigns
 * log levels, HTTP status, WebSocket close codes, tracing status or metric labels.
 * Those mappings, including expected refusals, need their own contracts.
 *
 * Empty results and valid domain outcomes remain successes. A missing required
 * record, refused transition, failed read and uncertain write stay distinct when
 * they require different caller behavior. Not every interesting state is an error.
 *
 * ## Scenarios for the first implementation
 *
 * - Successful Results remain successful through failure annotation.
 * - An unclassified foreign failure exposes no private information to a caller.
 * - Adapter-classified cancellation and deadlines survive annotation.
 * - Annotation retains the local discriminant, public classification and cause.
 * - Translation changes public meaning while retaining the diagnostic cause.
 * - Enriching one failure cannot change another use of its metadata.
 * - Changing supplied or projected records cannot mutate the originating failure.
 * - Internal failures conceal their message, type and fields in public accessors.
 * - Reordering aggregate items does not select a different public failure.
 * - An unknown failure alongside a transient one does not imply safe retry.
 * - Caught null, undefined, strings and hostile objects remain real failures.
 * - An exception carrier preserves a trusted Failure through the future edge.
 *
 * These mirror the other blueprints' scenarios through TypeScript semantics.
 * Common meaning, disclosure and ownership do not require Go sentinel mechanics
 * or Rust enums. HTTP problem envelopes, WebSocket messages and client mappings
 * are later adapter contracts. This module establishes no frontend integration;
 * its executable guarantees are listed in CONTRACT.md.
 *
 * @packageDocumentation
 */
export { KINDS, parseKind } from './kind.js';
export type { Kind } from './kind.js';
export { err, mapError, ok } from './result.js';
export type { Result } from './result.js';
export {
  AppError,
  causeOf,
  detailsOf,
  failure,
  fromCaught,
  kindOf,
  publicInfo,
  withCause,
  withDetails,
  withFields,
} from './failure.js';
export type { Failure, FailureOptions, PublicInfo } from './failure.js';
