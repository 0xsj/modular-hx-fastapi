import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Envelope } from './index.js';
it('owns bytes and preserves full producer provenance', () => {
  const raw = readFileSync(
    new URL('./fixtures/envelope.json', import.meta.url),
  );
  const decoded = Envelope.decode(raw);
  if (!decoded.ok) throw Error('fixture');
  const event = decoded.value;
  const again = Envelope.create(
    event.id,
    'diagnostic.created.v1',
    1000,
    event.work,
    { safe: true },
  );
  expect(again.ok).toBe(true);
  if (again.ok)
    expect(again.value.work.snapshot()).toEqual(event.work.snapshot());
  raw[0] = 33;
  const copy = event.bytes();
  copy[0] = 33;
  expect(Envelope.decode(event.bytes()).ok).toBe(true);
  for (const [key, value] of Object.entries({
    v: 2,
    id: 'invalid',
    type: 'unversioned',
    occurred_at_ms: -1,
    payload: [],
  })) {
    const wire = JSON.parse(Buffer.from(event.bytes()).toString());
    wire[key] = value;
    expect(Envelope.decode(Buffer.from(JSON.stringify(wire))).ok, key).toBe(
      false,
    );
  }
});
