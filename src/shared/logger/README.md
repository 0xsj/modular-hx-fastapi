# Logger

Console, JSON and no-op output with explicit projections and bounded delivery.

Read the [contract](CONTRACT.md), then the native config, projection, delivery, runtime/handler files.
The composition root supplies settings, resources and lifecycle; this module never
imports root or product code.

- [Implementation notes](../../../notes/modules/src/shared/logger/README.md).
- [Runnable example](../../../FOUNDATIONS.md).

Omitted (undefined) config properties select defaults; explicitly empty enum text or zero bounds refuse. Sink and clock capabilities are captured by the owning root.
