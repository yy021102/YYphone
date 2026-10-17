import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { INITIAL_USER_PROFILE } from '../data/mockData';
import { clearDbStorage } from './dbStorage';
import { DEFAULT_FONT_SETTINGS, normalizeFontUrl, readFontSettings } from './fontSettings';
import { DEFAULT_CHAT_RUNTIME, getRoundThought, isKeepAlivePlaying, isProactiveDue, permittedSticker, preserveRoundThoughts, proactiveInterval, readChatRuntimeSettings, startKeepAlive, stopKeepAlive } from './chatRuntime';
import { CALENDAR_APPEARANCE_KEY, MUSIC_APPEARANCE_KEY, captureHomeAppearance, isHomeAppearance } from './homeAppearance';
import { addMemoryCandidates, buildMemoryInjection, DEFAULT_MEMORY_SETTINGS, exportMemories, importMemories, readEmbeddings, readMemories, readMemorySettings, writeEmbeddings, writeMemories, writeMemorySettings } from './memoryData';
import { extractMemoryCandidates, requestMemoryAiText } from './memoryAi';
import { createJournalEntry, generateGrowthNote } from './journalAi';
import { buildGrowthInjection, buildJournalInjection, readGrowthNotes, readJournalEntries, readJournalSettings, writeGrowthNotes, writeJournalEntries, writeJournalSettings } from './journalData';
import { activeMemoryArchive, deleteCharacterMemoryArchives, deleteMemoryArchive, guardMemoryArchive, invalidateMemoryArchive, memoryArchiveLabel, prepareMemoryArchiveSwitch } from './memoryArchives';
import { applyMomentsAfterChat, buildMomentsInjection, MomentPost, MOMENTS_STORAGE_KEY } from './momentsData';
import { readSetting, saveSetting, SETTINGS_KEYS } from './settings';
import { emptyAlipayData, grantIntimatePay, readAlipayContacts, readAlipayData, requestIntimatePay, settleIncomingChatPayment, writeAlipayData, WECHAT_CHATS_STORAGE_KEY } from './alipayData';
import { parseAiJson, parseChatResponse, parseForumPost } from './aiResponse';
import { readStoredValue } from './localStorage';
import { estimateConversationTokens, estimatePromptTokens, estimateTextTokens } from './chatTokens';
import { normalizeForumHandle, readGeneratedForumHandles, resolveForumHandle } from './forumIdentity';
import { BUILTIN_STICKERS, CHAT_STICKERS_STORAGE_KEY, readAvailableChatStickers } from './chatStickers';
import { LITTLE_P_MESSAGES_KEY, LITTLE_P_VISIBLE_KEY, littlePHistory, littlePSystemPrompt, parseLittlePReply, readLittlePMessages, writeLittlePMessages, type LittlePMessage } from './littleP';
import { requestConfiguredAiText } from './aiApi';

const stored = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value); },
  removeItem: (key: string) => { stored.delete(key); },
  clear: () => stored.clear(),
  key: (index: number) => [...stored.keys()][index] ?? null,
  get length() { return stored.size; },
};
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });

beforeEach(async () => { await clearDbStorage(); });
afterEach(() => { mock.restoreAll(); });

const archiveFixture = (archiveId = 'old') => {
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'archive-chat', type: 'direct', participantIds: ['archive-char'], activeArchiveId: archiveId,
    archives: [{ id: 'old', name: '旧身份' }, { id: 'new', name: '新身份' }],
    messages: Array.from({ length: 25 }, (_, i) => ({
      id: `m-${i}`, senderId: i % 2 ? 'archive-char' : 'user', text: `身份信息${i}`,
      createdAt: `2026-10-17T10:00:${String(i).padStart(2, '0')}.000Z`,
    })),
  }]);
};

const archiveMemory = (id: string, charId = 'archive-char') => ({
  id, charId, content: `记忆${id}`, category: 'core' as const, importance: 5, pinned: true,
  createdAt: '2026-01-01', updatedAt: '2026-01-01', recallCount: 0, source: 'manual' as const,
});

test('legacy memory, journals, growth and cursors migrate to current archive and restore together', () => {
  archiveFixture();
  saveSetting('yyphone:memory-items', [archiveMemory('old'), archiveMemory('shared', 'shared'), archiveMemory('other', 'other')]);
  saveSetting('yyphone:memory-journal', [{ id: 'journal-old', charId: 'archive-char', content: '旧身份日记', level: 1, from: '2026-01-01', to: '2026-01-02', messageCount: 10, createdAt: '', source: 'manual' }]);
  saveSetting('yyphone:memory-growth', [{ id: 'growth-old', charId: 'archive-char', relationship: '旧身份关系', changes: '变化', habits: '', createdAt: '', basedOnUntil: '', status: 'active' }]);
  saveSetting('yyphone:memory-settings', { ...DEFAULT_MEMORY_SETTINGS, cursors: { 'archive-char': 'old-memory-cursor' } });
  saveSetting('yyphone:memory-journal-settings', { journalCursors: { 'archive-char': 'old-journal-cursor' } });
  prepareMemoryArchiveSwitch();
  assert.equal(memoryArchiveLabel('archive-char'), '旧身份');
  assert.ok(readMemories().find((m) => m.id === 'old')?.archiveKey);
  archiveFixture('new');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared', 'other']);
  assert.deepEqual(readJournalEntries(), []);
  assert.deepEqual(readGrowthNotes(), []);
  assert.equal(readMemorySettings().cursors['archive-char'], undefined);
  assert.equal(readJournalSettings().journalCursors['archive-char'], undefined);
  writeMemories([...readMemories(), archiveMemory('new')]);
  writeMemorySettings({ ...readMemorySettings(), cursors: { 'archive-char': 'new-memory-cursor' } });
  writeJournalSettings({ ...readJournalSettings(), journalCursors: { 'archive-char': 'new-journal-cursor' } });
  archiveFixture('old');
  assert.deepEqual(readMemories().filter((m) => m.charId === 'archive-char').map((m) => m.id), ['old']);
  assert.equal(readJournalEntries()[0].content, '旧身份日记');
  assert.equal(readGrowthNotes()[0].relationship, '旧身份关系');
  assert.equal(readMemorySettings().cursors['archive-char'], 'old-memory-cursor');
  assert.equal(readJournalSettings().journalCursors['archive-char'], 'old-journal-cursor');
  archiveFixture('new');
  assert.equal(readMemorySettings().cursors['archive-char'], 'new-memory-cursor');
  assert.equal(readJournalSettings().journalCursors['archive-char'], 'new-journal-cursor');
});

