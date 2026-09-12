export const validKey = (value: string): boolean =>
  /^[A-Z][A-Z0-9_]*$/.test(value);
export function integer(text: string): number | undefined {
  if (!/^-?(0|[1-9][0-9]*)$/.test(text)) return;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : undefined;
}
