import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { extractMemoryCandidates } from './memoryAi';
import { addMemoryCandidates, buildMemoryInjection, DEFAULT_MEMORY_SETTINGS, embedMissingMemories, exportMemories, importMemories, readEmbeddings, readMemories, writeEmbeddings, writeMemories, writeMemorySettings, type MemoryCandidate, type MemoryItem } from './memoryData';
import { conversationMemoryQuery, memoryQueryParts } from './memoryRecall';
import { regeneratedReplyIds } from './chatRegeneration';
import { readMemoryUserName } from './memoryIdentity';
import { giftMemoryContent } from './giftMemory';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const stamp = '2026-10-10T10:00:00Z';
const item = (id: string, content: string, extra: Partial<MemoryItem> = {}): MemoryItem => ({ id, charId: 'a', content,
  category: 'preference', source: 'chat', importance: 3, pinned: false, createdAt: stamp, updatedAt: stamp, recallCount: 0, ...extra });
const update = (m: MemoryItem, content: string): MemoryCandidate => ({ content, category: m.category, importance: 4, pinned: false,
  update: { id: m.id, previousContent: m.content, previousUpdatedAt: m.updatedAt } });
const response = (memories: unknown[]) => Response.json({ choices: [{ message: { content: JSON.stringify({ memories }) } }] });

beforeEach(async () => {
  await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '尊重对方，有自己的想法' }]);
  writeStoredValue('yyphone:api-presets', [{ id: 'api', name: 'api', endpoint: 'https://memory.invalid/v1', apiKey: 'test', model: 'test' }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'chat-a', type: 'direct', participantIds: ['a'], activeArchiveId: 'one', messages: [
    { id: 'new-coffee', senderId: 'user', text: '最近喝咖啡会不舒服，我暂时不喝咖啡了', createdAt: '2026-10-31T10:00:00Z' },
  ] }]);
});
afterEach(() => mock.restoreAll());

test('memory names follow the active persona and never treat a modern preset label as a real name', () => {
  writeStoredValue('pocketos:user-profile', { name: '桌面名字' });
  const profiles = [
    { id: 'a', name: '校园预设', realName: '小满', nickname: '小熊' },
    { id: 'b', name: '另一个预设', realName: '', nickname: '阿晴' },
    { id: 'legacy', name: '旧人设姓名' },
  ];
  for (const [id, name] of [['a', '小满'], ['b', '阿晴'], ['legacy', '旧人设姓名']]) {
    writeStoredValue('pocketos:personas', { activeProfileId: id, profiles });
    assert.equal(readMemoryUserName(), name);
    assert.match(giftMemoryContent({ name: '围巾', direction: 'character-to-player', date: '2026-11-08', scene: '' }), new RegExp(`我送给${name}`));
  }
  writeStoredValue('pocketos:personas', { activeProfileId: 'missing', profiles });
  assert.equal(readMemoryUserName(), '桌面名字');
});

test('extraction instructs new and updated memories to use the current name without rewriting existing stored entries', async () => {
  writeStoredValue('pocketos:personas', { activeProfileId: 'p', profiles: [{ id: 'p', name: '预设标签', realName: '小满', nickname: '小熊' }] });
  writeMemories([item('old', '玩家喜欢咖啡'), item('other-name', '阿晴喜欢红茶', { source: 'manual' })]);
  const before = readMemories();
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    const system = payload.messages[0].content;
    assert.match(system, /记忆正文用姓名“小满”/);
    assert.doesNotMatch(system, /用“玩家”指代/);
    assert.match(payload.messages.at(-1).content, /小满：最近喝咖啡会不舒服/);
    return response([{ content: '小满最近喝咖啡会不舒服，暂时不喝咖啡。', category: 'preference', importance: 3 }]);
  });
  const result = await extractMemoryCandidates('a');
  assert.match(result.candidates[0].content, /^小满/);
  assert.deepEqual(readMemories(), before);
});

