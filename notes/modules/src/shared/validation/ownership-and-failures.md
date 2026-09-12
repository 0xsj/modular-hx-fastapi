# Safe issues are values, not rejected input

Origin: comparable scalar/decimal/report tests in this slice. An issue code is
safe public data; storing an input value as the issue would bypass error redaction.
The report keeps the first issue per field, bounds distinct fields, and copies
snapshots. The builder is operation-local, not a concurrent collector.

JavaScript string length counts UTF-16 code units. Iteration counts scalars, and a Unicode-mode surrogate regex rejects unpaired code units. isWellFormed worked on Node 24 but was outside the repository ES2023 TypeScript lib; the equivalent regex avoids changing the whole compiler target.

No normalization or domain invariant belongs here. For example a combining mark
counts separately; an identity module must decide its own normalized identifier
policy. Used in the sibling pagination source directory. See CONTRACT.md there.
