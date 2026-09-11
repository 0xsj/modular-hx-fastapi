# Errors module notes

This directory mirrors [src/shared/errors/](../../../../../src/shared/errors/README.md).
Start with the walkthrough for a code-oriented review, then use the focused
findings and evidence as needed.

| Note | Purpose |
| --- | --- |
| [Language walkthrough](language-walkthrough.md) | Reading order, syntax notes, source links and a worked example |
| [TypeScript adaptation: typed values and runtime boundaries](typescript-adaptation.md) | The findings that shaped this language's implementation |
| [First implementation](first-slice.md) | Initial specification tests, implementation choices and selected fault checks |
| [Cross-language consistency](consistency.md) | Public shape, absence and intentional language differences |
| [Mutation findings](mutations.md) | Current selected faults and the metadata-fixture lesson |
| [Mutation evidence](mutations.json) | Exact edits, failing cases, exit codes and snapshot hashes |

See the [module contract](../../../../../src/shared/errors/CONTRACT.md) for promised behavior and
the [notes guide](../../../../../notes/README.md) for naming and ownership.
