# ID contract

This module separates the UUID value from generation effects. It depends on shared
errors, standard runtime facilities and (in Rust) a private OS entropy adapter.
It has no dependency on the clock module: its generator consumes only a wall-time
capability supplied by the caller. Domain-specific ID wrappers belong to domains.

| Scenario | Observable guarantee |
| --- | --- |
| I01 | Parse exactly 36 ASCII characters in 8-4-4-4-12 hexadecimal form, accepting either case and emitting lowercase. Accept variant `10` with any version nibble, including existing v4 inputs. Reject whitespace, compact/braced/URN forms, bad hex/hyphens, nil and other variants with `invalid / id.invalid`; do not echo input. |
| I02 | IDs have value equality and canonical formatting. UUIDv7 timestamp extraction returns integer Unix milliseconds only for version 7. Parse does not verify generation provenance or uniqueness. |
| I03 | Generate RFC 9562 UUIDv7: 48-bit Unix milliseconds, version 7, a 12-bit counter, variant `10`, and 62 fresh random bits. Exact deterministic byte fixtures are comparable across builds. |
| I04 | Successful sequential calls on one generator strictly increase by bytes/canonical text. A new greater millisecond reseeds the counter; same time or rollback retains the previous timestamp and increments the counter. No global or restart ordering guarantee. |
| I05 | A counter at 4095 refuses further calls at the same/earlier timestamp with `unavailable / id.exhausted`. State remains unchanged; a later wall millisecond permits progress. No spin, sleep, hidden retry or invented future millisecond. |
| I06 | An entropy failure returns `unavailable / id.entropy` with the original diagnostic cause; no ID or generator state is committed. A later successful call uses the next unconsumed counter. No insecure fallback. |
| I07 | Negative or greater-than-48-bit Unix milliseconds are refused with `invalid / id.time_range` before entropy/state changes, even during rollback. Native submillisecond times truncate downward within the accepted nonnegative range. |
| I08 | A finite Sequence returns supplied IDs in order, owns its input list, and repeatedly returns `unavailable / id.sequence_exhausted` after exhaustion. It consumes no clock or entropy and may intentionally repeat fixtures. |
| I09 | The production constructor uses the runtime's cryptographic OS randomness. Concurrency follows the language model below; duplicate-free tests within one generator establish no statistical/global collision claim. |

Each attempted generation that reaches entropy requests exactly 10 bytes. On a
new timestamp, the first two bytes in big-endian order seed the low 11 counter
bits (high counter bit starts at zero). The remaining eight bytes become the
suffix with its top two bits replaced by variant `10`. At a repeated/earlier tick,
the first two random bytes are discarded and the previous counter is incremented.
This provides at least 2049 successful IDs at a fresh timestamp before refusal;
a zero seed permits 4096. Ordering wins over the suffix's random variation.
Successful state is committed only after entropy succeeds. Entropy itself may
have been consumed on a failed attempt and cannot be rolled back.

The timestamp range is inclusive `0..281474976710655`. ID timestamps are approximate
generator wall time, held during rollback; event occurrence time stays a separate
field. IDs are identifiers, not authorization secrets. Random collision resistance
across independent generators still requires storage uniqueness constraints.

Go uses a private 16-byte comparable value, `(ID, error)`, a consumer-owned `Now`
interface and `io.Reader`. A generator/sequence mutex serializes its own calls,
including dependency access; do not copy it or reenter it from a dependency. Shared
injected dependencies across generators require their own concurrency protection.
The zero Go ID is an absence sentinel: `String` displays nil, parsing/MarshalText
and sequence construction reject it. Failed UnmarshalText preserves the receiver.

Rust uses a private 16-byte `Id` with Copy/Eq/Ord/Hash and `Result<Id, Failure>`.
There is no public invalid/zero constructor. A wall-time closure supplies the
consumer's capability; `Entropy` hides OS-library types. Generation takes `&mut
self`; share through caller-owned synchronization when needed. Clock fakes can be
shared through Arc. No Clone implementation duplicates generator state.

TypeScript uses an immutable branded canonical string and the shared `Result`
union. `parse` validates unknown input; the brand is a compile-time aid, not a
security boundary. Generation is synchronous within one isolate, with no shared
state across workers. Dependency exceptions from entropy become failures; bad
clock values are classified, while arbitrary programmer exceptions in clock
callbacks are not caught. Fakes return copied Date values.

Rust/Node OS entropy errors are recoverable values. Modern Go's default
`crypto/rand` may terminate the process on catastrophic OS entropy failure; the
module cannot convert a runtime fatal error into a result. Injected reader errors
are preserved and tested. Dependencies must honor their documented byte-fill and
wall-clock contracts; panics and malicious/reentrant adapters are outside it.

Reference: [RFC 9562, UUIDv7 and counters](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7).
Timers, database encoders, transport schemas, token generation and domain ID
wrappers are deferred until there is a concrete consumer.
