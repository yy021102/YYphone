import { readStoredValue, writeStoredValue } from './localStorage';
import { forgetPaperMemories } from './paperNotes';

const CHATS_KEY = 'yyphone:wechat-chats';
const RECORD_KEYS = ['yyphone:memory-items', 'yyphone:memory-journal', 'yyphone:memory-growth'];
const CURSOR_SETTINGS = [
  ['yyphone:memory-settings', 'cursors'],
  ['yyphone:memory-journal-settings', 'journalCursors'],
] as const;

interface ArchiveChat {
  id: string;
  type: string;
  participantIds: string[];
  activeArchiveId?: string;
  archives?: Array<{ id: string; name: string }>;
}

export interface ArchiveRecord {
  id: string;
  charId: string;
  archiveKey?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const chats = () => readStoredValue(CHATS_KEY, [], (value): value is ArchiveChat[] =>
  Array.isArray(value) && value.every((chat) => isRecord(chat) && typeof chat.id === 'string' &&
    typeof chat.type === 'string' && Array.isArray(chat.participantIds)));

export const chatArchiveKey = (charId: string, archiveId: string) => JSON.stringify([charId, archiveId]);

export const activeMemoryArchive = (charId: string): string => {
  if (charId === 'shared') return 'shared';
  const chat = chats().find((item) => item.type === 'direct' &&
    item.participantIds.length === 1 && item.participantIds[0] === charId);
  return chatArchiveKey(charId, chat?.activeArchiveId ?? 'archive-default');
};

export const memoryArchiveLabel = (charId: string): string => {
  const chat = chats().find((item) => item.type === 'direct' &&
    item.participantIds.length === 1 && item.participantIds[0] === charId);
  return chat?.archives?.find((item) => item.id === chat.activeArchiveId)?.name ?? '存档 1';
};

const belongsToActive = (item: ArchiveRecord) =>
  item.charId === 'shared' || item.archiveKey === activeMemoryArchive(item.charId);

export const readArchiveRecords = <T extends ArchiveRecord>(
  key: string, isValid: (value: unknown) => value is T[]
): T[] => {
  const all = readStoredValue(key, [], isValid);
  let migrated = false;
  const bound = all.map((item) => {
    if (item.archiveKey) return item;
    migrated = true;
    return { ...item, archiveKey: activeMemoryArchive(item.charId) };
  });
  if (migrated) writeStoredValue(key, bound);
  return bound.filter(belongsToActive);
};

export const writeArchiveRecords = <T extends ArchiveRecord>(
  key: string, items: T[], isValid: (value: unknown) => value is T[]
) => {
  readArchiveRecords(key, isValid);
  const all = readStoredValue(key, [], isValid);
  const bound = items.map((item) => {
    const archiveKey = activeMemoryArchive(item.charId);
    if (item.archiveKey && item.archiveKey !== archiveKey) {
      throw new Error('聊天存档已变化，已取消写入旧档内容，请重新打开记忆模块。');
    }
    return { ...item, archiveKey };
  });
  writeStoredValue(key, [...all.filter((item) => !belongsToActive(item)), ...bound]);
};

export const readArchiveCursors = (key: string, field: string): Record<string, string> => {
  const settings = readStoredValue(key, {}, isRecord);
  const raw = isRecord(settings[field]) ? settings[field] : {};
  const scoped = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  let migrated = false;
  for (const [id, value] of Object.entries(scoped)) {
    if (id.startsWith('[') || id === 'shared') continue;
    scoped[activeMemoryArchive(id)] = value;
    delete scoped[id];
    migrated = true;
  }
  if (migrated) writeStoredValue(key, { ...settings, [field]: scoped });
  const result: Record<string, string> = {};
  for (const [scope, cursor] of Object.entries(scoped)) {
    if (!scope.startsWith('[')) continue;
    const tuple: unknown = JSON.parse(scope);
    if (Array.isArray(tuple) && typeof tuple[0] === 'string' && activeMemoryArchive(tuple[0]) === scope) result[tuple[0]] = cursor;
  }
  return result;
};

export const archiveCursorsForWrite = (key: string, field: string, cursors: Record<string, string>) => {
  readArchiveCursors(key, field);
  const settings = readStoredValue(key, {}, isRecord);
  const all = isRecord(settings[field]) ? { ...settings[field] } : {};
  for (const [charId, cursor] of Object.entries(cursors)) all[activeMemoryArchive(charId)] = cursor;
  return all;
};

export const prepareMemoryArchiveSwitch = () => {
  const valid = (value: unknown): value is ArchiveRecord[] =>
    Array.isArray(value) && value.every((item) => isRecord(item) &&
      typeof item.id === 'string' && typeof item.charId === 'string');
  for (const key of RECORD_KEYS) readArchiveRecords(key, valid);
  for (const [key, field] of CURSOR_SETTINGS) readArchiveCursors(key, field);
};

const revisions = new Map<string, number>();

export const invalidateMemoryArchive = (charId: string) =>
  revisions.set(charId, (revisions.get(charId) ?? 0) + 1);

export const guardMemoryArchive = (charId: string) => {
  const scope = activeMemoryArchive(charId);
  const revision = revisions.get(charId) ?? 0;
  return () => {
    if (scope !== activeMemoryArchive(charId) || revision !== (revisions.get(charId) ?? 0)) {
      throw new Error('聊天存档已切换或删除，已取消本次记忆整理，请在目标存档重新操作。');
    }
  };
};

export const deleteMemoryArchive = (charId: string, archiveId: string) => {
  const scope = chatArchiveKey(charId, archiveId);
  forgetPaperMemories({ archiveKey: scope });
  const removedIds = new Set<string>();
  for (const key of RECORD_KEYS) {
    const all = readStoredValue(key, [], (value): value is ArchiveRecord[] => Array.isArray(value));
    const kept = all.filter((item) => {
      if (item.archiveKey !== scope) return true;
      if (key === RECORD_KEYS[0]) removedIds.add(item.id);
      return false;
    });
    writeStoredValue(key, kept);
  }
  for (const [key, field] of CURSOR_SETTINGS) {
    const settings = readStoredValue(key, {}, isRecord);
    if (!isRecord(settings[field])) continue;
    const cursors = { ...settings[field] };
    delete cursors[scope];
    writeStoredValue(key, { ...settings, [field]: cursors });
  }
  const embeddings = readStoredValue('yyphone:memory-embeddings', {}, isRecord);
  for (const id of removedIds) delete embeddings[id];
  writeStoredValue('yyphone:memory-embeddings', embeddings);
  invalidateMemoryArchive(charId);
};

export const deleteCharacterMemoryArchives = (charId: string) => {
  forgetPaperMemories({ charId });
  prepareMemoryArchiveSwitch();
  const scopes = new Set<string>([activeMemoryArchive(charId)]);
  for (const key of RECORD_KEYS) {
    const all = readStoredValue(key, [], (value): value is ArchiveRecord[] => Array.isArray(value));
    for (const item of all) if (item.charId === charId && item.archiveKey) scopes.add(item.archiveKey);
  }
  for (const [key, field] of CURSOR_SETTINGS) {
    const settings = readStoredValue(key, {}, isRecord);
    if (!isRecord(settings[field])) continue;
    for (const scope of Object.keys(settings[field])) {
      if (!scope.startsWith('[')) continue;
      const tuple: unknown = JSON.parse(scope);
      if (Array.isArray(tuple) && tuple[0] === charId) scopes.add(scope);
    }
  }
  for (const scope of scopes) {
    const tuple: unknown = JSON.parse(scope);
    if (Array.isArray(tuple) && typeof tuple[1] === 'string') deleteMemoryArchive(charId, tuple[1]);
  }
};
