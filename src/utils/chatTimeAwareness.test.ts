import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { buildPrompt, type PromptChatMessage } from './buildPrompt';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString } from './localStorage';

const now = new Date('2026-11-03T15:22:00+08:00');
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  },
} });
const message = (id: string, text: string, createdAt: string, senderId = 'user'): PromptChatMessage =>
  ({ id, text, createdAt, senderId });
const conversation = (messages: PromptChatMessage[]) => ({
  id: 'chat', type: 'direct', participantIds: ['a'], messages, noteName: '', context: '', avatars: {}, updatedAt: now.toISOString(),
});
const prompt = (options: Partial<Parameters<typeof buildPrompt>[0]> = {}) =>
  buildPrompt({ chatId: 'chat', timeZone: 'Asia/Shanghai', ...options });
const timeContext = (messages: ReturnType<typeof buildPrompt>) =>
  messages.find(item => item.role === 'system' && item.content.startsWith('【当前时间】'))?.content ?? '';
const storeMessages = (messages: PromptChatMessage[]) =>
  setStorageItemsAtomically({ 'yyphone:wechat-chats': [conversation(messages)] });

beforeEach(async () => {
  mock.timers.enable({ apis: ['Date'], now });
  values.clear();
  await clearDbStorage();
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts': [{ id: 'a', name: '林渡', avatarUrl: '', persona: '直率而体贴', worldBooks: [] }],
    'yyphone:wechat-chats': [conversation([])],
  });
});
afterEach(() => mock.timers.reset());

test('unanswered messages retain distinct sending times even when generated together, in both history formats', async () => {
  await storeMessages([
    message('old', '我刚刚出门，等会儿去吃饭', '2026-11-03T13:22:00+08:00'),
    message('new-one', '饭已经吃完啦', '2026-11-03T15:21:00+08:00'),
    message('new-two', '刚回到家', now.toISOString()),
  ]);
  const original = readStorageString('yyphone:wechat-chats');
  for (const structuredHistory of [false, true]) {
    const result = prompt({ structuredHistory, currentInput: '刚回到家' });
    const oldIndex = result.findIndex(item => item.role === 'user' && item.content.includes('我刚刚出门'));
    const recentIndex = result.findIndex(item => item.role === 'user' && item.content.includes('饭已经吃完'));
    assert.match(result[oldIndex - 1].content, /【消息发送时间】.*13:22/);
    assert.match(result[recentIndex - 1].content, /【消息发送时间】.*15:21/);
    assert.match(timeContext(result), /【末尾玩家消息的原始发送时间】.*15:22/);
    assert.match(timeContext(result), /不是在点击生成回复时重新发送/);
    assert.match(timeContext(result), /不要把自己未回复的间隔说成玩家不理你/);
    assert.match(timeContext(result), /较早消息中的“刚刚”“现在”“等会儿”/);
    assert.equal(result.at(-1)?.content, '刚回到家');
    assert.equal(result.filter(item => item.role === 'user').length, 3);
    assert.equal(readStorageString('yyphone:wechat-chats'), original);
  }
});

test('a single message sent two hours ago is dated even without any other history', async () => {
  await storeMessages([message('old', '我在等车', '2026-11-03T13:22:00+08:00')]);
  const result = prompt();
  assert.match(timeContext(result), /原始发送时间】.*13:22，距现在2 小时/);
  assert.match(timeContext(result), /距离上一条聊天消息已过去2 小时/);
  assert.equal(result.at(-1)?.content, '我在等车');
  assert.match(timeContext(prompt({ historyLimit: 0 })), /原始发送时间】.*13:22，距现在2 小时/);
});

test('the latest input counts as a real message, not two hours of silence since earlier history', async () => {
  await storeMessages([
    message('old', '下午要出门', '2026-11-03T13:22:00+08:00'),
    message('new', '我现在到家了', now.toISOString()),
  ]);
  const context = timeContext(prompt({ currentInput: '我现在到家了' }));
  assert.match(context, /原始发送时间】.*15:22/);
  assert.doesNotMatch(context, /距离上一条聊天消息已过去|久未联系可以/);
});

test('generating again does not retimestamp old user input or disregard a newer character reply', async () => {
  await storeMessages([
    message('old', '我去吃饭了', '2026-11-03T13:22:00+08:00'),
    message('reply', '好，回来再聊', '2026-11-03T15:21:00+08:00', 'a'),
  ]);
  const result = prompt({ currentInput: '我去吃饭了', structuredHistory: true });
  assert.match(timeContext(result), /原始发送时间】.*13:22，距现在2 小时/);
  assert.doesNotMatch(timeContext(result), /距离上一条聊天消息已过去/);
  const replyIndex = result.findIndex(item => item.role === 'assistant');
  assert.match(result[replyIndex - 1].content, /【消息发送时间】.*15:21/);
  assert.deepEqual(JSON.parse(result[replyIndex].content), { speakerId: 'a', reply: ['好，回来再聊'] });
});

