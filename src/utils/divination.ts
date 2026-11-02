export type DivinationReader = { mode: 'oracle' } | { mode: 'character'; actorId: string; actorName: string };
export interface DivinationInterpretation {
  id: string;
  reader: DivinationReader;
  status: 'pending' | 'done' | 'error';
  text: string;
  error?: string;
  createdAt: string;
}
export const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const nonemptyText = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
export function isDivinationInterpretation(value: unknown): value is DivinationInterpretation {
  if (!isObject(value) || !nonemptyText(value.id, 200) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      !isObject(value.reader) || typeof value.text !== 'string' || value.text.length > 12000 ||
      value.error !== undefined && (typeof value.error !== 'string' || value.error.length > 1000)) return false;
  const reader = value.reader;
  if (!(reader.mode === 'oracle' || reader.mode === 'character' && nonemptyText(reader.actorId, 200) && nonemptyText(reader.actorName, 100))) return false;
  return value.status === 'pending' || value.status === 'done' && !!value.text.trim() ||
    value.status === 'error' && nonemptyText(value.error, 1000);
}
