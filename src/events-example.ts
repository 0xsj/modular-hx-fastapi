import { os } from './shared/env/index.js';
import { runEvents } from './root/events.js';
const lookup = os();
const stop = new AbortController();
process.once('SIGTERM', () => stop.abort());
process.once('SIGINT', () => stop.abort());
try {
  process.exitCode = lookup.ok ? await runEvents(lookup.value, stop.signal) : 2;
} catch {
  process.stderr.write('event configuration refused\n');
  process.exitCode = 2;
}
