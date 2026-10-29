import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import {
  BIRTHDAY_LETTERS_KEY, BIRTHDAY_SETTINGS_KEY, DEFAULT_BIRTHDAY_SETTINGS, birthdayDaysAway, birthdayInYear,
  birthdayIsDue, birthdayUser, isBirthdaySettings, keepBirthdayLetter, localBirthdayDate, nextBirthday,
  parseBirthdayLetter, prepareBirthdayLetter, readBirthdayLetters, saveBirthdaySettings, shareBirthdayLetter, validBirthday,
} from './birthday';
import { toMessageContent } from './buildPrompt';
import { isWeChatFavorites, WECHAT_FAVORITES_KEY } from './wechatFavorites';

const values = new Map<string, string>();
const events = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  dispatchEvent: events.dispatchEvent.bind(events), localStorage: {
    getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null,
    get length() { return values.size; },
  },
} });
const settings = { ...DEFAULT_BIRTHDAY_SETTINGS, enabled: true, monthDay: '10-29', characterIds: ['a', 'b'] };
const body = Array.from({ length: 8 }, (_, i) => `${i ? '还有一件小事。' : '那盏灯还亮着。'}我记得你说，晚一点也没有关系。那天我才明白，你不是不在意，只是习惯把自己的期待放在最后。今天想陪你安静走一段路，不用提前想好去哪里。`).join('\n\n');
const answer = () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: '灯替你留着', body }) } }] });
const read = (key: string) => JSON.parse(readStorageString(key) || 'null');
beforeEach(async () => {
  await clearDbStorage();
  writeStoredValue(BIRTHDAY_SETTINGS_KEY, settings);
  writeStoredValue('pocketos:personas', { activeProfileId: 'player', profiles: [{ id: 'player', name: '默认人设', nickname: '小满', identity: 'PLAYER_IDENTITY' }] });
  writeStoredValue('pocketos:wechat-contacts', [
    { id: 'a', name: '林渡', persona: 'PERSONA_A', worldBooks: [{ bookId: 'book-a' }], avatarUrl: '' },
    { id: 'b', name: '时予', persona: 'NEVER_OTHER_PERSONA', worldBooks: [], avatarUrl: '' },
  ]);
  writeStoredValue('yyphone:api-presets', [{ id: 'api', name: 'api', endpoint: 'https://test.invalid/v1', apiKey: 'test', model: 'birthday-model' }]);
  const now = '2026-10-27T10:00:00Z';
  writeStoredValue('yyphone:wechat-chats', [
    { id: 'main-a', type: 'direct', participantIds: ['a'], activeArchiveId: 'current', blocked: false, updatedAt: now,
      archives: [{ id: 'old', messages: [{ text: 'NEVER_OLD_ARCHIVE' }] }], messages: [
        ...Array.from({ length: 170 }, (_, i) => ({ id: `m${i}`, senderId: i % 2 ? 'a' : 'user', text: i === 169 ? '灯替你留着' : `私聊内容${i}`, createdAt: now, thought: 'NEVER_THOUGHT_FIELD' })),
        { id: 'thought', senderId: 'a', kind: 'thought', text: 'NEVER_THOUGHT' },
        { id: 'hidden', senderId: 'a', hidden: true, text: 'NEVER_HIDDEN' },
        { id: 'alias', senderId: 'narrator', kind: 'context-note', source: 'alias-experience', text: 'NEVER_ALIAS' },
      ] },
    { id: 'main-b', type: 'direct', participantIds: ['b'], blocked: false, messages: [{ id: 'b1', senderId: 'b', text: 'NEVER_OTHER_CHAT', createdAt: now }] },
  ]);
  writeStoredValue('yyphone:memory-items', [
    { id: 'memory-a', charId: 'a', archiveKey: '["a","current"]', content: 'OWN_MEMORY', importance: 5 },
    { id: 'old', charId: 'a', archiveKey: '["a","old"]', content: 'NEVER_OLD_MEMORY' },
    { id: 'other', charId: 'b', content: 'NEVER_OTHER_MEMORY' },
  ]);
  writeStoredValue('yyphone:world-books', [
    { id: 'book-a', name: '设定', entries: [{ id: 'entry', title: '城市', content: 'BOUND_WORLD_BOOK', depth: 'middle' },
      { id: 'green', title: '关键词', content: 'KEYWORD_WORLD_BOOK', activation: 'keyword', keywords: ['灯'], depth: 'middle' }] },
    { id: 'book-b', name: '其他', entries: [{ id: 'other', title: '禁止', content: 'NEVER_OTHER_BOOK', depth: 'middle' }] },
  ]);
});
afterEach(() => mock.restoreAll());

