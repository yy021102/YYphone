import { readStorageString, writeStorageString } from './localStorage';

export interface IntimatePayCard {
  id: string;
  charId: string;
  charName: string;
  avatar?: string;
  monthlyLimit: number;
  usedAmount: number;
  note: string;
  usageMonth?: string;
}

export interface RealLedgerItem {
  id: string;
  title: string;
  amount: number;
  isExpense: boolean;
  date: string;
  time: string;
  category?: string;
}

export interface AlipayData {
  balance: number;
  yuebao: number;
  bankCardCount: string;
  bankCardNote: string;
  intimateCards: IntimatePayCard[];
  monthlyBudgets: Record<string, number>;
  ledgerList: RealLedgerItem[];
  allowedViewers: string[];
  lastInterestDate: string;
  chatSettlements?: Record<string, 'received' | 'returned'>;
  channelGiftSettlements?: Record<string, 'sent' | 'received'>;
}

export interface AlipayContact {
  id: string;
  name: string;
  avatarUrl?: string;
  forumNickname?: string;
  forumHandle?: string;
}

export const ALIPAY_STORAGE_KEY = 'yyphone:alipay-data';
export const WECHAT_CONTACTS_STORAGE_KEY = 'pocketos:wechat-contacts';
export const WECHAT_CHATS_STORAGE_KEY = 'yyphone:wechat-chats';

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const today = () => localDate(new Date());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const validLedgerItem = (value: unknown): value is RealLedgerItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.amount === 'number' &&
  Number.isFinite(value.amount) &&
  typeof value.isExpense === 'boolean' &&
  typeof value.date === 'string' &&
  typeof value.time === 'string';

const validCard = (value: unknown): value is IntimatePayCard =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.charId === 'string' &&
  typeof value.charName === 'string' &&
  typeof value.monthlyLimit === 'number' &&
  Number.isFinite(value.monthlyLimit) &&
  typeof value.usedAmount === 'number' &&
  Number.isFinite(value.usedAmount) &&
  typeof value.note === 'string';

export const emptyAlipayData = (): AlipayData => ({
  balance: 0,
  yuebao: 0,
  bankCardCount: '0 张',
  bankCardNote: '暂无绑定银行卡',
  intimateCards: [],
  monthlyBudgets: {},
  ledgerList: [],
  allowedViewers: [],
  lastInterestDate: today(),
});

const normalizeAlipayData = (value: unknown): AlipayData => {
  const defaults = emptyAlipayData();
  if (!isRecord(value)) return defaults;
  const budgets = isRecord(value.monthlyBudgets)
    ? Object.fromEntries(
        Object.entries(value.monthlyBudgets).filter(
          ([key, amount]) => /^\d{4}-\d{2}$/.test(key) && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
        )
      ) as Record<string, number>
    : {};
  const giftSettlements: Record<string, 'sent' | 'received'> = {
    ...(Array.isArray(value.ledgerList) ? Object.fromEntries(value.ledgerList.filter(validLedgerItem)
      .filter((item) => item.id.startsWith('channel-gift-'))
      .map((item) => [item.id.slice('channel-gift-'.length), item.isExpense ? 'sent' : 'received'])) : {}),
    ...(isRecord(value.channelGiftSettlements) ? Object.fromEntries(Object.entries(value.channelGiftSettlements)
      .filter((entry): entry is [string, 'sent' | 'received'] => entry[1] === 'sent' || entry[1] === 'received')) : {}),
  };
  return {
    balance: typeof value.balance === 'number' && Number.isFinite(value.balance) ? Math.max(0, value.balance) : 0,
    yuebao: typeof value.yuebao === 'number' && Number.isFinite(value.yuebao) ? Math.max(0, value.yuebao) : 0,
    bankCardCount: typeof value.bankCardCount === 'string' ? value.bankCardCount : defaults.bankCardCount,
    bankCardNote: typeof value.bankCardNote === 'string' ? value.bankCardNote : defaults.bankCardNote,
    intimateCards: Array.isArray(value.intimateCards)
      ? value.intimateCards.filter(validCard).map((card) => {
          const month = today().slice(0, 7);
          return card.usageMonth && card.usageMonth !== month
            ? { ...card, usedAmount: 0, usageMonth: month }
            : { ...card, usageMonth: month };
        })
      : [],
    monthlyBudgets: budgets,
    ledgerList: Array.isArray(value.ledgerList)
      ? value.ledgerList.filter(validLedgerItem).filter((item) => !item.id.startsWith('channel-gift-'))
      : [],
    allowedViewers: Array.isArray(value.allowedViewers)
      ? value.allowedViewers.filter((id): id is string => typeof id === 'string')
      : [],
    lastInterestDate: typeof value.lastInterestDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.lastInterestDate)
      ? value.lastInterestDate
      : today(),
    chatSettlements: isRecord(value.chatSettlements)
      ? Object.fromEntries(Object.entries(value.chatSettlements).filter(
          (entry): entry is [string, 'received' | 'returned'] => entry[1] === 'received' || entry[1] === 'returned'
        ))
      : {},
    ...(Object.keys(giftSettlements).length ? { channelGiftSettlements: giftSettlements } : {}),
  };
};