test('same-minute messages share a timestamp without modifying their content or reply shape', async () => {
  await storeMessages([
    message('one', '在吗', '2026-11-03T15:21:10+08:00'),
    message('two', '在', '2026-11-03T15:21:20+08:00', 'a'),
    message('three', '想问你个事', '2026-11-03T15:21:30+08:00'),
    message('four', '方便聊聊吗', now.toISOString()),
  ]);
  const result = prompt({ structuredHistory: true });
  assert.equal(result.filter(item => item.content.startsWith('【消息发送时间】')).length, 1);
  assert.match(result.find(item => item.role === 'user')?.content ?? '', /玩家：在吗$/);
  assert.deepEqual(JSON.parse(result.find(item => item.role === 'assistant')!.content), { speakerId: 'a', reply: ['在'] });
});

test('turning time awareness off removes timestamps, time intervals and current-time guidance', async () => {
  await storeMessages([
    message('old', '早些时候的消息', '2026-11-03T11:22:00+08:00'),
    message('middle', '晚一点的消息', '2026-11-03T13:22:00+08:00'),
    message('new', '现在的消息', now.toISOString()),
  ]);
  const result = prompt({ timeAwarenessEnabled: false });
  assert.doesNotMatch(result.map(item => item.content).join('\n'), /【消息发送时间】|【末尾玩家消息的原始发送时间】|【当前时间】|时间流逝|【按发送时间理解留言】/);
  assert.equal(result.at(-1)?.content, '现在的消息');
});

test('time zone applies equally to historical sends, the latest input and generation time across midnight', async () => {
  await storeMessages([
    message('old', '今天的旧消息', '2026-11-03T13:22:00+08:00'),
    message('new', '又补了一句', now.toISOString()),
  ]);
  const result = prompt({ timeZone: 'America/Los_Angeles' });
  assert.match(result.find(item => item.content.startsWith('【消息发送时间】'))?.content ?? '', /2026.*11.*2.*21:22/);
  assert.match(timeContext(result), /【当前时间】.*2026.*11.*2.*23:22/);
  assert.match(timeContext(result), /原始发送时间】.*2026.*11.*2.*23:22/);
});

test('mounted history keeps its original time and never becomes the current chat latest message', async () => {
  await setStorageItemsAtomically({ 'yyphone:wechat-chats': [
    { ...conversation([message('old', '旧留言', '2026-11-03T13:22:00+08:00')]), attachHistory: true, attachedHistoryChatIds: ['other'] },
    { ...conversation([message('attached', '另一个群刚刚聊的', now.toISOString(), 'a')]), id: 'other', type: 'group' },
  ] });
  const result = prompt({ structuredHistory: true });
  assert.match(timeContext(result), /距离上一条聊天消息已过去2 小时/);
  const attachedIndex = result.findIndex(item => item.role === 'assistant');
  const metadata = JSON.parse(result[attachedIndex].content);
  assert.match(metadata.historySource, /挂载.*记录1/);
  assert.match(result.slice(0, attachedIndex).reverse().find(item => item.content.startsWith('【消息发送时间】'))?.content ?? '', /15:22/);
});

test('invalid saved dates and synthetic current inputs never acquire fabricated sending times', async () => {
  await storeMessages([message('bad-date', '没有可靠时间的旧消息', 'not-a-date')]);
  const result = prompt({ currentInput: '后台主动联系的指令' });
  assert.doesNotMatch(timeContext(result), /【末尾玩家消息的原始发送时间】|Invalid Date|距离上一条聊天消息已过去/);
  assert.equal(result.at(-1)?.content, '后台主动联系的指令');
});

test('private context notes and hidden narration do not reset the last real conversation time', async () => {
  await storeMessages([
    message('old', '两小时前的留言', '2026-11-03T13:22:00+08:00'),
    message('hidden-narration', '不应作为聊天的新消息', now.toISOString(), 'narrator'),
    { ...message('context', '后台上下文更新', now.toISOString(), 'narrator'), kind: 'context-note' },
  ]);
  const result = prompt();
  assert.match(timeContext(result), /距离上一条聊天消息已过去2 小时/);
  assert.doesNotMatch(result.map(item => item.content).join('\n'), /不应作为聊天的新消息/);
  assert.equal(result.filter(item => item.content.startsWith('【消息发送时间】')).length, 0);
});
