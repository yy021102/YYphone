import { readStoredValue } from './localStorage';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isDirectChat = (chat: unknown): chat is {
  type: 'direct';
  participantIds: string[];
  context?: string;
} =>
    isRecord(chat) &&
    chat.type === 'direct' &&
    Array.isArray(chat.participantIds) &&
    chat.participantIds.every((id) => typeof id === 'string') &&
    (chat.context === undefined || typeof chat.context === 'string');

export const getChatRelationContexts = (contactIds: string[]): string[] => {
  const storedChats = readStoredValue<unknown[]>('yyphone:wechat-chats', [], Array.isArray);
  const chats = storedChats.filter(isDirectChat);
  const contexts: string[] = [];
  const seen = new Set<string>();
  for (const contactId of contactIds) {
    if (seen.has(contactId)) continue;
    seen.add(contactId);
    const context = chats.find((chat) =>
      chat.participantIds.length === 1 && chat.participantIds[0] === contactId
    )?.context?.trim();
    if (context) contexts.push(`【${contactId} 的对话关系补充】\n${context}`);
  }
  return contexts;
};
