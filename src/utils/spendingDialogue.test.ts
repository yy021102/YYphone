import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { ALIPAY_STORAGE_KEY, chargeAlipay, emptyAlipayData, intimatePayAwareness, readAlipayData, writeAlipayData } from './alipayData';
import { buildPrompt } from './buildPrompt';
import { generatePhoneScope } from './phoneAi';
import { settleOutgoingTransfer } from './outgoingTransfer';
import { CHAT_COMMUNICATION_RULES } from './chatCommunication';
import { readPhoneVisits } from './phoneVisits';
import type { CharacterPhoneData } from '../apps/PhoneExplorerApp';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  setTimeout, clearTimeout, dispatchEvent: () => true, localStorage: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null, get length() { return storage.size; },
  },
} });
const get = (key: string) => JSON.parse(readStorageString(key) ?? 'null');
const previous = (): CharacterPhoneData => ({ charId: 'a', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [],
  browserHistory: [], notes: [], icityDiaries: [], agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] },
  wallet: { balance: 1000, records: [{ id: 'existing', title: '旧记录', amount: -10, timeStr: '昨天' }], updatedAt: '2026-11-01T10:00:00Z' } });
const context = { charId: 'a', charName: '林渡', userName: '玩家', npcs: [] };
const chat = (id: string, participantIds: string[], type = 'direct') => ({
  id, type, participantIds, activeArchiveId: 'one', noteName: '', context: '', messages: [], avatars: {},
});
beforeEach(async () => {
  await clearDbStorage();
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts': [{ id: 'a', name: '林渡', persona: '经济宽裕，说话有自己的节奏', worldBooks: [] },
      { id: 'b', name: '时予', persona: '不同角色', worldBooks: [] }],
    'yyphone:wechat-chats': [chat('chat-a', ['a']), chat('chat-b', ['b']), chat('group', ['a', 'b'], 'group')],
    'yyphone:api-presets': [{ id: 'api', name: '本地测试', endpoint: 'http://127.0.0.1:39123/v1', apiKey: 'fixture' }],
    [ALIPAY_STORAGE_KEY]: { ...emptyAlipayData(), balance: 100, intimateCards: [
      { id: 'card', charId: 'a', charName: '林渡', monthlyLimit: 1000, usedAmount: 0, note: '不用为小事客气' },
    ] },
  });
});
afterEach(() => mock.restoreAll());

test('recent visits refresh independently, replace old visits and reject incomplete generations', async () => {
  const prev = previous();
  prev.photos = [{ id: 'photo', isPrivate: false, location: '书店', dateStr: '昨天', sceneDesc: '窗边摆着旧书。', charThought: '下次再来。' },
    { id: 'private', isPrivate: true, location: '私密地点', dateStr: '昨天', sceneDesc: '秘密', charThought: '' }];
  assert.deepEqual(readPhoneVisits(prev).map(visit => [visit.location, visit.detail, visit.note]), [['书店', '窗边摆着旧书。', '下次再来。']]);
  let visits: unknown[] = Array.from({ length: 3 }, (_, i) => ({ location: `街角小店${i}`, dateStr: '11月8日',
    timeStr: '16:20', duration: '半小时', companion: '独自', activity: '买晚饭', detail: '站在门口等刚出锅的饼。', note: '还是这家的好吃。' }));
  let prompt = '';
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    prompt = String(init?.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ visits }) } }] });
  });
  const original = JSON.stringify(prev);
  const result = await generatePhoneScope('maps', context, prev);
  assert.equal(result.visits?.length, 3);
  assert.equal(result.visits?.[0].detail, '站在门口等刚出锅的饼。');
  assert.equal(result.photos, undefined, 'visits refresh must not replace the album');
  assert.equal(readPhoneVisits({ ...prev, ...result }).length, 3, 'new visits replace the photo fallback');
  const second = await generatePhoneScope('maps', context, { ...prev, ...result });
  assert.equal(readPhoneVisits({ ...prev, ...second }).length, 3, 'refresh does not accumulate old visits');
  assert.match(prompt, /不编造玩家的同行/);
  visits = [{ location: '空记录' }];
  await assert.rejects(generatePhoneScope('maps', context, prev), /原记录未改动/);
  assert.equal(JSON.stringify(prev), original);
});

