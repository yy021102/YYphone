import { readSetting, SETTINGS_KEYS } from './settings';

export interface ChatRuntimeSettings {
  keepAlive: boolean;
  banners: boolean;
  systemNotifications: boolean;
  allowIncomingCalls: boolean;
}

export const DEFAULT_CHAT_RUNTIME: ChatRuntimeSettings = {
  keepAlive: false,
  banners: false,
  systemNotifications: false,
  allowIncomingCalls: false,
};

export const readChatRuntimeSettings = (): ChatRuntimeSettings =>
  readSetting(SETTINGS_KEYS.chatRuntime, DEFAULT_CHAT_RUNTIME, (value): value is ChatRuntimeSettings =>
    !!value && typeof value === 'object' &&
    Object.keys(DEFAULT_CHAT_RUNTIME).every((key) =>
      typeof Reflect.get(value, key) === 'boolean'
    )
  );

/** Explicit per-chat settings take priority; old chats retain their previous global preference. */
export const incomingCallsAllowed = (
  chat: { type: string; blocked?: boolean; allowIncomingCalls?: boolean },
  legacy: Pick<ChatRuntimeSettings, 'allowIncomingCalls'>,
): boolean => chat.type === 'direct' && !chat.blocked && (chat.allowIncomingCalls ?? legacy.allowIncomingCalls);

export interface ChatNotification {
  chatId: string;
  name: string;
  avatar: string;
  text: string;
}

export interface ProactiveChat {
  id: string;
  type: string;
  blocked: boolean;
  participantIds: string[];
  proactiveEnabled?: boolean;
  proactiveIntervalMinutes?: number;
  lastProactiveAt?: string;
  updatedAt: string;
}

export const proactiveInterval = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1440, Math.max(1, Math.round(value)))
    : 30;

export const isProactiveDue = (chat: ProactiveChat, now: number): boolean => {
  if (chat.type !== 'direct' || chat.blocked || !chat.proactiveEnabled || chat.participantIds.length !== 1) return false;
  const activity = Math.max(Date.parse(chat.updatedAt) || 0, Date.parse(chat.lastProactiveAt ?? '') || 0);
  return activity > 0 && now - activity >= proactiveInterval(chat.proactiveIntervalMinutes) * 60_000;
};

export const getRoundThought = (
  message: { senderId: string; thought?: string; replyBatchId?: string },
  messages: Array<{ senderId: string; thought?: string; replyBatchId?: string }>
): string => message.thought || (message.replyBatchId
  ? messages.find((item) => item.replyBatchId === message.replyBatchId &&
      item.senderId === message.senderId && item.thought)?.thought
  : '') || '';

export const preserveRoundThoughts = <T extends { senderId: string; thought?: string; replyBatchId?: string }>(messages: T[]): T[] => {
  const thoughts = new Map<string, string>();
  for (const message of messages) {
    if (message.replyBatchId && message.thought) thoughts.set(`${message.replyBatchId}:${message.senderId}`, message.thought);
  }
  return messages.map((message) => {
    if (message.thought || !message.replyBatchId) return message;
    const thought = thoughts.get(`${message.replyBatchId}:${message.senderId}`);
    return thought ? { ...message, thought } : message;
  });
};

export const permittedSticker = (
  categories: string[] | undefined,
  sticker: { category?: string }
): boolean => categories === undefined || categories.includes(sticker.category || '默认');

let keepAliveAudio: HTMLAudioElement | undefined;
let keepAliveUrl = '';

export const isKeepAlivePlaying = () => !!keepAliveAudio && !keepAliveAudio.paused && !keepAliveAudio.ended;

export const stopKeepAlive = () => {
  keepAliveAudio?.pause();
  if (keepAliveAudio) keepAliveAudio.src = '';
  keepAliveAudio = undefined;
  if (keepAliveUrl) URL.revokeObjectURL(keepAliveUrl);
  keepAliveUrl = '';
};

export const startKeepAlive = async (): Promise<void> => {
  if (keepAliveAudio && !keepAliveAudio.paused) return;
  if (!keepAliveAudio) {
    const samples = 8000;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const text = (offset: number, value: string) =>
      [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, samples, true);
    view.setUint32(28, samples * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, samples * 2, true);
    keepAliveUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    keepAliveAudio = new Audio(keepAliveUrl);
    keepAliveAudio.loop = true;
    keepAliveAudio.preload = 'auto';
  }
  await keepAliveAudio.play();
};
