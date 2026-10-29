import { type XianyuProduct, type XianyuChatThread } from '../apps/TaobaoApp';
import { type AlipayData } from './alipayData';

export function canBuyXianyuItem(item: XianyuProduct | undefined): boolean {
  return !!item && !item.isPlayerItem && !item.soldToThreadId;
}

export function isSelfXianyuThread(thread: XianyuChatThread, items: XianyuProduct[]): boolean {
  const item = items.find(item => item.id === thread.itemId);
  return !!thread.isPlayerItem && !thread.buyerId && !thread.linkedCharId &&
    (thread.peerName === item?.sellerName || thread.peerName === '玩家');
}

export interface XianyuBuyer { buyerId: string; name: string; message: string; buy: boolean }
export function parseXianyuBuyers(value: unknown, allowedIds: string[], sellerName: string): XianyuBuyer[] {
  if (!value || typeof value !== 'object' || !('buyers' in value) || !Array.isArray(value.buyers)) throw new Error('买家咨询格式无效，请重试。');
  const seen = new Set<string>();
  const buyers = value.buyers.map((entry): XianyuBuyer => {
    if (!entry || typeof entry.buyerId !== 'string' || !allowedIds.includes(entry.buyerId) || seen.has(entry.buyerId) ||
      typeof entry.name !== 'string' || !entry.name.trim() || entry.name.trim() === sellerName ||
      typeof entry.message !== 'string' || !entry.message.trim() || typeof entry.buy !== 'boolean') throw new Error('买家身份或咨询内容无效，请重试。');
    seen.add(entry.buyerId);
    return { buyerId: entry.buyerId, name: entry.name.trim().slice(0, 40), message: entry.message.trim().slice(0, 1000), buy: entry.buy };
  });
  if (buyers.length !== allowedIds.length) throw new Error('买家咨询不完整，请重试。');
  if (buyers.filter(buyer => buyer.buy).length > 1) throw new Error('同一件商品只能由一位买家拍下，请刷新买家。');
  return buyers;
}

export function settleXianyuSale(item: XianyuProduct, thread: XianyuChatThread, data: AlipayData, now = new Date()) {
  if (!item.isPlayerItem || !thread.isPlayerItem || !thread.buyerId || thread.buyerId === 'user' || thread.peerName === item.sellerName || thread.itemId !== item.id) throw new Error('买卖双方身份无效，无法成交。');
  if (item.soldToThreadId || data.ledgerList.some(entry => entry.id === `xianyu-sale-${item.id}`)) throw new Error('这件商品已经售出。');
  if (!Number.isFinite(item.price) || item.price < 0 || item.price > 1_000_000) throw new Error('商品价格无效。');
  const amount = Math.round(item.price * 100) / 100;
  return {
    item: { ...item, soldToThreadId: thread.id, soldAt: now.toISOString() },
    finance: {
      ...data, balance: Math.round((data.balance + amount) * 100) / 100,
      ledgerList: [{ id: `xianyu-sale-${item.id}`, title: `闲鱼卖出 · ${item.title} · ${thread.peerName}`, amount,
        isExpense: false, date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        time: now.toTimeString().slice(0, 5), category: '闲鱼收入' }, ...data.ledgerList],
    },
  };
}