test('birthday dates use local calendar days, roll across years and handle leap-day birthdays consistently', () => {
  assert(validBirthday('02-29')); assert(!validBirthday('02-30')); assert(!validBirthday('04-31'));
  assert(!validBirthday('2-9')); assert(!validBirthday('00-01'));
  assert.equal(birthdayInYear('02-29', 2026), '2026-02-28'); assert.equal(birthdayInYear('02-29', 2028), '2028-02-29');
  assert.equal(nextBirthday('01-01', new Date(2026, 11, 31, 23, 59)), '2027-01-01');
  assert.equal(birthdayDaysAway('01-01', new Date(2026, 11, 31, 23, 59)), 1);
  assert.equal(birthdayDaysAway('10-29', new Date(2026, 9, 29, 23, 59)), 0);
  assert.equal(localBirthdayDate(new Date(2026, 9, 29, 0, 1)), '2026-10-29');
});
test('only an enabled unseen birthday is due; disabled, invalid dates and previous years cannot trigger it', () => {
  const now = new Date(2026, 9, 29, 15);
  assert(birthdayIsDue(settings, [], now)); assert(!birthdayIsDue(settings, ['2026-10-29'], now));
  assert(birthdayIsDue(settings, ['2025-10-29'], now));
  assert(!birthdayIsDue({ ...settings, enabled: false }, [], now));
  assert(!birthdayIsDue({ ...settings, monthDay: '' }, [], now));
  assert(!birthdayIsDue(settings, [], new Date(2026, 9, 28)));
  assert(birthdayIsDue({ ...settings, monthDay: '02-29' }, [], new Date(2026, 1, 28)));
});
test('settings validate real dates, preserve disabled empty configuration, and deduplicate participants', async () => {
  assert(isBirthdaySettings(DEFAULT_BIRTHDAY_SETTINGS));
  assert(!isBirthdaySettings({ ...settings, monthDay: '11-31' }));
  await assert.rejects(saveBirthdaySettings({ ...settings, monthDay: '' }), /选择生日/);
  await saveBirthdaySettings({ ...settings, characterIds: ['a', 'a'] });
  assert.deepEqual(read(BIRTHDAY_SETTINGS_KEY).characterIds, ['a']);
  assert.equal(birthdayUser().name, '小满');
});
test('letter parsing preserves uneven paragraphs and rejects truncated or malformed output', () => {
  assert.equal(parseBirthdayLetter('```json\n' + JSON.stringify({ title: '给你', body }) + '\n```').body, body);
  assert.throws(() => parseBirthdayLetter('{"body":"生日快乐"}'), /没有写完整/);
  assert.throws(() => parseBirthdayLetter('broken'), /JSON/);
});
test('preparing a birthday letter uses only own current timeline, persona and linked books, caches once, and never injects memory or chat', async () => {
  const before = ['yyphone:wechat-chats', 'yyphone:memory-items'].map(readStorageString); let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++; const raw = String(init?.body), payload = JSON.parse(raw), data = JSON.parse(payload.messages[1].content);
    assert(!raw.includes('NEVER_')); assert(raw.includes('PERSONA_A')); assert(raw.includes('BOUND_WORLD_BOOK'));
    assert(raw.includes('KEYWORD_WORLD_BOOK')); assert(raw.includes('OWN_MEMORY')); assert(raw.includes('PLAYER_IDENTITY'));
    assert.equal(data.material.filter((s: any) => s.kind === 'chat').length, 150);
    assert.match(payload.messages[0].content, /长短错落/); assert.equal(payload.model, 'birthday-model');
    return answer();
  });
  const signal = new AbortController().signal;
  const [letter, again] = await Promise.all([prepareBirthdayLetter('a', '2026-10-29', signal), prepareBirthdayLetter('a', '2026-10-29', signal)]);
  assert.equal(letter.id, again.id); await prepareBirthdayLetter('a', '2026-10-29', signal); assert.equal(calls, 1);
  assert.equal(readBirthdayLetters('2026-10-29').length, 1);
  assert.deepEqual(['yyphone:wechat-chats', 'yyphone:memory-items'].map(readStorageString), before);
  assert.equal(letter.userName, '小满'); assert.equal(letter.body, body);
});
test('preparations for multiple characters preserve each other and cache is scoped to birthday, persona and active archive', async () => {
  mock.method(globalThis, 'fetch', async () => answer());
  await Promise.all(['a', 'b'].map(id => prepareBirthdayLetter(id, '2026-10-29', new AbortController().signal)));
  assert.equal(readBirthdayLetters('2026-10-29').length, 2);
  assert.equal(readBirthdayLetters('2027-10-29').length, 0);
  const chats = read('yyphone:wechat-chats'); chats[0].activeArchiveId = 'other'; writeStoredValue('yyphone:wechat-chats', chats);
  assert.deepEqual(readBirthdayLetters('2026-10-29').map(l => l.characterId), ['b']);
  const personas = read('pocketos:personas'); personas.activeProfileId = 'other'; writeStoredValue('pocketos:personas', personas);
  assert.equal(readBirthdayLetters('2026-10-29').length, 0);
});
test('cancelled or late responses after switching an archive, deleting a role or changing persona are never saved', async () => {
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => { controller.abort(); return answer(); });
  await assert.rejects(prepareBirthdayLetter('a', '2026-10-29', controller.signal), { name: 'AbortError' });
  assert.equal(read(BIRTHDAY_LETTERS_KEY), null);
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => {
    const chats = read('yyphone:wechat-chats'); chats[0].activeArchiveId = 'other'; writeStoredValue('yyphone:wechat-chats', chats); return answer();
  });
  await assert.rejects(prepareBirthdayLetter('a', '2026-10-29', new AbortController().signal), /存档已变化/);
  assert.equal(read(BIRTHDAY_LETTERS_KEY), null);
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => {
    writeStoredValue('pocketos:wechat-contacts', []); return answer();
  });
  await assert.rejects(prepareBirthdayLetter('a', '2026-10-29', new AbortController().signal), /存档已变化/);
  assert.equal(read(BIRTHDAY_LETTERS_KEY), null);
});
test('network or formatting failures do not cache a fake letter and can be retried', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: '{"body":"太短"}' } }] }));
  await assert.rejects(prepareBirthdayLetter('a', '2026-10-29', new AbortController().signal), /完整/);
  assert.equal(readBirthdayLetters('2026-10-29').length, 0);
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => answer());
  await prepareBirthdayLetter('a', '2026-10-29', new AbortController().signal);
  assert.equal(readBirthdayLetters('2026-10-29').length, 1);
});
test('keeping a letter creates an independent deduplicated favorite with full content, without touching chat', async () => {
  mock.method(globalThis, 'fetch', async () => answer());
  const letter = await prepareBirthdayLetter('a', '2026-10-29', new AbortController().signal);
  const before = readStorageString('yyphone:wechat-chats');
  await Promise.all([keepBirthdayLetter(letter), keepBirthdayLetter(letter)]);
  const favorites = read(WECHAT_FAVORITES_KEY);
  assert(isWeChatFavorites(favorites)); assert.equal(favorites.length, 1); assert.equal(favorites[0].message.content, body);
  assert.equal(readStorageString('yyphone:wechat-chats'), before);
});
test('a selected contact with no existing conversation can bring a prepared letter into a new valid direct chat', async () => {
  writeStoredValue('yyphone:wechat-chats', read('yyphone:wechat-chats').filter((c: any) => c.id !== 'main-b'));
  mock.method(globalThis, 'fetch', async () => answer());
  const letter = await prepareBirthdayLetter('b', '2026-10-29', new AbortController().signal);
  const chatId = await shareBirthdayLetter(letter), chats = read('yyphone:wechat-chats');
  const created = chats.find((c: any) => c.id === chatId);
  assert.deepEqual(created.participantIds, ['b']); assert.equal(created.type, 'direct');
  assert.equal(created.blocked, false); assert.equal(created.pinned, false); assert.equal(created.narratorEnabled, false);
  assert.equal(created.messages.length, 1); assert.equal(created.messages[0].senderId, 'b');
  assert.equal(chats.length, 2);
});
test('explicit sharing appends one readable letter to the original chat only, does not touch archives or long-term memory, and rejects a changed or blocked timeline', async () => {
  mock.method(globalThis, 'fetch', async () => answer());
  const letter = await prepareBirthdayLetter('a', '2026-10-29', new AbortController().signal);
  const before = read('yyphone:wechat-chats'), memoryBefore = readStorageString('yyphone:memory-items');
  const ids = await Promise.all([shareBirthdayLetter(letter), shareBirthdayLetter(letter)]); assert.deepEqual(ids, ['main-a', 'main-a']);
  const after = read('yyphone:wechat-chats'); assert.equal(after[0].messages.length, before[0].messages.length + 1);
  assert.deepEqual(after[0].archives, before[0].archives); assert.deepEqual(after[1], before[1]);
  assert.equal(readStorageString('yyphone:memory-items'), memoryBefore);
  assert.match(toMessageContent(after[0].messages.at(-1)), /灯还亮着/);
  after[0].blocked = true; writeStoredValue('yyphone:wechat-chats', after);
  await assert.rejects(shareBirthdayLetter(letter), /拉黑/);
  after[0].activeArchiveId = 'different'; writeStoredValue('yyphone:wechat-chats', after);
  await assert.rejects(shareBirthdayLetter(letter), /存档/);
});
