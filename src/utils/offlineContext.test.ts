import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { writeStoredValue } from './localStorage';
import { generateOfflineText } from './offlineAi';
import { normalizeStory, readOfflineStyle, writeOfflineStyle, DEFAULT_OFFLINE_STYLE, type OfflineStory } from './offlineData';
import { offlineWechatBackground, readOfflineGroupChats } from './offlineWechat';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
beforeEach(async () => { values.clear(); await clearDbStorage(); });
afterEach(() => mock.restoreAll());
const story: OfflineStory = { id: 's', title: '书店', characterIds: ['a'], personaId: '', worldBookIds: [], presetId: '', wechatContextCount: 2,
  groupChatIds: ['group', 'deleted'], autoChoices: false, contextMessages: 30, ended: false, messages: [], createdAt: '2026-11-12', updatedAt: '2026-11-12' };
const contacts = [{ id: 'a', name: '林渡', avatarUrl: '', persona: '温和' }, { id: 'b', name: '小夏', avatarUrl: '', persona: '' }];
function setupChats() {
  writeStoredValue('pocketos:wechat-contacts', contacts);
  writeStoredValue('yyphone:wechat-chats', [
    { id: 'direct-a', type: 'direct', participantIds: ['a'], context: '私聊补充：两人已约好周日见面', messages: [
      { senderId: 'a', text: '过早的私聊不带入' }, { senderId: 'user', text: '记得带伞' }, { senderId: 'a', text: '我会提前到' },
      { senderId: 'a', kind: 'thought', text: '心声不可挂载' }, { senderId: 'a', hidden: true, text: '隐藏消息不可挂载' },
    ] },
    { id: 'direct-b', type: 'direct', participantIds: ['b'], context: '未登场角色补充不应读取', messages: [] },
    { id: 'group', type: 'group', groupTitle: '周末小队', participantIds: ['a', 'b'], context: '群补充：这周一起去书店', messages: [
      { senderId: 'a', text: '过早的群消息不带入' }, { senderId: 'b', text: '我订好了位置' }, { senderId: 'user', text: '下午见' },
      { senderId: 'a', source: 'alias-experience', text: '小号隐藏注入不可挂载' }, { senderId: 'a', kind: 'thought', text: '群聊心声不可挂载' },
    ] },
    { id: 'unselected', type: 'group', groupTitle: '未勾选的群', context: '未选群补充不应读取', messages: [{ senderId: 'b', text: '未选群消息不应读取' }] },
    { id: 'observer', type: 'observer', groupTitle: '旁观聊天', messages: [] },
  ]);
}
test('offline context uses selected groups, per-chat counts and correct speakers without hidden messages or thoughts', () => {
  setupChats();
  const context = offlineWechatBackground(story, contacts, '小雨');
  assert.match(context, /私聊补充：两人已约好周日见面/); assert.match(context, /群补充：这周一起去书店/);
  assert.match(context, /小夏：我订好了位置/); assert.match(context, /小雨：下午见/); assert.match(context, /林渡：我会提前到/);
  assert.doesNotMatch(context, /不应读取|不可挂载|不带入/);
  assert.deepEqual(readOfflineGroupChats().map(chat => chat.id), ['group', 'unselected']);
});
test('dialogue supplements are independent of message count, and legacy stories never select groups automatically', () => {
  setupChats();
  const context = offlineWechatBackground({ ...story, wechatContextCount: 0, groupChatIds: undefined }, contacts, '小雨');
  assert.match(context, /两人已约好周日见面/); assert.doesNotMatch(context, /最近聊天|记得带伞|下午见|周末小队|这周一起去书店/);
  const imported = normalizeStory({ ...story, groupChatIds: ['group', 'group', false] });
  assert.deepEqual(imported?.groupChatIds, ['group']);
  assert.deepEqual(normalizeStory({ ...story, groupChatIds: undefined })?.groupChatIds, []);
});
test('real offline generation includes dialogue supplements and selected group background while retaining the no-thought rule', async () => {
  setupChats();
  writeStoredValue('yyphone:api-presets', [{ id: 'test', name: 'test', endpoint: 'https://offline.invalid/v1', apiKey: 'fixture', model: 'test' }]);
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const prompt = JSON.parse(String(init?.body)).messages[0].content;
    assert.match(prompt, /两人已约好周日见面/); assert.match(prompt, /小夏：我订好了位置/); assert.match(prompt, /线下不生成角色心声/);
    assert.doesNotMatch(prompt, /不应读取|不可挂载|不带入/);
    return Response.json({ choices: [{ message: { content: '林渡在书店门口收起了伞。' } }] });
  });
  assert.match((await generateOfflineText(story, undefined, [], 'opening')).text, /收起了伞/);
});
test('offline typography persists separately, legacy appearance gets defaults, and malformed font data is rejected', () => {
  const file = { name: 'fixture.ttf', dataUrl: 'data:font/ttf;base64,AAEAAA==' };
  writeOfflineStyle({ ...DEFAULT_OFFLINE_STYLE, fontFamily: 'serif', fontSize: 20, lineHeight: 2, fontFile: file });
  assert.equal(readOfflineStyle().fontSize, 20); assert.deepEqual(readOfflineStyle().fontFile, file);
  writeOfflineStyle(DEFAULT_OFFLINE_STYLE); assert.equal(readOfflineStyle().fontFile, undefined);
  writeOfflineStyle({ ...DEFAULT_OFFLINE_STYLE, fontSize: 100 }); assert.equal(readOfflineStyle().fontSize, undefined);
});
