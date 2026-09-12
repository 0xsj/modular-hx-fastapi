# Secret value contract

**Stage:** implemented and tested, including native logger projection. Remote
secret resolution and memory protection are outside this value.

## Responsibility and dependencies

A secret wraps a language-native string so supported presentation paths emit the
constant `[REDACTED]` instead of its contents. It is the first new leaf for the
foundations demo: no dependency on errors, env, logger, provenance, config or root.
Standard-library formatting hooks are allowed; provider SDKs are not.

Construction preserves the input exactly, including empty strings, whitespace,
Unicode and control characters. It performs no trimming, validation of credentials,
hashing, encryption, ID generation, time reads, environment reads or I/O.

Empty is a valid wrapped value. Whether a credential is required or may be empty
belongs to env/config or the credential's application owner. Missing configuration
is not represented by an empty Secret. Use the owner's explicit presence result.

## Ownership and explicit disclosure

The raw string has private storage and no public setter. The only supported API
for accessing its contents is named Reveal/reveal. It returns the exact original
string: Go/TypeScript return immutable string values; Rust borrows `&str` from the
owner. Do not provide implicit raw-string conversion, dereference-to-string,
public fields or an accessor that casually exposes the contents under another name.

Copying a Go value must preserve redaction. Rust owns its String and does not
expose a mutable borrow. TypeScript uses runtime-private storage; a type assertion
alone is not privacy. Ordinary property enumeration must not reveal the string.
Go's zero String wraps an empty string and still redacts. A missing pointer,
Option::None, null or undefined is not a constructed secret.

Calling Reveal/reveal does not mutate the wrapper. The returned plain string is
ordinary data and may be disclosed by its caller. Redaction provides no memory
wiping, locked memory, encryption, constant-time comparison or protection against
debuggers, unsafe code, deliberate reflection attacks or modified formatters.

## Presentation contract

The marker is constant for empty, short and long values: it discloses no length,
prefix, suffix or fingerprint. Standard unadorned content formatting returns
exactly `[REDACTED]`. Surrounding records may add their own punctuation or quotes.

Formatting flags, alternate/debug modes and nesting must not reveal contents.
Type/address inspection may identify the wrapper's type or address; it makes no
promise to hide object identity. Those operations must not expose the wrapped text.
The contract covers the native routes listed below, not arbitrary third-party
serializers. A custom serializer that deliberately calls reveal owns that disclosure.

| Build | Native routes required by the leaf |
| --- | --- |
| Go | String/GoString, fmt formatting on values and pointers, text marshaling, encoding/json on direct and nested values, direct slog attributes and values nested in slog text/JSON attributes. |
| Rust | Manual Display and Debug, including alternate/pretty Debug, values nested in standard containers and a containing struct with derived Debug. |
| TypeScript | String conversion, template literals, toJSON/JSON.stringify on direct and nested values, Node util.inspect and its use for console presentation. Runtime-private storage must also remain absent from ordinary own-property enumeration. |

Go uses the standard formatting, encoding and slog interfaces; it must not depend
on this repository's future logger package. Rust implements formatting manually,
rather than deriving Debug over its raw String. No serde dependency or raw
serialization implementation is required by this leaf. TypeScript must cover JSON
and Node inspection separately: implementing toString alone is insufficient.

There is no raw marshaling/unmarshaling round trip. Redacted JSON/text is a display
projection, not a persisted credential or an input that can reconstruct the secret.
A future Rust JSON/logger adapter must project a secret to the same marker before
encoding. All three future console/structured logger adapters must preserve it
when the secret is nested. Those are adapter scenarios, not evidence from a value test.

## Construction and failures

Go and Rust accept their statically typed string input without domain validation.
TypeScript's constructor also checks that runtime input is a primitive string,
without coercion. Invalid input throws a TypeError with a fixed message that does
not inspect or stringify the rejected value. This is an API misuse boundary; the
leaf needs no shared error dependency. Env's required-value errors are separate.

No formatting hook uses a global logger or reads the environment. A failing output
writer retains the native formatting API's error behavior; the value does not
retry, log the failure, panic deliberately or exit the process. No heap-allocation
or out-of-memory recovery guarantee is made.

## Native interface proposal

These declarations summarize the implemented public value APIs.

| Build | Construction | Explicit disclosure | Representation |
| --- | --- | --- | --- |
| Go | `secret.New(value string) String` | `(String).Reveal() string` | Struct with private string; formatting, text-marshaling and slog hooks. |
| Rust | `SecretString::new(value: String) -> Self` | `reveal(&self) -> &str` | Owned private String; manual Display/Debug. |
| TypeScript | `new SecretString(value: string)` | `reveal(): string` | Runtime-private string; conversion, JSON and Node inspection hooks. |

Keep these small implementations in one `value` file per build initially.
Additional serializers or provider resolution get an owner when a real consumer
requires them. No generic `Secret<T>`, secret registry or secret-provider interface
is introduced by this slice.

## Acceptance scenarios

These are requirements for the next executable spec tests, not completed tests.

| ID | Observable scenario |
| --- | --- |
| S01 | Construct/reveal preserves empty, whitespace, Unicode, line breaks and ordinary strings exactly. |
| S02 | Standard content formatting returns the same marker for empty and nonempty values; prefix, suffix and length are not encoded in it. |
| S03 | Alternate/debug/flagged native formatting cannot reveal the contents. |
| S04 | Native container/record nesting preserves redaction; test a distinct secret sentinel and an unrelated public field together. |
| S05 | Go text/JSON and TypeScript JSON serialization produce the marker, including nested values; Rust native Debug covers its leaf serialization-free boundary. |
| S06 | Node inspection and Go slog routes preserve redaction independently of ordinary string conversion; Rust Display and Debug are both exercised. |
| S07 | Explicit reveal returns the original value repeatedly without changing later redacted output. |
| S08 | No public mutation or implicit raw-string conversion bypass exists; verify applicable compiler boundaries as well as runtime ownership. |
| S09 | Go's zero value still redacts; absent optional values remain distinguishable from a constructed empty secret. |
| S10 | TypeScript rejects non-string runtime inputs without coercing them or invoking user-defined conversion/getter hooks to report the failure. |
| S11 | Future console/JSON/Pino/tracing adapters preserve nested secret redaction while retaining neighboring public fields. Adapter scenario. |

S01–S10 are the next leaf slice, using the applicable native routes. An unsupported
Rust serializer is not a passing JSON test. S11 requires the actual logger adapters.
Use explicit fixture strings and literal expected markers. Compilation, runtime
assertions and selected mutation results must be reported separately.

## Primary references

Reviewed for the interface design; the new implementation has not been measured.

- [Go formatting interfaces and dispatch](https://pkg.go.dev/fmt).
- [Go JSON marshaling](https://pkg.go.dev/encoding/json#Marshal).
- [Go slog LogValuer](https://pkg.go.dev/log/slog#LogValuer).
- [Rust Debug](https://doc.rust-lang.org/std/fmt/trait.Debug.html).
- [Node custom inspection](https://nodejs.org/api/util.html#custom-inspection-functions-on-objects).
