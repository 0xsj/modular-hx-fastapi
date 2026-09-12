# Cursor opacity does not establish trust

Origin: malformed cursor tests and cross-language JSON differences. Cursors encode
[version, scope, position]. The caller must bind scope to query/tenant/order and
supply a stable total-order position; the codec cannot infer any of those.

Base64url is unpadded and checked by decoding then re-encoding. Permissive decoders
can accept padding or noncanonical trailing bits. Go JSON repairs unpaired surrogate
escapes; its adapter checks those tokens explicitly. Rust serde rejects them;
JavaScript validates decoded scalar strings. Numeric version 1.0 is accepted as 1
in each build.

Window uses limit+1 but puts the last *returned* row in the next cursor. Using the
extra row skips a record. Container ownership is shallow: Go/TypeScript copy the
array, not arbitrary mutable item objects; Rust moves the input Vec.

Used in this source directory; CONTRACT.md and native input tests capture the
limits. No SQL ordering, cursor signature, encryption or authorization is claimed.
