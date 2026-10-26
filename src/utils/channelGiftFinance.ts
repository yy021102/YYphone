import { readAlipayData, writeAlipayData, type AlipayData } from './alipayData';

export interface ChannelGiftPayment {
  eventId: string;
  direction: 'sent' | 'received';
  amount: number;
}

const cents = (value: number) => Math.round(value * 100);

/** Settle a virtual gift once without adding it to the user's real-life ledger. */
export const settleChannelGiftPayment = (payment: ChannelGiftPayment): { balance: number; duplicate: boolean; previous?: AlipayData } => {
  if (!payment.eventId || !Number.isFinite(payment.amount) || payment.amount <= 0 ||
    !Number.isSafeInteger(cents(payment.amount)) || Math.abs(cents(payment.amount) - payment.amount * 100) > 0.000001) {
    throw new Error('礼物金额无效。');
  }
  const account = readAlipayData();
  if (account.channelGiftSettlements?.[payment.eventId]) return { balance: account.balance, duplicate: true };
  const balanceCents = cents(account.balance);
  const amountCents = cents(payment.amount);
  if (payment.direction === 'sent' && balanceCents < amountCents) {
    throw new Error(`支付宝余额不足，当前余额 ¥${account.balance.toFixed(2)}。`);
  }
  const next: AlipayData = {
    ...account,
    balance: (balanceCents + (payment.direction === 'sent' ? -amountCents : amountCents)) / 100,
    channelGiftSettlements: { ...account.channelGiftSettlements, [payment.eventId]: payment.direction },
  };
  writeAlipayData(next);
  if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('yyphone:finance-change'));
  return { balance: next.balance, duplicate: false, previous: account };
};
