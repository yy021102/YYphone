import { activeMemoryArchive } from './memoryArchives';
import {
  embedMissingMemories, embeddingConfigured, newMemoryId, readMemories, readMemorySettings,
  writeMemories, type GiftMemoryDetails, type MemoryItem,
} from './memoryData';

export const giftDateToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export const giftMemoryContent = (gift: GiftMemoryDetails) => {
  const who = gift.direction === 'player-to-character' ? '玩家送给我' : '我送给玩家';
  return `${gift.date}，${who}「${gift.name}」。送礼情景：${gift.scene || '未记录'}`.slice(0, 300);
};

export const recordGiftMemory = (charId: string, details: GiftMemoryDetails): MemoryItem | null => {
  if (!charId || !details.name.trim()) return null;
  const gift: GiftMemoryDetails = {
    name: details.name.trim().slice(0, 100),
    direction: details.direction,
    date: details.date || giftDateToday(),
    scene: details.scene.trim().slice(0, 160),
    ...(details.sourceKey ? { sourceKey: details.sourceKey } : {}),
  };
  const items = readMemories();
  const archiveKey = activeMemoryArchive(charId);
  const content = giftMemoryContent(gift);
  const existing = items.find((item) => item.charId === charId && item.archiveKey === archiveKey &&
    (gift.sourceKey ? item.gift?.sourceKey === gift.sourceKey : item.category === 'item' && item.content === content));
  if (existing) return existing;
  const now = new Date().toISOString();
  const item: MemoryItem = {
    id: newMemoryId(), charId, archiveKey, content, category: 'item', importance: 3,
    pinned: false, createdAt: now, updatedAt: now, recallCount: 0, source: 'chat', gift,
  };
  writeMemories([...items, item]);
  const config = readMemorySettings().embedding;
  if (embeddingConfigured(config)) {
    void embedMissingMemories([item], config).catch((error) => console.warn('Gift memory embedding failed.', error));
  }
  return item;
};
