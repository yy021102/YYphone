export interface WorldBookActivation {
  activation?: 'always' | 'keyword' | 'disabled';
  keywords?: string[];
  scanDepth?: number;
}

export const parseWorldBookKeywords = (value: string): string[] => [...new Set(value.split(/[,，、;；\n]/).map(key => key.trim()).filter(Boolean))];

/** Missing fields retain the original always-on behavior of native books. */
export function parseWorldBookActivation(value: Record<string, unknown>, external = false): WorldBookActivation {
  const raw = value.keywords ?? (external ? value.key : undefined);
  if (raw !== undefined && (!Array.isArray(raw) || !raw.every(key => typeof key === 'string'))) throw new Error('世界书关键词格式无效。');
  const keywords = raw === undefined ? undefined : [...new Set((raw as string[]).map(key => key.trim()).filter(Boolean))];
  const activation = value.activation ?? (external ? value.disable === true ? 'disabled' : value.constant === true ? 'always' : value.constant === false || keywords?.length ? 'keyword' : undefined : undefined);
  if (activation !== undefined && !['always', 'keyword', 'disabled'].includes(String(activation))) throw new Error('世界书触发模式无效。');
  if (value.scanDepth !== undefined && (!Number.isInteger(value.scanDepth) || Number(value.scanDepth) < 0 || Number(value.scanDepth) > 100)) throw new Error('关键词扫描范围应为 0～100 条。');
  return { ...(activation !== undefined ? { activation: activation as WorldBookActivation['activation'] } : {}), ...(keywords !== undefined ? { keywords } : {}), ...(value.scanDepth !== undefined ? { scanDepth: Number(value.scanDepth) } : {}) };
}

export function isWorldBookEntryActive(entry: WorldBookActivation, messages: readonly string[] = []): boolean {
  if (entry.activation === 'disabled') return false;
  if (entry.activation !== 'keyword') return true;
  const depth = entry.scanDepth ?? 6;
  if (!depth) return false;
  const recent = messages.slice(-depth).map(message => message.toLowerCase());
  return (entry.keywords ?? []).some(key => key.trim() && recent.some(message => message.includes(key.trim().toLowerCase())));
}

export const validWorldBookActivation = (value: Record<string, unknown>): boolean => {
  try { parseWorldBookActivation(value); return true; } catch { return false; }
};
