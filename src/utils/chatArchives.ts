import { initializeDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString } from './localStorage';
import { activeMemoryArchive, chatArchiveKey, invalidateMemoryArchive } from './memoryArchives';
import { forkGroupJournalState, GROUP_JOURNAL_KEY, invalidateGroupJournal } from './groupJournal';
import { ALIAS_ACCOUNTS_KEY, ALIAS_EVENT, readAliasState } from './aliasAccounts';
import { PAPER_NOTES_KEY, readPaperNotes } from './paperNotes';
import { restorePhoneInspectionHistory } from './phoneInspection';

type Row = Record<string, any>;
export interface ChatArchiveSlot<M = Row> {
  id: string; name: string; messages: M[]; updatedAt: string;
  origin?: 'branch' | 'restart'; parentArchiveId?: string; parentArchiveName?: string;
  forkedAt?: string; forkMessageId?: string;
}
type ArchiveChat = Row & { id: string; type: string; participantIds: string[]; messages: Row[]; activeArchiveId?: string; archives?: ChatArchiveSlot[] };
const CHATS_KEY = 'yyphone:wechat-chats';
const RECORD_KEYS = ['yyphone:memory-items', 'yyphone:memory-journal', 'yyphone:memory-growth'] as const;
const CURSORS = [['yyphone:memory-settings', 'cursors'], ['yyphone:memory-journal-settings', 'journalCursors']] as const;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
function stored(key: string, fallback: unknown): unknown {
  const raw = readStorageString(key);
  try { return raw === null ? fallback : JSON.parse(raw); }
  catch { throw new Error('存档相关数据格式异常，未改动原存档。'); }
}
function rows(key: string): Row[] {
  const value = stored(key, []);
  if (!Array.isArray(value) || !value.every(record)) throw new Error('存档相关记录格式异常，未改动原存档。');
  return value;
}
function object(key: string): Row {
  const value = stored(key, {});
  if (!record(value)) throw new Error('存档相关设置格式异常，未改动原存档。');
  return value;
}

export function chatArchiveSlots<M>(chat: { messages: M[]; archives?: ChatArchiveSlot<M>[]; activeArchiveId?: string; updatedAt: string }) {
  const activeId = chat.activeArchiveId || 'archive-default';
  const archives = chat.archives?.length ? chat.archives : [];
  return { activeId, archives: archives.some(slot => slot.id === activeId) ? archives : [
    ...archives, { id: activeId, name: '存档 1', messages: [], updatedAt: chat.updatedAt },
  ] };
}

function copyCharacterMemory(charId: string, fromId: string, toId: string, branch: boolean): Record<string, unknown> {
  const fromScope = chatArchiveKey(charId, fromId), toScope = chatArchiveKey(charId, toId);
  const changes: Record<string, unknown> = {};
  const clonedMemoryIds = new Map<string, string>();
  for (const key of RECORD_KEYS) {
    const all = rows(key);
    if (!all.every(item => typeof item.id === 'string' && typeof item.charId === 'string' && (item.archiveKey === undefined || typeof item.archiveKey === 'string'))) throw new Error('记忆记录格式异常，未创建存档。');
    // Bind legacy rows before changing the active archive, including other characters' older records.
    const bound = all.map(item => item.archiveKey ? item : { ...item, archiveKey: activeMemoryArchive(item.charId) });
    const source = branch ? bound.filter(item => item.charId === charId && item.archiveKey === fromScope) : [];
    const ids = new Map(source.map(item => [item.id, `branch-${crypto.randomUUID()}`]));
    const copied = source.map(item => {
      const next = { ...structuredClone(item), id: ids.get(item.id)!, archiveKey: toScope };
      if ('mergedInto' in next) next.mergedInto = item.mergedInto ? ids.get(item.mergedInto) : undefined;
      if (key === RECORD_KEYS[0]) clonedMemoryIds.set(item.id, next.id);
      return next;
    });
    if (copied.length || bound.some((item, index) => item !== all[index])) changes[key] = [...bound, ...copied];
  }
  for (const [key, field] of CURSORS) {
    const settings = object(key), raw = settings[field] ?? {};
    if (!record(raw) || !Object.values(raw).every(value => typeof value === 'string')) throw new Error('记忆整理进度格式异常，未创建存档。');
    const cursors = { ...raw };
    for (const [id, value] of Object.entries(raw)) {
      if (id.startsWith('[') || id === 'shared') continue;
      cursors[activeMemoryArchive(id)] = value; delete cursors[id];
    }
    if (branch && typeof cursors[fromScope] === 'string') cursors[toScope] = cursors[fromScope];
    if (JSON.stringify(raw) !== JSON.stringify(cursors)) changes[key] = { ...settings, [field]: cursors };
  }
  if (clonedMemoryIds.size) {
    const embeddings = object('yyphone:memory-embeddings');
    const copied = { ...embeddings };
    for (const [oldId, newId] of clonedMemoryIds) if (embeddings[oldId]) copied[newId] = structuredClone(embeddings[oldId]);
    changes['yyphone:memory-embeddings'] = copied;
  }
  if (branch) {
    const aliases = readAliasState();
    const source = aliases.threads.filter(thread => thread.charId === charId && thread.archiveKey === fromScope);
    if (source.length) {
      const checks = { ...aliases.checks };
      for (const [key, value] of Object.entries(aliases.checks)) {
        try {
          const tuple = JSON.parse(key);
          if (Array.isArray(tuple) && tuple[0] === charId && tuple[1] === fromScope) checks[JSON.stringify([charId, toScope, tuple[2]])] = value;
        } catch { /* Global scheduling stamps do not belong to a chat archive. */ }
      }
      changes[ALIAS_ACCOUNTS_KEY] = { ...aliases, checks, threads: [...aliases.threads, ...source.map(thread => ({ ...structuredClone(thread), id: crypto.randomUUID(), experienceKey: thread.experienceKey || thread.id, archiveKey: toScope, unread: 0 }))] };
    }
    const papers = readPaperNotes(), sourcePapers = papers.memories.filter(note => note.charId === charId && note.archiveKey === fromScope);
    if (sourcePapers.length) changes[PAPER_NOTES_KEY] = { ...papers, memories: [...papers.memories, ...sourcePapers.map(note => ({ ...structuredClone(note), id: `paper-branch-${crypto.randomUUID()}`, archiveKey: toScope }))] };
  }
  return changes;
}

