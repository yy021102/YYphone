import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { assertPerspectiveCurrent, generateCharacterPerspective, injectCharacterPerspective, parseCharacterPerspective, PERSPECTIVE_HISTORY_LIMIT, PERSPECTIVE_MEMORY_LIMIT, PERSPECTIVE_JOURNAL_LIMIT, readPerspectiveSnapshot } from './characterPerspective';
import { chatArchiveKey } from './memoryArchives';
import { changeChatArchive } from './chatArchives';
import { readDirectMessages } from './journalData';
import { buildPrompt, toMessageContent } from './buildPrompt';

const values = new Map<string, string>(); let failKey = '';
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: () => true, localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { if (k === failKey) { failKey = ''; throw new Error('QUOTA_TEST'); } values.set(k, v); },
  removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const read = (k: string) => JSON.parse(readStorageString(k) || 'null');
const stamp = '2026-10-25T12:00:00.000Z', scope = chatArchiveKey('a', 'archive-default');
const nativeFetch = globalThis.fetch;
const rawReport = () => ({ title: '我们对坦诚的理解，或许并不一样', body: '和你相处久了，我渐渐觉得，你不是不愿意表达自己的需要，而是很在意表达之后，对方是否还保有选择。\n\n我欣赏这种分寸，也会担心你为了留给别人余地，反而让自己的意思变得模糊。但这其中也有我的偏见：我习惯直接说清楚，有时会低估你考虑的那些关系。\n\n这不是一份定论。我还想慢慢弄懂，那些你愿意坚持和愿意让步的部分，究竟怎样在你心里相处。' });
const reportFor = () => parseCharacterPerspective(JSON.stringify(rawReport()));

beforeEach(async () => {
  failKey = ''; await clearDbStorage();
  writeStoredValue('pocketos:personas', { activeProfileId: 'p', profiles: [{ id: 'p', name: '玩家预设', nickname: '小雨', identity: '大学生', personality: '自填温柔', background: '', speakingStyle: '' }] });
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '重视独立、说话克制', worldBooks: [{ bookId: 'w', entryId: 'e' }] }, { id: 'b', name: '时予', persona: '活泼', worldBooks: [] }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'a-chat', type: 'direct', participantIds: ['a'], noteName: '', context: '慢慢了解的朋友', avatars: {}, updatedAt: stamp, messages: [
    { id: '1', senderId: 'user', text: '今天我其实也有点累', createdAt: stamp },
    { id: '2', senderId: 'a', text: '你可以先歇一会儿', thought: 'PRIVATE_THOUGHT', createdAt: stamp },
    { id: '3', senderId: 'narrator', kind: 'context-note', source: 'character-perspective', text: 'OLD_REPORT', createdAt: stamp },
    { id: '4', senderId: 'user', text: 'HIDDEN', hidden: true, createdAt: stamp },
  ], archives: [{ id: 'other', name: '另一条剧情', messages: [{ text: 'OTHER_BRANCH' }], updatedAt: stamp }] },
  { id: 'b-chat', type: 'direct', participantIds: ['b'], messages: [{ senderId: 'user', text: 'OTHER_PERSON', createdAt: stamp }], updatedAt: stamp }]);
  writeStoredValue('yyphone:memory-items', [{ id: 'm', charId: 'a', archiveKey: scope, content: '玩家说自己不想一直逞强', importance: 5 }, { id: 'other', charId: 'a', archiveKey: chatArchiveKey('a', 'other'), content: 'OTHER_MEMORY' }, { id: 'b', charId: 'b', content: 'OTHER_PERSON_MEMORY' }]);
  const journal = { charId: 'a', archiveKey: scope, from: stamp, to: stamp, createdAt: stamp, level: 1, source: 'manual', messageCount: 2 };
  writeStoredValue('yyphone:memory-journal', [{ ...journal, id: 'j', content: '我们谈起各自累的时候' }, { ...journal, id: 'merged', content: 'MERGED_DUPLICATE', mergedInto: 'j' }]);
  writeStoredValue('yyphone:world-books', [{ id: 'w', name: '他的经历', entries: [{ id: 'e', title: '成长', content: '他不喜欢被人照顾得失去自主', depth: 'back' }, { id: 'unlinked', title: '其他', content: 'UNLINKED_BOOK', depth: 'back' }] }]);
  writeStoredValue('yyphone:api-presets', [{ id: 'test', name: '测试', endpoint: 'https://test.invalid/v1', apiKey: 'dummy-test', model: 'test-model' }]);
  writeStoredValue('yyphone:active-api-preset', 'test');
});
afterEach(() => { globalThis.fetch = nativeFetch; });