test('archive isolation applies to prompt memory, journal and growth injection and dedupe', async () => {
  Object.assign(window, { setTimeout, clearTimeout });
  archiveFixture();
  writeMemories([archiveMemory('old')]);
  writeJournalEntries([{ id: 'journal-old', charId: 'archive-char', content: '独属于旧档的经历', level: 1, from: '2026-01-01', to: '2026-01-02', messageCount: 10, createdAt: '', source: 'manual' }]);
  writeGrowthNotes([{ id: 'growth-old', charId: 'archive-char', relationship: '旧档恋人', changes: '', habits: '', createdAt: '', basedOnUntil: '', status: 'active' }]);
  assert.match((await buildMemoryInjection(['archive-char'], 'direct', '', () => '')).text, /记忆old/);
  assert.match(buildJournalInjection(['archive-char'], 'direct', ''), /独属于旧档的经历/);
  assert.match(buildGrowthInjection(['archive-char'], 'direct'), /旧档恋人/);
  archiveFixture('new');
  assert.equal((await buildMemoryInjection(['archive-char'], 'direct', '', () => '')).text, '');
  assert.equal(buildJournalInjection(['archive-char'], 'direct', ''), '');
  assert.equal(buildGrowthInjection(['archive-char'], 'direct'), '');
  const result = await addMemoryCandidates('archive-char', [{ content: '记忆old', category: 'core', importance: 5, pinned: true }], 'chat', DEFAULT_MEMORY_SETTINGS);
  assert.equal(result.added, 1);
  assert.equal(result.merged, 0);
  archiveFixture('old');
  assert.equal(readMemories()[0].id, 'old');
});

test('deleting an archive removes its memory, journals, growth, cursors and embeddings only', () => {
  archiveFixture();
  writeMemories([archiveMemory('old'), archiveMemory('shared', 'shared')]);
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, cursors: { 'archive-char': 'old-cursor' } });
  writeJournalEntries([{ id: 'j', charId: 'archive-char', content: '旧日记', level: 1, from: '', to: '', messageCount: 10, createdAt: '', source: 'manual' }]);
  writeGrowthNotes([{ id: 'g', charId: 'archive-char', relationship: '旧关系', changes: '', habits: '', createdAt: '', basedOnUntil: '', status: 'active' }]);
  archiveFixture('new');
  writeMemories([...readMemories(), archiveMemory('new')]);
  writeMemorySettings({ ...readMemorySettings(), cursors: { 'archive-char': 'new-cursor' } });
  writeEmbeddings({ old: { m: 'm', v: [1] }, new: { m: 'm', v: [2] }, shared: { m: 'm', v: [3] } });
  deleteMemoryArchive('archive-char', 'old');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared', 'new']);
  assert.equal(readMemorySettings().cursors['archive-char'], 'new-cursor');
  assert.deepEqual(Object.keys(readEmbeddings()).sort(), ['new', 'shared']);
  archiveFixture('old');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared']);
  assert.deepEqual(readJournalEntries(), []);
  assert.deepEqual(readGrowthNotes(), []);
  assert.equal(readMemorySettings().cursors['archive-char'], undefined);
  deleteCharacterMemoryArchives('archive-char');
  archiveFixture('new');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared']);
  assert.equal(readMemorySettings().cursors['archive-char'], undefined);
});

test('memory exports target current archive and imports explicitly belong to destination archive', () => {
  archiveFixture();
  writeMemories([archiveMemory('old')]);
  const exported = exportMemories('archive-char');
  archiveFixture('new');
  assert.equal(exportMemories('archive-char').memories.length, 0);
  const result = importMemories(exported, 'archive-char', ['archive-char']);
  assert.equal(result.items.length, 1);
  assert.equal(readMemories()[0].archiveKey, activeMemoryArchive('archive-char'));
  archiveFixture('old');
  assert.equal(readMemories()[0].id, 'old');
});

test('archive guards reject stale writes even after switching back to the same archive', () => {
  archiveFixture();
  writeMemories([archiveMemory('old')]);
  const old = readMemories();
  const guard = guardMemoryArchive('archive-char');
  archiveFixture('new');
  assert.throws(() => writeMemories(old), /存档已变化/);
  assert.throws(guard, /存档已切换/);
  archiveFixture('old');
  invalidateMemoryArchive('archive-char');
  assert.throws(guard, /存档已切换/);
  assert.equal(readMemories()[0].content, '记忆old');
});