let archiveWrites: Promise<unknown> = Promise.resolve();
export type ArchiveChoice = { mode: 'branch' | 'restart'; name?: string } | { mode: 'switch'; targetId: string };
/** Commit the saved source, destination and its memory in the same storage transaction. */
export function changeChatArchive(chatId: string, choice: ArchiveChoice, expectedArchiveId?: string): Promise<string> {
  const run = archiveWrites.then(async () => {
    await initializeDbStorage();
    await restorePhoneInspectionHistory(chatId);
    const allChats = rows(CHATS_KEY), chat = allChats.find(item => item.id === chatId) as ArchiveChat | undefined;
    if (!chat || !Array.isArray(chat.messages) || !chat.messages.every(record) || !Array.isArray(chat.participantIds)) throw new Error('聊天已经变化，请重新打开存档。');
    const { activeId, archives } = chatArchiveSlots(chat as ArchiveChat & { updatedAt: string });
    if (expectedArchiveId !== undefined && activeId !== expectedArchiveId) throw new Error('当前存档已变化，请重新选择。');
    if (new Set(archives.map(slot => slot.id)).size !== archives.length || !archives.every(slot => record(slot) && typeof slot.id === 'string' && typeof slot.name === 'string' && (slot.messages === undefined || Array.isArray(slot.messages) && slot.messages.every(record)))) throw new Error('聊天存档格式异常，未改动原存档。');
    if (choice.mode === 'switch' && choice.targetId === activeId) return activeId;
    const current = archives.find(slot => slot.id === activeId)!;
    const now = new Date().toISOString(), creating = choice.mode !== 'switch';
    const nextId = choice.mode === 'switch' ? choice.targetId : `archive-${crypto.randomUUID()}`;
    const branch = choice.mode === 'branch';
    const nextArchives = archives.map(slot => ({ ...slot, messages: slot.id === activeId ? structuredClone(chat.messages) : structuredClone(slot.messages ?? []), updatedAt: slot.id === activeId ? chat.updatedAt : slot.updatedAt }));
    let nextMessages: Row[];
    if (creating) {
      const suppliedName = choice.name?.trim();
      if (suppliedName && suppliedName.length > 60) throw new Error('存档名称最多60字。');
      let name = suppliedName || (branch ? `${current.name.slice(0, 40)} · 分支` : `存档 ${archives.length + 1}`);
      if (!suppliedName) { const base = name; let suffix = 2; while (nextArchives.some(slot => slot.name === name)) name = `${base} ${suffix++}`; }
      nextMessages = branch ? structuredClone(chat.messages) : [];
      nextArchives.push({ id: nextId, name, messages: structuredClone(nextMessages), updatedAt: now, origin: branch ? 'branch' : 'restart',
        ...(branch ? { parentArchiveId: activeId, parentArchiveName: current.name, forkedAt: now, forkMessageId: chat.messages.at(-1)?.id } : {}) });
    } else {
      const target = nextArchives.find(slot => slot.id === nextId);
      if (!target) throw new Error('目标存档已不存在。');
      nextMessages = structuredClone(target.messages);
    }
    const changes: Record<string, unknown> = {};
    const charId = chat.type === 'direct' && chat.participantIds.length === 1 ? chat.participantIds[0] : '';
    // Cancel older background summaries before taking the memory snapshot.
    if (charId) invalidateMemoryArchive(charId); else invalidateGroupJournal(chatId);
    if (charId) Object.assign(changes, copyCharacterMemory(charId, activeId, nextId, branch));
    if (branch && chat.type !== 'direct') {
      const group = forkGroupJournalState(chat.id, activeId, nextId);
      if (group) changes[GROUP_JOURNAL_KEY] = group;
    }
    changes[CHATS_KEY] = allChats.map(item => item.id === chatId ? { ...item, archives: nextArchives, activeArchiveId: nextId, archiveRevision: crypto.randomUUID(), messages: nextMessages, updatedAt: now } : item);
    await setStorageItemsAtomically(changes);
    if (charId) invalidateMemoryArchive(charId); else invalidateGroupJournal(chatId);
    if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(ALIAS_EVENT));
    return nextId;
  });
  archiveWrites = run.catch(() => {});
  return run;
}
