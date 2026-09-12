# Validation contract

V01: Text validation checks valid Unicode scalar sequences, character count and
optional non-whitespace presence without trimming or normalizing. Bounds are
inclusive; invalid policy is an invalid failure distinct from an input violation.
Whitespace for this contract is ASCII space, tab, CR and LF; Unicode normalization
and domain-specific whitespace policy belong to callers.
V02: A field issue has an ASCII path (1..128 bytes; letters/digits/underscore/dot/
hyphen/brackets) and a stable ASCII code (1..64; lowercase letters/digits/underscore/
dot). Codes are safe explanations, never rejected values. Reject malformed issues.
V03: A report retains the first issue per field, at most 32 distinct fields.
Further distinct issues set truncated=true; duplicates do not. Reports expose owned
snapshots, preserve insertion order, and produce no failure when empty. Nonempty
reports project Invalid, type validation.failed and safe code-valued public fields.
V04: Strict unsigned decimal parsing accepts only ASCII digits, 1..10 bytes, with
no signs, whitespace, exponent or leading zeros except "0"; enforce inclusive
caller bounds (0..2147483647). No coercion, fallback or silent clamping.
