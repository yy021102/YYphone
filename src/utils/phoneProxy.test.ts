import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { activeMemoryArchive } from './memoryArchives';
import { CHECK_PHONE_STORAGE_KEY } from './phoneData';
import { PHONE_PROXY_EVENTS_KEY, pendingPhoneProxyEvents, pendingPhoneProxyMessage, phoneProxyInstructions,
  replyToPhoneProxyMessage, sendPhoneProxyMessage, validatePhoneProxyAcknowledgement } from './phoneProxy';
import { isVisibleChatMessage } from './chatHistory';
import { requestChatReply } from './chatReply';
import { regenerationMessages, retainSettledReplyPayment } from './chatRegeneration';
import { buildPrompt } from './buildPrompt';
import type { PhoneWeChatThread } from '../apps/PhoneExplorerApp';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  setTimeout, clearTimeout, localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null, get length() { return storage.size; },
  },
} });
const get = (key: string) => JSON.parse(readStorageString(key) ?? 'null');
const thread = (): PhoneWeChatThread => ({
  id: 'thread', targetId: 'npc', name: '小陈', remark: '同事小陈', avatarText: '陈', avatarBg: '#eee',
  messages: [{ id: 'old', sender: 'other', senderName: '小陈', text: '明天几点到公司', time: '10:00' }],
});
const chat = () => get('yyphone:wechat-chats')[0];
const phone = () => get(CHECK_PHONE_STORAGE_KEY).a;
const respond = (reply: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify({ reply }) } }] });
beforeEach(async () => {
  await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: 'OWNER_SECRET', worldBooks: [] }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'chat', type: 'direct', participantIds: ['a'], activeArchiveId: 'one',
    noteName: '', context: '', narratorEnabled: false, messages: [{ id: 'u', senderId: 'user', text: 'PRIVATE_PLAYER_CHAT', createdAt: new Date().toISOString() }] }]);
  writeStoredValue(CHECK_PHONE_STORAGE_KEY, { a: { charId: 'a', npcThreads: [thread()], wallpaperUrl: 'KEEP_WALLPAPER' } });
  writeStoredValue('yyphone:api-presets', [{ id: 'api', name: '本地测试', endpoint: 'http://127.0.0.1:39123/v1', apiKey: 'fixture' }]);
});
afterEach(() => mock.restoreAll());

test('looking at a phone never creates awareness; actual send saves message, silent note and durable receipt together', async () => {
  assert.deepEqual(pendingPhoneProxyEvents(chat().messages, 'a'), []);
  assert.equal(phoneProxyInstructions([]), '');
  const sent = await sendPhoneProxyMessage('a', 'thread', '  今天一起吃午饭吗  ', '玩家');
  assert.equal(sent.thread.messages.at(-1)?.text, '今天一起吃午饭吗');
  assert.equal(pendingPhoneProxyMessage(sent.thread)?.id, sent.messageId);
  assert.equal(phone().wallpaperUrl, 'KEEP_WALLPAPER');
  const note = chat().messages.at(-1);
  assert.equal(isVisibleChatMessage(note), false);
  assert.match(note.aiContext, /不是林渡本人主动说的话/);
  assert.equal(get(PHONE_PROXY_EVENTS_KEY).length, 1);
  assert.equal(pendingPhoneProxyEvents([], 'a').length, 1, 'receipt survives a stale chat write');
  assert.equal(pendingPhoneProxyEvents([], 'someone-else').length, 0);
  assert.match(phoneProxyInstructions(pendingPhoneProxyEvents(chat().messages, 'a')), /必须知情并提及/);
});

