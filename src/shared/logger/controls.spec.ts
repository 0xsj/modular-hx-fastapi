import { expect, it } from 'vitest';
import { create } from './index.js';
it('L06 unicode controls cannot split console records', async () => {
  const lines: string[] = [];
  const r = create({
    format: 'console',
    color: 'never',
    clock: { now: () => new Date(0) },
    resource: { name: 'test' },
    sink: {
      write: (s) => {
        lines.push(s);
      },
    },
  });
  if (!r.ok) throw new Error('fixture');
  const text = 'text\u007f\u0085\u009b\u2028\u2029';
  r.value.log.info(text, { field: text });
  await r.value.close(1000);
  for (const control of ['\u007f', '\u0085', '\u009b', '\u2028', '\u2029'])
    expect(lines.join('')).not.toContain(control);
});
