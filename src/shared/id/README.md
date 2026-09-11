# id

Read the [module context](index.ts) and [contract](CONTRACT.md) first.
The implementation has no framework, transport, product or persistence dependency.

## Comparable API

| Capability | Go | Rust | Nest / TypeScript |
| --- | --- | --- | --- |
| UUID value | `ID`, private comparable array | `Id`, private Copy/Eq/Ord/Hash value | branded immutable `ID` string |
| Parse | `Parse(string) (ID, error)` | `Id::parse(&str)` / `FromStr` | `parse(unknown): Result<ID, Failure>` |
| Format | `String`, text marshal | `Display` / `to_string()` | the string itself |
| V7 timestamp | `Time() (time.Time, bool)` | `unix_millis() -> Option<u64>` | `unixMillis(id)` → `number` or `undefined` |
| Production generator | `NewV7(wall)` | `V7::new(wall_closure)` | `new V7(wall)` |
| Inject entropy | `NewV7WithEntropy(wall, reader)` | `V7::with_entropy(wall, entropy)` | `new V7(wall, entropy)` |
| Generate | `NewID() (ID, error)` | `new_id(&mut self) -> Result<Id, Failure>` | `newId(): Result<ID, Failure>` |
| Fixture generator | `NewSequence(ids...)` | `Sequence::new(&ids)` | `new Sequence(ids)` |


## Reading and use

The [executable example](example.spec.ts) corrects wall time backward after a 25 ms
advance. Elapsed time stays at 25 ms and UUID generation stays ordered. Its
entropy is deterministic for demonstration only. Production code chooses the
system clock and the default cryptographic generator at composition time.

Expected example output:

```text
01234567-89ab-7000-8000-000000000000
01234567-89ab-7001-8000-000000000000
25ms
```

The [language walkthrough](../../../notes/modules/src/shared/id/language-walkthrough.md) explains syntax and
ownership; [mutation notes](../../../notes/modules/src/shared/id/mutations.md) distinguish tested guarantees
from future work. Every clone carries its own contracts, code and evidence.

Ordering is local to one generator. Rollback holds its last timestamp; exhaustion
returns a classified refusal until a later millisecond. Generator failures never
commit state. Parsing remains version-independent and rejects other variants.
Store event occurrence time explicitly; database uniqueness belongs to persistence.