export const readAlipayData = (): AlipayData => {
  try {
    const raw = readStorageString(ALIPAY_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    const account = normalizeAlipayData(stored);
    const hasLegacyGiftLedger = isRecord(stored) && Array.isArray(stored.ledgerList) &&
      stored.ledgerList.some((item: unknown) => isRecord(item) && typeof item.id === 'string' && item.id.startsWith('channel-gift-'));
    const now = today();
    const lastDate = new Date(`${account.lastInterestDate}T00:00:00`);
    const todayDate = new Date(`${now}T00:00:00`);
    const elapsedDays = Math.max(0, Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000));
    if (elapsedDays > 0) {
      for (let day = 0; day < elapsedDays; day += 1) {
        account.yuebao += account.yuebao * 0.0208 / 365;
      }
      account.lastInterestDate = now;
      writeAlipayData(account);
    } else if (!raw || hasLegacyGiftLedger) {
      writeAlipayData(account);
    }
    return account;
  } catch (error) {
    console.error('Could not read Alipay data.', error);
    return emptyAlipayData();
  }
};

export const writeAlipayData = (data: AlipayData) => {
  writeStorageString(ALIPAY_STORAGE_KEY, JSON.stringify(data));
};

export const updateAlipayBalance = (input: string): number => {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('请输入非负金额，最多两位小数。');
  const balance = Number(value);
  if (!Number.isSafeInteger(Math.round(balance * 100))) throw new Error('金额过大，请重新输入。');
  writeAlipayData({ ...readAlipayData(), balance });
  window.dispatchEvent(new Event('yyphone:finance-change'));
  return balance;
};

export const readAlipayContacts = (): AlipayContact[] => {
  try {
    const value: unknown = JSON.parse(
      readStorageString(WECHAT_CONTACTS_STORAGE_KEY) ?? '[]'
    );
    if (!Array.isArray(value)) return [];
    return value.flatMap((contact): AlipayContact[] =>
      isRecord(contact) &&
      typeof contact.id === 'string' &&
      typeof contact.name === 'string'
        ? [{
            id: contact.id,
            name: contact.name,
            avatarUrl: typeof contact.avatarUrl === 'string' ? contact.avatarUrl : undefined,
            forumNickname: typeof contact.forumNickname === 'string' ? contact.forumNickname : undefined,
            ...(typeof contact.forumHandle === 'string' ? { forumHandle: contact.forumHandle } : {}),
          }]
        : []
    );
  } catch (error) {
    console.error('Could not read WeChat contacts for Alipay.', error);
    return [];
  }
};

export type PaymentSource =
  | { type: 'balance' }
  | { type: 'intimate'; charId: string };

