import { it, expect } from 'vitest';
import { Factory, actor, operation, attribution, reference } from './index.js';
import { parse } from '../id/index.js';
import { type Result } from '../errors/index.js';
function value<T>(r: Result<T, unknown>): T {
  if (!r.ok) throw new Error('fixture');
  return r.value;
}
it('P23 explicit cause cannot hide reused execution identity', () => {
  const ids = { newId: () => parse('01900000-0000-7000-8000-000000000001') };
  const f = new Factory({ now: () => new Date(0) }, ids);
  const executor = value(actor('service', 'api')),
    op = value(operation('demo.run'));
  const parent = value(
    f.open({
      origin: 'startup',
      operation: op,
      executor,
      attribution: value(attribution()),
    }),
  );
  const result = f.child(parent, {
    operation: op,
    executor,
    workId: value(parse('01900000-0000-7000-8000-000000000002')),
    cause: value(
      reference('event', value(parse('01900000-0000-7000-8000-000000000003'))),
    ),
  });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.error.type).toBe('provenance.invalid_generated_id');
});
