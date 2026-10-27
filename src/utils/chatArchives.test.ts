import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { changeChatArchive } from './chatArchives';
import { activeMemoryArchive, chatArchiveKey, deleteMemoryArchive, guardMemoryArchive } from './memoryArchives';
import { buildMemoryInjection, readEmbeddings, readMemories, readMemorySettings, writeMemories } from './memoryData';
import { readGrowthNotes, readJournalEntries, readJournalSettings, writeJournalEntries } from './journalData';
import { readGroupJournal } from './groupJournal';
import { ALIAS_ACCOUNTS_KEY, buildAliasMemoryContext, readAliasState, sendAliasMessage, visibleAliasThreads } from './aliasAccounts';
import { buildPaperMemoryInjection } from './paperNotes';
import { buildPrompt } from './buildPrompt';

const values = new Map<string, string>();let failKey = '';
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: () => true, localStorage: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (key === failKey) { failKey = ''; throw new Error('QUOTA_TEST'); } values.set(key, value); },
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const read = (key: string) => JSON.parse(readStorageString(key) || 'null');
const sourceScope = chatArchiveKey('a', 'archive-default');
const stamp = (i: number) => `2026-10-20T10:0${i}:00.000Z`;
const chat = () => read('yyphone:wechat-chats').find((item: any) => item.id === 'chat-a');

beforeEach(async () => {
  failKey = '';await clearDbStorage();
  writeStoredValue('pocketos:personas', { activeProfileId: 'player', profiles: [{ id: 'player', name: '玩家', nickname: '小雨', avatarUrl: '' }] });
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '谨慎温柔', worldBooks: [] }, { id: 'b', name: '时予', persona: '爽朗', worldBooks: [] }]);
  writeStoredValue('yyphone:wechat-chats', [
    { id: 'chat-a', type: 'direct', participantIds: ['a'], noteName: '', context: '', avatars: {}, updatedAt: stamp(3), messages: [
      { id: 'm1', senderId: 'user', text: '之前我们在桥边一起看过烟花', createdAt: stamp(1) },
      { id: 'm2', senderId: 'a', text: '我答应陪你去看海', thought: '我很在意这个约定', createdAt: stamp(2) },
      { id: 'm3', senderId: 'user', text: '那就从这里继续吧', createdAt: stamp(3) },
    ] },
    { id: 'chat-b', type: 'direct', participantIds: ['b'], activeArchiveId: 'other', noteName: '', context: '', avatars: {}, updatedAt: stamp(1), messages: [] },
  ]);
  const memory = { content: '我答应陪玩家去看海', category: 'promise', importance: 5, pinned: true, createdAt: stamp(2), updatedAt: stamp(2), recallCount: 2, source: 'chat' };
  writeStoredValue('yyphone:memory-items', [{ ...memory, id: 'mem-a', charId: 'a' }, { ...memory, id: 'shared', charId: 'shared', content: '玩家的通用偏好' }, { ...memory, id: 'mem-b', charId: 'b', content: '另一位角色的记忆' }]);
  writeStoredValue('yyphone:memory-embeddings', { 'mem-a': { m: 'embedding-test', v: [0.2, 0.4] }, 'mem-b': { m: 'other', v: [0.5] } });
  const entry = { charId: 'a', from: stamp(1), to: stamp(2), fromMessageId: 'm1', toMessageId: 'm2', messageCount: 2, createdAt: stamp(2), source: 'manual' };
  writeStoredValue('yyphone:memory-journal', [{ ...entry, id: 'jr1', level: 1, content: '桥边烟花与看海约定', mergedInto: 'jr2' }, { ...entry, id: 'jr2', level: 2, content: '阶段回顾：我们约好一起看海' }]);
  writeStoredValue('yyphone:memory-growth', [{ id: 'gr1', charId: 'a', relationship: '比以前更信任', changes: '愿意说出期待', habits: '', status: 'active', basedOnUntil: stamp(2), createdAt: stamp(2) }]);
  writeStoredValue('yyphone:memory-settings', { cursors: { a: stamp(2), b: stamp(1) }, topK: 3 });
  writeStoredValue('yyphone:memory-journal-settings', { journalCursors: { a: stamp(2) }, journalEvery: 60, journalPrompt: '保留约定' });
  writeStoredValue(ALIAS_ACCOUNTS_KEY, { profiles: [{ id: 'p', owner: 'user', userProfileId: 'player', name: '晚风', handle: 'night_wind', avatarUrl: '', bio: '', createdAt: stamp(1) }],
    threads: [{ id: 'alias-source', charId: 'a', userProfileId: 'player', archiveKey: sourceScope, userAccountId: 'p', characterAccountId: 'main', requester: 'user', status: 'accepted', requestText: '认识一下', requestReply: '你好', identity: 'unknown', blocked: false, unread: 0, createdAt: stamp(1), updatedAt: stamp(2), revision: 2, activityId: 'already-mentioned', mainMentionedActivityId: 'already-mentioned', messages: [{ id: 'am', from: 'user', text: '只是路过问声好', createdAt: stamp(2), identityAtTime: 'unknown' }] }],
    autoEnabled: false, checks: { [JSON.stringify(['a', sourceScope, 'player'])]: 123 }, lastError: '' });
  writeStoredValue('yyphone:paper-notes', { version: 1, days: {}, notes: [], memories: [{ id: 'paper-original', date: '2026-10-20', charId: 'a', chatId: 'chat-a', archiveKey: sourceScope, kind: 'thought', content: '纸条里的那句没说出口的话' }] });
});

