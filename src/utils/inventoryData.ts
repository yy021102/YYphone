import { readStorageString, readStoredValue, writeStoredValue } from './localStorage';
import { readOfflineContacts } from './offlineData';

export const INVENTORY_KEY = 'yyphone:inventory';

export interface InventoryItem {
  id: string;
  /** gift = 角色送的；purchase = 自己买的 */
  kind: 'gift' | 'purchase';
  title: string;
  desc: string;
  emoji: string;
  imageUrl?: string;
  price?: number;
  fromCharId?: string;
  fromCharName?: string;
  shop?: string;
  acquiredAt: string;
}

interface InventoryStore {
  items: InventoryItem[];
  /** 是否已经从微信聊天里的订单卡片补录过历史 */
  backfilled: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isStore = (value: unknown): value is InventoryStore =>
  isRecord(value) && Array.isArray(value.items) && typeof value.backfilled === 'boolean';

const readStore = (): InventoryStore =>
  readStoredValue(INVENTORY_KEY, { items: [], backfilled: false } as InventoryStore, isStore);

const writeStore = (store: InventoryStore) => writeStoredValue(INVENTORY_KEY, store);

const newId = () => `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** 第一次使用时，从微信里已有的订单卡片补录历史（角色送的商品 + 自己买并通知了角色的商品），外卖不计入。 */
const backfillFromChats = (store: InventoryStore): InventoryStore => {
  if (store.backfilled) return store;
  const items = [...store.items];
  try {
    const chats: unknown = JSON.parse(readStorageString('yyphone:wechat-chats') ?? '[]');
    const contacts = readOfflineContacts();
    if (Array.isArray(chats)) {
      for (const chat of chats) {
        if (!isRecord(chat) || !Array.isArray(chat.messages)) continue;
        for (const message of chat.messages) {
          if (!isRecord(message) || message.kind !== 'order' || typeof message.id !== 'string') continue;
          const category = message.orderCategory;
          if (category !== 'shopping' && category !== 'xianyu') continue;
          const fromUser = message.senderId === 'user';
          const isGift = !fromUser && message.orderMode === 'gift';
          const isSelfPurchase = fromUser && message.orderMode === 'self';
          if (!isGift && !isSelfPurchase) continue;
          const price = Number(message.amount);
          const sender = typeof message.senderId === 'string' ? message.senderId : '';
          items.push({
            id: `inv-msg-${message.id}`,
            kind: isGift ? 'gift' : 'purchase',
            title: typeof message.title === 'string' && message.title ? message.title : String(message.text ?? '物品'),
            desc: typeof message.content === 'string' ? message.content : '',
            emoji: typeof message.productEmoji === 'string' ? message.productEmoji : isGift ? '🎁' : '🛍️',
            ...(typeof message.imageUrl === 'string' && message.imageUrl ? { imageUrl: message.imageUrl } : {}),
            ...(Number.isFinite(price) && price > 0 ? { price } : {}),
            ...(isGift && sender ? { fromCharId: sender, fromCharName: contacts.find((c) => c.id === sender)?.name } : {}),
            shop: category === 'xianyu' ? '闲鱼' : '淘宝',
            acquiredAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString(),
          });
        }
      }
    }
  } catch (error) {
    console.warn('Could not backfill inventory from chats.', error);
  }
  const next = { items, backfilled: true };
  writeStore(next);
  return next;
};

export const readInventory = (): InventoryItem[] =>
  [...backfillFromChats(readStore()).items].sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));

export const addInventoryItem = (item: Omit<InventoryItem, 'id' | 'acquiredAt'> & { acquiredAt?: string }) => {
  const store = backfillFromChats(readStore());
  writeStore({
    ...store,
    items: [...store.items, { ...item, id: newId(), acquiredAt: item.acquiredAt ?? new Date().toISOString() }],
  });
};

export const removeInventoryItem = (id: string) => {
  const store = readStore();
  writeStore({ ...store, items: store.items.filter((item) => item.id !== id) });
};
