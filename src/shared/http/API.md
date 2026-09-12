# HTTP native surface

The pure leaves implement [CONTRACT.md](CONTRACT.md) and [SHAPES.md](SHAPES.md).
They do not import SDK or framework types.

- problemOf(Result<unknown, unknown>): Problem | undefined. The result branch
  distinguishes success from a caught undefined/null failure.
- classifyCompletion(CompletionFacts): Result<Classification, Failure>.
- Outcome is imported/re-exported from telemetry.
- new Active(monotonicClock, outputs); finish(facts): Result<boolean, Failure>.
- nest.Server owns native response finish/close handling and AsyncLocalStorage.
  current() reads immutable scope/logger values for the executing request.
- Observer.start(method, scheme, headers) returns an owned trace projection,
  scoped run(callback), and finish(completion, route, scope, failure).

The concrete otel observer maps one completion to duration metrics, a SERVER span
and a safe OTLP log. Scope/error details enter log attributes, never metric labels.
Root owns registered route names, provider resources, admission limits and shutdown.
