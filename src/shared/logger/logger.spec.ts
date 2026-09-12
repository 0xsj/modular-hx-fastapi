import { it, expect } from 'vitest';
import { create, colorEnabled, parseLevel, type Config } from './index.js';
import { SecretString } from '../secret/index.js';
import { failure, type Result } from '../errors/index.js';
import { Factory, actor, operation, attribution } from '../provenance/index.js';
import { parse } from '../id/index.js';
function value<T>(r: Result<T, unknown>): T {
  if (!r.ok) throw new Error('unexpected failure');
  return r.value;
}
function fixture(extra: Partial<Config> = {}) {
  const lines: string[] = [];
  let calls = 0;
  const config: Config = {
    format: 'json',
    level: 'info',
    color: 'never',
    resource: { name: 'test' },
    clock: {
      now: () => {
        calls++;
        return new Date(1234);
      },
    },
    sink: {
      write: (s: string) => {
        lines.push(s);
      },
    },
    ...extra,
  };
  const runtime = value(create(config));
  return { runtime, lines, calls: () => calls, config };
}
it('L01/L02 inclusive filtering and no-op effects', async () => {
  for (const level of ['debug', 'info', 'warn', 'error'])
    expect(parseLevel(level).ok).toBe(true);
  expect(parseLevel('INFO').ok).toBe(false);
  for (const format of ['console', 'json', 'none']) {
    const f = fixture({ format });
    f.runtime.log.debug('hidden');
    f.runtime.log.info('visible');
    expect((await f.runtime.close(1000)).ok).toBe(true);
    expect(f.calls()).toBe(format === 'none' ? 0 : 1);
    expect(f.lines.join('')).not.toContain('hidden');
    expect(f.lines.length).toBe(format === 'none' ? 0 : 1);
  }
});
it('L03/L10 immutable fields, nested redaction and real JSON output', async () => {
  const f = fixture();
  const nested = {
    token: new SecretString('credential-SENTINEL'),
    public: 'visible',
  };
  const parent = f.runtime.log.with({ nested, keep: 1 });
  const child = parent.with({ keep: 2, extra: true });
  nested.public = 'changed';
  child.info('child');
  parent.info('parent');
  await f.runtime.close(1000);
  const v = f.lines.map((s) => JSON.parse(s));
  expect(v[0]).toMatchObject({
    timestamp_ms: 1234,
    level: 'info',
    fields: {
      keep: 2,
      extra: true,
      nested: { token: '[REDACTED]', public: 'visible' },
    },
  });
  expect(v[1].fields).toMatchObject({ keep: 1 });
  expect(v[1].fields.extra).toBeUndefined();
  expect(f.lines.join('')).not.toContain('credential-SENTINEL');
});
it('L04/L05 safe scope and failure projections', async () => {
  const f = fixture();
  const ids = { newId: () => parse('01900000-0000-7000-8000-000000000001') };
  const factory = new Factory(f.config.clock, ids);
  const scope = value(
    factory.open({
      origin: 'startup',
      attribution: value(attribution()),
      operation: value(operation('demo.run')),
      executor: value(actor('service', 'api')),
    }),
  );
  const log = value(f.runtime.log.withScope(scope));
  log
    .withError(
      failure('unavailable', 'dependency unavailable', {
        type: 'demo.offline',
        cause: new Error('credential-SENTINEL'),
      }),
    )
    .warn('refused', { scope: { scope_id: 'forged' } });
  log
    .withError(
      failure('internal', 'credential-SENTINEL', { type: 'demo.internal' }),
    )
    .error('internal');
  log.withError(new Error('credential-SENTINEL')).error('unknown');
  await f.runtime.close(1000);
  const v = f.lines.map((s) => JSON.parse(s));
  expect(v[0].scope.scope_id).toBe(scope.snapshot().scopeId);
  expect(v[0].error).toMatchObject({ kind: 'unavailable', has_cause: true });
  expect(v[1].error.type).toBe('demo.internal');
  expect(v[2].error.classified).toBe(false);
  expect(f.lines.join('')).not.toContain('credential-SENTINEL');
});
it('L06 explicit color and control escaping', async () => {
  for (const [mode, tty, noColor, want] of [
    ['auto', true, false, true],
    ['auto', true, true, false],
    ['auto', false, false, false],
    ['always', false, true, true],
    ['never', true, false, false],
  ] as const)
    expect(value(colorEnabled(mode, tty, noColor))).toBe(want);
  expect(colorEnabled('bad', false, false).ok).toBe(false);
  for (const color of ['always', 'never']) {
    const f = fixture({ format: 'console', color });
    f.runtime.log.info('message\nforged\x1b[31m', { field: 'value\nnew' });
    await f.runtime.close(1000);
    const s = f.lines.join('');
    expect(s.split('\n')).toHaveLength(2);
    expect(s).not.toContain('forged\x1b');
    expect(s.includes('\x1b[')).toBe(color === 'always');
  }
});
it('L07 failure cannot throw from log emission', async () => {
  const f = fixture({
    sink: {
      write: () => {
        throw new Error('private sink detail');
      },
    },
  });
  expect(() => f.runtime.log.info('event')).not.toThrow();
  const r = await f.runtime.close(1000);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe('unavailable');
  expect(f.runtime.stats().failed).toBe(1);
});
it('L08 bounded queue and close deadline', async () => {
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  const f = fixture({ capacity: 1, sink: { write: () => pending } });
  f.runtime.log.info('first');
  f.runtime.log.info('queued');
  f.runtime.log.info('dropped');
  const closed = await f.runtime.close(5);
  expect(closed.ok).toBe(false);
  if (!closed.ok) expect(closed.error.kind).toBe('timeout');
  expect(f.runtime.stats().dropped).toBe(1);
  release();
  expect((await f.runtime.close(1000)).ok).toBe(true);
});
it('L09 invalid config/time/size and closed emission', async () => {
  const f = fixture();
  expect(create({ ...f.config, format: 'bad' }).ok).toBe(false);
  await f.runtime.close(1000);
  const invalid = fixture({ clock: { now: () => new Date(-1) } });
  invalid.runtime.log.info('invalid');
  expect(invalid.runtime.stats().failed).toBe(1);
  expect((await invalid.runtime.close(1000)).ok).toBe(false);
  const large = fixture({ maxRecordBytes: 64 });
  large.runtime.log.info('x'.repeat(100));
  await large.runtime.close(1000);
  large.runtime.log.info('closed');
  expect(large.runtime.stats().dropped).toBe(2);
  expect(large.lines).toEqual([]);
});
it('L03 safely refuses cyclic fields without raw display', async () => {
  const f = fixture();
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  f.runtime.log.info('cycle', cycle);
  expect(f.runtime.stats().failed).toBe(1);
  expect(f.lines).toEqual([]);
  expect((await f.runtime.close(1000)).ok).toBe(false);
});

it('T03 trace binding survives child fields without leaking to its parent', async () => {
  const { traceRef } = await import('../telemetry/index.js');
  const f = fixture();
  const trace = value(
    traceRef('12345678901234567890123456789012', '1234567890123456', false),
  );
  value(f.runtime.log.withTrace(trace)).with({ trace: 'forged' }).info('child');
  f.runtime.log.info('parent');
  await f.runtime.close(1000);
  const records = f.lines.map((s) => JSON.parse(s));
  expect(records[0].trace).toEqual({
    trace_id: '12345678901234567890123456789012',
    span_id: '1234567890123456',
    sampled: false,
  });
  expect(records[1].trace).toBeUndefined();
});
