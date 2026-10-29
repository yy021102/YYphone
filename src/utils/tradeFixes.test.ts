import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyAlipayData } from './alipayData';
import { parseTransferActions, settleOutgoingTransfer } from './outgoingTransfer';
import { canBuyXianyuItem, isSelfXianyuThread, parseXianyuBuyers, settleXianyuSale } from './xianyuTrade';
import { buildPaymentDisplayMessages } from './chatPaymentDisplay';

const payment = { id: 'transfer-1', kind: 'transfer', senderId: 'user', recipientId: 'char', amount: '12.34',
  paymentStatus: 'pending' as const, createdAt: new Date().toISOString(), text: '给你' };
const listing = { id: 'listing', title: '旧相机', desc: '完好', emoji: '📷', sellerName: '小满', price: 25.5, freeShipping: true, isPlayerItem: true };
const thread = { id: 'buyer-thread', itemId: listing.id, itemTitle: listing.title, itemPrice: listing.price,
  peerName: '林渡', buyerId: 'char', linkedCharId: 'char', isPlayerItem: true, messages: [] };

test('a returned player transfer credits its original balance exactly once and shows a recipient receipt', () => {
  const before = { ...emptyAlipayData(), balance: 10 };
  const next = settleOutgoingTransfer(before, payment, 'returned', 'char');
  assert.equal(next.balance, 22.34); assert.equal(before.balance, 10);
  assert.throws(() => settleOutgoingTransfer(next, payment, 'returned', 'char'), /已处理/);
  assert.throws(() => settleOutgoingTransfer(next, payment, 'received', 'char'), /已处理/);
  const display = buildPaymentDisplayMessages([{ ...payment, paymentStatus: 'returned' as const }], 'char');
  assert.equal(display.length, 2); assert.equal(display[1].senderId, 'char'); assert.equal(display[1].paymentReceiptId, payment.id);
});
test('receiving player money changes settlement only, not player balance', () => {
  const before = { ...emptyAlipayData(), balance: 10 };
  const next = settleOutgoingTransfer(before, payment, 'received', 'char');
  assert.equal(next.balance, 10); assert.equal(next.chatSettlements?.[payment.id], 'received');
});
test('intimate-pay refund restores current-month usage without creating personal money', () => {
  const before = { ...emptyAlipayData(), balance: 10, intimateCards: [{ id: 'card', charId: 'payer', charName: 'A', monthlyLimit: 100, usedAmount: 50, note: '' }] };
  const next = settleOutgoingTransfer(before, { ...payment, payerId: 'payer' }, 'returned', 'char');
  assert.equal(next.balance, 10); assert.equal(next.intimateCards[0].usedAmount, 37.66);
  const old = settleOutgoingTransfer(before, { ...payment, payerId: 'payer', createdAt: '2020-01-01T00:00:00Z' }, 'returned', 'char');
  assert.equal(old.intimateCards[0].usedAmount, 50); assert.equal(old.balance, 10);
  assert.equal(settleOutgoingTransfer({ ...before, intimateCards: [] }, { ...payment, payerId: 'payer' }, 'returned', 'char').balance, 10);
});
test('transfer decisions reject other recipients, forged IDs, duplicate actions, invalid money and already-settled payments', () => {
  const action = { messageId: payment.id, action: 'returned' };
  assert.throws(() => parseTransferActions([action], [payment], 'other'), /自己/);
  assert.throws(() => parseTransferActions([{ ...action, messageId: 'forged' }], [payment], 'char'), /自己/);
  assert.throws(() => parseTransferActions([action, action], [payment], 'char'), /重复/);
  assert.throws(() => parseTransferActions([action], [{ ...payment, kind: 'red-packet' }], 'char'), /自己/);
  assert.throws(() => parseTransferActions([action], [{ ...payment, paymentStatus: 'received' }], 'char'), /自己/);
  for (const amount of ['NaN', '-1', '0', '1000001']) assert.throws(() => settleOutgoingTransfer(emptyAlipayData(), { ...payment, amount }, 'returned', 'char'), /金额/);
  assert.equal(parseTransferActions([action], [{ ...payment, recipientId: undefined, paymentStatus: undefined }], 'char', 'char').length, 1);
  assert.throws(() => parseTransferActions([action], [{ ...payment, recipientId: undefined }], 'char'), /自己/);
});
test('own and sold items cannot be bought and legacy self-chat threads are recognized', () => {
  assert.equal(canBuyXianyuItem(listing), false);
  assert.equal(canBuyXianyuItem(undefined), false);
  assert.equal(canBuyXianyuItem({ ...listing, isPlayerItem: false }), true);
  assert.equal(canBuyXianyuItem({ ...listing, isPlayerItem: false, soldToThreadId: 'sold' }), false);
  assert.equal(isSelfXianyuThread({ ...thread, buyerId: undefined, linkedCharId: undefined, peerName: listing.sellerName }, [listing]), true);
  assert.equal(isSelfXianyuThread(thread, [listing]), false);
});
test('a real buyer sale credits income once, rejects competitors and preserves original state', () => {
  const before = { ...emptyAlipayData(), balance: 10 };
  const sale = settleXianyuSale(listing, thread, before);
  assert.equal(sale.finance.balance, 35.5); assert.equal(sale.finance.ledgerList[0].isExpense, false);
  assert.equal(sale.item.soldToThreadId, thread.id); assert.equal(before.balance, 10);
  assert.throws(() => settleXianyuSale(sale.item, { ...thread, id: 'competitor' }, sale.finance), /售出/);
  // Even an old listing snapshot cannot duplicate the persisted sale income.
  assert.throws(() => settleXianyuSale(listing, thread, sale.finance), /售出/);
  assert.throws(() => settleXianyuSale(listing, { ...thread, buyerId: undefined }, before), /身份/);
  assert.throws(() => settleXianyuSale({ ...listing, isPlayerItem: false }, thread, before), /身份/);
});
test('buyer generation permits only distinct assigned identities, never seller self-purchase', () => {
  const buyer = { buyerId: 'char', name: '林渡', message: '还在吗', buy: false };
  assert.equal(parseXianyuBuyers({ buyers: [buyer] }, ['char'], listing.sellerName)[0].buy, false);
  assert.throws(() => parseXianyuBuyers({ buyers: [{ ...buyer, name: listing.sellerName }] }, ['char'], listing.sellerName), /身份/);
  assert.throws(() => parseXianyuBuyers({ buyers: [buyer, buyer] }, ['char'], listing.sellerName), /身份/);
  assert.throws(() => parseXianyuBuyers({ buyers: [{ ...buyer, buyerId: 'forged' }] }, ['char'], listing.sellerName), /身份/);
  assert.throws(() => parseXianyuBuyers({ buyers: [] }, ['char'], listing.sellerName), /不完整/);
});
