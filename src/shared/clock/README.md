# clock

Read the [module context](index.ts) and [contract](CONTRACT.md) first.
The implementation has no framework, transport, product or persistence dependency.

## Comparable API

| Capability | Go | Rust | Nest / TypeScript |
| --- | --- | --- | --- |
| Production | `System{}` | `SystemClock::new()` | `new SystemClock()` |
| Controlled fake | `NewFake(start)` | `FakeClock::new(start)` | `new FakeClock(start)` |
| Wall reading | `Now() time.Time` | `now() -> SystemTime` | `now(): Date` |
| Elapsed reading | `Elapsed() time.Duration` | `elapsed() -> Duration` | `elapsed(): bigint` nanoseconds |
| Correct wall | `Set(time.Time)` | `set(SystemTime)` | `set(Date)` |
| Advance both | `Advance(time.Duration) error` | `advance(Duration) -> Result<(), AdvanceError>` | `advance(milliseconds): void`, throws `RangeError` |


## Reading and use

The [executable example](../id/example.spec.ts) corrects wall time backward after a 25 ms
advance. Elapsed time stays at 25 ms and UUID generation stays ordered. Its
entropy is deterministic for demonstration only. Production code chooses the
system clock and the default cryptographic generator at composition time.

Expected example output:

```text
01234567-89ab-7000-8000-000000000000
01234567-89ab-7001-8000-000000000000
25ms
```

The [language walkthrough](../../../notes/modules/src/shared/clock/language-walkthrough.md) explains syntax and
ownership; [mutation notes](../../../notes/modules/src/shared/clock/mutations.md) distinguish tested guarantees
from future work. Every clone carries its own contracts, code and evidence.

Declare the narrow wall/elapsed capability at the consumer; the clock module
does not require consumers to depend on a combined service interface. Wall time
and elapsed readings are separate values. No sleep or scheduling API is present.