test('NPC receives only its own conversation, can be oblivious or suspicious, and retry never resends', async () => {
  const sent = await sendPhoneProxyMessage('a', 'thread', '我们今天吃火锅吧', '玩家');
  let prompt = '';
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    prompt = String(init?.body);
    return respond(['好啊，还是老地方？', '你今天怎么突然这么积极']);
  });
  const updated = await replyToPhoneProxyMessage('a', 'thread', sent.messageId, sent.archiveKey, new AbortController().signal);
  assert.equal(updated.messages.length, 4);
  assert.equal(updated.messages.filter(message => message.byPlayer).length, 1);
  assert.equal(updated.messages.at(-1)?.replyToProxyId, sent.messageId);
  assert.equal(pendingPhoneProxyMessage(updated), undefined);
  assert.match(prompt, /明天几点到公司/);
  assert.doesNotMatch(prompt, /OWNER_SECRET|PRIVATE_PLAYER_CHAT|byPlayer|proxyArchiveKey|phone-proxy-/);
  assert.match(chat().messages.at(-1).aiContext, /好啊，还是老地方/);
  assert.match(get(PHONE_PROXY_EVENTS_KEY)[0].detail, /你今天怎么突然这么积极/);
  await assert.rejects(replyToPhoneProxyMessage('a', 'thread', sent.messageId, sent.archiveKey, new AbortController().signal), /已回复/);
});

test('malformed, canceled and stale NPC replies preserve the sent message and owner awareness', async () => {
  const sent = await sendPhoneProxyMessage('a', 'thread', '你好呀', '玩家');
  const fetch = mock.method(globalThis, 'fetch', async () => respond([]));
  await assert.rejects(replyToPhoneProxyMessage('a', 'thread', sent.messageId, sent.archiveKey, new AbortController().signal), /格式不完整/);
  assert.equal(phone().npcThreads[0].messages.length, 2);
  assert.equal(pendingPhoneProxyEvents(chat().messages, 'a').length, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(replyToPhoneProxyMessage('a', 'thread', sent.messageId, sent.archiveKey, controller.signal), /abort/i);
  fetch.mock.mockImplementation(async () => {
    const phones = get(CHECK_PHONE_STORAGE_KEY);
    phones.a.npcThreads[0].messages.push({ id: 'newer', sender: 'other', senderName: '小陈', text: '更新内容', time: '12:00' });
    writeStoredValue(CHECK_PHONE_STORAGE_KEY, phones);
    return respond(['不能写入的旧回复']);
  });
  await assert.rejects(replyToPhoneProxyMessage('a', 'thread', sent.messageId, sent.archiveKey, new AbortController().signal), /过期回复/);
  assert.doesNotMatch(JSON.stringify(phone()), /不能写入/);
});

test('invalid sends and failed storage cannot save a message without its awareness receipt', async () => {
  const before = JSON.stringify([...storage]);
  await assert.rejects(sendPhoneProxyMessage('a', 'thread', ' ', '玩家'), /1～500/);
  await assert.rejects(sendPhoneProxyMessage('a', 'thread', '字'.repeat(501), '玩家'), /1～500/);
  await assert.rejects(sendPhoneProxyMessage('missing', 'thread', '你好', '玩家'), /已变化/);
  assert.equal(JSON.stringify([...storage]), before);
  const original = window.localStorage.setItem.bind(window.localStorage);
  mock.method(window.localStorage, 'setItem', (key: string, value: string) => {
    if (key === PHONE_PROXY_EVENTS_KEY) throw new Error('test quota');
    original(key, value);
  });
  await assert.rejects(sendPhoneProxyMessage('a', 'thread', '不能单独保存', '玩家'), /test quota/);
  assert.equal(phone().npcThreads[0].messages.length, 1);
  assert.equal(chat().messages.length, 1);
});

test('owner acknowledgement is visible speech, persists on successful reply, and is required again on reroll', async () => {
  const sent = await sendPhoneProxyMessage('a', 'thread', '吃饭吗', '玩家');
  const targets = ['小陈'];
  for (const result of [{ reply: ['今天好吗'], thought: '你用我的手机给小陈发消息了' },
    { reply: [{ kind: 'narration', text: '你用我的手机给小陈发消息了' }] }]) {
    assert.throws(() => validatePhoneProxyAcknowledgement(result, targets), /必须/);
  }
  validatePhoneProxyAcknowledgement({ reply: ['你用我的手机给小陈发消息了？'] }, targets);
  validatePhoneProxyAcknowledgement({ reply: [{ text: 'Did you text Chen?', translation: '你用我的手机给小陈发消息了？' }] }, targets, true);
  const response = { id: 'r', senderId: 'a', replyBatchId: 'round', phoneProxyAcknowledgedIds: [sent.messageId] };
  const messages = [...chat().messages, response];
  assert.deepEqual(pendingPhoneProxyEvents(messages, 'a'), []);
  assert.equal(pendingPhoneProxyEvents(regenerationMessages(messages), 'a').length, 1);
  const payment = { ...response, kind: 'transfer', paymentStatus: 'received' };
  assert.equal(pendingPhoneProxyEvents(regenerationMessages([...chat().messages, payment]), 'a').length, 1);
  assert.equal(retainSettledReplyPayment(payment, new Set(['r']), 'new-round').phoneProxyAcknowledgedIds, undefined);
  const prompt = JSON.stringify(buildPrompt({ chatId: 'chat', currentInput: '在吗', timeAwarenessEnabled: false }));
  assert.match(prompt, /玩家使用角色手机代发消息/);
  assert.doesNotMatch(prompt, /线下亲身经历/);
});

test('chat API corrects an omitted owner reaction once and never returns twice-omitted reactions as success', async () => {
  const responses = [
    { reply: ['今天挺好'], thought: '普通心声。' },
    { reply: ['你拿我的手机给小陈发消息了？'], thought: '好奇他会怎么回。' },
  ];
  const fetch = mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] }));
  mock.method(console, 'warn', () => {});
  const options = { requireThought: true, phoneProxyTargets: ['小陈'] };
  const result = await requestChatReply([{ role: 'user', content: '在吗' }], { endpoint: 'http://127.0.0.1:39123/v1', apiKey: 'fixture' },
    () => {}, { defaultSpeakerId: 'a', namesById: { a: ['林渡'] } }, options);
  assert.equal(fetch.mock.callCount(), 2);
  assert.match(JSON.stringify(result.reply), /小陈/);
  fetch.mock.mockImplementation(async () => respond(['我不知道你做了什么']));
  await assert.rejects(requestChatReply([{ role: 'user', content: '在吗' }], { endpoint: 'http://127.0.0.1:39123/v1', apiKey: 'fixture' },
    () => {}, { defaultSpeakerId: 'a', namesById: { a: ['林渡'] } }, { phoneProxyTargets: ['小陈'] }), /必须/);
});

