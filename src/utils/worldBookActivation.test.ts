import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { isWorldBookEntryActive, parseWorldBookActivation, parseWorldBookKeywords } from './worldBookActivation';
import { getWorldBookEntriesForContacts, withGlobalWorldBooks } from './worldBookPrompt';
import { buildPrompt } from './buildPrompt';
import { buildCharacterExport, parsePortableWorldBooks, remapImportedWorldBooks } from './characterExport';
import { formatAdventureWorldBooks } from './adventureWorldBooks';
import { requestConfiguredAiText } from './aiApi';

const values = new Map<string, string>(), events = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: events.dispatchEvent.bind(events), localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const read = (key: string) => JSON.parse(readStorageString(key) || 'null');
const now = '2026-10-29T10:00:00Z';
const transcript = (texts: string[]) => texts.map((text, i) => ({ id: `m-${i}`, senderId: 'user', text, createdAt: now }));
function setMessages(texts: string[]) { const chats = read('yyphone:wechat-chats'); chats[0].messages = transcript(texts); writeStoredValue('yyphone:wechat-chats', chats); }
const prompt = (options = {}) => buildPrompt({ chatId: 'main', timeAwarenessEnabled: false, ...options }).map(message => message.content).join('\n');
beforeEach(async () => {
  await clearDbStorage();
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts': [{ id: 'a', name: '林渡', persona: '谨慎', avatarUrl: '', worldBooks: [{ bookId: 'b' }] }],
    'yyphone:wechat-chats': [{ id: 'main', type: 'direct', participantIds: ['a'], blocked: false, avatars: {}, noteName: '', context: '', updatedAt: now, currentChatHistoryCount: 20, messages: transcript(['今天怎么样']) },
      { id: 'other', type: 'direct', participantIds: ['other'], messages: transcript(['樱花 咖啡']), updatedAt: now }],
    'yyphone:world-books': [
      { id: 'b', name: '角色世界', entries: [
        { id: 'legacy', title: '旧条目', content: 'LEGACY_ALWAYS', depth: 'front' },
        { id: 'green', title: '花园', content: 'GREEN_GARDEN', depth: 'front', activation: 'keyword', keywords: ['樱花', 'Rain'], scanDepth: 2 },
        { id: 'off', title: '停用', content: 'DISABLED_CONTENT', depth: 'back', activation: 'disabled' },
      ] },
      { id: 'g', name: '全局', isGlobal: true, entries: [{ id: 'coffee', title: '咖啡店', content: 'GLOBAL_COFFEE', depth: 'middle', activation: 'keyword', keywords: ['咖啡'], scanDepth: 1 }] },
    ],
  });
});
afterEach(() => mock.restoreAll());

test('keyword mode scans individual recent messages, matches any literal keyword case-insensitively and expires', () => {
  const green = { activation: 'keyword' as const, keywords: ['樱花', 'Rain'], scanDepth: 2 };
  assert(isWorldBookEntryActive(green, ['去看看樱花吧'])); assert(isWorldBookEntryActive(green, ['RAIN today']));
  assert(!isWorldBookEntryActive(green, ['樱花', '昨天', '今天']));
  assert(!isWorldBookEntryActive({ ...green, keywords: ['你好'] }, ['你', '好']));
  assert(!isWorldBookEntryActive({ ...green, keywords: ['.*'] }, ['任何内容']));
  assert(!isWorldBookEntryActive({ ...green, scanDepth: 0 }, ['樱花']));
  assert(!isWorldBookEntryActive({ ...green, keywords: [] }, ['樱花']));
  assert(!isWorldBookEntryActive({ activation: 'disabled' }, ['樱花']));
  assert(isWorldBookEntryActive({}, []));
  assert.deepEqual(parseWorldBookKeywords('樱花，Rain\n樱花;海边、落日'), ['樱花', 'Rain', '海边', '落日']);
});

test('main prompts honor global/bound modes and scope, scan live input and never trigger from thoughts or injected summaries', () => {
  const before = prompt(); assert(before.includes('LEGACY_ALWAYS'));
  for (const content of ['GREEN_GARDEN', 'GLOBAL_COFFEE', 'DISABLED_CONTENT']) assert(!before.includes(content));
  setMessages(['看看樱花', '好呀']); assert(prompt().includes('GREEN_GARDEN'));
  setMessages(['看看樱花', '说别的', '天气怎么样']); assert(!prompt().includes('GREEN_GARDEN'));
  assert(prompt({ currentInput: '喝咖啡吧' }).includes('GLOBAL_COFFEE'));
  const chats = read('yyphone:wechat-chats'); chats[0].messages[0].thought = '樱花 咖啡';
  chats[0].messages.push({ id: 'silent', senderId: 'narrator', kind: 'context-note', source: 'phone-inspection', text: '樱花 咖啡', aiContext: '樱花 咖啡', createdAt: now });
  chats[0].archives = [{ id: 'old', messages: transcript(['樱花 咖啡']) }];
  writeStoredValue('yyphone:wechat-chats', chats);
  assert(!prompt().includes('GREEN_GARDEN')); assert(!prompt().includes('GLOBAL_COFFEE'));
});