test('a branch inherits the exact conversation, independent memories and vectors, merged journal graph, growth and cursors', async () => {
  const originalMessages = structuredClone(chat().messages);
  const id = await changeChatArchive('chat-a', { mode: 'branch', name: '去看海' }, 'archive-default');
  const current = chat();assert.equal(current.activeArchiveId, id);assert.deepEqual(current.messages, originalMessages);assert.deepEqual(current.archives[0].messages, originalMessages);
  assert.equal(current.archives[1].parentArchiveId, 'archive-default');assert.equal(current.archives[1].forkMessageId, 'm3');assert.equal(current.archives[1].origin, 'branch');
  const memories = readMemories(), copied = memories.find(m => m.charId === 'a')!;
  assert.notEqual(copied.id, 'mem-a');assert.equal(copied.archiveKey, chatArchiveKey('a', id));assert.equal(copied.content, '我答应陪玩家去看海');assert.equal(memories.filter(m => m.charId === 'shared').length, 1);
  assert.equal(read('yyphone:memory-items').find((m: any) => m.id === 'mem-a').archiveKey, sourceScope);
  assert.equal(read('yyphone:memory-items').find((m: any) => m.id === 'mem-b').archiveKey, chatArchiveKey('b', 'other'));
  assert.deepEqual(readEmbeddings()[copied.id], readEmbeddings()['mem-a']);
  const journal = readJournalEntries();assert.equal(journal.length, 2);assert.equal(journal.find(e => e.level === 1)?.mergedInto, journal.find(e => e.level === 2)?.id);assert(journal.every(e => !['jr1', 'jr2'].includes(e.id)));assert.equal(journal[0].fromMessageId, 'm1');
  assert.notEqual(readGrowthNotes()[0].id, 'gr1');assert.equal(readGrowthNotes()[0].status, 'active');
  assert.equal(readMemorySettings().cursors.a, stamp(2));assert.equal(readJournalSettings().journalCursors.a, stamp(2));assert.equal(readJournalSettings().journalEvery, 60);
  const alias = visibleAliasThreads()[0];assert.notEqual(alias.id, 'alias-source');assert.equal(alias.identity, 'unknown');assert.equal(alias.mainMentionedActivityId, 'already-mentioned');assert.equal(readAliasState().checks[JSON.stringify(['a', chatArchiveKey('a', id), 'player'])], 123);
  assert.match(buildPaperMemoryInjection(['a'], 'direct'), /纸条里的那句/);
});

