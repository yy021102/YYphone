import { beforeEach, afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { chatReplyPacing, CHAT_THOUGHT_STYLE } from './chatReplyPacing';
import { CHAT_COMMUNICATION_RULES } from './chatCommunication';
import { buildPrompt } from './buildPrompt';
import { requestChatReply, withChatResponseFormat } from './chatReply';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { buildCalendarContext, emptyCalendarData } from './calendarData';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } } });
beforeEach(async () => {
  values.clear(); await clearDbStorage();
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts': [{ id: 'a', name: '林渡', avatarUrl: '', persona: '独立、直率，会反思自己的偏见', worldBooks: [] }],
    'yyphone:wechat-chats': [{ id: 'chat', type: 'direct', participantIds: ['a'], context: '', noteName: '', avatars: {}, messages: [], updatedAt: '2026-10-31T08:00:00Z' }],
    'yyphone:calendar-data': { ...emptyCalendarData(), visibleCharacterIds: ['a'], entries: [{ id: 'period', kind: 'period', title: '经期', date: '2026-10-31', endDate: '2026-11-04' }] },
  });
});
afterEach(() => mock.restoreAll());

test('actual prompt retains personality and deep discussion guidance while calendar remains optional background', () => {
  const prompt = buildPrompt({ chatId: 'chat', currentInput: '我觉得懂事的人好像总是吃亏', historyLimit: 30 });
  const text = prompt.map(m => m.content).join('\n');
  assert.match(text, /独立、直率/);
  assert.ok(text.includes(CHAT_COMMUNICATION_RULES));
  assert.match(text, /不必等玩家问/); assert.match(text, /不临时编造创伤、前任或共同回忆/);
  const calendar = buildCalendarContext(['a'], () => '林渡', true, new Date('2026-10-31T12:00:00'));
  assert.match(calendar!, /目前正处于经期/); assert.match(calendar!, /不是本轮必须执行的关怀任务/);
  assert.equal(buildCalendarContext(['unrelated'], () => '别人', true, new Date('2026-10-31T12:00:00')), null);
});

test('response protocol accepts one-line jokes, punctuation, and five substantive messages with independent short thoughts', async () => {
  const cases = [ ['宝宝在吗'], ['？'], [
    '我以前很看重懂事，现在会多问一句，这是谁的方便',
    '我也享受过别人替我省事，却没意识到对方一直在让步',
    '所以对我来说，愿意体谅人和只能体谅人，差得很远',
    '如果对方不懂事的时候我就不喜欢他，那我珍惜的可能只是那份便利',
    '这件事我还得留意自己，不能光说别人',
  ] ];
  for (const reply of cases) {
    let payload: any;
    mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
      payload = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply, thought: '我有自己的想法。', speakerId: 'a' }) } }] }), { headers: { 'Content-Type': 'application/json' } });
    });
    const prompt = withChatResponseFormat([{ role: 'system', content: CHAT_COMMUNICATION_RULES }, { role: 'user', content: '继续聊' }], `${chatReplyPacing({ min: 1, max: 5 })}\n${CHAT_THOUGHT_STYLE}`);
    const response = await requestChatReply(prompt, { endpoint: 'https://ai.invalid/v1', apiKey: 'test', model: 'test' }, () => {}, { defaultSpeakerId: 'a', namesById: { a: ['林渡'] } }, { requireThought: true });
    assert.equal((response.reply as unknown[]).length, reply.length);
    assert.equal(response.thought, '我有自己的想法。');
    const instructions = payload.messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n');
    assert.match(instructions, /1～5 条/); assert.match(instructions, /上限不是目标/);
    assert.doesNotMatch(instructions, /恰好 [1-5] 条/);
    mock.restoreAll();
  }
});

test('custom lower bounds and deliberate fixed counts remain respected, and group limits apply to the whole group', () => {
  assert.match(chatReplyPacing({ min: 2, max: 4 }), /2～4 条/);
  assert.match(chatReplyPacing({ min: 3, max: 3 }), /恰好 3 条/);
  assert.match(chatReplyPacing({ min: 1, max: 5 }, true), /全群消息总数/);
  assert.doesNotMatch(chatReplyPacing({ min: 2, max: 4 }), /reply 只放一条即可/);
});