test('in-flight memory extraction, journal and growth generation cannot write to another archive', async () => {
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, useSecondaryApi: true, secondaryApi: { endpoint: 'https://memory.invalid/v1', apiKey: 'test', model: 'mock' } });
  let changeArchive = false;
  mock.method(globalThis, 'fetch', async () => {
    if (changeArchive) archiveFixture('new');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"memories":[],"relationship":"旧关系","changes":"旧变化"}' } }] }));
  });
  for (const generate of [extractMemoryCandidates, createJournalEntry, generateGrowthNote]) {
    archiveFixture();
    changeArchive = true;
    await assert.rejects(generate('archive-char'), /存档已切换/);
    assert.deepEqual(readMemories(), []);
    assert.deepEqual(readJournalEntries(), []);
    assert.deepEqual(readGrowthNotes(), []);
    assert.equal(readJournalSettings().journalCursors['archive-char'], undefined);
  }
});

test('in-flight candidate embedding cannot restore deleted memories into a different archive', async () => {
  archiveFixture();
  mock.method(globalThis, 'fetch', async () => {
    archiveFixture('new');
    return new Response(JSON.stringify({ data: [{ embedding: [1, 0], index: 0 }] }));
  });
  await assert.rejects(addMemoryCandidates('archive-char', [{ content: '旧身份记忆', category: 'core', importance: 5, pinned: true }], 'chat', {
    ...DEFAULT_MEMORY_SETTINGS, embedding: { endpoint: 'https://embedding.invalid', apiKey: 'test', model: 'mock' },
  }), /存档已切换/);
  assert.deepEqual(readMemories(), []);
  assert.deepEqual(readEmbeddings(), {});
});

test('full input estimator includes every assembled message role and system context', () => {
  const messages = [
    { role: 'system' as const, content: '人设 世界书 记忆 挂载聊天 回复格式'.repeat(30) },
    { role: 'assistant' as const, content: '上一轮内容' },
    { role: 'system' as const, content: '表情包目录 调用规则'.repeat(20) },
    { role: 'user' as const, content: '下一次输入' },
  ];
  assert.equal(estimatePromptTokens(messages), 3 + messages.reduce((sum, message) => sum + 4 + estimateTextTokens(message.content), 0));
  for (let index = 0; index < messages.length; index += 1) {
    assert.ok(estimatePromptTokens(messages) > estimatePromptTokens(messages.filter((_, i) => i !== index)));
  }
});

test('memory preview includes core and related memories without embedding requests or recall writes', async () => {
  Object.assign(window, { setTimeout, clearTimeout });
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, embedding: { endpoint: 'https://embedding.invalid/v1', apiKey: 'test', model: 'model' } });
  const memories = [
    { id: 'core', charId: 'char', content: '核心人设', category: 'core' as const, pinned: true, importance: 5, createdAt: '2026-01-01', updatedAt: '2026-01-01', recallCount: 0, source: 'manual' as const },
    { id: 'related', charId: 'char', content: '一起看星星', category: 'event' as const, pinned: false, importance: 4, createdAt: '2026-01-01', updatedAt: '2026-01-01', recallCount: 0, source: 'manual' as const },
  ];
  writeMemories(memories);
  const before = readMemories();
  const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('Preview must not use network'); });
  const injection = await buildMemoryInjection(['char'], 'direct', '一起看星星', () => '角色', { localOnly: true });
  assert.deepEqual(injection.ids, ['core', 'related']);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(readMemories(), before);
});

test('Little P persists its own history, limits context to 100 and keeps visibility independent', () => {
  const messages: LittlePMessage[] = Array.from({ length: 125 }, (_, i) => ({ id: `${i}`, role: i % 2 ? 'assistant' : 'user', text: `消息${i}` }));
  messages[124].sticker = BUILTIN_STICKERS[0];
  writeLittlePMessages(messages);
  const history = littlePHistory(readLittlePMessages());
  assert.equal(readLittlePMessages().length, 125);
  assert.equal(history.length, 100);
  assert.equal(history[0].content, '消息25');
  assert.ok(history[99].content.includes(BUILTIN_STICKERS[0].description));
  saveSetting(LITTLE_P_VISIBLE_KEY, false);
  assert.equal(readLittlePMessages().length, 125);
  assert.deepEqual(readStoredValue(WECHAT_CHATS_STORAGE_KEY, [], Array.isArray), []);
  writeLittlePMessages([]);
  assert.deepEqual(readLittlePMessages(), []);
  assert.equal(readSetting(LITTLE_P_VISIBLE_KEY, true, (value): value is boolean => typeof value === 'boolean'), false);
  assert.deepEqual(readStoredValue(LITTLE_P_MESSAGES_KEY, [], Array.isArray), []);
});

