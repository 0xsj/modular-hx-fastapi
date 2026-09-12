import { expect, it } from 'vitest';
import { Reader, map } from './index.js';
it('V02/V04 reject trailing line terminators without echoing invalid keys', () => {
  for (const suffix of ['\n', '\r', '\r\n', '\u2028', '\u2029']) {
    const r = new Reader(map({ N: `2${suffix}` }));
    r.int('N', 1, 0, 10);
    expect(r.check().ok).toBe(false);
    const k = new Reader(map({}));
    k.string(`PRIVATE${suffix}`, 'x');
    const result = k.check();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  }
});