test('one extraction finds an older relevant entry, updates its text and retains the previous version without changing journals', async () => {
  const old = item('coffee', '玩家喜欢每天喝咖啡');
  writeMemories([old, ...Array.from({ length: 75 }, (_, i) => item(`other-${i}`, `一起讨论项目编号${i}`, { updatedAt: '2026-10-30T10:00:00Z' }))]);
  writeEmbeddings({ coffee: { m: 'old-model', v: [1, 0] } });
  writeStoredValue('yyphone:memory-journal', [{ id: 'journal', charId: 'a', content: '旧的流水账照常保留' }]);
  const journal = readStorageString('yyphone:memory-journal');let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;const payload = JSON.parse(String(init?.body));
    assert.match(payload.messages.at(-1).content, /id:coffee；可更新/);
    assert.match(payload.messages[0].content, /不能抹掉过去、把暂时写成永久/);
    return response([{ updateId: 'coffee', evidenceIds: ['new-coffee'], content: '玩家以前喜欢每天喝咖啡，最近因不适暂时不喝。', category: 'preference', importance: 4 }]);
  });
  const extracted = await extractMemoryCandidates('a');assert.equal(calls, 1);assert.equal(extracted.candidates.length, 1);
  assert.equal(extracted.candidates[0].update?.previousContent, old.content);
  const result = await addMemoryCandidates('a', extracted.candidates, 'chat', DEFAULT_MEMORY_SETTINGS);
  assert.deepEqual(result, { added: 0, merged: 0, updated: 1 });
  const latest = readMemories().find(m => m.id === 'coffee')!;
  assert.match(latest.content, /暂时不喝/);assert.equal(latest.createdAt, old.createdAt);
  assert.deepEqual(latest.revisions, [{ content: old.content, updatedAt: old.updatedAt }]);
  assert.equal(readEmbeddings().coffee, undefined);assert.equal(readStorageString('yyphone:memory-journal'), journal);
  const prompt = await buildMemoryInjection(['a'], 'direct', '咖啡', () => '林渡', { localOnly: true });assert.match(prompt.text, /暂时不喝/);
});

test('unknown targets, protected entries and unsupported update evidence are never converted into an overwrite or a new fact', async () => {
  writeMemories([item('ok', '玩家喜欢咖啡'), item('manual', '玩家喜欢咖啡', { source: 'manual' }), item('pinned', '玩家喜欢咖啡', { pinned: true }),
    item('edited', '玩家喜欢咖啡', { manuallyEdited: true }), item('core', '玩家喜欢咖啡', { category: 'core' }), item('other', '其他人喜欢咖啡', { charId: 'b' })]);
  mock.method(globalThis, 'fetch', async () => response(['manual', 'pinned', 'edited', 'core', 'other', 'invented', 'ok'].map(updateId => ({
    updateId, evidenceIds: updateId === 'ok' ? ['not-in-this-batch'] : ['new-coffee'], content: '不能偷偷改掉', category: 'preference',
  }))));
  const before = readMemories();assert.equal((await extractMemoryCandidates('a')).candidates.length, 0);assert.deepEqual(readMemories(), before);
});

test('opposite facts are not swallowed as fuzzy duplicates, even with identical embeddings; exact duplicates still merge', async () => {
  const old = item('coffee', '玩家喜欢每天喝咖啡');writeMemories([old]);writeEmbeddings({ coffee: { m: 'same', v: [1, 0] } });
  const settings = { ...DEFAULT_MEMORY_SETTINGS, embedding: { endpoint: 'https://embed.invalid/v1', apiKey: 'test', model: 'same' } };
  mock.method(globalThis, 'fetch', async () => Response.json({ data: [{ index: 0, embedding: [1, 0] }] }));
  const opposite = await addMemoryCandidates('a', [{ content: '玩家不喜欢每天喝咖啡', category: 'preference', importance: 3, pinned: false }], 'chat', settings);
  assert.equal(opposite.added, 1);assert.equal(readMemories().length, 2);assert.equal(readMemories()[0].content, old.content);
  const same = await addMemoryCandidates('a', [{ content: old.content, category: 'preference', importance: 3, pinned: false }], 'chat', DEFAULT_MEMORY_SETTINGS);
  assert.equal(same.merged, 1);assert.equal(readMemories().length, 2);
});

