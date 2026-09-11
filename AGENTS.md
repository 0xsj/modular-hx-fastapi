# Working in n2f

Read this file and [README.md](README.md) first. Consult
[ARCHITECTURE.md](ARCHITECTURE.md) when changing boundaries; read other documents
when the task needs them.

## Purpose

Nine to five is a family of independently usable backend blueprints. Each build
carries a familiar architecture and working discipline, expressed in its own
language and framework. This repository is a starter, with its implemented state
listed in the README. Reserved folders are not implemented capabilities.

A clone must be complete on its own. Do not import a sibling repository, reach
outside this repository for runtime configuration, or make local documentation
depend on files that do not travel with the clone.

## Architecture in practice

- A module owns its domain vocabulary, rules and application operations.
- Domain and application code stay free of framework and persistence details.
  Declare narrow capabilities at the consumer and supply implementations at the
  composition root.
- Modules do not import peers. Compose reads or translate between ports at the
  root. Introduce event coordination only for a concrete workflow.
- Shared code has a named responsibility and no dependency on product modules or
  the composition root. Third-party types stay behind their owning boundary.
- Build the smallest complete behavior that demonstrates a boundary. Add a
  dependency, layer, abstraction or worker to solve a named problem.
- Keep empty, missing, refused, failed and uncertain outcomes distinct wherever
  they imply different caller behavior.
- State the owner of transactions, retries and background lifecycles. A state
  change and a promised event or receipt need an explicit atomicity guarantee.
- Use the conventions in ARCHITECTURE.md as review rules. Do not describe them
  as mechanically enforced until an applicable check exists.

## How work is recorded

**Notes are a deliverable.** Record discoveries while the work is fresh: the
failed assumption, alternative, failure mode or technique the code cannot explain.
Follow [notes/README.md](notes/README.md). There is no note quota; do not invent a
finding to fill a directory or restate a function signature.

Module notes mirror the full repository-relative source directory under
`notes/modules/<source-directory>/`, including source roots such as `pkg/`,
`internal/` or `src/`. Keep topic notes and evidence inside that directory;
use descriptive filenames without repeating the module name as a prefix.
Mirror nested source directories when a note belongs to that narrower owner.
Create note directories only when there is a note to record; this is a directory
mapping, not a requirement for one note per source file. Keep reusable language
and technique notes in their existing lifespan categories.

Keep these records distinct:

- Behavior contracts live beside the module before its implementation, using the
  language's documentation conventions. Name inputs, outcomes, ownership and
  failure behavior.
- Notes preserve learning and are separated by lifespan.
- [Decision records](decisions/README.md) preserve consequential choices and
  genuine alternatives, including their cost.
- [STATUS.md](STATUS.md) records work, corrections and verification. Update the
  README when what is runnable or implemented changes.

Keep current guidance current. Supersede a consequential decision when it changes;
correct descriptive documentation directly. A past assumption must not continue
to instruct the next implementation.

## Comparing the builds

For a coordinated task, establish a common behavior contract before parallel
implementation. Each repository carries the contract it implements locally.
Use comparable scenarios and report intentional differences in APIs,
dependencies and runtime behavior. The comparison should allow findings to change
the contract; it must not assume one implementation is correct because it came
first.

When using parallel agents, give each a clear repository or file scope. Coordinate
changes to shared expectations explicitly. Do not overwrite another build's work
to make a comparison pass.

## Verification

Run checks appropriate to what changed. Keep deterministic unit scenarios close
to the behavior, and verify persistence guarantees against the real adapter when
one exists. Tests written with implementation visibility are ordinary tests;
specification timing alone does not make them independent or implementation-blind.

Report what ran, what passed, what failed, what was skipped and what remains
unverified. A build checks compilation; an empty test suite establishes no
behavior. Do not add tests that merely count folders or repeat the implementation.

Protocols can be adopted when their costs are justified. No external protocol
directory, decision-sealing tool or architecture checker is required by this
scaffold.
