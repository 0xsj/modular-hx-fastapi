import 'reflect-metadata';
import { os } from './shared/env/index.js';
import { startHTTP } from './root/http.js';
const lookup = os();
if (!lookup.ok) {
  process.stderr.write('configuration source unavailable\n');
  process.exitCode = 2;
} else {
  try {
    const running = await startHTTP(lookup.value);
    const stop = () => {
      void running.close().then(
        () => {
          process.exit(0);
        },
        () => {
          process.stderr.write('HTTP shutdown failed\n');
          process.exit(1);
        },
      );
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch {
    process.stderr.write('configuration or HTTP startup refused\n');
    process.exitCode = 2;
  }
}
