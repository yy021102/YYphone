import { readStoredValue } from './localStorage';
import type { OfflineContact, OfflineStory } from './offlineData';
import { isVisibleChatMessage } from './chatHistory';
import { npcParticipantId, readCharacterNpcs } from './characterNpcs';

const row = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const chats = () => readStoredValue<unknown[]>('yyphone:wechat-chats', [], (value): value is unknown[] => Array.isArray(value)).filter(row);
export const readOfflineGroupChats = () => chats().flatMap(chat => chat.type === 'group' && typeof chat.id === 'string'
  ? [{ id: chat.id, name: typeof chat.groupTitle === 'string' && chat.groupTitle.trim() ? chat.groupTitle : '未命名群聊' }] : []);

export function offlineWechatBackground(story: OfflineStory, contacts: OfflineContact[], userName: string): string {
  const sources = chats();
  const direct = story.characterIds.flatMap(id => {
    const chat = sources.find(chat => chat.type === 'direct' && Array.isArray(chat.participantIds) && chat.participantIds.length === 1 && chat.participantIds[0] === id);
    return chat ? [chat] : [];
  });
  const groups = sources.filter(chat => chat.type === 'group' && typeof chat.id === 'string' && story.groupChatIds?.includes(chat.id));
  const count = Math.max(0, Math.min(200, Math.floor(story.wechatContextCount || 0)));
  const npcs = readCharacterNpcs();
  return [...direct, ...groups].flatMap(chat => {
    const group = chat.type === 'group';
    const nameOf = (id: unknown) => id === 'user' ? userName : contacts.find(contact => contact.id === id)?.name ?? npcs.find(npc => npcParticipantId(npc.id) === id)?.name ?? (typeof id === 'string' ? `成员(${id})` : '成员');
    const name = group ? typeof chat.groupTitle === 'string' && chat.groupTitle.trim() ? chat.groupTitle : '未命名群聊'
      : nameOf(Array.isArray(chat.participantIds) ? chat.participantIds[0] : '');
    const context = typeof chat.context === 'string' ? chat.context.trim() : '';
    const messages = count > 0 && Array.isArray(chat.messages) ? chat.messages.filter(row).filter(message =>
      !message.hidden && message.kind !== 'thought' && message.senderId !== 'narrator' &&
      isVisibleChatMessage({ source: typeof message.source === 'string' ? message.source : undefined })
    ).slice(-count).map(message => {
      const text = typeof message.text === 'string' && message.text ? message.text : typeof message.title === 'string' ? `[${message.title}]` : '[消息]';
      return `${nameOf(message.senderId)}：${text.slice(0, 500)}`;
    }).join('\n') : '';
    if (!context && !messages) return [];
    return [`【${group ? '所选群聊' : '与角色的私聊'}：${name}】\n${[context && `对话补充：\n${context}`, messages && `最近聊天：\n${messages}`].filter(Boolean).join('\n\n')}`];
  }).join('\n\n');
}