export interface PaymentResult {
  data: AlipayData;
  payer?: IntimatePayCard;
}

const makeLedgerItem = (title: string, amount: number): RealLedgerItem => {
  const now = new Date();
  return {
    id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    amount,
    isExpense: true,
    date: localDate(now),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    category: '消费',
  };
};

const appendIntimatePayMessage = (
  contact: AlipayContact,
  note: string,
  title: string,
  amount: number,
  request = false
) => {
  const chatsRaw = readStorageString(WECHAT_CHATS_STORAGE_KEY);
  const chatsValue: unknown = chatsRaw ? JSON.parse(chatsRaw) : [];
  if (!Array.isArray(chatsValue)) throw new Error('微信聊天数据格式无效，无法发送亲密付互动消息。');
  const chats = chatsValue as Array<Record<string, unknown>>;
  let conversation = chats.find((chat) =>
    chat.type === 'direct' &&
    Array.isArray(chat.participantIds) &&
    chat.participantIds.length === 1 &&
    chat.participantIds[0] === contact.id
  );
  const timestamp = new Date().toISOString();
  if (request && conversation?.blocked) throw new Error('该角色已被拉黑，无法提交亲密付申请。');
  if (request && Array.isArray(conversation?.messages) && conversation.messages.some((message: unknown) =>
    isRecord(message) && message.kind === 'intimate-pay' && message.intimateStatus === 'pending'
  )) throw new Error('已有待回应的亲密付申请，请先到微信让角色回复。');
  const message = {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId: request ? 'user' : contact.id,
    text: request
      ? `我想向你申请亲密付，希望每月额度 ¥${amount.toFixed(2)}。${note ? `申请理由：${note}` : '你愿意为我开通吗？'}`
      : `${note ? `${note}。` : ''}我刚刚用亲密付帮你支付了「${title}」（¥${amount.toFixed(2)}），记得查收～`,
    ...(request ? { kind: 'intimate-pay', intimateStatus: 'pending', amount: amount.toFixed(2) } : {}),
    createdAt: timestamp,
    thought: '',
  };
  if (!conversation) {
    conversation = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'direct',
      participantIds: [contact.id],
      noteName: '',
      context: '',
      narratorEnabled: false,
      blocked: false,
      pinned: false,
      avatars: {},
      messages: [],
      updatedAt: timestamp,
      groupTitle: '',
      groupNicknames: {},
      allowAgentGroupRename: false,
      attachHistory: false,
      attachedHistoryCount: 10,
    };
    chats.unshift(conversation);
  }
  if (!Array.isArray(conversation.messages)) {
    throw new Error('目标微信会话的消息列表格式无效。');
  }
  conversation.messages.push(message);
  conversation.updatedAt = timestamp;
  writeStorageString(WECHAT_CHATS_STORAGE_KEY, JSON.stringify(chats));
};

export const requestIntimatePay = (contact: AlipayContact, limit: number, note: string): void => {
  if (!Number.isFinite(limit) || limit < 0.01 || limit > 1_000_000) throw new Error('申请额度需至少 0.01 且不超过 1,000,000 元。');
  appendIntimatePayMessage(contact, note, '', limit, true);
};

