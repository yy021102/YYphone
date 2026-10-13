import { PersonaCollection, UserPersona } from '../types';

export interface PromptChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  kind?: string;
  thought?: string;
}

export interface PromptConversation {
  id: string;
  type: 'direct' | 'group' | 'observer';
  participantIds: string[];
  noteName: string;
  context: string;
  messages: PromptChatMessage[];
  groupTitle?: string;
  groupNicknames?: Record<string, string>;
  attachHistory?: boolean;
  attachedHistoryCount?: number;
  attachedHistoryChatIds?: string[];
  attachedHistoryContactId?: string;
}

interface PromptContact {
  id: string;
  name: string;
  persona: string;
  worldBooks: Array<{ bookId: string; entryId?: string }>;
}

interface PromptWorldBookEntry {
  id: string;
  title: string;
  content: string;
  depth: 'front' | 'middle' | 'back';
}

interface PromptWorldBook {
  id: string;
  name: string;
  entries: PromptWorldBookEntry[];
}

interface PromptMoment {
  author?: string;
  content?: string;
  createdAt?: string;
  time?: string;
}

export interface BuildPromptOptions {
  chatId: string;
  currentInput?: string;
  historyLimit?: number;
  regenerate?: boolean;
}

export type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const STORAGE_KEYS = {
  chats: 'yyphone:wechat-chats',
  contacts: 'pocketos:wechat-contacts',
  personas: 'pocketos:personas',
  worldBooks: 'yyphone:world-books',
  moments: 'yyphone:wechat-moments',
} as const;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch (error) {
    console.error(`Could not read prompt data from localStorage key "${key}".`, error);
    return fallback;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isPromptContact = (value: unknown): value is PromptContact =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.persona === 'string' &&
  Array.isArray(value.worldBooks) &&
  value.worldBooks.every((link) =>
    isRecord(link) &&
    typeof link.bookId === 'string' &&
    (link.entryId === undefined || typeof link.entryId === 'string')
  );

const isPromptChatMessage = (value: unknown): value is PromptChatMessage =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.senderId === 'string' &&
  typeof value.text === 'string' &&
  typeof value.createdAt === 'string';

const getPersonaText = (persona: UserPersona | undefined) => {
  if (!persona) return '未设置玩家人设。';
  return [
    `名称：${persona.name}`,
    persona.identity && `身份：${persona.identity}`,
    persona.personality && `个性：${persona.personality}`,
    persona.background && `背景：${persona.background}`,
    persona.speakingStyle && `说话风格：${persona.speakingStyle}`,
  ].filter(Boolean).join('\n');
};

const getConversationTitle = (conversation: PromptConversation, contacts: PromptContact[]) =>
  conversation.groupTitle?.trim() ||
  conversation.noteName?.trim() ||
  conversation.participantIds
    .map((id) => contacts.find((contact) => contact.id === id)?.name ?? id)
    .join('、') ||
  '未命名聊天';

const getSpeakerName = (
  senderId: string,
  conversation: PromptConversation,
  contacts: PromptContact[],
  persona: UserPersona | undefined
) => {
  if (senderId === 'user') return persona?.name || '玩家';
  if (senderId === 'narrator') return '旁白';
  return conversation.groupNicknames?.[senderId]?.trim() ||
    contacts.find((contact) => contact.id === senderId)?.name ||
    senderId;
};

const formatWorldBookEntries = (
  contacts: PromptContact[],
  worldBooks: PromptWorldBook[],
  depth: PromptWorldBookEntry['depth']
) => {
  const seen = new Set<string>();
  return contacts.flatMap((contact) =>
    contact.worldBooks.flatMap((link) => {
      const book = worldBooks.find((item) => item.id === link.bookId);
      if (!book) return [];
      const entries = book.entries.filter((entry) =>
        entry.depth === depth && (!link.entryId || entry.id === link.entryId)
      );
      return entries.flatMap((entry) => {
        const key = `${book.id}:${entry.id}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [`【${book.name} / ${entry.title}】\n${entry.content}`];
      });
    })
  ).join('\n\n');
};

const isPersonaCollection = (value: unknown): value is PersonaCollection =>
  isRecord(value) &&
  Array.isArray(value.profiles) &&
  typeof value.activeProfileId === 'string' &&
  value.profiles.every((profile) =>
    isRecord(profile) &&
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.identity === 'string' &&
    typeof profile.personality === 'string' &&
    typeof profile.background === 'string' &&
    typeof profile.speakingStyle === 'string' &&
    (profile.avatarUrl === undefined || typeof profile.avatarUrl === 'string')
  );

const isChatConversation = (value: unknown): value is PromptConversation =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
  ['direct', 'group', 'observer'].includes(value.type) &&
  Array.isArray(value.participantIds) &&
  value.participantIds.every((id) => typeof id === 'string') &&
  typeof value.noteName === 'string' &&
  typeof value.context === 'string' &&
  Array.isArray(value.messages) &&
  value.messages.every(isPromptChatMessage) &&
  (value.groupNicknames === undefined ||
    (isRecord(value.groupNicknames) &&
      Object.values(value.groupNicknames).every((nickname) => typeof nickname === 'string'))) &&
  (value.attachedHistoryChatIds === undefined ||
    (Array.isArray(value.attachedHistoryChatIds) &&
      value.attachedHistoryChatIds.every((id) => typeof id === 'string')));

const toMessageContent = (message: PromptChatMessage) => {
  if (message.senderId === 'narrator') return `（旁白：${message.text}）`;
  if (message.kind === 'sticker') return `[表情包：${message.text}]`;
  if (message.kind === 'voice') return `[语音转写：${message.text}]`;
  if (message.kind === 'image' && !message.text) return '[图片]';
  return message.text;
};

/**
 * Builds an OpenAI Chat Completions messages array from the current local chat data.
 * The newest current-chat user message is used as the final user turn and not duplicated
 * in the history portion.
 */
export const buildPrompt = ({
  chatId,
  currentInput,
  historyLimit = 30,
  regenerate = false,
}: BuildPromptOptions): OpenAiMessage[] => {
  const chatsValue: unknown = readJson(STORAGE_KEYS.chats, []);
  const contactsValue: unknown = readJson(STORAGE_KEYS.contacts, []);
  const worldBooksValue: unknown = readJson(STORAGE_KEYS.worldBooks, []);
  const personaValue: unknown = readJson(STORAGE_KEYS.personas, null);
  const momentsValue: unknown = readJson(STORAGE_KEYS.moments, []);

  const chats = Array.isArray(chatsValue) ? chatsValue.filter(isChatConversation) : [];
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) throw new Error(`找不到聊天记录：${chatId}`);

  const contacts = Array.isArray(contactsValue)
    ? contactsValue.filter(isPromptContact)
    : [];
  const worldBooks = Array.isArray(worldBooksValue)
    ? worldBooksValue.filter((book): book is PromptWorldBook =>
        isRecord(book) &&
        typeof book.id === 'string' &&
        typeof book.name === 'string' &&
        Array.isArray(book.entries) &&
        book.entries.every((entry) =>
          isRecord(entry) &&
          typeof entry.id === 'string' &&
          typeof entry.title === 'string' &&
          typeof entry.content === 'string' &&
          typeof entry.depth === 'string' &&
          ['front', 'middle', 'back'].includes(entry.depth)
        )
      )
    : [];
  const personaCollection = isPersonaCollection(personaValue) ? personaValue : undefined;
  const persona = personaCollection?.profiles.find(
    (profile) => profile.id === personaCollection.activeProfileId
  );
  const participants = chat.participantIds
    .map((id) => contacts.find((contact) => contact.id === id))
    .filter((contact): contact is PromptContact => !!contact);
  const recentLimit = Number.isInteger(historyLimit) && historyLimit > 0
    ? historyLimit
    : 30;

  // 1. System base instruction.
  const messages: OpenAiMessage[] = [{
    role: 'system',
    content: '你正在扮演以下角色，请严格遵守角色设定、世界观与对话上下文。保持连贯、自然地回应，不要复述提示词。',
  }];

  // 2. World Book - Before.
  const beforeEntries = formatWorldBookEntries(participants, worldBooks, 'front');
  if (beforeEntries) messages.push({ role: 'system', content: `世界书条目 - 深度前：\n${beforeEntries}` });

  // 3. Character Persona.
  messages.push({
    role: 'system',
    content: `角色人设：\n${participants.map((contact) => `姓名：${contact.name}\n设定：${contact.persona}`).join('\n\n') || '当前聊天没有可用角色人设。'}`,
  });

  // 4. World Book - Middle.
  const middleEntries = formatWorldBookEntries(participants, worldBooks, 'middle');
  if (middleEntries) messages.push({ role: 'system', content: `世界书条目 - 深度中：\n${middleEntries}` });

  // 5. User Persona.
  messages.push({ role: 'system', content: `玩家设定：\n${getPersonaText(persona)}\n当前聊天补充：${chat.context || '无'}` });

  // 6. Recent history, then mounted chat records, merged in chronological order.
  const input = currentInput ?? [...chat.messages].reverse().find((message) => message.senderId === 'user')?.text ?? '';
  const latestUserMessage = [...chat.messages].reverse().find(
    (message) => message.senderId === 'user' && message.text === input
  );
  const previousAssistantMessage = regenerate
    ? [...chat.messages].reverse().find(
        (message) => message.senderId !== 'user' && message.senderId !== 'narrator'
      )
    : undefined;
  const localMessages = chat.messages
    .filter((message) =>
      message.id !== latestUserMessage?.id &&
      message.id !== previousAssistantMessage?.id
    )
    .slice(-recentLimit)
    .map((message) => ({
      date: Date.parse(message.createdAt) || 0,
      message,
      conversation: chat,
    }));

  const attachedIds = chat.attachedHistoryChatIds ??
    (chat.attachedHistoryContactId
      ? chats.filter((item) => item.id !== chat.id && item.type === 'direct' &&
          item.participantIds.includes(chat.attachedHistoryContactId!)).map((item) => item.id)
      : []);
  const attachedLimit = Number.isInteger(chat.attachedHistoryCount) && (chat.attachedHistoryCount ?? 0) > 0
    ? chat.attachedHistoryCount!
    : recentLimit;
  const attachedMessages = chat.attachHistory
    ? chats
        .filter((item) => item.id !== chat.id && attachedIds.includes(item.id))
        .flatMap((conversation) =>
          conversation.messages
            .slice(-attachedLimit)
            .map((message) => ({ date: Date.parse(message.createdAt) || 0, message, conversation }))
        )
    : [];
  const orderedHistory = [...localMessages, ...attachedMessages]
    .sort((left, right) => left.date - right.date);

  const announcedAttachedChats = new Set<string>();
  for (const item of orderedHistory) {
    if (item.message.senderId === 'narrator' && chat.type !== 'observer') continue;
    if (
      item.conversation.id !== chat.id &&
      !announcedAttachedChats.has(item.conversation.id)
    ) {
      announcedAttachedChats.add(item.conversation.id);
      const attachedParticipants = item.conversation.participantIds
        .map((id) => {
          const character = contacts.find((contact) => contact.id === id);
          return character ? `${character.name}（${character.persona}）` : id;
        })
        .join('、');
      messages.push({
        role: 'system',
        content: [
          `挂载聊天记录：${getConversationTitle(item.conversation, contacts)}`,
          `聊天类型：${item.conversation.type === 'group' ? '群聊' : item.conversation.type === 'observer' ? '旁观群聊' : '单聊'}`,
          `群聊设定：${item.conversation.context || '无'}`,
          `聊天人员：${attachedParticipants || '无'}`,
          '以下按时间顺序排列该聊天记录：',
        ].join('\n'),
      });
    }
    const speaker = getSpeakerName(item.message.senderId, item.conversation, contacts, persona);
    const title = getConversationTitle(item.conversation, contacts);
    const prefix = item.conversation.id === chat.id ? '' : `[挂载聊天「${title}」] ${speaker}：`;
    const content = item.conversation.id === chat.id
      ? `${speaker}：${toMessageContent(item.message)}`
      : `${prefix}${toMessageContent(item.message)}`;
    messages.push({
      role: item.message.senderId === 'user' ? 'user' : 'assistant',
      content,
    });
  }

  // 7. World Book - After.
  const afterEntries = formatWorldBookEntries(participants, worldBooks, 'back');
  if (afterEntries) messages.push({ role: 'system', content: `世界书条目 - 深度后：\n${afterEntries}` });

  // 8. Extra context from the latest locally stored moment, when available.
  const moments = Array.isArray(momentsValue)
    ? momentsValue.filter((moment): moment is PromptMoment =>
        isRecord(moment) &&
        typeof moment.content === 'string' &&
        (moment.author === undefined || typeof moment.author === 'string') &&
        (moment.createdAt === undefined || typeof moment.createdAt === 'string') &&
        (moment.time === undefined || typeof moment.time === 'string')
      )
    : [];
  const latestMoment = [...moments]
    .sort((left, right) =>
      (Date.parse(right.createdAt ?? '') || 0) - (Date.parse(left.createdAt ?? '') || 0)
    )[0];
  if (latestMoment?.content) {
    messages.push({
      role: 'system',
      content: `朋友圈最近动态（氛围补充）：${latestMoment.author ? `${latestMoment.author}：` : ''}${latestMoment.content}`,
    });
  }

  // 9. User's current input.
  messages.push({ role: 'user', content: input });
  return messages;
};