test('snapshot is read-only and excludes other people, branches, hidden messages, thoughts, old reports and duplicate summaries', () => {
  const before = [...values]; const snapshot = readPerspectiveSnapshot('a');
  assert.equal(snapshot.userName, '小雨'); assert.equal(snapshot.playerId, 'p'); assert.equal(snapshot.chatId, 'a-chat');
  assert.equal(snapshot.sources.filter(s => s.kind === 'chat').length, 2);
  assert.equal(snapshot.sources[0].speaker, 'user'); assert.equal(snapshot.sources[1].speaker, 'character');
  const text = JSON.stringify(snapshot);
  for (const forbidden of ['OTHER_BRANCH', 'OTHER_PERSON', 'OTHER_MEMORY', 'PRIVATE_THOUGHT', 'OLD_REPORT', 'HIDDEN', 'MERGED_DUPLICATE', 'UNLINKED_BOOK']) assert(!text.includes(forbidden), forbidden);
  assert.match(text, /重视独立/); assert.match(text, /自主/); assert.match(text, /慢慢了解/); assert.deepEqual([...values], before);
});

test('history is bounded to the latest 200 eligible main-account messages, with limited memory and journal counts', () => {
  const all = read('yyphone:wechat-chats'); all[0].messages = Array.from({ length: 230 }, (_, i) => ({ id: String(i), senderId: i % 2 ? 'a' : 'user', text: `line-${i}`, createdAt: stamp }));
  all[0].messages.push({ senderId: 'narrator', kind: 'context-note', text: 'EXCLUDED', createdAt: stamp }); writeStoredValue('yyphone:wechat-chats', all);
  writeStoredValue('yyphone:memory-items', Array.from({ length: 30 }, (_, i) => ({ id: String(i), charId: 'a', content: `memory${i}` })));
  writeStoredValue('yyphone:memory-journal', Array.from({ length: 30 }, (_, i) => ({ id: String(i), charId: 'a', content: `journal${i}`, to: stamp })));
  const s = readPerspectiveSnapshot('a'); assert.equal(s.sources.filter(i => i.kind === 'chat').length, PERSPECTIVE_HISTORY_LIMIT); assert.equal(s.sources[0].text, 'line-30');
  assert.equal(s.sources.filter(i => i.kind === 'memory').length, PERSPECTIVE_MEMORY_LIMIT); assert.equal(s.sources.filter(i => i.kind === 'journal').length, PERSPECTIVE_JOURNAL_LIMIT);
});

test('long-term background retains early, middle and recent stages as well as important memories', () => {
  const at = (i: number) => new Date(Date.UTC(2026, 0, i + 1)).toISOString();
  writeStoredValue('yyphone:memory-items', Array.from({ length: 30 }, (_, i) => ({ id: `mem-${i}`, charId: 'a', archiveKey: scope, content: `memory-stage-${i}`, createdAt: at(i), updatedAt: at(i), pinned: i === 1 })));
  writeStoredValue('yyphone:memory-journal', Array.from({ length: 30 }, (_, i) => ({ id: `jr-${i}`, charId: 'a', archiveKey: scope, content: `journal-stage-${i}`, to: at(i), createdAt: at(i) })));
  const s = readPerspectiveSnapshot('a');
  for (const stage of [0, 1, 29]) assert(s.sources.some(source => source.text === `memory-stage-${stage}`));
  for (const stage of [0, 13, 27, 28, 29]) assert(s.sources.some(source => source.text === `journal-stage-${stage}`));
  assert.equal(s.sources.filter(i => i.kind === 'memory').length, PERSPECTIVE_MEMORY_LIMIT);
  assert.equal(s.sources.filter(i => i.kind === 'journal').length, PERSPECTIVE_JOURNAL_LIMIT);
});

test('parser accepts free-form long prose without evidence IDs or fixed sections and preserves the complete ending', () => {
  const long = { title: '一份不同的观察', body: Array.from({ length: 18 }, (_, i) => `第${i + 1}段。${'相处带来的认识需要放回具体的关系与处境里理解。'.repeat(6)}`).join('\n\n') + '\n\n这是长文真正的结尾。' };
  const parsed = parseCharacterPerspective(JSON.stringify(long));
  assert.equal(parsed.body, long.body); assert(parsed.body.length > 2400); assert(parsed.body.endsWith('这是长文真正的结尾。')); assert(!('sections' in parsed)); assert(!('sources' in parsed));
  assert.throws(() => parseCharacterPerspective(JSON.stringify({ title: '空正文', body: '  ' })), /没有写完整/);
  assert.throws(() => parseCharacterPerspective(JSON.stringify({ title: '旧模板', sections: [] })), /没有写完整/);
});

test('generation uses the configured API and grounded role perspective, without writing chats, memories, cursors or reports', async () => {
  const before = [...values]; let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++; const body = JSON.parse(String(init?.body)); const system = body.messages[0].content, material = JSON.parse(body.messages[1].content);
    assert.match(system, /不纯夸赞/); assert.match(system, /成长不等于更听我的话/); assert.match(system, /speaker=user/); assert.match(system, /不是行为证据/);
    assert.match(system, /1600至2400/); assert.match(system, /逐渐/); assert.match(system, /不要套固定的四栏/); assert.match(system, /不逐字引用或转述某条消息/); assert.match(system, /最近一次争执/);
    assert.equal(material.character.persona, '重视独立、说话克制'); assert.equal(material.character.worldBooks.length, 1);
    assert.equal(material.background.recentInteraction[0].speaker, 'user'); assert.equal(material.background.relationshipOverTime.length, 1); assert.equal(material.background.relationshipMemories.length, 1);
    assert(!('id' in material.background.recentInteraction[0])); assert(body.max_tokens >= 8000); assert(!String(init?.body).includes('PRIVATE_THOUGHT'));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(rawReport()) } }] }), { status: 200 });
  };
  const s = readPerspectiveSnapshot('a'); await generateCharacterPerspective(s, new AbortController().signal);
  assert.equal(calls, 1); assert.deepEqual([...values], before);
});

