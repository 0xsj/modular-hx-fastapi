# Redaction and requiredness have different owners

**Origin:** design review for the accepted foundations demo, 2026-09-11.
These are specification findings, not measured implementation results.

A wrapper answers how a string may be displayed. A configuration reader answers
whether a named setting must exist or may be empty. Rejecting empty strings inside
the wrapper would couple presentation to credential policy and would not solve
missing-value handling. A constructed empty secret therefore still redacts; the
reader must preserve absence and refuse missing/empty required credentials itself.

Formatting is also several boundaries. Safe string display does not prove safe
nested JSON or debug inspection. The contract names native routes individually.
Rust's first value supports Display/Debug; a later logger projection owns JSON.
Go's standard slog hooks can be supported without importing the future logger
package. TypeScript needs runtime-private storage plus JSON and inspection hooks.

**Test implication:** include a secret sentinel and a distinct public neighbor in
the same record. Checking only absence of the secret could pass if a formatter
silently discarded the whole record. Assertions must check both redaction and
preservation of the public field. Adapter coverage is recorded only when that
adapter exists.

**Used in:** [the contract](../../../../../src/shared/secret/CONTRACT.md) and
[the implementation order](../../../../../FOUNDATIONS.md). Exact native routes and primary
references are recorded in the contract. Revisit when adding serialization or a
new logger backend; explicit reveal remains the caller's disclosure boundary.
