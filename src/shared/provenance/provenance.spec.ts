import { it, expect } from 'vitest';
import * as p from './index.js';
import { parse, type ID } from '../id/index.js';
import { failure, type Failure, type Result } from '../errors/index.js';
function value<T>(r: Result<T, Failure>): T {
  if (!r.ok) throw new Error(r.error.type);
  return r.value;
}
const id = (n: number): ID =>
  value(parse(`01900000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`));
const actor = () => value(p.actor('service', 'api'));
const op = () => value(p.operation('demo.export'));
const root = (): p.RootSpec => ({
  origin: 'startup',
  operation: op(),
  executor: actor(),
  attribution: value(p.attribution()),
});
const step = (): p.StepSpec => ({ operation: op(), executor: actor() });
function setup() {
  const state = { time: new Date(1000), clock: 0, ids: 0 };
  const f = new p.Factory(
    {
      now() {
        state.clock++;
        return state.time;
      },
    },
    {
      newId() {
        return { ok: true as const, value: id(++state.ids) };
      },
    },
  );
  return { f, state };
}
function typeOf(r: Result<unknown, Failure>) {
  expect(r.ok).toBe(false);
  return r.ok ? '' : r.error.type;
}
it('P01 P02 attribution', () => {
  for (const s of ['', 'a b', 'é', 'a'.repeat(129)])
    expect(typeOf(p.actor('user', s))).toBe('provenance.invalid_actor');
  const a = value(p.actor('user', 'alice')),
    b = value(p.actor('user', 'bob'));
  const spec = { initiator: a, onBehalfOf: b, tenant: 'acme' };
  const attr = value(p.attribution(spec));
  spec.tenant = 'other';
  expect(attr.tenant).toBe('acme');
  for (const s of [
    { onBehalfOf: b },
    { initiator: p.anonymous(), onBehalfOf: b },
    { initiator: a, onBehalfOf: a },
  ])
    expect(typeOf(p.attribution(s))).toBe('provenance.invalid_attribution');
  expect(value(p.attribution()).initiator).toBeUndefined();
  expect(p.anonymous().kind).toBe('anonymous');
});
it('P03 P04 P05 P06 P07 P08 P09 transitions', () => {
  const { f, state } = setup();
  const spec = root();
  spec.attribution = value(p.attribution({ tenant: 'acme' }));
  const a = value(f.open(spec));
  const s = a.snapshot();
  expect([s.scopeId, s.work.workId, s.work.correlationId]).toEqual([
    id(1),
    id(1),
    id(1),
  ]);
  expect([s.attempt, s.work.depth, state.clock, state.ids]).toEqual([
    1, 0, 1, 1,
  ]);
  const c = value(f.child(a, step())).snapshot();
  expect(c.work.causation?.id).toBe(s.scopeId);
  expect(c.work.depth).toBe(1);
  expect(c.work.attribution.tenant).toBe('acme');
  const before = state.ids;
  const cause = value(p.reference('event', id(90)));
  const work = value(p.prepare(a, { workId: id(50), operation: op(), cause }));
  expect([state.clock, state.ids]).toEqual([before, before]);
  const b = value(f.execute(work, { executor: actor(), attempt: 1 }));
  state.time = new Date(2000);
  const retry = value(
    f.retry(b, value(p.actor('service', 'worker'))),
  ).snapshot();
  expect([
    retry.work.workId,
    retry.attempt,
    retry.previousAttempt,
    retry.executor.identity,
  ]).toEqual([id(50), 2, b.snapshot().scopeId, 'worker']);
  expect(retry.work.causation).toEqual(cause);
  expect(retry.startedAt.getTime()).toBe(2000);
  const other = value(f.retry(b, actor())).snapshot();
  expect(other.attempt).toBe(2);
  expect(other.scopeId).not.toBe(retry.scopeId);
  expect(
    value(f.execute(work, { executor: actor(), attempt: 3 })).snapshot()
      .previousAttempt,
  ).toBeUndefined();
  const explicit = root();
  explicit.workId = id(80);
  const x = value(f.open(explicit)).snapshot();
  expect(x.work.workId).toBe(id(80));
  expect(x.work.correlationId).toBe(x.scopeId);
});
it('P10 P11 bounds and wall corrections', () => {
  const { f, state } = setup();
  const a = value(f.open(root()));
  const s = a.snapshot();
  s.attempt = 4294967295;
  expect(typeOf(f.retry(value(p.restoreScope(s)), actor()))).toBe(
    'provenance.attempt_exhausted',
  );
  expect([state.clock, state.ids]).toEqual([1, 1]);
  const d = a.snapshot();
  d.work.depth = 4294967295;
  d.work.causation = value(p.reference('event', id(90)));
  expect(typeOf(f.child(value(p.restoreScope(d)), step()))).toBe(
    'provenance.depth_exhausted',
  );
  state.time = new Date(1);
  expect(value(f.child(a, step())).snapshot().startedAt.getTime()).toBe(1);
});
it('P12 P23 validates before effects and forwards failures', () => {
  const { f, state } = setup();
  const bad = root();
  bad.executor = p.anonymous();
  expect(typeOf(f.open(bad))).toBe('provenance.invalid_actor');
  expect([state.clock, state.ids]).toEqual([0, 0]);
  state.time = new Date(-1);
  expect(typeOf(f.open(root()))).toBe('provenance.invalid_time');
  expect(state.ids).toBe(0);
  const error = failure('unavailable', 'entropy', {
    type: 'id.entropy',
    cause: new Error('source'),
  });
  const broken = new p.Factory(
    { now: () => new Date(0) },
    { newId: () => ({ ok: false, error }) },
  );
  const r = broken.open(root());
  expect(!r.ok && r.error).toBe(error);
  const collision = new p.Factory(
    { now: () => new Date(0) },
    { newId: () => ({ ok: true, value: id(1) }) },
  );
  const a = value(collision.open(root()));
  expect(typeOf(collision.child(a, step()))).toBe(
    'provenance.invalid_generated_id',
  );
  expect(typeOf(f.child({} as p.Scope, step()))).toBe(
    'provenance.invalid_scope',
  );
  expect(typeOf(f.enter(root(), {} as p.IncomingResult))).toBe(
    'provenance.invalid_incoming_result',
  );
  const forged = root();
  forged.executor = { kind: 'service', identity: 'forged' };
  expect(typeOf(f.open(forged))).toBe('provenance.invalid_actor');
});
it('P13 links', () => {
  const target = value(p.reference('event', id(90)));
  const link: p.Link = { relation: 'input', target };
  const input = [link, link];
  const links = value(p.linkSet(input));
  input.pop();
  expect(links.values()).toEqual([link]);
  const view = links.values();
  view.pop();
  expect(links.values()).toEqual([link]);
  expect(typeOf(p.linkSet(Array(33).fill(link) as p.Link[]))).toBe(
    'provenance.too_many_links',
  );
  expect(typeOf(p.linkSet([{ relation: 'previous_attempt', target }]))).toBe(
    'provenance.invalid_reference',
  );
});
it('P14 replay', () => {
  const { f } = setup();
  const a = value(f.open(root()));
  const source = value(p.reference('work', a.snapshot().work.workId));
  const spec = {
    source,
    operation: op(),
    executor: actor(),
    attribution: value(p.attribution()),
  };
  const replay = value(f.replay(spec));
  const s = replay.snapshot();
  expect(s.work.correlationId).toBe(s.scopeId);
  expect(s.work.workId).not.toBe(source.id);
  expect(s.work.replay?.runId).toBe(s.scopeId);
  expect(s.work.origin).toBe('replay');
  expect(s.work.causation).toBeUndefined();
  expect(value(f.child(replay, step())).snapshot().work.replay).toEqual(
    s.work.replay,
  );
  expect(typeOf(f.replay({ ...spec, workId: source.id }))).toBe(
    'provenance.invalid_work',
  );
});
it('P15 P16 P17 incoming dispositions', () => {
  const { f } = setup();
  const good = id(80).toUpperCase();
  const cases: [p.IncomingHints, string, number, boolean][] = [
    [{}, 'fresh', 0, false],
    [{ correlation: good }, 'continued', 0, false],
    [
      { correlation: good, causation: { kind: 'scope', id: id(90) } },
      'continued',
      0,
      true,
    ],
    [
      {
        correlation: good,
        causation: { kind: 'scope', id: 'private-SENTINEL' },
      },
      'continued',
      1,
      false,
    ],
    [
      { correlation: 'bad', causation: { kind: 'scope', id: id(90) } },
      'restarted',
      2,
      false,
    ],
    [{ correlation: '' }, 'restarted', 1, false],
  ];
  for (const [h, decision, count, hasCause] of cases) {
    const incoming = p.inspectIncoming(h);
    expect(incoming.decision).toBe(decision);
    expect(incoming.issues()).toHaveLength(count);
    expect(JSON.stringify(incoming.issues())).not.toContain('private-SENTINEL');
    const scope = value(f.enter(root(), incoming));
    const s = scope.snapshot();
    if (decision === 'continued') {
      expect(s.work.correlationId).toBe(id(80));
      expect(s.work.origin).toBeUndefined();
      expect(s.work.depth).toBeUndefined();
      expect(s.work.causation !== undefined).toBe(hasCause);
      expect(
        value(f.child(scope, step())).snapshot().work.depth,
      ).toBeUndefined();
    } else {
      expect(s.work.correlationId).toBe(s.scopeId);
      expect(s.work.causation).toBeUndefined();
    }
  }
});
it('P18 P19 snapshot ownership and validation', () => {
  const { f, state } = setup();
  const a = value(f.open(root()));
  state.time.setTime(5000);
  expect(a.snapshot().startedAt.getTime()).toBe(1000);
  const original = a.snapshot();
  const s = a.snapshot();
  s.work.depth = 9;
  s.startedAt.setTime(999);
  expect(a.snapshot()).toEqual(original);
  const b = a.snapshot();
  b.attempt = 0;
  expect(typeOf(p.restoreScope(b))).toBe('provenance.invalid_attempt');
  const c = a.snapshot();
  c.previousAttempt = c.scopeId;
  expect(typeOf(p.restoreScope(c))).toBe('provenance.invalid_scope');
  const d = a.snapshot();
  d.work.replay = {
    runId: id(80),
    source: value(p.reference('event', id(90))),
  };
  expect(typeOf(p.restoreScope(d))).toBe('provenance.invalid_origin');
  const w = a.snapshot().work;
  w.causation = value(p.reference('work', w.workId));
  expect(p.restoreWork(w).ok).toBe(false);
});
