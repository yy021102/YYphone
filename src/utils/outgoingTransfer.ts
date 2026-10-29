import { type AlipayData } from './alipayData';

export interface OutgoingTransfer {
  id: string; senderId: string; kind?: string; recipientId?: string; amount?: string;
  payerId?: string; createdAt: string; paymentStatus?: 'pending' | 'received' | 'returned';
}
export type TransferAction = { messageId: string; action: 'received' | 'returned' };

export function parseTransferActions(value: unknown, payments: OutgoingTransfer[], actorId: string, defaultRecipientId?: string): TransferAction[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error('转账处理动作格式无效。');
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.messageId !== 'string' ||
      !['received', 'returned'].includes(item.action) || seen.has(item.messageId)) throw new Error('转账处理动作无效或重复。');
    seen.add(item.messageId);
    const payment = payments.find(payment => payment.id === item.messageId);
    if (!payment || payment.kind !== 'transfer' || payment.senderId !== 'user' ||
      (payment.recipientId ?? defaultRecipientId) !== actorId ||
      (payment.paymentStatus && payment.paymentStatus !== 'pending')) throw new Error('角色只能处理发给自己、尚未收取的转账。');
    return { messageId: item.messageId, action: item.action };
  });
}

/** A refund reverses the original source; receiving an outgoing transfer never credits the player. */
export function settleOutgoingTransfer(data: AlipayData, payment: OutgoingTransfer, action: TransferAction['action'], actorId: string, defaultRecipientId?: string): AlipayData {
  parseTransferActions([{ messageId: payment.id, action }], [payment], actorId, defaultRecipientId);
  if (data.chatSettlements?.[payment.id]) throw new Error('这笔转账已处理，不能重复收取或退还。');
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 1_000_000) throw new Error('转账金额无效。');
  const refund = action === 'returned';
  const paidAt = new Date(payment.createdAt);
  const now = new Date();
  const sameMonth = paidAt.getFullYear() === now.getFullYear() && paidAt.getMonth() === now.getMonth();
  return {
    ...data,
    balance: Math.round((data.balance + (refund && !payment.payerId ? amount : 0)) * 100) / 100,
    intimateCards: refund && payment.payerId && sameMonth ? data.intimateCards.map(card => card.charId === payment.payerId
      ? { ...card, usedAmount: Math.round(Math.max(0, card.usedAmount - amount) * 100) / 100 } : card) : data.intimateCards,
    chatSettlements: { ...data.chatSettlements, [payment.id]: action },
  };
}