test('Little P only accepts text and catalogue stickers, never action or payment messages', () => {
  const replies = parseLittlePReply('```json\n{"reply":[{"text":"嗨，来陪你啦！"},{"stickerId":"builtin-1"}]}\n```', BUILTIN_STICKERS);
  assert.equal(replies[0].text, '嗨，来陪你啦！');
  assert.equal(replies[1].sticker?.id, 'builtin-1');
  for (const invalid of [
    '{"reply":[]}', '{"reply":[{"stickerId":"unknown"}]}',
    '{"reply":[{"kind":"transfer","text":"转账","amount":100}]}',
    '{"reply":[{"text":"已操作","action":"clear"}]}',
    '{"reply":[{"text":"你好"}],"intimatePayAction":{"type":"grant"}}',
    '{"reply":[{"stickerId":"builtin-1"},{"stickerId":"builtin-2"}]}',
    JSON.stringify({ reply: ['{"reply":["不应直接显示元数据"]}'] }),
  ]) assert.throws(() => parseLittlePReply(invalid, BUILTIN_STICKERS), /小P|AI/);
  assert.match(littlePSystemPrompt(BUILTIN_STICKERS), /没有工具和代操作能力/);
  assert.match(littlePSystemPrompt(BUILTIN_STICKERS), /最近 100 条/);
});

test('Little P reuses built-in and imported stickers', () => {
  saveSetting(CHAT_STICKERS_STORAGE_KEY, [{ id: 'custom-1', imageUrl: 'https://example.com/sticker.png', description: '自定义' }]);
  const available = readAvailableChatStickers();
  assert.equal(available.length, BUILTIN_STICKERS.length + 1);
  assert.equal(available.at(-1)?.id, 'custom-1');
});

test('shared AI helper supports isolated Little P history on OpenAI and Gemini without changing default worldbook behavior', async () => {
  saveSetting('yyphone:world-books', [{ id: 'private-world', name: 'private', isGlobal: true, entries: [{ id: 'e', title: 'private', content: 'PRIVATE_WORLDBOOK_SENTINEL', depth: 'front' }] }]);
  const bodies: Record<string, unknown>[] = [];
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":["你好"]}' } }], candidates: [{ content: { parts: [{ text: '{"reply":["你好"]}' }] } }] }));
  });
  const history = [{ role: 'user' as const, content: '旧消息' }, { role: 'assistant' as const, content: '上次回答' }];
  for (const endpoint of ['https://test.invalid/v1', 'https://generativelanguage.googleapis.com']) {
    await requestConfiguredAiText('ONLY_LITTLE_P', '这次输入', { api: { endpoint, apiKey: 'test', model: 'mock' }, history, includeGlobalWorldBooks: false });
  }
  assert.deepEqual(bodies[0].messages, [{ role: 'system', content: 'ONLY_LITTLE_P' }, ...history, { role: 'user', content: '这次输入' }]);
  assert.deepEqual(bodies[1].contents, [
    { role: 'user', parts: [{ text: '旧消息' }] }, { role: 'model', parts: [{ text: '上次回答' }] }, { role: 'user', parts: [{ text: '这次输入' }] },
  ]);
  assert.equal(JSON.stringify(bodies).includes('PRIVATE_WORLDBOOK_SENTINEL'), false);
  await requestConfiguredAiText('DEFAULT', '默认请求', { api: { endpoint: 'https://test.invalid/v1', apiKey: 'test' } });
  assert.ok(JSON.stringify(bodies[2]).includes('PRIVATE_WORLDBOOK_SENTINEL'));
});

test('API configuration expansion defaults open and persists both collapse and expansion', () => {
  const read = () => readSetting(SETTINGS_KEYS.apiConfigExpanded, true, (value): value is boolean => typeof value === 'boolean');
  assert.equal(read(), true);
  saveSetting(SETTINGS_KEYS.apiConfigExpanded, false);
  assert.equal(read(), false);
  saveSetting(SETTINGS_KEYS.apiConfigExpanded, true);
  assert.equal(read(), true);
});

test('conversation token estimates cover Chinese, English, quotes and attachment text but not thoughts or image URLs', () => {
  assert.equal(estimateTextTokens(''), 0);
  assert.equal(estimateTextTokens('abcdefgh'), 2);
  assert.equal(estimateTextTokens('你好世界'), 6);
  assert.equal(estimateTextTokens('🙂'), 3);
  assert.equal(estimateConversationTokens([]), 0);
  const message = { id: 'tokens-1', senderId: 'char', text: '你好世界', createdAt: '' };
  assert.equal(estimateConversationTokens([message]), 10);
  assert.equal(estimateConversationTokens([{ ...message, thought: '很长的心声'.repeat(100) }]), 10);
  assert.ok(estimateConversationTokens([{ ...message, replyTo: { id: 'quote', senderName: '玩家', text: '引用测试' } }]) > 10);
  assert.ok(estimateConversationTokens([{ ...message, kind: 'forum-forward', title: '帖子标题', content: '论坛正文'.repeat(20) }]) > 10);
  const image = { ...message, kind: 'image', text: '', imageUrl: 'https://example.com/huge-image.jpg' };
  const largeImage = { ...image, imageUrl: 'data:image/png;base64,' + 'A'.repeat(10000) };
  assert.equal(estimateConversationTokens([image]), estimateConversationTokens([largeImage]));
  assert.equal(estimateConversationTokens([message, message]), 20);
});