test('regeneration does not trigger lore from the assistant reply being replaced', () => {
  const chats = read('yyphone:wechat-chats'); chats[0].messages.push({ id: 'old-reply', senderId: 'a', text: '去看樱花', createdAt: now, replyBatchId: 'old-batch' }); writeStoredValue('yyphone:wechat-chats', chats);
  assert(prompt().includes('GREEN_GARDEN')); assert(!prompt({ regenerate: true }).includes('GREEN_GARDEN'));
});

test('auxiliary, selected-book and adventure paths apply the same filter rather than bypassing green entries', () => {
  assert(!getWorldBookEntriesForContacts(['a']).join('').includes('GREEN_GARDEN'));
  setMessages(['樱花']); assert(getWorldBookEntriesForContacts(['a']).join('').includes('GREEN_GARDEN'));
  assert(!getWorldBookEntriesForContacts(['a'], undefined, ['其他话题']).join('').includes('GREEN_GARDEN'));
  assert(getWorldBookEntriesForContacts([], ['b'], ['RAIN']).join('').includes('GREEN_GARDEN'));
  const books = read('yyphone:world-books');
  assert(!formatAdventureWorldBooks(['b'], books, []).includes('GREEN_GARDEN'));
  assert(formatAdventureWorldBooks(['b'], books, ['樱花']).includes('GREEN_GARDEN'));
  assert(!withGlobalWorldBooks('咖啡只出现在任务规则里').includes('GLOBAL_COFFEE'));
  assert(withGlobalWorldBooks('任务', ['咖啡']).includes('GLOBAL_COFFEE'));
});

test('native character bundles and ST fields retain keyword behavior, scan ranges and legacy defaults', () => {
  const books = parsePortableWorldBooks(read('yyphone:world-books'));
  const character = { id: 'a', name: '林渡', avatarUrl: '', persona: '', group: '', starred: false, worldBooks: [{ bookId: 'b' }] };
  const exported = buildCharacterExport(character, ['b'], books);
  const restored = remapImportedWorldBooks(parsePortableWorldBooks(JSON.parse(JSON.stringify(exported)).worldBooks));
  const entry = restored.books[0].entries.find(entry => entry.title === '花园')!;
  assert.equal(entry.activation, 'keyword'); assert.deepEqual(entry.keywords, ['樱花', 'Rain']); assert.equal(entry.scanDepth, 2);
  assert.deepEqual(parseWorldBookActivation({ key: ['樱花'], constant: false, scanDepth: 4 }, true), { activation: 'keyword', keywords: ['樱花'], scanDepth: 4 });
  assert.equal(parseWorldBookActivation({ key: ['樱花'], constant: true }, true).activation, 'always');
  assert.equal(parseWorldBookActivation({ constant: false, disable: true }, true).activation, 'disabled');
  assert.deepEqual(parseWorldBookActivation({}), {});
  for (const invalid of [{ activation: 'wrong' }, { keywords: 'not-array' }, { scanDepth: -1 }, { scanDepth: 101 }]) assert.throws(() => parseWorldBookActivation(invalid));
});

test('global lore in generic API calls scans user input and recent history rather than its own instructions', async () => {
  const requests: string[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => { requests.push(String(init?.body)); return Response.json({ choices: [{ message: { content: 'ok' } }] }); });
  const api = { endpoint: 'https://api.invalid/v1', apiKey: 'test', model: 'test' };
  await requestConfiguredAiText('任务规则咖啡', '你好', { api });
  await requestConfiguredAiText('任务规则', '来杯咖啡', { api });
  assert(!requests[0].includes('GLOBAL_COFFEE')); assert(requests[1].includes('GLOBAL_COFFEE'));
});

test('player-authored narration is distinct from spoken dialogue and remains recognized when AI narration is disabled', () => {
  const chats = read('yyphone:wechat-chats'); chats[0].narratorEnabled = false;
  chats[0].messages.push({ id: 'old-scene', senderId: 'narrator', source: 'user-narration', text: '傍晚的灯亮了', createdAt: now });
  chats[0].messages.push({ id: 'scene', senderId: 'narrator', source: 'user-narration', text: '窗外开始飘起樱花', createdAt: now }); writeStoredValue('yyphone:wechat-chats', chats);
  const messages = buildPrompt({ chatId: 'main', timeAwarenessEnabled: false });
  const narration = messages.find(message => message.content.includes('玩家提供的旁白'))!;
  assert(narration); assert(narration.content.includes('不是玩家发出的聊天台词'));
  assert(messages.some(message => message.role === 'system' && message.content.includes('傍晚的灯亮了')));
  assert.equal(messages.filter(message => message.content.includes('窗外开始飘起樱花')).length, 1);
  assert(messages.at(-1)!.content.includes('窗外开始飘起樱花'));
  assert(messages.some(message => message.content.includes('GREEN_GARDEN')));
});
