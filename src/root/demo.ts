import { type Lookup } from '../shared/env/index.js';
import { SystemClock } from '../shared/clock/index.js';
import { V7 } from '../shared/id/index.js';
import {
  AppError,
  failure,
  type Result,
  type Failure,
} from '../shared/errors/index.js';
import {
  Factory,
  actor,
  attribution,
  operation,
  prepare,
} from '../shared/provenance/index.js';
import {
  type Sink,
  type Logger,
  type Runtime,
} from '../shared/logger/index.js';
import { loadConfig, type Config } from './config.js';
import { logging } from './logging.js';
// Only the composition root turns setup Results into an aborting exception.
// Business modules keep their own typed Result and recovery decisions.
function requireValue<T>(r: Result<T, Failure>): T {
  if (!r.ok) throw new AppError(r.error);
  return r.value;
}
export async function run(
  lookup: Lookup,
  sink: Sink,
  diagnostic: (line: string) => void,
  terminal: boolean,
): Promise<number> {
  const loaded = loadConfig(lookup);
  if (!loaded.ok) {
    diagnostic(
      `configuration refused: ${JSON.stringify(loaded.error.fields ?? {})}\n`,
    );
    return 2;
  }
  const config = loaded.value;
  let runtime: Runtime | undefined;
  let code = 0;
  try {
    const clock = new SystemClock();
    const ids = new V7(clock);
    config.resource = {
      ...config.resource,
      instance_id: requireValue(ids.newId()),
    };
    runtime = requireValue(logging(config, clock, sink, terminal));
    demo(config, runtime.log, clock, ids);
  } catch {
    diagnostic('foundations failed\n');
    code = 1;
  } finally {
    if (runtime) {
      const closed = await runtime.close(config.flushMs);
      if (!closed.ok) diagnostic('logging delivery failed\n');
      if (runtime.stats().dropped) diagnostic('logging records dropped\n');
    }
  }
  return code;
}
function demo(config: Config, log: Logger, clock: SystemClock, ids: V7): void {
  const start = clock.elapsed();
  const factory = new Factory(clock, ids),
    executor = requireValue(actor('service', config.resource.name));
  const startup = requireValue(
    factory.open({
      origin: 'startup',
      operation: requireValue(operation('foundations.startup')),
      attribution: requireValue(attribution()),
      executor,
    }),
  );
  const parent = requireValue(log.withScope(startup)).with({ simulated: true });
  parent.info('foundations.start', {
    config: config.manifest,
    credential: { token: config.token, public: 'visible' },
  });
  if (config.verbose) parent.debug('foundations.debug', { enabled: true });
  const workId = requireValue(ids.newId());
  const work = requireValue(
    prepare(startup, {
      workId,
      operation: requireValue(operation('demo.export')),
    }),
  );
  parent.info('work.prepared', { work_id: workId });
  const first = requireValue(factory.execute(work, { executor, attempt: 1 }));
  requireValue(log.withScope(first))
    .with({ simulated: true })
    .withError(
      failure('unavailable', 'demo dependency unavailable', {
        type: 'demo.offline',
        cause: new Error('fixture source retains credential-SENTINEL'),
      }),
    )
    .warn('dependency.unavailable');
  // No external write occurred. This fixture's owner permits exactly one retry.
  const second = requireValue(factory.retry(first, executor));
  requireValue(log.withScope(second))
    .with({ simulated: true })
    .info('work.completed', {
      result: 'exported',
      elapsed_ms: Number(clock.elapsed() - start) / 1e6,
    });
  parent
    .withError(
      failure('conflict', 'demo item already exists', { type: 'demo.exists' }),
    )
    .warn('operation.conflict');
  parent
    .withError(new Error('fixture source retains credential-SENTINEL'))
    .error('operation.unknown');
  parent.info('foundations.complete', {
    completed: 1,
    refused: 1,
    attempts: 2,
    unknown: 1,
    elapsed_ms: Number(clock.elapsed() - start) / 1e6,
  });
}