test('manual forum handles normalize @ and override cached generated identities', () => {
  assert.equal(normalizeForumHandle(' @moonlit_cocoa '), 'moonlit_cocoa');
  assert.equal(normalizeForumHandle('月下可可'), '月下可可');
  assert.equal(normalizeForumHandle(''), '');
  for (const invalid of ['@', '@@name', 'with space', 'a', 'a'.repeat(41), 'bad/id']) {
    assert.throws(() => normalizeForumHandle(invalid), /论坛 ID/);
  }
  const contact = { id: 'forum-character' };
  assert.equal(resolveForumHandle(contact, 'cocoa_after_dark'), 'cocoa_after_dark');
  assert.equal(resolveForumHandle({ ...contact, forumHandle: '@star_collector' }, 'ignored'), 'star_collector');
  assert.equal(readGeneratedForumHandles()[contact.id], 'cocoa_after_dark');
});

test('generated forum handles persist consistently across posts and comments without changing internal IDs', () => {
  const contact = { id: 'forum-char-unique' };
  const post = parseForumPost('{"content":"角色发帖","authorHandle":"夜航的纸飞机","comments":[]}');
  assert.equal(resolveForumHandle(contact, post.authorHandle), '夜航的纸飞机');
  assert.equal(resolveForumHandle(contact, 'another_new_id'), '夜航的纸飞机');
  assert.equal(resolveForumHandle(contact, undefined), '夜航的纸飞机');
  assert.equal(contact.id, 'forum-char-unique');
  assert.throws(() => resolveForumHandle({ id: 'unset-char' }, undefined), /未生成有效/);
  assert.throws(() => resolveForumHandle({ id: 'internal-char' }, 'internal-char'), /未生成有效/);
  saveSetting('pocketos:wechat-contacts', [{ ...contact, name: '角色', forumHandle: 'custom_handle' }]);
  assert.equal(readAlipayContacts()[0].forumHandle, 'custom_handle');
});

test('AI JSON accepts fences and explanatory wrappers without exposing metadata as text', () => {
  const reply = { reply: ['第一句', { kind: 'text', text: '第二句，有括号 } 和引号 "' }], thought: '心声' };
  for (const output of [JSON.stringify(reply), `\`\`\`json\n${JSON.stringify(reply)}\n\`\`\``, `<think>推理</think>以下是结果：\n${JSON.stringify(reply)}\n结束`]) {
    assert.deepEqual(parseChatResponse(output), reply);
  }
  assert.deepEqual(parseChatResponse(JSON.stringify({ reply: JSON.stringify(['第一句', '第二句']) })).reply, ['第一句', '第二句']);
  assert.throws(() => parseChatResponse('{"reply":["未完成"'), /JSON/);
  assert.throws(() => parseChatResponse('普通文本而非约定的对象'), /JSON/);
  assert.throws(() => parseChatResponse('{"thought":"只有心声"}'), /reply/);
  assert.throws(() => parseChatResponse(JSON.stringify({ reply: ['{"thought":"泄漏元数据","reply":["第一句"]}'] })), /元数据/);
  assert.throws(() => parseChatResponse(JSON.stringify({ reply: ['你好，以下是内容：{"reply":["第一句"],"thought":"元数据"}'] })), /元数据/);
  assert.deepEqual(parseAiJson('{"reply":["<think>正文中的标记</think>"]}'), { reply: ['<think>正文中的标记</think>'] });
  assert.throws(() => parseAiJson('说明 {"reply": [坏数据]}'), /JSON/);
});

test('custom-board post output accepts an optional title and wrapped post but validates content', () => {
  const comment = { speakerType: 'passerby', speakerId: 'passerby', content: '评论内容' };
  assert.deepEqual(parseForumPost(`结果：\n\`\`\`json\n${JSON.stringify({ post: { content: '自建板块正文', comments: [comment] } })}\n\`\`\``), {
    title: '', content: '自建板块正文', comments: [comment],
  });
  assert.deepEqual(parseForumPost('{"content":"不含评论的正文"}'), { title: '', content: '不含评论的正文', comments: [] });
  assert.throws(() => parseForumPost('{"content":{},"comments":[]}'), /帖子/);
});

test('incoming money only credits on acceptance and cannot be settled twice or from legacy cards', () => {
  const before = { ...emptyAlipayData(), balance: 20 };
  const payment = { id: 'payment-1', kind: 'transfer', senderId: 'char', recipientId: 'user', amount: '88.88', paymentStatus: 'pending' as const };
  const received = settleIncomingChatPayment(before, payment, 'received');
  assert.equal(before.balance, 20);
  assert.equal(received.balance, 108.88);
  assert.equal(received.chatSettlements?.[payment.id], 'received');
  assert.throws(() => settleIncomingChatPayment(received, payment, 'received'), /已处理/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, paymentStatus: undefined }, 'received'), /历史/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, senderId: 'user' }, 'received'), /不可领取/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, amount: 'NaN' }, 'received'), /金额/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, amount: '0.001' }, 'received'), /金额/);
  const redPacket = settleIncomingChatPayment(before, { ...payment, kind: 'red-packet' }, 'received');
  assert.equal(redPacket.balance, 108.88);
});

test('returning a pending transfer changes status without adding or subtracting player funds', () => {
  const before = { ...emptyAlipayData(), balance: 33 };
  const payment = { id: 'payment-return', kind: 'transfer', senderId: 'char', recipientId: 'user', amount: '10', paymentStatus: 'pending' as const };
  const returned = settleIncomingChatPayment(before, payment, 'returned');
  assert.equal(returned.balance, 33);
  assert.equal(returned.chatSettlements?.[payment.id], 'returned');
  assert.throws(() => settleIncomingChatPayment(returned, payment, 'received'), /已处理/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, kind: 'red-packet' }, 'returned'), /只有/);
});