test('a changed or protected target aborts the whole save without adding unrelated candidates', async () => {
  const old = item('coffee', '玩家喜欢咖啡');writeMemories([old]);
  writeMemories([{ ...old, content: '玩家亲手改过的正文', manuallyEdited: true }]);const before = readMemories();
  await assert.rejects(addMemoryCandidates('a', [{ content: '也不能提前写入的新事实', category: 'fact', importance: 3, pinned: false }, update(old, '新的情况')], 'chat', DEFAULT_MEMORY_SETTINGS), /原记忆未改动/);
  assert.deepEqual(readMemories(), before);
});

test('a successful replacement vector represents the updated text; late old embedding work cannot restore a stale vector', async () => {
  const old = item('coffee', '玩家喜欢咖啡');writeMemories([old]);
  const embedding = { endpoint: 'https://embed.invalid/v1', apiKey: 'test', model: 'same' };
  let release!: () => void;const hold = new Promise<void>(r => { release = r; });
  mock.method(globalThis, 'fetch', async () => { await hold;return Response.json({ data: [{ index: 0, embedding: [1, 0] }] }); });
  const pending = embedMissingMemories([old], embedding);
  await addMemoryCandidates('a', [update(old, '玩家以前喜欢咖啡，最近暂时不喝')], 'chat', DEFAULT_MEMORY_SETTINGS);
  release();assert.equal(await pending, 0);assert.equal(readEmbeddings().coffee, undefined);
  mock.restoreAll();mock.method(globalThis, 'fetch', async () => Response.json({ data: [{ index: 0, embedding: [0, 1] }] }));
  const current = readMemories()[0];await addMemoryCandidates('a', [update(current, '玩家后来恢复少量饮用咖啡')], 'chat', { ...DEFAULT_MEMORY_SETTINGS, embedding });
  assert.deepEqual(readEmbeddings().coffee.v, [0, 1]);assert.equal(readEmbeddings().coffee.c, readMemories()[0].content);
});

test('archive changes while embedding cancel updates, and exported/imported entries preserve their update history', async () => {
  const old = item('coffee', '玩家喜欢咖啡');writeMemories([old]);
  mock.method(globalThis, 'fetch', async () => {
    writeStoredValue('yyphone:wechat-chats', [{ id: 'chat-a', type: 'direct', participantIds: ['a'], activeArchiveId: 'two', messages: [] }]);
    return Response.json({ data: [{ index: 0, embedding: [1, 0] }] });
  });
  await assert.rejects(addMemoryCandidates('a', [update(old, '新情况')], 'chat', { ...DEFAULT_MEMORY_SETTINGS, embedding: { endpoint: 'https://embed.invalid', apiKey: 'test', model: 'same' } }), /存档已切换/);
  assert.deepEqual(readMemories(), []);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'chat-a', type: 'direct', participantIds: ['a'], activeArchiveId: 'one', messages: [] }]);
  assert.equal(readMemories()[0].content, old.content);mock.restoreAll();
  await addMemoryCandidates('a', [update(old, '玩家以前喜欢咖啡，现在暂时不喝')], 'chat', DEFAULT_MEMORY_SETTINGS);
  const exported = exportMemories('a');writeMemories([]);importMemories(exported, 'a', ['a']);
  assert.equal(readMemories()[0].revisions?.[0].content, old.content);
});

