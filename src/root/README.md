# Composition root

The independent HTTP greeting lives in app.module/controller/service.
The named foundations command uses config.ts, logging.ts and demo.ts.
logger.adapter.ts implements the Nest LoggerService bridge without exposing Pino.
See [CONTRACT.md](CONTRACT.md) and [process notes](../../notes/modules/src/root/README.md).