test('editing, continuing and deleting branch memories cannot change the saved source or sibling timelines', async () => {
  const branch = await changeChatArchive('chat-a', { mode: 'branch' });
  writeMemories(readMemories().map(m => m.charId === 'a' ? { ...m, content: 'BRANCH_ONLY_MEMORY' } : m));
  writeJournalEntries(readJournalEntries().map(e => ({ ...e, content: 'BRANCH_ONLY_JOURNAL' })));
  const all = read('yyphone:wechat-chats');all[0].messages.push({ id: 'branch-new', senderId: 'a', text: 'BRANCH_ONLY_DIALOGUE', createdAt: stamp(4) });writeStoredValue('yyphone:wechat-chats', all);
  sendAliasMessage(visibleAliasThreads()[0].id, 'BRANCH_ONLY_ALIAS');
  const oldGuard = guardMemoryArchive('a');
  await changeChatArchive('chat-a', { mode: 'switch', targetId: 'archive-default' });
  assert.throws(oldGuard, /存档/);assert(!JSON.stringify(chat().messages).includes('BRANCH_ONLY_DIALOGUE'));assert.equal(readMemories().find(m => m.charId === 'a')?.content, '我答应陪玩家去看海');assert(!JSON.stringify(readJournalEntries()).includes('BRANCH_ONLY_JOURNAL'));assert(!buildAliasMemoryContext(['a']).includes('BRANCH_ONLY_ALIAS'));
  await changeChatArchive('chat-a', { mode: 'switch', targetId: branch });assert.match(JSON.stringify(chat().messages), /BRANCH_ONLY_DIALOGUE/);assert.match(buildAliasMemoryContext(['a']), /BRANCH_ONLY_ALIAS/);
  await changeChatArchive('chat-a', { mode: 'switch', targetId: 'archive-default' });deleteMemoryArchive('a', branch);
  assert.equal(readMemories().find(m => m.charId === 'a')?.id, 'mem-a');assert.equal(readJournalEntries().length, 2);assert(readEmbeddings()['mem-a']);assert(!read('yyphone:memory-items').some((m: any) => m.archiveKey === chatArchiveKey('a', branch)));assert.equal(readAliasState().threads.length, 1);
});

test('restart saves the current scene but starts with no character memory, journals, growth, cursors or alias history', async () => {
  const id = await changeChatArchive('chat-a', { mode: 'restart', name: '重开故事' });
  assert.equal(chat().messages.length, 0);assert.equal(chat().archives[0].messages.length, 3);assert.equal(chat().archives[1].origin, 'restart');
  assert(!readMemories().some(m => m.charId === 'a'));assert(readMemories().some(m => m.charId === 'shared'));assert.deepEqual(readJournalEntries(), []);assert.deepEqual(readGrowthNotes(), []);assert.equal(readMemorySettings().cursors.a, undefined);assert.equal(readJournalSettings().journalCursors.a, undefined);assert.equal(visibleAliasThreads().length, 0);assert.equal(buildPaperMemoryInjection(['a'], 'direct'), '');
  await changeChatArchive('chat-a', { mode: 'switch', targetId: 'archive-default' }, id);assert.equal(chat().messages.length, 3);assert.equal(readJournalEntries().length, 2);assert.equal(readGrowthNotes().length, 1);assert.equal(readMemorySettings().cursors.a, stamp(2));
});

test('nested branches inherit the selected fork point rather than the latest content of their ancestor', async () => {
  const a = await changeChatArchive('chat-a', { mode: 'branch', name: 'A' });
  writeMemories(readMemories().map(m => m.charId === 'a' ? { ...m, content: 'A_PAST' } : m));
  const b = await changeChatArchive('chat-a', { mode: 'branch', name: 'B' });assert.equal(chat().archives.find((s: any) => s.id === b).parentArchiveId, a);assert.equal(readMemories().find(m => m.charId === 'a')?.content, 'A_PAST');
  await changeChatArchive('chat-a', { mode: 'switch', targetId: 'archive-default' });writeMemories(readMemories().map(m => m.charId === 'a' ? { ...m, content: 'ORIGINAL_FUTURE' } : m));
  await changeChatArchive('chat-a', { mode: 'switch', targetId: b });assert.equal(readMemories().find(m => m.charId === 'a')?.content, 'A_PAST');
  assert.equal(new Set(read('yyphone:memory-items').map((m: any) => m.id)).size, read('yyphone:memory-items').length);
});

