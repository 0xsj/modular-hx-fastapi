# TypeScript clocks: copy Dates and keep elapsed units explicit

**Origin:** C01–C06 on Node 24.19.0, especially mutation of input and returned Dates.

A `Date` is mutable. A `readonly` reference does not prevent `setTime()` on the
object it names. FakeClock stores a primitive millisecond number and constructs a
fresh Date for each read; setters extract the number immediately. C06 mutates both
sides of this boundary to verify ownership.

`#wall` and `#elapsed` are JavaScript private fields, enforced at runtime. The `n`
suffix in `0n` means bigint. Production elapsed readings subtract two
[`hrtime.bigint()`](https://nodejs.org/docs/latest-v24.x/api/process.html#processhrtimebigint)
values; fake advances explicitly convert milliseconds with `BigInt(ms) * 1000000n`.
Numbers and bigints cannot be mixed in arithmetic without conversion.

The public fake advance accepts whole milliseconds because that matches Date's
wall precision. `Number.isSafeInteger` rejects fractions, NaN, infinity and
unsafe numbers before BigInt conversion. The candidate wall must also fit Date's
range. Validation precedes both assignments, and invalid test input throws a
RangeError without invoking the application errors module.

Synchronous methods run within one isolate. This is not a mutex shared between
workers. The fake has no automatic advancement, timers or scheduler behavior.

**Read:** [implementation](../../../../../src/shared/clock/clock.ts), [public tests](../../../../../src/shared/clock/clock.spec.ts),
[worked example](../../../../../src/shared/id/example.spec.ts), [mutation evidence](mutations.md).
