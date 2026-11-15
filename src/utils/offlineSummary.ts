import { readStoredValue, writeStoredValue } from './localStorage';
import { readOfflineMemories, saveOfflineMemory, type OfflineStory, type OfflineSummaryBatch } from './offlineData';

export const OFFLINE_SUMMARY_SETTINGS_KEY = 'yyphone:offline-summary-settings';
export interface OfflineSummarySettings { prompt: string; maxChars: number; batchSize: number }
export const DEFAULT_OFFLINE_SUMMARY_SETTINGS: OfflineSummarySettings = { prompt: '', maxChars: 1200, batchSize: 50 };
export const readOfflineSummarySettings = (): OfflineSummarySettings => {
  const stored = readStoredValue(OFFLINE_SUMMARY_SETTINGS_KEY, {} as Partial<OfflineSummarySettings>,
    (v): v is Partial<OfflineSummarySettings> => !!v && typeof v === 'object' && !Array.isArray(v));
  return {
    prompt: typeof stored.prompt === 'string' ? stored.prompt : '',
    maxChars: Number.isSafeInteger(stored.maxChars) && stored.maxChars! >= 100 && stored.maxChars! <= 20000 ? stored.maxChars! : 1200,
    batchSize: Number.isSafeInteger(stored.batchSize) && stored.batchSize! >= 1 ? stored.batchSize! : 50,
  };
};
export function saveOfflineSummarySettings(settings: OfflineSummarySettings) {
  if (!Number.isSafeInteger(settings.maxChars) || settings.maxChars < 100 || settings.maxChars > 20000 ||
    !Number.isSafeInteger(settings.batchSize) || settings.batchSize < 1) throw new Error('每批字数请填写 100～20000 的整数，分批条数请填写正整数。');
  writeStoredValue(OFFLINE_SUMMARY_SETTINGS_KEY, settings);
}
export function offlineSummaryRanges(story: OfflineStory, from: number, to: number, batchSize: number) {
  if (![from, to, batchSize].every(Number.isSafeInteger) || from < 1 || to < from || to > story.messages.length || batchSize < 1)
    throw new Error('请填写有效的消息范围和分批条数。');
  const ranges: Array<{ from: number; to: number; messageIds: string[] }> = [];
  for (let start = from; start <= to; start += batchSize) {
    const end = Math.min(to, start + batchSize - 1);
    ranges.push({ from: start, to: end, messageIds: story.messages.slice(start - 1, end).map(m => m.id) });
  }
  return ranges;
}
export const offlineSummaryBatches = (storyId: string): OfflineSummaryBatch[] => {
  const memory = readOfflineMemories().find(m => m.storyId === storyId);
  if (!memory) return [];
  if (!Array.isArray(memory.batches) || memory.batches.some(b => !b || typeof b.id !== 'string' ||
    !Array.isArray(b.messageIds) || !b.messageIds.every(id => typeof id === 'string') || typeof b.summary !== 'string' || typeof b.createdAt !== 'string'))
    return [{ id: 'legacy', messageIds: [], summary: memory.summary, createdAt: memory.createdAt }];
  return memory.batches;
};
export function saveOfflineSummaryBatches(story: OfflineStory, drafts: Array<{ messageIds: string[]; summary: string }>, replaceAll = false) {
  if (!drafts.length || drafts.some(d => !d.summary.trim() || !d.messageIds.length)) throw new Error('请先填写或生成本批总结。');
  const positions = new Map(story.messages.map((m, index) => [m.id, index]));
  let batches = replaceAll ? [] : offlineSummaryBatches(story.id);
  for (const draft of drafts) {
    if (draft.messageIds.some((id, index) => !positions.has(id) || index > 0 && positions.get(id)! !== positions.get(draft.messageIds[index - 1])! + 1))
      throw new Error('消息范围已变化，请重新选择。');
    const ids = new Set(draft.messageIds);
    const exact = (batch: OfflineSummaryBatch) => JSON.stringify(batch.messageIds) === JSON.stringify(draft.messageIds);
    if (batches.some(b => !exact(b) && b.messageIds.some(id => ids.has(id))))
      throw new Error('本批与已保存范围部分重叠，请调整范围，或选择替换全部总结。');
    batches = [...batches.filter(b => !exact(b)), { id: crypto.randomUUID(), messageIds: [...draft.messageIds], summary: draft.summary.trim(), createdAt: new Date().toISOString() }];
  }
  batches.sort((a, b) => (positions.get(a.messageIds[0]) ?? -1) - (positions.get(b.messageIds[0]) ?? -1));
  const text = batches.map(batch => {
    const start = positions.get(batch.messageIds[0]), end = positions.get(batch.messageIds.at(-1)!);
    return `【${start === undefined || end === undefined ? '此前总结' : `第 ${start + 1}～${end + 1} 条`}】\n${batch.summary}`;
  }).join('\n\n');
  saveOfflineMemory(story, text, batches);
}