test('intimate-pay requests create a pending user message rather than directly granting a card', () => {
  const contact = { id: 'request-char', name: '申请测试角色' };
  requestIntimatePay(contact, 2000, '希望买日用品');
  assert.equal(readAlipayData().intimateCards.length, 0);
  const chats = readStoredValue(WECHAT_CHATS_STORAGE_KEY, [] as Array<{ messages: Array<{ senderId: string; intimateStatus: string; amount: string }> }>, (value): value is Array<{ messages: Array<{ senderId: string; intimateStatus: string; amount: string }> }> => Array.isArray(value));
  assert.equal(chats[0].messages[0].senderId, 'user');
  assert.equal(chats[0].messages[0].intimateStatus, 'pending');
  assert.equal(chats[0].messages[0].amount, '2000.00');
  assert.throws(() => requestIntimatePay(contact, 2000, ''), /待回应/);
  assert.throws(() => requestIntimatePay(contact, -1, ''), /额度/);
});

test('character grants and limit changes preserve existing usage and unrelated finances', () => {
  const oldWindow = window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, dispatchEvent: () => true } });
  try {
    const contact = { id: 'grant-char', name: '赠予测试角色' };
    writeAlipayData({ ...emptyAlipayData(), balance: 50, chatSettlements: { earlier: 'received' } });
    grantIntimatePay(contact, 3000, '拿去用吧');
    assert.equal(readAlipayData().intimateCards[0].monthlyLimit, 3000);
    assert.equal(readAlipayData().balance, 50);
    const current = readAlipayData();
    current.intimateCards[0].usedAmount = 100;
    writeAlipayData(current);
    grantIntimatePay(contact, 5000, '额度调整');
    assert.equal(readAlipayData().intimateCards[0].usedAmount, 100);
    assert.equal(readAlipayData().intimateCards.length, 1);
    assert.equal(readAlipayData().chatSettlements?.earlier, 'received');
    assert.throws(() => grantIntimatePay(contact, Infinity, ''), /额度/);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: oldWindow });
  }
});

const post = (patch: Partial<MomentPost> = {}): MomentPost => ({
  id: 'post-1',
  authorId: 'user',
  authorName: '玩家',
  authorAvatar: '',
  authorType: 'user',
  content: '今天去看海了',
  createdAt: '2026-10-17T10:00:00.000Z',
  likes: [],
  comments: [],
  seenByCharIds: [],
  seenCommentIdsByChar: {},
  ...patch,
});
const comment = (id: string, authorId = 'other') => ({
  id, authorId, authorName: authorId, content: '海边天气真好',
  createdAt: '2026-10-17T11:00:00.000Z',
});
const inject = () => buildMomentsInjection(['char-1'], false, () => '测试角色');

test('a read moment only delivers new comments and does not rediscover the body', () => {
  saveSetting(MOMENTS_STORAGE_KEY, [post()]);
  const first = inject();
  assert.equal(first.marks[0].markBody, true);
  applyMomentsAfterChat(first, []);
  assert.equal(inject().text, '');
  saveSetting(MOMENTS_STORAGE_KEY, [post({ seenByCharIds: ['char-1'], comments: [comment('new')] })]);
  const update = inject();
  assert.equal(update.marks[0].markBody, false);
  assert.match(update.text, /你已看过原动态，本次仅评论更新/);
  assert.match(update.text, /不得说/);
  applyMomentsAfterChat(update, []);
  assert.equal(inject().text, '');
});

test('existing character comments and likes imply the original moment was read', () => {
  for (const interaction of [
    { comments: [comment('own', 'char-1'), comment('new')] },
    { likes: [{ id: 'char-1', name: '测试角色' }], comments: [comment('new')] },
  ]) {
    saveSetting(MOMENTS_STORAGE_KEY, [post(interaction)]);
    assert.equal(inject().marks[0].markBody, false);
  }
});

test('editing a moment still allows rereading its changed body', () => {
  saveSetting(MOMENTS_STORAGE_KEY, [post({
    updatedAt: '2026-10-17T12:00:00.000Z',
    comments: [comment('old', 'char-1')],
    likes: [{ id: 'char-1', name: '测试角色' }],
  })]);
  assert.equal(inject().marks[0].markBody, true);
});

test('only delivered comments become read, and observer chats get no moments', () => {
  saveSetting(MOMENTS_STORAGE_KEY, [post({
    seenByCharIds: ['char-1'],
    comments: Array.from({ length: 12 }, (_, i) => comment(`comment-${i}`)),
  })]);
  const first = inject();
  assert.equal(first.marks[0].commentIds.length, 10);
  applyMomentsAfterChat(first, []);
  assert.deepEqual(inject().marks[0].commentIds, ['comment-0', 'comment-1']);
  assert.equal(buildMomentsInjection(['char-1'], true, () => '').text, '');
});

