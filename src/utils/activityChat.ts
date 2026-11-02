import { currentAliasUser } from './aliasAccounts';
import { activeMemoryArchive } from './memoryArchives';
import { readStoredValue } from './localStorage';
import { isObject } from './divination';

const CHATS_KEY = 'yyphone:wechat-chats';
interface ActivityMessage { id: string; createdAt?: string }
interface ActivityChat {
  id: string; type: string; participantIds: string[]; messages: ActivityMessage[];
  archiveRevision?: string | number; blocked?: boolean;
}
export interface ActivityChatScope {
  actorId: string; userId: string; archiveKey: string; chatId: string; archiveRevision: string | number;
}
function chats(): ActivityChat[] {
  const value = readStoredValue<unknown>(CHATS_KEY, [], (_v): _v is unknown => true);
  if (!Array.isArray(value) || !value.every((c): c is ActivityChat => isObject(c) && typeof c.id === 'string' &&
    typeof c.type === 'string' && Array.isArray(c.participantIds) && c.participantIds.every(id => typeof id === 'string') &&
    Array.isArray(c.messages) && c.messages.every(m => isObject(m) && typeof m.id === 'string')))
    throw new Error('聊天记录格式异常，未保存互动同步记录。');
  return value;
}
const directChat = (all: ActivityChat[], actorId: string) => all.find(c =>
  c.type === 'direct' && c.participantIds.length === 1 && c.participantIds[0] === actorId);
export function captureActivityChatScope(actorId: string): ActivityChatScope {
  const chat = directChat(chats(), actorId);
  return { actorId, userId: currentAliasUser().id, archiveKey: activeMemoryArchive(actorId),
    chatId: chat?.id ?? '', archiveRevision: chat?.archiveRevision ?? '' };
}
export function assertActivityChatScope(scope: ActivityChatScope): void {
  const contacts = readStoredValue<unknown>('pocketos:wechat-contacts', [], (_v): _v is unknown => true);
  const chat = directChat(chats(), scope.actorId);
  if (currentAliasUser().id !== scope.userId || activeMemoryArchive(scope.actorId) !== scope.archiveKey ||
    (chat?.id ?? '') !== scope.chatId || (chat?.archiveRevision ?? '') !== scope.archiveRevision ||
    !Array.isArray(contacts) || !contacts.some(c => isObject(c) && c.id === scope.actorId))
    throw new Error('当前玩家、角色或存档已变化，已取消本次互动，请重新请求。');
}
export function activityChatChanges(scope: ActivityChatScope, input: { id: string; title: string; detail: string; source: string }): Record<string, unknown> {
  assertActivityChatScope(scope);
  const all = chats(), current = directChat(all, scope.actorId), now = new Date().toISOString();
  if (current?.blocked) throw new Error('这位角色的聊天已拉黑，不能同步互动记录。');
  const card = { id: input.id, senderId: 'user', kind: 'link', source: input.source, title: input.title,
    text: input.detail, content: input.detail, createdAt: now };
  const base = current ?? { id: `chat-${crypto.randomUUID()}`, type: 'direct', participantIds: [scope.actorId],
    noteName: '', context: '', narratorEnabled: false, blocked: false, pinned: false, avatars: {}, messages: [],
    timeZone: 'Asia/Shanghai', allowIncomingCalls: false, currentChatHistoryCount: 200, replyMessageMin: 1, replyMessageMax: 6, updatedAt: now };
  const next = { ...base, updatedAt: now, messages: base.messages.some(m => m.id === input.id)
    ? base.messages.map(m => m.id === input.id ? { ...card, createdAt: m.createdAt ?? now } : m) : [...base.messages, card] };
  return { [CHATS_KEY]: current ? all.map(c => c.id === current.id ? next : c) : [next, ...all] };
}