export const chargeAlipay = (
  amount: number,
  title: string,
  source: PaymentSource,
  options: { notifyIntimatePayer?: boolean; recordLedger?: boolean } = { recordLedger: false }
): PaymentResult => {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('支付金额必须大于 0。');
  const data = readAlipayData();
  const payer = source.type === 'intimate'
    ? data.intimateCards.find((card) => card.charId === source.charId)
    : undefined;
  if (source.type === 'intimate' && !payer) throw new Error('该角色尚未开通亲密付。');
  if (payer) {
    const remaining = payer.monthlyLimit - payer.usedAmount;
    if (amount > remaining) throw new Error(`亲密付额度不足，当前剩余 ¥${Math.max(0, remaining).toFixed(2)}。`);
  } else if (amount > data.balance) {
    throw new Error(`支付宝余额不足，当前余额 ¥${data.balance.toFixed(2)}。`);
  }

  const nextData: AlipayData = {
    ...data,
    balance: payer ? data.balance : data.balance - amount,
    intimateCards: payer
      ? data.intimateCards.map((card) =>
          card.charId === payer.charId
            ? {
                ...card,
                usedAmount: card.usedAmount + amount,
                usageMonth: today().slice(0, 7),
              }
            : card
        )
      : data.intimateCards,
    ledgerList: options.recordLedger === false
      ? data.ledgerList
      : [makeLedgerItem(title, amount), ...data.ledgerList],
  };

  if (payer) {
    const contact = readAlipayContacts().find((item) => item.id === payer.charId);
    if (!contact) throw new Error('亲密付角色已不在微信通讯录中。');
    writeAlipayData(nextData);
    if (options.notifyIntimatePayer !== false) {
      try {
        appendIntimatePayMessage(contact, payer.note, title, amount);
      } catch (error) {
        writeAlipayData(data);
        throw error;
      }
    }
  } else {
    writeAlipayData(nextData);
  }
  return { data: nextData, payer };
};

export const creditAlipay = (amount: number): AlipayData => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('入账金额必须大于 0。');
  }
  const data = readAlipayData();
  const nextData: AlipayData = {
    ...data,
    balance: data.balance + amount,
  };

  writeAlipayData(nextData);
  return nextData;
};

export interface IncomingChatPayment {
  id: string;
  kind?: string;
  senderId: string;
  recipientId?: string;
  amount?: string;
  paymentStatus?: 'pending' | 'received' | 'returned';
}

export const settleIncomingChatPayment = (
  data: AlipayData,
  payment: IncomingChatPayment,
  action: 'received' | 'returned'
): AlipayData => {
  if ((payment.kind !== 'transfer' && payment.kind !== 'red-packet') ||
    payment.senderId === 'user' || payment.recipientId !== 'user' || payment.paymentStatus !== 'pending') {
    throw new Error('这笔款项不可领取或退回；历史已入账的款项不会重复入账。');
  }
  if (data.chatSettlements?.[payment.id]) throw new Error('这笔款项已处理，请重新打开聊天。');
  if (action === 'returned' && payment.kind !== 'transfer') throw new Error('只有待收款的转账可以退回。');
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 1_000_000) throw new Error('收款金额无效。');
  return {
    ...data,
    balance: Math.round((data.balance + (action === 'received' ? amount : 0)) * 100) / 100,
    chatSettlements: { ...data.chatSettlements, [payment.id]: action },
  };
};

export const grantIntimatePay = (contact: AlipayContact, monthlyLimit: number, note: string): void => {
  if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0.01 || monthlyLimit > 1_000_000) {
    throw new Error('角色返回的亲密付额度无效。');
  }
  const data = readAlipayData();
  const existing = data.intimateCards.find((card) => card.charId === contact.id);
  writeAlipayData({
    ...data,
    intimateCards: [
      ...data.intimateCards.filter((card) => card.charId !== contact.id),
      {
        id: existing?.id ?? `intimate-${contact.id}`,
        charId: contact.id,
        charName: contact.name,
        avatar: contact.avatarUrl,
        monthlyLimit: Math.round(monthlyLimit * 100) / 100,
        usedAmount: existing?.usedAmount ?? 0,
        usageMonth: today().slice(0, 7),
        note,
      },
    ],
  });
  window.dispatchEvent(new Event('yyphone:finance-change'));
};

export const sendIntimatePayInteraction = (
  charId: string,
  title: string,
  amount: number
) => {
  const contact = readAlipayContacts().find((item) => item.id === charId);
  const payer = readAlipayData().intimateCards.find((card) => card.charId === charId);
  if (!contact || !payer) throw new Error('找不到亲密付角色，无法发送互动消息。');
  appendIntimatePayMessage(contact, payer.note, title, amount);
};
