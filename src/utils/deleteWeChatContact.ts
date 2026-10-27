import { setStorageItemsAtomically } from './dbStorage';
import { readStoredValue } from './localStorage';
import { CHARACTER_NPCS_STORAGE_KEY, npcParticipantId, readCharacterNpcs } from './characterNpcs';
import { ALIAS_ACCOUNTS_KEY, aliasStateWithoutCharacter, readAliasState } from './aliasAccounts';
import { PERSPECTIVE_SHELF_KEY } from './perspectiveShelf';

type Row = Record<string, any>;
const rows = (key: string): Row[] => {
  const value = readStoredValue<unknown>(key, [], (_value): _value is unknown => true);
  if (!Array.isArray(value) || !value.every(item => !!item && typeof item === 'object' && !Array.isArray(item))) throw new Error('联系人或聊天数据格式异常，未删除角色。');
  return value;
};
export interface FormerParticipant { name: string; avatarUrl: string }

/** Remove live membership, while retaining the author identity of historical group messages. */
export async function deleteWeChatContact(contactId: string) {
  const contacts = rows('pocketos:wechat-contacts');
  const removed = contacts.find(contact => contact.id === contactId);
  if (!removed) throw new Error('这个角色已经不存在。');
  const npcs = readCharacterNpcs();
  const remainingIds = new Set(contacts.filter(contact => contact.id !== contactId).map(contact => contact.id));
  const nextNpcs = npcs.map(npc => {
    const linkedCharIds = npc.linkedCharIds.filter(id => remainingIds.has(id));
    const primary = contacts.find(contact => linkedCharIds.includes(contact.id));
    return { ...npc, linkedCharIds, charId: primary?.id, charName: primary?.name };
  }).filter(npc => npc.linkedCharIds.length);
  const deletedIds = new Set([contactId, ...npcs.filter(npc => !nextNpcs.some(next => next.id === npc.id)).map(npc => npcParticipantId(npc.id))]);
  const nextContacts = contacts.filter(contact => contact.id !== contactId).map(contact => ({
    ...contact, linkedNpcIds: nextNpcs.filter(npc => npc.linkedCharIds.includes(contact.id)).map(npc => npc.id),
    ...(Array.isArray(contact.npcs) ? { npcs: [] } : {}), ...(Array.isArray(contact.npcList) ? { npcList: [] } : {}),
  }));
  const chats = rows('yyphone:wechat-chats');
  const removedChatIds = new Set(chats.filter(chat => chat.type === 'direct' && chat.participantIds?.some((id: string) => deletedIds.has(id))).map(chat => chat.id));
  const nextChats = chats.filter(chat => !removedChatIds.has(chat.id)).map(chat => {
    const leaving = (chat.participantIds ?? []).filter((id: string) => deletedIds.has(id));
    const formerParticipants: Record<string, FormerParticipant> = { ...chat.formerParticipants };
    for (const id of leaving) {
      const person = id === contactId ? removed : npcs.find(npc => npcParticipantId(npc.id) === id);
      formerParticipants[id] = { name: chat.groupNicknames?.[id]?.trim() || person?.name || '已离开的成员', avatarUrl: chat.avatars?.[id] || person?.avatarUrl || '' };
    }
    const withoutDeleted = (value: Row = {}) => Object.fromEntries(Object.entries(value).filter(([id]) => !deletedIds.has(id)));
    return { ...chat,
      ...(leaving.length ? { participantIds: chat.participantIds.filter((id: string) => !deletedIds.has(id)), formerParticipants,
        groupNicknames: withoutDeleted(chat.groupNicknames), avatars: withoutDeleted(chat.avatars) } : {}),
      ...(chat.attachedHistoryContactId === contactId ? { attachedHistoryContactId: undefined } : {}),
      ...(chat.attachedHistoryChatIds ? { attachedHistoryChatIds: chat.attachedHistoryChatIds.filter((id: string) => !removedChatIds.has(id)) } : {}),
      ...(chat.attachedHistoryCounts ? { attachedHistoryCounts: Object.fromEntries(Object.entries(chat.attachedHistoryCounts).filter(([id]) => !removedChatIds.has(id))) } : {}),
    };
  });
  await setStorageItemsAtomically({ 'pocketos:wechat-contacts': nextContacts, 'yyphone:wechat-chats': nextChats, [CHARACTER_NPCS_STORAGE_KEY]: nextNpcs,
    [PERSPECTIVE_SHELF_KEY]: rows(PERSPECTIVE_SHELF_KEY).filter(item => item.identity?.charId !== contactId),
    [ALIAS_ACCOUNTS_KEY]: aliasStateWithoutCharacter(readAliasState(), contactId) });
  if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('yyphone:alias-accounts'));
}
