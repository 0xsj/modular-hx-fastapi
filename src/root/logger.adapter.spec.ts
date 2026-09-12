import { it, expect } from 'vitest';
import { create } from '../shared/logger/index.js';
import { NestLogger } from './logger.adapter.js';
it('routes Nest severity and context without printing raw framework errors', async () => {
  const lines: string[] = [];
  const r = create({
    format: 'json',
    level: 'debug',
    clock: { now: () => new Date(0) },
    resource: { name: 'test' },
    sink: {
      write: (s) => {
        lines.push(s);
      },
    },
  });
  if (!r.ok) throw new Error('fixture');
  const adapter = new NestLogger(r.value.log);
  adapter.log('ready', 'Bootstrap');
  adapter.error(
    new Error('private-SENTINEL'),
    'stack-private-SENTINEL',
    'Bootstrap',
  );
  adapter.verbose('details', 'Bootstrap');
  await r.value.close(1000);
  const v = lines.map((s) => JSON.parse(s));
  expect(v.map((x) => x.level)).toEqual(['info', 'error', 'debug']);
  expect(v[0].fields.context).toBe('Bootstrap');
  expect(v[1].error.classified).toBe(false);
  expect(lines.join('')).not.toContain('private-SENTINEL');
});
