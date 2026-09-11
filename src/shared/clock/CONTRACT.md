# Clock contract

Status: initial implemented scope; the scenarios below are the acceptance contract.

Time has two meanings: a wall timestamp describes when something was observed;
a monotonic reading measures elapsed time. Subtract elapsed readings from the same
clock instance. Never persist them or compare origins across instances/processes.
A timestamp supplied to a domain operation is a value; obtaining it is an
application effect. Consumers request only the capability they need.

| Scenario | Observable guarantee                                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01      | A fake starts at its supplied wall instant and zero elapsed time. Repeated reads do not advance it.                                                                                            |
| C02      | Advancing by a nonnegative duration moves wall and elapsed time by that duration; zero is a no-op.                                                                                             |
| C03      | Setting wall time forward or backward leaves elapsed time untouched. The next advance starts from the corrected wall time.                                                                     |
| C04      | Invalid or unrepresentable advances are refused without changing either reading. Invalid date input is refused where the language can represent it.                                            |
| C05      | Production wall time samples the system clock; elapsed time uses the runtime monotonic source. Reads do not deliberately sleep.                                                                |
| C06      | Sharing a fake follows the language's concurrency model; updates are whole-state operations. Returned/input timestamps cannot mutate its state. Two separate reads are not an atomic snapshot. |

Production clocks inherit their platform's resolution, suspend behavior and clock
corrections. Monotonic does not promise precise physical time, progress on every
read, or inclusion of machine suspend time. Wall time may move backward.

Go uses UTC `time.Time` with the embedded monotonic component removed, plus
`time.Duration`. Rust uses timezone-free `SystemTime` plus `Duration`. TypeScript
uses copied `Date` values (millisecond wall precision) plus bigint nanoseconds for
elapsed readings. Fake advances in TypeScript take whole nonnegative milliseconds;
Go/Rust retain native duration precision. No cross-language nanosecond wall parity
is promised. Rust's unsigned duration cannot express a negative advance.

Fake input mistakes are programmer/test configuration errors: Go returns an
ordinary error, Rust returns a small local `AdvanceError`, and TypeScript throws
`RangeError`. They are not application failures. Constructors and wall setters
accept valid native instants; TypeScript rejects invalid Dates. Native overflow is
checked before mutation. Go's zero fake is usable at the zero Go instant; Rust and
TypeScript require construction. Go fakes must not be copied after use; Rust uses
interior locking, and TypeScript is synchronous within one JavaScript isolate.

No sleep, timers, scheduling, calendar utilities, timezone conversion, global
clock replacement or database precision policy belongs to this slice.
