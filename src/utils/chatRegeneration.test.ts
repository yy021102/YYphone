import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { buildPrompt } from './buildPrompt';
import { requestChatReply, withChatResponseFormat } from './chatReply';
import { canGenerateChatPayment, chatPaymentGenerationInstructions, regeneratedReplyBatch, regeneratedReplyIds, regenerationMessages, regenerationPaymentStamp, retainSettledReplyPayment, settledReplyPaymentIds } from './chatRegeneration';
import { emptyAlipayData, readAlipayData, settleIncomingChatPayment, writeAlipayData } from './alipayData';

const values = new Map<string, string>();
const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; } };
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, setTimeout, clearTimeout } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
const user = { id: 'user', senderId: 'user', text: '给我转一点钱好吗', createdAt: '2026-11-01T10:00:00Z' };
const pending = { id: 'old-transfer', senderId: 'a', replyBatchId: 'old-batch', text: 'ABANDONED_TRANSFER_NOTE', thought: 'ABANDONED_TRANSFER_THOUGHT', kind: 'transfer', recipientId: 'user', amount: '998.01', paymentStatus: 'pending' as const, createdAt: '2026-11-01T10:01:00Z' };
const text = { id: 'old-text', senderId: 'a', replyBatchId: 'old-batch', text: 'ABANDONED_TRANSFER_REPLY', thought: 'ABANDONED_TRANSFER_THOUGHT', createdAt: '2026-11-01T10:01:01Z' };
interface TestMessage {
  id: string; senderId: string; text: string; createdAt: string; thought?: string; kind?: string;
  replyBatchId?: string; amount?: string; recipientId?: string; paymentStatus?: 'pending' | 'received' | 'returned';
  packetClaims?: Array<{ recipientId: string; amount: string; claimed: boolean }>;
}
const messages = (): TestMessage[] => [{ id: 'older', senderId: 'a', text: 'OLDER_KEPT', thought: 'OLDER_THOUGHT', createdAt: '2026-11-01T09:00:00Z' }, user, pending, text];
const chat = (items: any[] = messages()) => ({ id: 'chat', type: 'direct', participantIds: ['a'], noteName: '', context: '', includeLatestThought: true, messages: items });
beforeEach(async () => { await clearDbStorage(); writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '', worldBooks: [] }]); writeStoredValue('yyphone:wechat-chats', [chat()]); writeAlipayData({ ...emptyAlipayData(), balance: 10 }); });
afterEach(() => mock.restoreAll());

test('an unsettled transfer is replaced with the whole prior batch and is absent from prompt, hidden thought and current history', () => {
  const before = readStorageString('yyphone:wechat-chats');
  assert.deepEqual([...regeneratedReplyIds(messages())], ['old-transfer', 'old-text']);
  const body = JSON.stringify(buildPrompt({ chatId: 'chat', regenerate: true, structuredHistory: true }));
  assert(!body.includes('ABANDONED_')); assert(!body.includes('998.01')); assert(body.includes('OLDER_KEPT')); assert(body.includes(user.text));
  assert.equal(readStorageString('yyphone:wechat-chats'), before);
  assert.equal(canGenerateChatPayment(false, true), true);
  assert(!chatPaymentGenerationInstructions(false, true).includes('不得再次'));
});

test('received, returned and legacy payments survive reroll, while the abandoned speech and thoughts are excluded', () => {
  for (const paymentStatus of ['received', 'returned', undefined] as const) {
    const items: TestMessage[] = [user, { ...pending, paymentStatus }, text];
    const protectedIds = settledReplyPaymentIds(items); assert(protectedIds.has(pending.id));
    assert.deepEqual([...regeneratedReplyIds(items)], [text.id]);
    const view = regenerationMessages(items); assert.equal(view.length, 2); assert.equal(view[1].thought, undefined);
    writeStoredValue('yyphone:wechat-chats', [chat(items)]);
    const body = JSON.stringify(buildPrompt({ chatId: 'chat', regenerate: true }));
    assert(body.includes('998.01')); assert(!body.includes(text.text)); assert(!body.includes(pending.thought));
    assert.equal(canGenerateChatPayment(false, true, protectedIds.size), false);
  }
});

