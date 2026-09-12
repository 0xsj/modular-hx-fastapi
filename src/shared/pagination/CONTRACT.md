# Pagination contract

P01: Page size defaults to 25 only when absent. Present input uses strict decimal
validation and must be 1..100. Empty, zero, signs, fractions and over-limit refuse.
P02: Cursor is unpadded canonical base64url of UTF-8 JSON array [1, scope, position].
Scope and position are nonempty Unicode scalar strings, at most 128 and 256 UTF-8
bytes respectively. Reject controls U+0000..001F, U+007F. Maximum wire length 1024.
Decode rejects malformed encoding, padding, noncanonical base64 trailing bits,
unknown versions/shape, and a scope different from the explicitly expected scope.
JSON byte serialization itself need not be canonical across languages; the decoded
values and base64 spelling of those bytes must be valid. Cursor inputs are untrusted.
P03: Scope is supplied by the caller and binds the query, ordering and tenant as
needed. Position is a stable total-order anchor owned by the query adapter.
Encoding supplies neither secrecy nor authenticity. Never embed credentials/PII.
P04: Read at most limit+1 rows to determine has_more. A next cursor is emitted only
when more rows exist and must point at the last returned row, not the extra row.
The page helper rejects a row window larger than limit+1 and invalid size; it owns
the returned array. Empty results are successful. No total count is fabricated.
