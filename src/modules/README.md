# Business modules

Add a named module when there is a real feature. Its `domain/` owns business rules;
`app/command/` and `app/query/` own use cases and their required ports; `infra/` supplies
concrete adapters; `transport/` handles protocol translation. Create each directory
when it has work to own.

Keep `domain/` and `app/` free of NestJS and infrastructure dependencies. Do not
import peer modules or root. Declare a consumer port and let root provide
the cross-module adapter when a use case needs another domain's capability.

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the complete dependency rules.