test('complete home appearance snapshots round-trip without profile identity fields', () => {
  const calendar = { background: 'calendar-image', disc: '', note: '日历便签' };
  const music = { background: 'music-image', disc: 'disc-image', note: '' };
  saveSetting(CALENDAR_APPEARANCE_KEY, calendar);
  saveSetting(MUSIC_APPEARANCE_KEY, music);
  const appearance = captureHomeAppearance({
    ...INITIAL_USER_PROFILE,
    avatarUrl: 'avatar-image',
    coverImageUrl: 'cover-image',
  });
  const imported: unknown = JSON.parse(JSON.stringify(appearance));
  assert.equal(isHomeAppearance(imported), true);
  assert.deepEqual(appearance.calendar, calendar);
  assert.deepEqual(appearance.music, music);
  assert.equal(appearance.profile.coverImageUrl, 'cover-image');
  assert.equal('name' in appearance.profile, false);
  assert.equal(isHomeAppearance({ ...appearance, music: { background: 1 } }), false);
  assert.equal(isHomeAppearance({ ...appearance, profile: { ...appearance.profile, avatarFrame: { enabled: true } } }), false);
});

test('forum contact data retains the bound avatar and editable nickname', () => {
  saveSetting('pocketos:wechat-contacts', [{
    id: 'char-1', name: '角色真名', avatarUrl: 'avatar-image', forumNickname: '月亮不加班',
  }]);
  assert.deepEqual(readAlipayContacts()[0], {
    id: 'char-1', name: '角色真名', avatarUrl: 'avatar-image', forumNickname: '月亮不加班',
  });
});

test('global font settings persist size and family with unchanged defaults', () => {
  assert.deepEqual(readFontSettings(), DEFAULT_FONT_SETTINGS);
  saveSetting(SETTINGS_KEYS.font, { scale: 1.3, family: 'serif' });
  assert.deepEqual(readFontSettings(), { scale: 1.3, family: 'serif' });
});

test('memory API is independent of the main API and covers journal generation', async () => {
  const urls: string[] = [];
  let content = '记忆整理结果';
  mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  writeMemorySettings({
    ...DEFAULT_MEMORY_SETTINGS,
    useSecondaryApi: true,
    secondaryApi: { endpoint: 'https://memory.example/v1', apiKey: 'test-memory-key', model: 'test-model' },
  });
  assert.equal(readMemorySettings().useSecondaryApi, true);
  assert.equal(await requestMemoryAiText('test system', 'test user'), '记忆整理结果');
  saveSetting('yyphone:wechat-chats', [{
    id: 'memory-api-chat', type: 'direct', participantIds: ['char-1'],
    messages: Array.from({ length: 10 }, (_, i) => ({
      id: `m-${i}`, senderId: 'user', text: '记住我喜欢看海',
      createdAt: `2026-10-17T10:00:${String(i).padStart(2, '0')}.000Z`,
    })),
  }]);
  content = JSON.stringify({ memories: [{ content: '玩家喜欢看海', category: 'fact', importance: 3, pinned: false }] });
  assert.equal((await extractMemoryCandidates('char-1')).candidates[0].content, '玩家喜欢看海');
  content = '记忆整理结果';
  assert.ok(await createJournalEntry('char-1'));
  assert.deepEqual(urls, [
    'https://memory.example/v1/chat/completions',
    'https://memory.example/v1/chat/completions',
    'https://memory.example/v1/chat/completions',
  ]);
});

test('memory secondary API also supports Gemini without a configured main API', async () => {
  let requestedUrl = '';
  mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini 记忆' }] } }] }));
  });
  writeMemorySettings({
    ...DEFAULT_MEMORY_SETTINGS,
    useSecondaryApi: true,
    secondaryApi: {
      endpoint: 'https://generativelanguage.googleapis.com',
      apiKey: 'test-gemini-key',
      model: 'gemini-test',
    },
  });
  assert.equal(await requestMemoryAiText('system', 'user'), 'Gemini 记忆');
  assert.match(requestedUrl, /\/v1beta\/models\/gemini-test:generateContent\?key=test-gemini-key$/);
});

test('memory follows the main API when disabled and never silently falls back when enabled', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: '主 API' } }] }));
  });
  saveSetting(SETTINGS_KEYS.apiPresets, [{
    id: 'main', name: 'main', endpoint: 'https://main.example/v1', apiKey: 'test-main-key',
  }]);
  assert.equal(await requestMemoryAiText('system', 'user'), '主 API');
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, useSecondaryApi: true });
  await assert.rejects(requestMemoryAiText('system', 'user'), /接口地址和密钥/);
  assert.equal(calls, 1);
});

test('all optional chat runtime features default to disabled and persist independently', () => {
  assert.deepEqual(readChatRuntimeSettings(), DEFAULT_CHAT_RUNTIME);
  saveSetting(SETTINGS_KEYS.chatRuntime, { ...DEFAULT_CHAT_RUNTIME, banners: true });
  assert.deepEqual(readChatRuntimeSettings(), { ...DEFAULT_CHAT_RUNTIME, banners: true });
});

