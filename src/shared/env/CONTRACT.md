# Environment reader contract

Stage: implemented from this contract with executable scenarios. The reader consumes a captured lookup; the
process root owns configuration definitions, cross-field rules and startup.

## Values and behavior

Lookup returns text plus explicit presence. Map snapshots own a copy of caller data.
OS capture snapshots the environment once; invalid native text is a classified
invalid / env.source failure with no raw key/value. It never resolves files or
remote secrets. Lookup callbacks are trusted synchronous adapters.

Reader exposes String(key, fallback), Required(key), Int(key, fallback, min, max),
Bool(key, fallback), Enum(key, fallback, allowed), Secret(key), Err/result and
Manifest. Native method casing follows the language. Values returned while the
reader has errors are not usable configuration.

- String uses a fallback only when absent. Present empty is an actual string.
- Required and Secret refuse absent or empty. Secret has no fallback.
- Int accepts only `-?(0|[1-9][0-9]*)`, with value in the inclusive supplied
  bounds and the common safe integer range ±9007199254740991. No whitespace,
  exponent, plus sign, leading zero, fractional or trailing text is accepted.
- Bool accepts exactly true/false text; empty is invalid. Enum accepts exactly one
  supplied choice; neither parser trims or case-folds.
- Defaults and bounds/choices are validated before a lookup. An invalid default,
  bounds or empty/duplicate choice list is invalid_definition, not operator input.
- Keys use `[A-Z][A-Z0-9_]*`. A key can be read once; a duplicate produces
  duplicate_key. Definitions and lookups are not lazy.
- All failures accumulate. Err returns invalid / env.invalid, message
  "invalid configuration", and copied key→reason field problems. Reasons are fixed
  required, invalid_integer, out_of_range, invalid_boolean, invalid_choice,
  invalid_definition, invalid_key, duplicate_key, invalid_source. Never echo values.
  Invalid key problems use a fixed `<key>` placeholder instead of the rejected key.
- Manifest refuses whenever Err is present. Otherwise it returns an owned,
  key-sorted list of {key,value,source,secret}, source environment/default.
  Secret values are always `[REDACTED]`. Integer/boolean entries use canonical text.
  String/enum entries reflect explicitly nonsecret settings selected by the root.
  This is not a dump of every environment variable.

No logger, root, provider SDK, global reader or registration dependency. Reader
uses secret and errors; leaf lookup/parser helpers need no project dependency.
A root must check all reads before constructing resources or printing a boot summary.
Retries, live reload, dotenv precedence and remote secret resolution are later
owners; this slice reads the supplied environment only.

## Comparable scenarios

| ID | Requirement |
| --- | --- |
| V01 | Absent, empty and set are distinct for String, Required and Secret. |
| V02 | Integers/booleans/enums accept exact supported text and refuse malformed/boundary input. |
| V03 | Invalid definitions refuse before lookup; fallback validation cannot be bypassed by a supplied value. |
| V04 | Collect independent problems without raw-value disclosure; any problem prevents a usable manifest. |
| V05 | Owned sorted manifest preserves public values and redacts secrets; input/output mutation cannot rewrite it. |
| V06 | Duplicate keys refuse; OS capture and map fixtures preserve snapshot semantics. |

These requirements precede tests/implementation. Compiler failures, executed
assertions and mutation evidence are recorded separately in module notes.