test('archive switches isolate pending events and reject a reply to the wrong archive', async () => {
  const sent = await sendPhoneProxyMessage('a', 'thread', '你好呀', '玩家');
  const chats = get('yyphone:wechat-chats');
  chats[0].activeArchiveId = 'two'; chats[0].messages = [];
  writeStoredValue('yyphone:wechat-chats', chats);
  assert.deepEqual(pendingPhoneProxyEvents([], 'a'), []);
  assert.notEqual(activeMemoryArchive('a'), sent.archiveKey);
  await assert.rejects(replyToPhoneProxyMessage('a', 'thread', sent.messageId, sent.archiveKey, new AbortController().signal), /存档已切换/);
});

test('a deleted and recreated owner chat cannot inherit unhandled events from the previous chat', async () => {
  const sent = await sendPhoneProxyMessage('a', 'thread', '你好呀', '玩家');
  const chats = get('yyphone:wechat-chats');
  chats[0].id = 'replacement-chat'; chats[0].messages = [];
  writeStoredValue('yyphone:wechat-chats', chats);
  assert.deepEqual(pendingPhoneProxyEvents([], 'a'), []);
  mock.method(globalThis, 'fetch', async () => respond(['你好']));
  await assert.rejects(replyToPhoneProxyMessage('a', 'thread', sent.messageId, sent.archiveKey, new AbortController().signal), /原聊天已被删除/);
  assert.equal(phone().npcThreads[0].messages.length, 2);
});
