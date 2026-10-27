import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { parseChatResponse } from './aiResponse';
import { requestChatReply, validateChatThoughts } from './chatReply';
import { voiceMessageText } from './chatVoice';
import { adventureSessionKey, restoreAdventureSessions, type AdventureSession } from '../components/TextAdventureSimulator';
import { builtinWorlds } from '../components/adventureWorldData';

afterEach(() => mock.restoreAll());
const speakers = { defaultSpeakerId: 'a', namesById: { a: ['林渡'], b: ['时予'] } };

test('voice markers and alternate voice fields become playable voice messages while normal mentions stay text', () => {
  for (const marker of ['【语音】今天早点睡', '[语音 5秒] 今天早点睡', '【语音：今天早点睡】', '[voice:今天早点睡]', '语音转写：今天早点睡', '<voice>今天早点睡</voice>']) {
    assert.equal(voiceMessageText(marker), '今天早点睡', marker);
    assert.deepEqual(parseChatResponse(JSON.stringify({ reply: [marker] }), { normalizeVoice: true }).reply, [{ kind: 'voice', text: '今天早点睡' }]);
  }
  for (const part of [{ type: 'audio', transcript: '今天早点睡' }, { messageType: 'voice_message', voiceText: '今天早点睡' }, { kind: '语音', content: '今天早点睡' }, { kind: 'voice', text: '', content: '', transcript: '今天早点睡' }]) {
    const reply = parseChatResponse(JSON.stringify({ reply: [part] }), { normalizeVoice: true }).reply as Array<{ kind: string; text: string }>;
    assert.equal(reply[0].kind, 'voice');assert.equal(reply[0].text, '今天早点睡');
  }
  assert.equal(voiceMessageText('你发的语音我听过了'), null);
  assert.equal(voiceMessageText('【语音识别失败】'), null);
  assert.throws(() => parseChatResponse('{"reply":[{"kind":"voice","text":""}]}', { normalizeVoice: true }), /正文/);
});

test('each speaking group member keeps their own thought, including on a message before the thought-bearing one', () => {
  const result = validateChatThoughts({ speakerId: 'a', thought: '我放心不下', reply: [
    { speakerId: 'b', text: '等一下' }, { speakerId: 'a', text: '怎么了' }, { speakerId: 'b', text: '没事', thought: '我还没想好怎么开口' },
  ] }, speakers, true);
  assert.deepEqual((result.reply as Array<{ thought: string }>).map(part => part.thought), ['我还没想好怎么开口', '我放心不下', '我还没想好怎么开口']);
  assert.throws(() => validateChatThoughts({ speakerId: 'a', thought: '我的心声', reply: [{ speakerId: 'b', text: '你好' }] }, speakers, true), /缺少/);
  assert.throws(() => validateChatThoughts({ thought: '我的心声', reply: ['你好'] }, speakers, true), /speakerId/);
});

test('a direct reply can supply its thought alongside a voice message without losing it on save', () => {
  const result = validateChatThoughts({ reply: [{ kind: 'voice', text: '早点睡', thought: '我舍不得挂断' }] }, speakers);
  assert.equal(result.thought, '我舍不得挂断');
});

test('missing chat thoughts trigger one correction on both API types; other tasks need no thought', async () => {
  mock.method(console, 'warn', () => {});
  for (const endpoint of ['https://test.invalid/v1', 'https://generativelanguage.googleapis.com']) {
    let calls = 0;
    mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
      calls++;
      if (calls === 2) assert.match(String(init?.body), /心声/);
      const text = JSON.stringify({ reply: ['在呢'], ...(calls === 2 ? { thought: '我一直在等这条消息' } : {}) });
      return Response.json(endpoint.includes('googleapis') ? { candidates: [{ content: { parts: [{ text }] } }] } : { choices: [{ message: { content: text } }] });
    });
    const api = { endpoint, apiKey: 'test' };
    const result = await requestChatReply([{ role: 'user', content: '你在吗' }], api, () => {}, speakers, { requireThought: true });
    assert.equal(result.thought, '我一直在等这条消息');assert.equal(calls, 2);
    calls = 0;
    await requestChatReply([{ role: 'user', content: '冒险任务' }], api, () => {});assert.equal(calls, 1);
  }
});

test('twice missing thoughts fail explicitly without inventing a replacement thought', async () => {
  mock.method(console, 'warn', () => {});let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++;return Response.json({ choices: [{ message: { content: '{"reply":["你好"],"thought":" "}' } }] }); });
  await assert.rejects(requestChatReply([{ role: 'user', content: '你好' }], { endpoint: 'https://test.invalid', apiKey: 'test' }, () => {}, speakers, { requireThought: true }), /纠正一次后仍无效/);
  assert.equal(calls, 2);
});

test('adventure legacy migration preserves solo and different companions as independent journeys', () => {
  const entry = builtinWorlds()[0];
  const solo: AdventureSession = { worldId: entry.world.id, companionId: '', turn: 7, scene: entry.world.scenes[0], stats: { courage: 2, insight: 3, fate: 1 }, items: ['信'], events: ['旧旅程'], summaries: [], companionAction: '' };
  const a = { ...solo, companionId: 'a', turn: 2 }, b = { ...solo, companionId: 'b', turn: 4 };
  const restored = restoreAdventureSessions({ [solo.worldId]: solo, a, b });
  assert.equal(restored[adventureSessionKey(solo.worldId, '')].turn, 7);
  assert.equal(restored[adventureSessionKey(solo.worldId, 'a')].turn, 2);
  assert.equal(restored[adventureSessionKey(solo.worldId, 'b')].turn, 4);
  assert.deepEqual(restoreAdventureSessions(restored), restored);
});
