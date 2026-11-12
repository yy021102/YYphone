import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { groupPrivateDeliveries, parseSocialActions, validateGroupPrivatePromises, type SocialContext } from './chatSocial';
import { requestChatReply } from './chatReply';

const context = (): SocialContext => ({
  chat: { id: 'group', type: 'group', participantIds: ['a', 'b', 'npc:x'], messages: [] },
  actors: [{ id: 'a', name: '甲', avatarUrl: '' }, { id: 'b', name: '乙', avatarUrl: '' }],
  regenerate: false, now: new Date(), privateChatLanguages: { b: 'en' },
});
const message = (speakerId: string, texts: unknown[] = ['私下说的话']) => ({ speakerId, texts, reason: '接着群里的话私下说' });
afterEach(() => mock.restoreAll());

test('non-main member and multiple members can privately send with isolated languages', () => {
  const result = parseSocialActions({ privateMessages: [message('a'), message('b', [{ text: 'Hello', translation: '你好' }])] }, context(), 'npc:x');
  const deliveries = groupPrivateDeliveries(result, 'npc:x');
  assert.deepEqual(deliveries.map(item => item.speakerId), ['a', 'b']);
  assert.equal(deliveries[1].translations?.[0]?.language, 'en');
  assert.equal(deliveries[1].texts[0], 'Hello');
  assert.deepEqual(groupPrivateDeliveries(parseSocialActions({ privateMessage: message('a') }, context(), 'b'), 'b').map(item => item.speakerId), ['a']);
});

test('legacy private message retains main sender and shape', () => {
  const payload = { texts: ['你好'], reason: '私下问候' };
  const parsed = parseSocialActions({ privateMessage: payload }, context(), 'a');
  assert.deepEqual(parsed.privateMessage, payload);
  assert.deepEqual(groupPrivateDeliveries(parsed, 'a'), [{ ...payload, speakerId: 'a' }]);
});

test('private sender permissions, language, duplicates and incompatible formats are validated', () => {
  for (const id of ['npc:x', 'outsider']) assert.throws(() => parseSocialActions({ privateMessages: [message(id)] }, context(), 'a'), /不允许/);
  assert.throws(() => parseSocialActions({ privateMessages: [message('a'), message('a')] }, context(), 'a'), /重复/);
  assert.throws(() => parseSocialActions({ privateMessages: [message('b')] }, context(), 'a'), /译文/);
  assert.throws(() => parseSocialActions({ privateMessages: [], privateMessage: message('a') }, context(), 'a'), /同时/);
  for (const ctx of [
    { ...context(), regenerate: true },
    { ...context(), chat: { ...context().chat, type: 'observer' as const } },
    { ...context(), chat: { ...context().chat, allowGroupPrivate: false } },
  ]) assert.throws(() => parseSocialActions({ privateMessages: [message('a')] }, ctx, 'a'), /不允许/);
});

test('immediate promise requires the actual speaker action, not a different sender', () => {
  const record = { speakerId: 'b', reply: [{ speakerId: 'a', text: '我现在私聊发你' }] };
  assert.throws(() => validateGroupPrivatePromises(record, context(), 'b'), /成员 a/);
  assert.throws(() => validateGroupPrivatePromises({ ...record, privateMessages: [message('b', [{ text: 'Hi', translation: '嗨' }])] }, context(), 'b'), /成员 a/);
  assert.doesNotThrow(() => validateGroupPrivatePromises({ ...record, privateMessages: [message('a')] }, context(), 'b'));
  for (const text of ['我以后私聊发你', '我不私聊发你', '如果有空我私聊发你', '我私聊发你？', '他说“我私聊发你”', '我想单独和小林聊聊']) {
    assert.doesNotThrow(() => validateGroupPrivatePromises({ reply: [{ speakerId: 'a', text }] }, context(), 'b'));
  }
  assert.doesNotThrow(() => validateGroupPrivatePromises(record, { ...context(), regenerate: true }, 'b'));
});

test('missing promised action is corrected once before exposing reply; A-B-A order stays intact', async () => {
  const reply = [
    { speakerId: 'a', text: '我现在私聊发你', thought: '这件事想私下说' },
    { speakerId: 'b', text: '那我继续说刚才那个', thought: '刚才的话还没说完' },
    { speakerId: 'a', text: '你说 我听着呢' },
  ];
  const result = { speakerId: 'b', thought: '接着说', reply };
  const requests: Array<Record<string, unknown>> = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(requests.length === 1 ? result : { ...result, privateMessages: [message('a')] }) } }] }), { status: 200 });
  });
  const parsed = await requestChatReply([{ role: 'user', content: '接着聊' }],
    { endpoint: 'https://mock.invalid/v1', apiKey: 'mock', model: 'mock' }, () => {},
    { defaultSpeakerId: 'a', namesById: { a: ['甲'], b: ['乙'] } },
    { groupChat: true, requireThought: true, validateResult: value => validateGroupPrivatePromises(value, context(), 'b') });
  assert.equal(requests.length, 2);
  assert.deepEqual((parsed.reply as typeof reply).map(part => part.speakerId), ['a', 'b', 'a']);
  assert.equal(groupPrivateDeliveries(parseSocialActions(parsed, context(), 'b'), 'b')[0].speakerId, 'a');
});

test('ordinary group chat uses one request; an uncorrected promise stops after one retry', async () => {
  let count = 0, promise = false;
  mock.method(globalThis, 'fetch', async () => {
    count++;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ speakerId: 'a', thought: '自然接话', reply: [{ speakerId: 'a', text: promise ? '私聊发给你' : '今天有点热', thought: '自然接话' }] }) } }] }), { status: 200 });
  });
  const request = () => requestChatReply([{ role: 'user', content: '继续聊' }],
    { endpoint: 'https://mock.invalid/v1', apiKey: 'mock', model: 'mock' }, () => {},
    { defaultSpeakerId: 'a', namesById: { a: ['甲'], b: ['乙'] } },
    { groupChat: true, requireThought: true, validateResult: value => validateGroupPrivatePromises(value, context(), 'a') });
  await request();
  assert.equal(count, 1);
  promise = true;
  await assert.rejects(request(), /纠正一次后仍无效/);
  assert.equal(count, 3);
});
