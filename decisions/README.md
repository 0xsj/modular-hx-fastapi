# Decisions

Record a choice when it changes a stored-data shape, a contract another party
uses, a difficult-to-remove dependency, a significant architectural boundary,
or reverses a previously reasoned decision.

Routine reversible implementation choices do not need numbered records.

## Accepted

- [0004 — Wall time and UUID generation have explicit state](0004-wall-time-and-uuid-generation-have-explicit-state.md)

- [0003 — Errors preserve meaning across boundaries](0003-errors-preserve-meaning-across-boundaries.md)

- [0001 — Each blueprint owns its local infrastructure](0001-each-blueprint-owns-local-infrastructure.md)

- [0002 — Observability, SMTP and S3 join local startup](0002-observability-smtp-and-s3-join-local-startup.md)

## Record before implementation

Use `NNNN-a-specific-claim.md`, with numbers local to this repository.

```markdown
# 0001 — a specific claim

**Status:** Proposed · **Date:** YYYY-MM-DD

## Context
The concrete constraint that requires a choice.

## Decision
The chosen behavior or boundary.

## Alternatives
Real options considered and why they lost.

## Consequences
What becomes easier and what this costs.

## Verification
The relevant evidence, or an explicit account of what is not verified.
```

The statuses are **Proposed**, **Accepted**, **Superseded**, and **Rejected**.
Retain rejected alternatives when their reasoning could prevent repeated work.

An accepted record's body stays unchanged. A later record supersedes it; update
the earlier status with a link. Cite records by their full filename, and name the
repository when comparing decisions across builds.

Immutability is held by review today. There is no sealing tool or tamper-evidence
claim in this scaffold. If one is adopted later, verification and sealing must
be separate operations; a failed check must never rewrite its baseline.

[ARCHITECTURE.md](../ARCHITECTURE.md) is the current working map.
[Notes](../notes/README.md) preserve discoveries; [status](../STATUS.md) records
progress and corrections.
