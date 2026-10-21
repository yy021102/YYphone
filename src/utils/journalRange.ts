export interface JournalRange { start: number; end: number }

export const selectJournalRange = <T,>(messages: T[], range?: JournalRange): T[] => {
  const start = range?.start ?? 1;
  const end = range?.end ?? messages.length;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > messages.length) {
    throw new Error(`请选择有效聊天范围：第1至第${messages.length}条（包含首尾）。`);
  }
  return messages.slice(start - 1, end);
};

interface RangedEntry {
  id: string; from: string; to: string; mergedInto?: string;
  fromMessageId?: string; toMessageId?: string;
}

export const replaceJournalRange = <T extends RangedEntry>(
  entries: T[], from: string, to: string, generated: T[],
  source?: { messages: Array<{ id?: string }>; range: JournalRange }
): T[] => {
  const positions = new Map(source?.messages.flatMap((message, index) => message.id ? [[message.id, index + 1] as const] : []));
  const removed = new Set(entries.filter((entry) => {
    const first = entry.fromMessageId ? positions.get(entry.fromMessageId) : undefined;
    const last = entry.toMessageId ? positions.get(entry.toMessageId) : undefined;
    return source && first !== undefined && last !== undefined
      ? first <= source.range.end && last >= source.range.start
      : entry.from <= to && entry.to >= from;
  }).map((entry) => entry.id));
  // Any ancestor containing a replaced child is stale even if its stored dates are incomplete.
  for (let changed = true; changed;) {
    changed = false;
    for (const entry of entries) {
      if (removed.has(entry.id) && entry.mergedInto && !removed.has(entry.mergedInto)) {
        removed.add(entry.mergedInto);
        changed = true;
      }
    }
  }
  return [...entries.filter((entry) => !removed.has(entry.id))
    .map((entry) => entry.mergedInto && removed.has(entry.mergedInto) ? { ...entry, mergedInto: undefined } : entry), ...generated];
};
