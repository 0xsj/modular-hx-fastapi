import { os } from './shared/env/index.js';
import { run } from './root/demo.js';
const captured = os();
// Retain the stdout error listener through process teardown. Write callbacks
// report EPIPE to the bounded sink; an EventEmitter error must not escape it.
process.stdout.on('error', () => {});
if (!captured.ok) {
  process.stderr.write('configuration source unavailable\n');
  process.exitCode = 2;
} else
  process.exitCode = await run(
    captured.value,
    {
      write: (line) =>
        new Promise<void>((resolve, reject) => {
          process.stdout.write(line, (error) =>
            error ? reject(error) : resolve(),
          );
        }),
    },
    (line) => {
      process.stderr.write(line);
    },
    process.stdout.isTTY === true,
  );