test('no user interaction means no speculative API call, even if a persona or unrelated memory exists', async () => {
  const all = read('yyphone:wechat-chats'); all[0].messages = []; writeStoredValue('yyphone:wechat-chats', all);
  globalThis.fetch = async () => { throw new Error('must not call'); };
  await assert.rejects(generateCharacterPerspective(readPerspectiveSnapshot('a'), new AbortController().signal), /先和这位角色聊聊天/);
});

test('cancelled or stale generation cannot produce a usable report', async () => {
  const s = readPerspectiveSnapshot('a'); const controller = new AbortController();
  globalThis.fetch = async () => { controller.abort(); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(rawReport()) } }] })); };
  await assert.rejects(generateCharacterPerspective(s, controller.signal), { name: 'AbortError' });
  globalThis.fetch = async () => { await changeChatArchive('a-chat', { mode: 'branch' }); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(rawReport()) } }] })); };
  await assert.rejects(generateCharacterPerspective(s, new AbortController().signal), /存档/);
});

test('explicit injection is idempotent, preserves other chats and writes only an attributed history note, excluded from automatic memory', async () => {
  const s = readPerspectiveSnapshot('a'), r = reportFor(), before = read('yyphone:wechat-chats');
  const memoryBefore = readStorageString('yyphone:memory-items'); const journalsBefore = readStorageString('yyphone:memory-journal');
  await Promise.all([injectCharacterPerspective(s, r), injectCharacterPerspective(s, r)]);
  const after = read('yyphone:wechat-chats'); assert.equal(after[0].messages.length, before[0].messages.length + 1); assert.deepEqual(after[1], before[1]); assert.deepEqual(after[0].archives, before[0].archives);
  const note = after[0].messages.at(-1); assert.equal(note.source, 'character-perspective'); assert.equal(note.kind, 'context-note'); assert.match(note.text, /不是玩家自述/);
  assert.match(toMessageContent(note), /玩家主动分享的角色视角/); assert.match(toMessageContent(note), /不是玩家自述、客观人格诊断/);
  assert(!readDirectMessages('a').some(m => m.id === note.id)); assert.equal(readStorageString('yyphone:memory-items'), memoryBefore); assert.equal(readStorageString('yyphone:memory-journal'), journalsBefore);
  assert(note.content.endsWith(r.body));
  const prompt = JSON.stringify(buildPrompt({ chatId: 'a-chat', timeAwarenessEnabled: false })); assert(prompt.includes(r.title));
  after[0].currentChatHistoryCount = 1; after[0].messages.push({ id: 'later', senderId: 'user', text: 'LATER_ONLY', createdAt: new Date().toISOString() }, { id: 'later-reply', senderId: 'a', text: 'LATER_REPLY', createdAt: new Date().toISOString() }); writeStoredValue('yyphone:wechat-chats', after);
  assert(!JSON.stringify(buildPrompt({ chatId: 'a-chat', timeAwarenessEnabled: false })).includes(r.title));
});

test('switching away and back, switching user persona or deleting the contact prevents cross-timeline injection', async () => {
  const s = readPerspectiveSnapshot('a'), r = reportFor();
  const branch = await changeChatArchive('a-chat', { mode: 'branch' }); await assert.rejects(injectCharacterPerspective(s, r), /已变化/);
  await changeChatArchive('a-chat', { mode: 'switch', targetId: 'archive-default' }, branch); assert.throws(() => assertPerspectiveCurrent(s), /已变化/);
  const fresh = readPerspectiveSnapshot('a'); writeStoredValue('pocketos:personas', { activeProfileId: 'q', profiles: [{ id: 'q', nickname: '另一位' }] }); await assert.rejects(injectCharacterPerspective(fresh, r), /已变化/);
  writeStoredValue('pocketos:personas', { activeProfileId: 'p', profiles: [{ id: 'p', nickname: '小雨' }] }); writeStoredValue('pocketos:wechat-contacts', []); await assert.rejects(injectCharacterPerspective(fresh, r), /已变化/);
  assert(!read('yyphone:wechat-chats')[0].messages.some((m: any) => m.id === `perspective-note:${r.id}`));
});

test('a failed write leaves all original data intact and a retry writes exactly once', async () => {
  const s = readPerspectiveSnapshot('a'), r = reportFor(); const before = readStorageString('yyphone:wechat-chats');
  failKey = 'yyphone:wechat-chats'; await assert.rejects(injectCharacterPerspective(s, r), /QUOTA_TEST/); assert.equal(readStorageString('yyphone:wechat-chats'), before);
  await injectCharacterPerspective(s, r); assert.equal(read('yyphone:wechat-chats')[0].messages.length, 5);
});
