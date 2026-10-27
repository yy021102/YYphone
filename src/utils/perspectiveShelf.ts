import { assertPerspectiveCurrent, type CharacterPerspective, type PerspectiveIdentity } from './characterPerspective';
import { initializeDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, readStoredValue } from './localStorage';
import { activeMemoryArchive } from './memoryArchives';

export const PERSPECTIVE_SHELF_KEY = 'yyphone:character-perspectives';
export interface SavedPerspective { identity: PerspectiveIdentity; report: CharacterPerspective; savedAt: string }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function valid(v: unknown): v is SavedPerspective[] {
  return Array.isArray(v) && v.every(s => record(s) && record(s.identity) && record(s.report) && typeof s.savedAt === 'string' &&
    ['charId', 'charName', 'playerId', 'userName', 'chatId', 'archiveKey', 'archiveRevision'].every(k => typeof (s.identity as Record<string, unknown>)[k] === 'string') &&
    ['id', 'createdAt', 'title', 'body'].every(k => typeof (s.report as Record<string, unknown>)[k] === 'string')) && new Set(v.map(s => s.report.id)).size === v.length;
}
const playerId = () => {
  const personas = readStoredValue('pocketos:personas', {}, record);
  const profile = Array.isArray(personas.profiles) ? personas.profiles.find(p => record(p) && p.id === personas.activeProfileId) : undefined;
  return record(profile) && typeof profile.id === 'string' && profile.id.trim() ? profile.id : 'persona-default';
};
export const readSavedPerspectives = (charId: string) => readStoredValue(PERSPECTIVE_SHELF_KEY, [], valid)
  .filter(s => s.identity.charId === charId && s.identity.playerId === playerId() && s.identity.archiveKey === activeMemoryArchive(charId))
  .sort((a, b) => b.report.createdAt.localeCompare(a.report.createdAt));
function allSaved() { const value: unknown = JSON.parse(readStorageString(PERSPECTIVE_SHELF_KEY) || '[]'); if (!valid(value)) throw new Error('已保留的侧写数据异常，未覆盖原内容。'); return value; }
let queue: Promise<unknown> = Promise.resolve();
function update(action: () => Promise<void>) { const run = queue.then(async () => { await initializeDbStorage(); await action(); }); queue = run.catch(() => {}); return run; }

/** Store the finished writing and its scope only; never persist raw transcripts, prompts or memory sources. */
export function savePerspective(identity: PerspectiveIdentity, report: CharacterPerspective) {
  return update(async () => {
    assertPerspectiveCurrent(identity);
    const all = allSaved(), existing = all.find(s => s.report.id === report.id);
    if (existing) {
      if (existing.identity.charId !== identity.charId || existing.identity.playerId !== identity.playerId || existing.identity.archiveKey !== identity.archiveKey) throw new Error('侧写来源已变化，请重新打开。');
      return;
    }
    const entry: SavedPerspective = {
      identity: { charId: identity.charId, charName: identity.charName, playerId: identity.playerId, userName: identity.userName, chatId: identity.chatId, archiveKey: identity.archiveKey, archiveRevision: identity.archiveRevision },
      report: { id: report.id, title: report.title, body: report.body, createdAt: report.createdAt }, savedAt: new Date().toISOString(),
    };
    if (!valid([entry])) throw new Error('侧写内容不完整，未保存。');
    await setStorageItemsAtomically({ [PERSPECTIVE_SHELF_KEY]: [...all, entry] });
  });
}
export function removeSavedPerspective(id: string) {
  return update(async () => {
    const all = allSaved(), target = all.find(s => s.report.id === id); if (!target) return;
    if (target.identity.playerId !== playerId() || target.identity.archiveKey !== activeMemoryArchive(target.identity.charId)) throw new Error('玩家或存档已变化，请重新打开侧写。');
    await setStorageItemsAtomically({ [PERSPECTIVE_SHELF_KEY]: all.filter(s => s.report.id !== id) });
  });
}
/** Reopening a saved article in its original timeline is allowed after returning from another archive. */
export function reopenPerspective(saved: SavedPerspective, current: PerspectiveIdentity): PerspectiveIdentity {
  if (saved.identity.charId !== current.charId || saved.identity.playerId !== current.playerId || saved.identity.archiveKey !== current.archiveKey || saved.identity.chatId !== current.chatId) throw new Error('这篇侧写属于另一个玩家或聊天存档。');
  assertPerspectiveCurrent(current);
  return { ...saved.identity, archiveRevision: current.archiveRevision };
}
export function perspectiveAlreadyInjected(identity: PerspectiveIdentity, id: string) {
  const chats = readStoredValue('yyphone:wechat-chats', [], (v): v is unknown[] => Array.isArray(v));
  const chat = chats.find(c => record(c) && c.id === identity.chatId);
  return record(chat) && Array.isArray(chat.messages) && chat.messages.some(m => record(m) && m.id === `perspective-note:${id}`);
}