const scarfTalk = [
  { senderId: 'user', text: '你送我的那条蓝色围巾还在' }, { senderId: 'a', text: '我记得选了很久' },
  { senderId: 'user', text: '嗯嗯' }, { senderId: 'a', text: '你现在还留着？' }, { senderId: 'user', text: '一直留着' },
  { senderId: 'a', text: '那就好' }, { senderId: 'user', text: '它还是很好看' },
];
test('a pronoun follow-up recalls the earlier object from the allowed conversation, without any API request', async () => {
  writeMemories([item('scarf', '我送过玩家一条蓝色围巾', { category: 'event' }), item('coffee', '玩家喜欢喝咖啡')]);
  const query = conversationMemoryQuery(scarfTalk, { participantIds: ['a'] });assert.match(query.context.join('\n'), /蓝色围巾/);
  const before = readMemories();mock.method(globalThis, 'fetch', async () => { throw new Error('No decision API'); });
  const injection = await buildMemoryInjection(['a'], 'direct', query, () => '林渡', { localOnly: true });
  assert(injection.ids.includes('scarf'));assert(!injection.ids.includes('coffee'));assert.deepEqual(readMemories(), before);
});

test('explicit new topics and topic boundaries do not carry an unrelated earlier subject into recall', async () => {
  writeMemories([item('scarf', '我送过玩家蓝色围巾', { category: 'event' }), item('coffee', '玩家喜欢喝咖啡')]);
  const explicit = conversationMemoryQuery([...scarfTalk, { senderId: 'user', text: '最近喝咖啡会不舒服' }], { participantIds: ['a'] });
  assert.deepEqual(explicit.context, []);
  const injection = await buildMemoryInjection(['a'], 'direct', explicit, () => '林渡', { localOnly: true });assert.deepEqual(injection.ids, ['coffee']);
  const boundary = conversationMemoryQuery([...scarfTalk, { senderId: 'user', text: '换个话题吧' }, { senderId: 'user', text: '那个后来呢' }], { participantIds: ['a'] });assert.deepEqual(boundary.context, []);
});

test('topic expansion cannot read beyond the mounted window, hidden thoughts, other accounts or replaced reply batches', () => {
  const narrow = conversationMemoryQuery(scarfTalk, { participantIds: ['a'], historyLimit: 2 });assert(!memoryQueryParts(narrow).text.includes('围巾'));
  const safe = conversationMemoryQuery([
    { senderId: 'b', text: 'OTHER_PERSONAL_SECRET' }, { senderId: 'a', kind: 'thought', text: 'PRIVATE_THOUGHT' },
    { senderId: 'user', hidden: true, text: 'HIDDEN_TEXT' }, { senderId: 'narrator', source: 'alias-experience', text: 'ALIAS_SECRET' },
    ...scarfTalk,
  ], { participantIds: ['a'] });assert(!/SECRET|THOUGHT|HIDDEN/.test(memoryQueryParts(safe).text));
  const messages = [{ id: 'user', senderId: 'user', text: '它怎么样了' }, { id: 'old', senderId: 'a', text: 'REPLACED_SCARF', batchId: 'old-batch' }];
  const replaced = regeneratedReplyIds(messages);
  const query = conversationMemoryQuery(messages.filter(m => !replaced.has(m.id)), { participantIds: ['a'] });assert(!memoryQueryParts(query).text.includes('REPLACED'));
});

test('contextual semantic recall sends a single embedding query, includes the antecedent and caches it', async () => {
  writeMemories([item('scarf', '我送过玩家蓝色围巾', { category: 'event' })]);writeEmbeddings({ scarf: { m: 'same', v: [1, 0] } });
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, embedding: { endpoint: 'https://semantic-qa.invalid/v1', apiKey: 'test', model: 'same' } });
  let calls = 0;mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;const body = JSON.parse(String(init?.body));assert.equal(body.input.length, 1);assert.match(body.input[0], /当前消息：它还是很好看/);assert.match(body.input[0], /蓝色围巾/);
    return Response.json({ data: [{ index: 0, embedding: [1, 0] }] });
  });
  const query = conversationMemoryQuery(scarfTalk, { participantIds: ['a'] });
  assert.deepEqual((await buildMemoryInjection(['a'], 'direct', query, () => '林渡')).ids, ['scarf']);
  await buildMemoryInjection(['a'], 'direct', query, () => '林渡');assert.equal(calls, 1);
});
