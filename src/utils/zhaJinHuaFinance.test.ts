import assert from 'node:assert/strict';
import test from 'node:test';

test('支付宝买入与结算各只入账一次', async () => {
  const values = new Map<string, string>();
  const localStorage = {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  Object.assign(globalThis, { window: { localStorage, dispatchEvent: () => true } });
  const { initializeDbStorage } = await import('./dbStorage');
  await initializeDbStorage();
  const { emptyAlipayData, readAlipayData, writeAlipayData } = await import('./alipayData');
  const { pokerLedger } = await import('./zhaJinHuaFinance');
  writeAlipayData({ ...emptyAlipayData(), balance: 100 });
  assert.equal(pokerLedger('test-zjh-unique', 'buy-in', 20), 80);
  assert.equal(pokerLedger('test-zjh-unique', 'buy-in', 20), 80);
  assert.equal(pokerLedger('test-zjh-unique', 'payout', 35), 115);
  assert.equal(pokerLedger('test-zjh-unique', 'payout', 35), 115);
  assert.equal(readAlipayData().ledgerList.filter(item => item.id.startsWith('test-zjh-unique')).length, 2);
});
