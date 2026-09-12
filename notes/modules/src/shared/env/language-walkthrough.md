# Env: implementation walkthrough

Lookup is captured at the process boundary, then parsing is deterministic.
Presence is a separate question from truthiness: an explicitly empty ordinary string
survives, while required/secret readers refuse it. Strict decimal and boolean syntax
avoid different coercion rules between runtimes.

Reader collects fixed key/reason problems, and a manifest is unavailable until
validation succeeds. Returned manifests own their storage and redact only marked
secrets. Raw source values never enter invalid-config diagnostics. Root owns settings
and cross-field rules; the shared module does not own a universal application config.

## TypeScript mechanics

Reader uses Maps/Sets for private accumulation and explicit undefined checks.
Number() alone accepts whitespace and exponent syntax, so a grammar check comes
first, then Number.isSafeInteger and supplied bounds. Result keeps configuration
refusal explicit. Optional Failure.fields requires a narrowed access or fallback;
the tests assert field counts so a fallback cannot hide missing diagnostics.

The OS adapter snapshots process.env. Node exposes strings after its own native
decoding; it cannot recover original invalid UTF-8 bytes that Node has replaced.
The adapter rejects malformed JavaScript Unicode visible at this boundary.

