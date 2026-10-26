import { mutateDirectChat } from './coupleSpaceData';
import { upsertContextNote } from './chatNotes';
import { readStorageString } from './localStorage';
import { resolveChatHistoryCount } from './chatHistory';

export interface PhoneWalletRecord {
  id: string;
  title: string;
  /** 正数为收入，负数为支出 */
  amount: number;
  timeStr: string;
  note?: string;
}

export interface PhoneWallet {
  balance: number;
  records: PhoneWalletRecord[];
  updatedAt: string;
}

export interface PhoneHealth {
  sleepHours: number;
  sleepNote: string;
  steps: number;
  screenTimeMinutes: number;
}

export const CHECK_PHONE_STORAGE_KEY = 'yyphone:check-phone-data';
const CHATS_STORAGE_KEY = 'yyphone:wechat-chats';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readJson = (key: string): unknown => {
  try {
    const raw = readStorageString(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const formatMoney = (value: number) =>
  value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const readCharacterWallet = (charId: string): PhoneWallet | null => {
  const map = readJson(CHECK_PHONE_STORAGE_KEY);
  const wallet = isRecord(map) && isRecord(map[charId]) ? (map[charId] as Record<string, unknown>).wallet : null;
  if (!isRecord(wallet) || typeof wallet.balance !== 'number' || !Array.isArray(wallet.records)) return null;
  return wallet as unknown as PhoneWallet;
};

/** 供钱包生成使用：聊天里与玩家之间的转账、红包、礼物/订单。 */
export const readRecentMoneyEvents = (charId: string, historyLimit?: number): string => {
  const chats = readJson(CHATS_STORAGE_KEY);
  if (!Array.isArray(chats)) return '';
  const chat = chats.find(
    (item) =>
      isRecord(item) &&
      item.type === 'direct' &&
      Array.isArray(item.participantIds) &&
      item.participantIds.length === 1 &&
      item.participantIds[0] === charId
  );
  if (!isRecord(chat) || !Array.isArray(chat.messages)) return '';
  const lines: string[] = [];
  for (const message of chat.messages.slice(-resolveChatHistoryCount(historyLimit ?? chat.currentChatHistoryCount))) {
    if (!isRecord(message)) continue;
    const kind = message.kind;
    if (kind !== 'red-packet' && kind !== 'transfer' && kind !== 'order') continue;
    const from = message.senderId === 'user' ? '玩家给你' : '你给玩家';
    const when = typeof message.createdAt === 'string' ? message.createdAt.slice(0, 16).replace('T', ' ') : '';
    const label = kind === 'red-packet' ? '红包' : kind === 'transfer' ? '转账' : message.orderMode === 'gift' ? '送礼物' : '下单商品';
    const amount = typeof message.amount === 'string' || typeof message.amount === 'number' ? `¥${message.amount}` : '';
    const status = kind === 'order' ? '' : message.paymentStatus === 'pending' ? '（待收款，未到账）' : message.paymentStatus === 'returned' ? '（已退回，未到账）' : message.senderId !== 'user' ? '（已领取/收款）' : '（已发出）';
    const text = typeof message.title === 'string' && message.title ? message.title : typeof message.text === 'string' ? message.text : '';
    lines.push(`${when} ${from}${label} ${amount}${status} ${text}`.trim());
  }
  return lines.slice(-15).join('\n');
};

export type PhoneShareMode = 'found' | 'memory';

/** 把手机内容作为“记忆”同步给角色：聊天里只出现一条「xx记忆已同步」，完整内容进入聊天上下文和流水账。 */
export const syncPhoneMemoryToContext = (
  charId: string,
  appLabel: string,
  detail: string
) => {
  upsertContextNote(charId, {
    id: `phone-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'phone-memory',
    title: appLabel,
    detail,
  });
};

/** Share found phone content as an explicit user message/card in the character's WeChat. */
export const postPhoneShareCard = (
  charId: string,
  charName: string,
  options: { appLabel: string; summary: string; detail: string }
) => {
  mutateDirectChat(charId, (chat) => {
    chat.messages.push({
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: 'user',
      kind: 'phone-share',
      text: `转发了${charName}手机里的${options.appLabel}`,
      title: `${charName}的手机 · ${options.appLabel}`,
      source: '我查到的内容',
      content: options.summary,
      aiContext: options.detail,
      shareMode: 'found',
      createdAt: new Date().toISOString(),
    });
  });
};