test('proactive scheduling respects per-chat intervals, activity, blocking and opt-in', () => {
  const now = Date.parse('2026-10-18T00:00:00Z');
  const chat = {
    id: 'chat', type: 'direct', blocked: false, participantIds: ['char'],
    proactiveEnabled: true, proactiveIntervalMinutes: 5,
    updatedAt: new Date(now - 300_000).toISOString(),
  };
  assert.equal(isProactiveDue(chat, now - 1), false);
  assert.equal(isProactiveDue(chat, now), true);
  assert.equal(isProactiveDue({ ...chat, lastProactiveAt: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(isProactiveDue({ ...chat, updatedAt: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(isProactiveDue({ ...chat, proactiveEnabled: false }, now), false);
  assert.equal(isProactiveDue({ ...chat, blocked: true }, now), false);
  assert.equal(isProactiveDue({ ...chat, type: 'group' }, now), false);
  assert.equal(isProactiveDue({ ...chat, updatedAt: 'invalid' }, now), false);
  assert.equal(proactiveInterval(undefined), 30);
  assert.equal(proactiveInterval(0), 1);
  assert.equal(proactiveInterval(2000), 1440);
});

test('round thoughts remain on every message after deleting the former final message or pat', () => {
  const messages = [
    { id: 'a', senderId: 'char', replyBatchId: 'round-1', thought: '' },
    { id: 'b', senderId: 'char', replyBatchId: 'round-1', thought: '' },
    { id: 'c', senderId: 'char', replyBatchId: 'round-1', thought: '这一轮的心声', kind: 'pat' },
    { id: 'd', senderId: 'other', replyBatchId: 'round-1', thought: '' },
    { id: 'e', senderId: 'char', replyBatchId: 'round-2', thought: '另一轮的心声' },
  ];
  assert.equal(getRoundThought(messages[0], messages), '这一轮的心声');
  const retained = preserveRoundThoughts(messages).filter((message) => message.id !== 'c');
  assert.equal(retained[0].thought, '这一轮的心声');
  assert.equal(retained[1].thought, '这一轮的心声');
  assert.equal(retained[2].thought, '');
  assert.equal(retained[3].thought, '另一轮的心声');
  assert.equal(messages[0].thought, '');
});

test('sticker permissions distinguish all, selected categories and none', () => {
  assert.equal(permittedSticker(undefined, { category: '萌' }), true);
  assert.equal(permittedSticker([], { category: '萌' }), false);
  assert.equal(permittedSticker(['萌'], { category: '萌' }), true);
  assert.equal(permittedSticker(['萌'], { category: '抽象' }), false);
  assert.equal(permittedSticker(['默认'], {}), true);
});

test('font URLs are normalized, persisted, and reject unsafe or non-URL values', () => {
  assert.equal(normalizeFontUrl('  https://example.com/font.woff2  '), 'https://example.com/font.woff2');
  assert.equal(normalizeFontUrl(' '), '');
  assert.throws(() => normalizeFontUrl('javascript:alert(1)'), /HTTP/);
  assert.throws(() => normalizeFontUrl('not a url'));
  const settings = { ...DEFAULT_FONT_SETTINGS, url: 'https://example.com/font.woff2' };
  saveSetting(SETTINGS_KEYS.font, settings);
  assert.deepEqual(readFontSettings(), settings);
});

test('keepalive creates one looping silent WAV and releases it on stop', async () => {
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const created: Array<{ loop: boolean; src: string; paused: boolean }> = [];
  class TestAudio {
    loop = false;
    preload = '';
    paused = true;
    ended = false;
    constructor(public src: string) { created.push(this); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: TestAudio });
  let audioBlob: Blob | undefined;
  mock.method(URL, 'createObjectURL', (blob: Blob) => { audioBlob = blob; return 'blob:test-audio'; });
  let revoked = '';
  mock.method(URL, 'revokeObjectURL', (url: string) => { revoked = url; });
  try {
    await startKeepAlive();
    await startKeepAlive();
    assert.equal(created.length, 1);
    assert.equal(created[0].loop, true);
    assert.equal(isKeepAlivePlaying(), true);
    assert.ok(audioBlob);
    const bytes = new Uint8Array(await audioBlob.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
    assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
    assert.equal(bytes.slice(44).every((value) => value === 0), true);
    stopKeepAlive();
    assert.equal(isKeepAlivePlaying(), false);
    assert.equal(created[0].src, '');
    assert.equal(revoked, 'blob:test-audio');
  } finally {
    stopKeepAlive();
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio);
    else Reflect.deleteProperty(globalThis, 'Audio');
  }
});

test('notification clicks focus an existing phone or open its scoped chat URL', async () => {
  const script = readFileSync(resolve(import.meta.dirname, '..', '..', 'public', 'notification-events.js'), 'utf8');
  for (const existing of [true, false]) {
    let handler: ((event: unknown) => void) | undefined;
    let pending: Promise<void> | undefined;
    let focused = false;
    let closed = false;
    let opened = '';
    let message: unknown;
    const client = {
      url: 'https://phone.example/YYppphh/',
      focus: async () => { focused = true; },
      postMessage: (value: unknown) => { message = value; },
    };
    runInNewContext(script, {
      URL,
      self: {
        registration: { scope: 'https://phone.example/YYppphh/' },
        addEventListener: (name: string, callback: (event: unknown) => void) => {
          assert.equal(name, 'notificationclick');
          handler = callback;
        },
        clients: {
          matchAll: async () => existing ? [client] : [],
          openWindow: async (url: string) => { opened = url; },
        },
      },
    });
    assert.ok(handler);
    handler({
      notification: { data: { chatId: 'chat-1' }, close: () => { closed = true; } },
      waitUntil: (promise: Promise<void>) => { pending = promise; },
    });
    await pending;
    assert.equal(closed, true);
    if (existing) {
      assert.equal(focused, true);
      assert.equal(JSON.stringify(message), JSON.stringify({ type: 'yyphone:open-chat', chatId: 'chat-1' }));
    } else {
      assert.equal(opened, 'https://phone.example/YYppphh/?chat=chat-1');
    }
  }
});
