import { expect, it } from 'vitest';
import { create, type Config } from './index.js';
it('L09 maximum supported time keeps the UTC console clock shape', async () => {
  const lines: string[] = [];
  const ms = 281474976710655;
  const r = create({
    format: 'console',
    color: 'never',
    clock: { now: () => new Date(ms) },
    resource: { name: 'test' },
    sink: {
      write: (s) => {
        lines.push(s);
      },
    },
  });
  if (!r.ok) throw new Error('fixture');
  r.value.log.info('boundary');
  await r.value.close(1000);
  const expected =
    [
      Math.floor(ms / 3600000) % 24,
      Math.floor(ms / 60000) % 60,
      Math.floor(ms / 1000) % 60,
    ]
      .map((n) => String(n).padStart(2, '0'))
      .join(':') + '.655';
  expect(lines[0].startsWith(expected + ' ')).toBe(true);
});
it('L03 unsupported array accessors are refused without invoking them', async () => {
  let calls = 0;
  const array: unknown[] = [];
  Object.defineProperty(array, 0, {
    get() {
      calls++;
      return 'private';
    },
    enumerable: true,
  });
  const r = create({
    format: 'json',
    clock: { now: () => new Date(0) },
    resource: { name: 'test' },
    sink: {
      write: () => {
        throw new Error('should not emit');
      },
    },
  });
  if (!r.ok) throw new Error('fixture');
  r.value.log.info('bad', { array });
  await r.value.close(1000);
  expect(calls).toBe(0);
  expect(r.value.stats().failed).toBe(1);
});
it('L07 explicit flush failures and queue bounds', async () => {
  const config: Config = {
    format: 'json',
    clock: { now: () => new Date(0) },
    resource: { name: 'test' },
    sink: {
      write: () => {},
      flush: () => Promise.reject(new Error('private')),
    },
  };
  for (const extra of [
    { capacity: 0 },
    { maxRecordBytes: 0 },
    { level: 'INFO' },
    { color: 'bad' },
  ])
    expect(create({ ...config, ...extra }).ok).toBe(false);
  const r = create(config);
  if (!r.ok) throw new Error('fixture');
  const result = await r.value.close(1000);
  expect(result.ok).toBe(false);
  expect(r.value.stats().failed).toBe(1);
});