test('actual settlement ledger and partially claimed group packets are protected even when the card still says pending', () => {
  const ledger = { [pending.id]: 'received' as const };
  assert.deepEqual([...regeneratedReplyIds(messages(), ledger)], [text.id]);
  const view = regenerationMessages(messages(), ledger); assert.equal(view.find(m => m.id === pending.id)?.paymentStatus, 'received');
  writeAlipayData({ ...readAlipayData(), chatSettlements: ledger });
  const body = JSON.stringify(buildPrompt({ chatId: 'chat', regenerate: true })); assert(body.includes('已收款')); assert(!body.includes('待确认收款'));
  const packet = { ...pending, kind: 'red-packet', packetClaims: [{ recipientId: 'b', amount: '1.00', claimed: true }, { recipientId: 'user', amount: '2.00', claimed: false }] };
  assert.equal(settledReplyPaymentIds([user, packet]).size, 1);
  assert.equal(settledReplyPaymentIds([user, { ...packet, packetClaims: packet.packetClaims.map(c => ({ ...c, claimed: false })) }]).size, 0);
});

test('successful pending reroll makes a fresh payable card without changing balance or leaving the old payable ID', () => {
  const original = messages(), removed = regeneratedReplyIds(original);
  const replacement = { ...pending, id: 'new-transfer', amount: '2.50', replyBatchId: 'new-batch', text: '喝点喜欢的' };
  const next = [...original.filter(m => !removed.has(m.id)), replacement];
  assert(!next.some(m => m.id === pending.id)); assert.equal(readAlipayData().balance, 10);
  const settled = settleIncomingChatPayment(readAlipayData(), replacement, 'received'); assert.equal(settled.balance, 12.5);
  assert.deepEqual(settled.chatSettlements, { [replacement.id]: 'received' });
  assert.throws(() => settleIncomingChatPayment(settled, replacement, 'received'), /已处理/);
});

test('repeated rerolls retain the same settled transaction in the replacement batch and never re-credit money', () => {
  let items: TestMessage[] = messages().map(m => m.id === pending.id ? { ...m, paymentStatus: 'received' as const } : m);
  writeAlipayData(settleIncomingChatPayment(readAlipayData(), pending, 'received'));
  const balance = readAlipayData().balance;
  for (let turn = 0; turn < 3; turn++) {
    const protectedIds = settledReplyPaymentIds(items, readAlipayData().chatSettlements), removed = regeneratedReplyIds(items, readAlipayData().chatSettlements), batch = `replacement-${turn}`;
    assert.equal(protectedIds.size, 1); assert.equal(canGenerateChatPayment(false, true, protectedIds.size), false);
    items = [...items.filter(m => !removed.has(m.id)).map(m => retainSettledReplyPayment(m, protectedIds, batch, readAlipayData().chatSettlements)), { ...text, id: `new-text-${turn}`, replyBatchId: batch, text: `新的台词${turn}` }];
    assert.equal(items.filter(m => m.kind === 'transfer').length, 1); assert.equal(items.find(m => m.id === pending.id)?.thought, undefined); assert.equal(readAlipayData().balance, balance);
  }
  assert.equal(canGenerateChatPayment(false, false, 1), true, 'a later normal turn can still send a new payment');
  assert.equal(canGenerateChatPayment(true, false), false);
});

test('in-flight payment status, amount, removal and group claims changes invalidate the captured replacement plan', () => {
  const original = messages(), ids = new Set(regeneratedReplyBatch(original).map(m => m.id)), stamp = regenerationPaymentStamp(original, ids);
  assert.notEqual(regenerationPaymentStamp(original, ids, { [pending.id]: 'received' }), stamp);
  assert.notEqual(regenerationPaymentStamp(original.map(m => m.id === pending.id ? { ...m, amount: '123.00' } : m), ids), stamp);
  assert.notEqual(regenerationPaymentStamp(original.filter(m => m.id !== pending.id), ids), stamp);
  assert.notEqual(regenerationPaymentStamp(original.map(m => m.id === pending.id ? { ...m, packetClaims: [{ recipientId: 'user', amount: '1', claimed: true }] } : m), ids), stamp);
});

test('failed or canceled model calls do not remove pending cards or modify finances', async () => {
  const before = readStorageString('yyphone:wechat-chats'), finance = readStorageString('yyphone:alipay-data');
  const prompt = withChatResponseFormat(buildPrompt({ chatId: 'chat', regenerate: true }), chatPaymentGenerationInstructions(false, true));
  const api = { endpoint: 'https://regeneration.invalid/v1', apiKey: 'test', model: 'test' };
  mock.method(globalThis, 'fetch', async () => new Response('offline', { status: 503 }));
  await assert.rejects(requestChatReply(prompt, api, () => {}), /503/);
  assert.equal(readStorageString('yyphone:wechat-chats'), before); assert.equal(readStorageString('yyphone:alipay-data'), finance);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(requestChatReply(prompt, api, () => {}, undefined, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(readStorageString('yyphone:wechat-chats'), before);
});
