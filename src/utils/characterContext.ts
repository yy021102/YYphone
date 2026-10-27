import { readStorageString, writeStorageString } from './localStorage';
import { activeMemoryArchive } from './memoryArchives';

export interface CharacterContextEvent {
  id: string;
  charId: string;
  createdAt: string;
  content: string;
  source: 'taobao' | 'xianyu' | 'couple';
  archiveKey?: string;
  // 高优先级事件会在角色下一次聊天时单独告知，读过之后标记为 consumed。
  priority?: 'high';
  consumed?: boolean;
}

export const CHARACTER_CONTEXT_STORAGE_KEY = 'yyphone:character-context-events';

const isContextEvent = (event: unknown): event is CharacterContextEvent =>
  !!event &&
  typeof event === 'object' &&
  typeof (event as CharacterContextEvent).id === 'string' &&
  typeof (event as CharacterContextEvent).charId === 'string' &&
  typeof (event as CharacterContextEvent).createdAt === 'string' &&
  typeof (event as CharacterContextEvent).content === 'string' &&
  ['taobao', 'xianyu', 'couple'].includes((event as CharacterContextEvent).source);

const readContextEvents = (): CharacterContextEvent[] => {
  const raw = readStorageString(CHARACTER_CONTEXT_STORAGE_KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error('角色上下文数据格式无效，无法保存互动记录。');
  return parsed.filter(isContextEvent);
};

export const appendCharacterContextEvent = (
  charId: string,
  content: string,
  source: CharacterContextEvent['source'],
  options: { priority?: 'high' } = {}
) => {
  const events = readContextEvents();
  events.push({
    id: `context-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    charId,
    createdAt: new Date().toISOString(),
    content,
    source,
    ...(options.priority ? { priority: options.priority } : {}),
  });
  writeStorageString(CHARACTER_CONTEXT_STORAGE_KEY, JSON.stringify(events));
};

export const readPendingHighPriorityEvents = (charIds: string[], source: CharacterContextEvent['source']) =>
  readContextEvents().filter(
    (event) => event.priority === 'high' && !event.consumed && event.source === source && charIds.includes(event.charId) && (!event.archiveKey || event.archiveKey === activeMemoryArchive(event.charId))
  );

export const markCharacterContextEventsConsumed = (eventIds: string[]) => {
  if (eventIds.length === 0) return;
  const ids = new Set(eventIds);
  const events = readContextEvents().map((event) => (ids.has(event.id) ? { ...event, consumed: true } : event));
  writeStorageString(CHARACTER_CONTEXT_STORAGE_KEY, JSON.stringify(events));
};
