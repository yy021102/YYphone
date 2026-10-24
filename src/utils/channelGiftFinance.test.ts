import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { emptyAlipayData, readAlipayData, writeAlipayData } from './alipayData';
import { settleChannelGiftPayment } from './channelGiftFinance';

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, dispatchEvent: () => true } });

test('Channels gifts change virtual balance once without changing real-life ledger', async () => {
  await clearDbStorage();
  writeAlipayData({ ...emptyAlipayData(), balance: 20,
    ledgerList: [{ id: 'real-expense', title: '午饭', amount: 12, isExpense: true, date: '2026-10-25', time: '12:00' }] });
  const sent = { eventId: 'gift-1', direction: 'sent' as const, amount: 6 };
  assert.equal(settleChannelGiftPayment(sent).balance, 14);
  assert.equal(settleChannelGiftPayment(sent).duplicate, true);
  assert.equal(readAlipayData().balance, 14);
  assert.equal(readAlipayData().channelGiftSettlements?.['gift-1'], 'sent');
  assert.deepEqual(readAlipayData().ledgerList.map((item) => item.id), ['real-expense']);
  assert.throws(() => settleChannelGiftPayment({ ...sent, eventId: 'too-expensive', amount: 99 }), /余额不足/);

  const received = { eventId: 'gift-2', direction: 'received' as const, amount: 18 };
  assert.equal(settleChannelGiftPayment(received).balance, 32);
  assert.equal(settleChannelGiftPayment(received).duplicate, true);
  assert.equal(readAlipayData().balance, 32);
  assert.equal(readAlipayData().channelGiftSettlements?.['gift-2'], 'received');
  assert.deepEqual(readAlipayData().ledgerList.map((item) => item.id), ['real-expense']);
});

test('old gift ledger rows migrate to settlement markers without changing balance', async () => {
  await clearDbStorage();
  writeAlipayData({ ...emptyAlipayData(), balance: 42, ledgerList: [
    { id: 'channel-gift-old', title: '旧礼物', amount: 6, isExpense: true, date: '2026-10-25', time: '12:00' },
    { id: 'real-income', title: '工资', amount: 100, isExpense: false, date: '2026-10-25', time: '12:00' },
  ] });
  const migrated = readAlipayData();
  assert.equal(migrated.balance, 42);
  assert.deepEqual(migrated.ledgerList.map((item) => item.id), ['real-income']);
  assert.equal(migrated.channelGiftSettlements?.old, 'sent');
  assert.equal(settleChannelGiftPayment({ eventId: 'old', direction: 'sent', amount: 6 }).duplicate, true);
  assert.equal(readAlipayData().balance, 42);
});
