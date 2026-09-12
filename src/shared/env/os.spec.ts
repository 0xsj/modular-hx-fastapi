import { it, expect } from 'vitest';
import { os } from './index.js';
it('V01 captures the environment once', () => {
  const key = 'N2F_ENV_SNAPSHOT_FIXTURE',
    previous = process.env[key];
  try {
    process.env[key] = 'before';
    const captured = os();
    expect(captured.ok).toBe(true);
    process.env[key] = 'after';
    if (captured.ok) expect(captured.value(key)).toBe('before');
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});