test('group and observer branches retain their own summary cursor and remap every merged journal parent', async () => {
  for (const type of ['group', 'observer']) {
    const chats = read('yyphone:wechat-chats');chats.push({ id: type, type, participantIds: ['a', 'b'], groupTitle: '朋友', updatedAt: stamp(3), messages: structuredClone(chat().messages) });writeStoredValue('yyphone:wechat-chats', chats);
    const entries = [1, 2].map(level => ({ id: `g${level}`, level, from: stamp(1), to: stamp(2), fromMessageId: 'm1', toMessageId: 'm2', messageCount: 2, content: `群回顾${level}`, source: 'auto', createdAt: stamp(2), ...(level === 1 ? { mergedInto: 'g2' } : {}) }));
    const previous = read('yyphone:group-journal') || { version: 1, groups: {} };
    previous.groups[type] = { auto: true, every: 70, archives: { 'archive-default': { entries, cursor: { id: 'm2', createdAt: stamp(2) }, lastError: '' } } };writeStoredValue('yyphone:group-journal', previous);
    const id = await changeChatArchive(type, { mode: 'branch' });const state = readGroupJournal(type);assert.equal(state.entries.length, 2);assert.equal(state.entries[0].mergedInto, state.entries[1].id);assert.equal(state.cursor?.id, 'm2');assert.equal(state.auto, true);
    const raw = read('yyphone:group-journal').groups[type];assert.deepEqual(raw.archives['archive-default'].entries, entries);assert.notEqual(raw.archives[id].entries[0].id, 'g1');
    await changeChatArchive(type, { mode: 'restart' });assert.equal(readGroupJournal(type).entries.length, 0);assert.equal(readGroupJournal(type).cursor, undefined);
  }
});

test('a failed atomic save leaves the chat and all memory stores exactly at the original point', async () => {
  const keys = ['yyphone:wechat-chats', 'yyphone:memory-items', 'yyphone:memory-journal', 'yyphone:memory-growth', 'yyphone:memory-embeddings', 'yyphone:memory-settings', 'yyphone:memory-journal-settings', ALIAS_ACCOUNTS_KEY, 'yyphone:paper-notes'];
  const before = Object.fromEntries(keys.map(key => [key, readStorageString(key)]));failKey = 'yyphone:wechat-chats';
  await assert.rejects(changeChatArchive('chat-a', { mode: 'branch' }), /QUOTA_TEST/);
  assert.deepEqual(Object.fromEntries(keys.map(key => [key, readStorageString(key)])), before);
  await changeChatArchive('chat-a', { mode: 'branch' });assert.equal(chat().archives.length, 2);
});

test('malformed memory and stale clicks cannot produce empty or duplicate half-created branches', async () => {
  const before = readStorageString('yyphone:wechat-chats');writeStoredValue('yyphone:memory-journal', { broken: true });
  await assert.rejects(changeChatArchive('chat-a', { mode: 'branch' }), /格式异常/);assert.equal(readStorageString('yyphone:wechat-chats'), before);
  writeStoredValue('yyphone:memory-journal', []);
  const first = changeChatArchive('chat-a', { mode: 'branch' }, 'archive-default');const second = changeChatArchive('chat-a', { mode: 'branch' }, 'archive-default');
  await first;await assert.rejects(second, /已变化/);assert.equal(chat().archives.length, 2);
});

test('switching away and back cancels previous jobs, and the current prompt sees only its selected branch', async () => {
  const oldGuard = guardMemoryArchive('a');const branch = await changeChatArchive('chat-a', { mode: 'branch' });const revision = chat().archiveRevision;
  writeMemories(readMemories().map(m => m.charId === 'a' ? { ...m, content: 'BRANCH_SECRET_CORE' } : m));
  const prompt = async () => JSON.stringify(buildPrompt({ chatId: 'chat-a', timeAwarenessEnabled: false, memoryInjection: await buildMemoryInjection(['a'], 'direct', '', () => '林渡', { localOnly: true }) }));
  assert.match(await prompt(), /BRANCH_SECRET_CORE/);
  await changeChatArchive('chat-a', { mode: 'switch', targetId: 'archive-default' });assert.throws(oldGuard, /存档/);assert.notEqual(chat().archiveRevision, revision);assert(!(await prompt()).includes('BRANCH_SECRET_CORE'));
  await changeChatArchive('chat-a', { mode: 'switch', targetId: branch });assert.match(await prompt(), /BRANCH_SECRET_CORE/);
});
