# Secret: implementation walkthrough

The secret value owns presentation, not requiredness. Empty is valid and reveal
returns the exact input; env rejects empty credentials at its boundary. A public
neighbor in each nested test prevents a false fix that redacts the entire object.
Logger tests exercise the real adapter, not only standalone formatting hooks.

Redaction is explicit type behavior. It cannot recognize a credential after reveal
has returned an ordinary string, erase process memory, or authorize provider access.

## TypeScript mechanics

#value is runtime-private JavaScript storage; TypeScript private alone would
remain enumerable at runtime. Object.freeze prevents public mutation but is not
the mechanism hiding the credential. Separate toString, Symbol.toPrimitive, toJSON
and util.inspect.custom hooks cover distinct presentation routes. The test also
disables custom inspection to verify hidden storage does not reveal the value.

expectTypeOf verifies no implicit string conversion at compilation. Constructor
misuse returns a fixed TypeError without calling a foreign object's toString.

