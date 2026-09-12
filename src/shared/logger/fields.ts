import { SecretString } from '../secret/index.js';
export type Fields = Readonly<Record<string, unknown>>;
// Only data properties on plain records are admitted. No foreign getter, toJSON,
// inspection hook or error rendering is a redaction fallback.
export function snapshot(value: unknown, parents = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof SecretString) return '[REDACTED]';
  if (typeof value !== 'object' || value === null || parents.has(value))
    throw new TypeError('unsupported log field');
  parents.add(value);
  try {
    if (Array.isArray(value))
      return Object.freeze(
        Array.from({ length: value.length }, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(
            value,
            String(index),
          );
          if (!descriptor || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError('unsupported log field');
          return snapshot(descriptor.value, parents);
        }),
      );
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
      throw new TypeError('unsupported log field');
    const entries = Object.entries(Object.getOwnPropertyDescriptors(value))
      .filter(([, d]) => d.enumerable)
      .map(([k, d]) => {
        if (!Object.hasOwn(d, 'value'))
          throw new TypeError('unsupported log field');
        return [k, snapshot(d.value, parents)];
      });
    return Object.freeze(Object.fromEntries(entries));
  } finally {
    parents.delete(value);
  }
}
