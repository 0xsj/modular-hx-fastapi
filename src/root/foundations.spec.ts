import { it, expect } from 'vitest';
import { map } from '../shared/env/index.js';
import { run } from './demo.js';
it('F01/F04 config refusal precedes boot and hides raw values', async () => {
  const out: string[] = [],
    diagnostic: string[] = [];
  const code = await run(
    map({ DEMO_TOKEN: '', LOG_LEVEL: 'private-SENTINEL', LOG_CAPACITY: '-1' }),
    {
      write: (s) => {
        out.push(s);
      },
    },
    (s) => {
      diagnostic.push(s);
    },
    false,
  );
  expect(code).toBe(2);
  expect(out).toEqual([]);
  expect(diagnostic.join('')).not.toContain('private-SENTINEL');
  for (const key of ['DEMO_TOKEN', 'LOG_LEVEL', 'LOG_CAPACITY'])
    expect(diagnostic.join('')).toContain(key);
});
it('F02/F03 output choices preserve workflow and scope relations', async () => {
  for (const mode of ['json', 'console', 'none']) {
    const out: string[] = [],
      diagnostic: string[] = [];
    const code = await run(
      map({
        DEMO_TOKEN: 'private-SENTINEL',
        LOG_FORMAT: mode,
        LOG_COLOR: 'never',
      }),
      {
        write: (s) => {
          out.push(s);
        },
      },
      (s) => {
        diagnostic.push(s);
      },
      false,
    );
    expect(code).toBe(0);
    expect(diagnostic).toEqual([]);
    expect(out.join('')).not.toContain('private-SENTINEL');
    if (mode === 'none') {
      expect(out).toEqual([]);
      continue;
    }
    expect(out.join('')).toContain('foundations.complete');
    if (mode !== 'json') continue;
    const events = Object.fromEntries(
      out.map((s) => {
        const v = JSON.parse(s);
        return [v.message, v];
      }),
    );
    const first = events['dependency.unavailable'].scope,
      second = events['work.completed'].scope;
    expect(second).toMatchObject({
      work_id: first.work_id,
      correlation_id: first.correlation_id,
      attempt: 2,
      previous_attempt: first.scope_id,
    });
    expect(second.scope_id).not.toBe(first.scope_id);
    expect(events['foundations.complete'].fields.attempts).toBe(2);
  }
});