test('wallet refresh replaces the recent snapshot instead of accumulating old records', async () => {
  let prompt = '';
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    prompt = String(init?.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ balance: 900,
      records: Array.from({ length: 6 }, (_, index) => ({ title: `日常收支${index}`, amount: index ? -12 : 60, timeStr: '今天 12:00' })),
    }) } }] });
  });
  const prev = previous(), original = JSON.stringify(prev);
  const result = await generatePhoneScope('wallet', context, prev);
  assert.equal(result.wallet?.records.length, 6);
  assert.equal(result.wallet?.records.some(record => record.id === 'existing'), false);
  assert.equal(result.wallet?.balance, 900);
  const refreshed = await generatePhoneScope('wallet', context, { ...prev, ...result });
  assert.equal(refreshed.wallet?.records.length, 6);
  assert.equal(refreshed.wallet?.balance, 900);
  assert.equal(JSON.stringify(prev), original);
  assert.match(prompt, /恰好 6 条/);
  assert.match(prompt, /已计入的交易不能再次加减/);
  assert.match(prompt, /替换上次列表/);
  assert.doesNotMatch(prompt, /新增 5~8/);
});
test('wallet rejects five, seven and malformed records without replacing existing money or history', async () => {
  let records: unknown[] = [];
  mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: JSON.stringify({ balance: 900, records }) } }] }));
  const prev = previous(), original = JSON.stringify(prev);
  for (const length of [0, 5, 7]) {
    records = Array.from({ length }, () => ({ title: '午饭', amount: -20, timeStr: '今天' }));
    await assert.rejects(generatePhoneScope('wallet', context, prev), /恰好 6 条/);
  }
  for (const invalid of [{ amount: 0 }, { amount: 0.001 }, { amount: Number.MAX_VALUE }, { title: '' }, { timeStr: '' }, { amount: '20' }]) {
    records = Array.from({ length: 6 }, () => ({ title: '午饭', amount: -20, timeStr: '今天', ...invalid }));
    await assert.rejects(generatePhoneScope('wallet', context, prev), /有效收支/);
  }
  assert.equal(JSON.stringify(prev), original);
});
test('intimate spending saves payer awareness with the charge but never fabricates a character message', () => {
  const originalChats = readStorageString('yyphone:wechat-chats');
  const paid = chargeAlipay(18, '淘宝 · 奶茶 [自购]', { type: 'intimate', charId: 'a' }, { recordLedger: false });
  assert.equal(paid.data.balance, 100);
  assert.equal(paid.data.intimateCards[0].usedAmount, 18);
  assert.equal(paid.data.ledgerList.length, 0, 'payer awareness is independent of personal bookkeeping');
  assert.equal(readStorageString('yyphone:wechat-chats'), originalChats);
  assert.equal(readAlipayData().intimatePayReceipts?.length, 1);
  assert.equal(paid.intimatePayReceiptId, paid.data.intimatePayReceipts?.[0].id);
  const own = JSON.stringify(buildPrompt({ chatId: 'chat-a', currentInput: '在吗', timeAwarenessEnabled: false }));
  assert.match(own, /淘宝 · 奶茶/);
  assert.match(own, /可以知道却不说/);
  assert.match(own, /不是必须回应的待办/);
  assert.match(own, /不能仅凭消费就认定已和好/);
  for (const chatId of ['chat-b', 'group']) assert.doesNotMatch(JSON.stringify(buildPrompt({ chatId, currentInput: '在吗', timeAwarenessEnabled: false })), /淘宝 · 奶茶/);
});
test('balance payments and failed intimate charges never create awareness; archives keep their receipts separate', () => {
  assert.equal(intimatePayAwareness(readAlipayData(), 'a'), '');
  chargeAlipay(10, '私人消费', { type: 'balance' });
  assert.equal(readAlipayData().intimatePayReceipts, undefined);
  assert.throws(() => chargeAlipay(1001, '未买到的物品', { type: 'intimate', charId: 'a' }), /额度不足/);
  assert.equal(readAlipayData().intimatePayReceipts, undefined);
  chargeAlipay(12, '本存档消费', { type: 'intimate', charId: 'a' });
  const chats = get('yyphone:wechat-chats'); chats[0].activeArchiveId = 'two';
  writeStoredValue('yyphone:wechat-chats', chats);
  assert.equal(intimatePayAwareness(readAlipayData(), 'a'), '');
  const prompt = JSON.stringify(buildPrompt({ chatId: 'chat-a', currentInput: '在吗', timeAwarenessEnabled: false }));
  assert.doesNotMatch(prompt, /本存档消费/);
});
test('refunded intimate transfers preserve the historical charge but tell the payer the money was returned', () => {
  const paid = chargeAlipay(20, '微信转账', { type: 'intimate', charId: 'a' });
  const refunded = settleOutgoingTransfer(paid.data, { id: 'transfer', senderId: 'user', recipientId: 'b', kind: 'transfer',
    amount: '20', payerId: 'a', intimatePayReceiptId: paid.intimatePayReceiptId, createdAt: new Date().toISOString(), paymentStatus: 'pending' }, 'returned', 'b');
  writeAlipayData(refunded);
  assert.equal(readAlipayData().intimateCards[0].usedAmount, 0);
  assert.match(intimatePayAwareness(readAlipayData(), 'a'), /已原路退回亲密付/);
});
test('intimate receipt normalization preserves valid refunds and rejects invalid refund dates', () => {
  const paid = chargeAlipay(20, '微信转账', { type: 'intimate', charId: 'a' });
  const receipt = paid.data.intimatePayReceipts![0];
  writeStoredValue(ALIPAY_STORAGE_KEY, { ...paid.data, intimatePayReceipts: [{ ...receipt, refundedAt: 'not-a-date' }] });
  assert.deepEqual(readAlipayData().intimatePayReceipts, []);
  writeAlipayData(paid.data);
  assert.equal(readAlipayData().intimatePayReceipts?.[0].id, receipt.id);
});
test('dialogue guidance allows contextual mirroring without requiring it or erasing personality and serious context', () => {
  const prompt = buildPrompt({ chatId: 'chat-a', currentInput: '111', timeAwarenessEnabled: false }).map(message => message.content).join('\n');
  assert.ok(prompt.includes(CHAT_COMMUNICATION_RULES));
  for (const rule of [/选择性镜像/, /不是每轮都镜像/, /不固定反义词配对/, /若是数量、工作信息或严肃求助，就照实际意思理解/, /已经讲完整件事/, /没有确立的关系不能/, /不用接梗打断/, /不临时编造创伤/]) assert.match(prompt, rule);
  assert.doesNotMatch(prompt, /禁止复述玩家的任何措辞/);
});
test('ordinary sharing carries grounded jealousy guidance in direct chats, groups and calls', () => {
  for (const chatId of ['chat-a', 'group']) {
    for (const callMode of [undefined, 'voice', 'video'] as const) {
      const input = '我刚买了无人机，准备周末去拍风景。';
      const prompt = buildPrompt({ chatId, currentInput: input, callMode, timeAwarenessEnabled: false });
      const system = prompt.filter(message => message.role === 'system').map(message => message.content).join('\n');
      assert.ok(system.includes(CHAT_COMMUNICATION_RULES));
      for (const rule of [/吃醋要有事实依据/, /角色确实知晓/, /不能凭空预设有人追求玩家/, /不是编造触发事件的许可/,
        /提到朋友、同事或异性不自动等于情敌/, /不通过假设、反问、威胁或“开个玩笑”绕过事实依据/,
        /同样约束 reply 和 thought/, /不在心声里另演一场无依据的争抢/]) assert.match(system, rule);
      assert.ok(prompt.at(-1)?.content.includes(input));
    }
  }
});
test('grounded jealousy guidance preserves explicit personality and events without making jealousy mandatory', () => {
  const contacts = get('pocketos:wechat-contacts');
  contacts[0].persona = '容易吃醋，但通常克制，会先弄清事实。';
  writeStoredValue('pocketos:wechat-contacts', contacts);
  const chats = get('yyphone:wechat-chats');
  chats[0].context = '昨晚玩家明确告诉林渡：前任提出复合，玩家已经拒绝。';
  writeStoredValue('yyphone:wechat-chats', chats);
  const prompt = buildPrompt({ chatId: 'chat-a', currentInput: '我已经拒绝了，不想再联系。', timeAwarenessEnabled: false })
    .map(message => message.content).join('\n');
  assert.ok(prompt.includes(contacts[0].persona));
  assert.ok(prompt.includes(chats[0].context));
  assert.match(prompt, /具体事件、关系或明确触发条件/);
  assert.match(prompt, /确有触发也不必每次吃醋/);
  assert.match(prompt, /反应轻重取决于人设、实际关系和当前情境/);
  assert.match(prompt, /已否认、澄清或解决的事，不反复拿来试探/);
});
