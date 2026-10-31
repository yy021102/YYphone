import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { activeMemoryArchive } from './memoryArchives';
import { generateTheaterFilm, parseTheaterFilm, readTheaterSnapshot } from './memoryTheater';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v),
  removeItem: (k: string) => values.delete(k), clear: () => values.clear(),
  key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const keys = ['pocketos:wechat-contacts', 'yyphone:wechat-chats', 'yyphone:memory-items', 'yyphone:memory-journal', 'yyphone:memory-settings'];
const persisted = () => keys.map(key => readStorageString(key));
const film = { title: '等灯亮的时候', dedication: '有些话，被好好接住了', scenes: [{ title: '一盏灯', narration: '你说累了，那句晚安没有被匆忙略过。', mood: 'night', sourceIds: ['c150'], quoteId: 'c150', quote: '这句是AI伪造的，不能显示' }], closing: '而今晚，你们还在彼此身边。' };
beforeEach(async () => {
  await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '认真温柔' }, { id: 'b', name: '时予', persona: 'NEVER_OTHER_PERSONA' }]);
  writeStoredValue('yyphone:api-presets', [{ id: 'api', name: 'api', endpoint: 'https://test.invalid/v1', apiKey: 'test', model: 'test' }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'a', type: 'direct', participantIds: ['a'], activeArchiveId: 'current',
    archives: [{ id: 'old', messages: [{ text: 'NEVER_OLD_ARCHIVE' }] }], messages: [
      ...Array.from({ length: 170 }, (_, i) => ({ id: `m${i}`, senderId: i % 2 ? 'a' : 'user', text: i === 169 ? '晚安，灯替你留着' : `可见消息${i}`, createdAt: '2026-10-26T10:00:00Z' })),
      { senderId: 'a', kind: 'thought', text: 'NEVER_THOUGHT' }, { senderId: 'a', hidden: true, text: 'NEVER_HIDDEN' },
      { senderId: 'narrator', kind: 'context-note', text: 'NEVER_CONTEXT' },
    ] }, { id: 'b', type: 'direct', participantIds: ['b'], messages: [{ senderId: 'b', text: 'NEVER_OTHER_CHAT' }] }]);
  writeStoredValue('yyphone:memory-items', [
    ...Array.from({ length: 18 }, (_, i) => ({ id: `r${i}`, charId: 'a', content: `一起经历的小事${i}`, importance: 3, recallCount: 7 })),
    { id: 'old', charId: 'a', archiveKey: '["a","old"]', content: 'NEVER_OLD_MEMORY' },
    { id: 'other', charId: 'b', content: 'NEVER_OTHER_MEMORY' },
  ]);
  writeStoredValue('yyphone:memory-journal', Array.from({ length: 5 }, (_, i) => ({ id: `j${i}`, charId: 'a', content: `相处回顾${i}`, to: `2026-10-2${i}` })));
  // Reading the theater must not migrate even legacy archive cursors or memories.
  writeStoredValue('yyphone:memory-settings', { cursors: { a: 'legacy-cursor' } });
});
afterEach(() => mock.restoreAll());

test('theater takes 150 visible messages, 12 own active memories and 3 journals, without touching storage', () => {
  const before = persisted();
  const snapshot = readTheaterSnapshot('a');
  assert.equal(snapshot.sources.filter(s => s.kind === 'chat').length, 150);
  assert.equal(snapshot.sources.filter(s => s.kind === 'memory').length, 12);
  assert.equal(snapshot.sources.filter(s => s.kind === 'journal').length, 3);
  assert.equal(snapshot.sources[0].text, '可见消息20');
  assert.equal(snapshot.sources[149].text, '晚安，灯替你留着');
  assert(!JSON.stringify(snapshot).includes('NEVER_'));
  assert(snapshot.sources.filter(s => s.kind === 'memory').every(s => !s.date && !s.quotable));
  assert.deepEqual(persisted(), before);
});

test('quotes resolve from supplied original messages; unsupported scenes and fake source ids are rejected', () => {
  const snapshot = readTheaterSnapshot('a');
  const result = parseTheaterFilm(JSON.stringify(film), snapshot);
  assert.equal(result.scenes[0].quote?.text, '晚安，灯替你留着');
  assert(!JSON.stringify(result).includes('伪造'));
  const noQuote = parseTheaterFilm(JSON.stringify({ ...film, scenes: [{ ...film.scenes[0], sourceIds: ['m1'], quoteId: 'm1' }] }), snapshot);
  assert.equal(noQuote.scenes[0].quote, undefined);
  assert.throws(() => parseTheaterFilm(JSON.stringify({ scenes: [{ narration: '凭空捏造', sourceIds: ['invented'] }] }), snapshot), /真实回忆/);
  assert.throws(() => parseTheaterFilm('not json', snapshot), /显影/);
});

test('one generation uses the memory secondary API and leaves all persisted data unchanged', async () => {
  writeStoredValue('yyphone:memory-settings', { cursors: { a: 'legacy-cursor' }, useSecondaryApi: true, secondaryApi: { endpoint: 'https://memory.invalid/v1', apiKey: 'secondary-secret', model: 'memory-model' } });
  const before = persisted(); let calls = 0;
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    calls++; assert.equal(url, 'https://memory.invalid/v1/chat/completions');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'memory-model'); assert(!String(init?.body).includes('NEVER_'));
    assert.match(body.messages[0].content, /不是角色真实发言/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(film) } }] });
  });
  const result = await generateTheaterFilm(readTheaterSnapshot('a'), new AbortController().signal);
  assert.equal(calls, 1); assert.equal(result.scenes.length, 1); assert.deepEqual(persisted(), before);
});

test('changing timeline while generating discards the film; cancellation discards even a late API response', async () => {
  const snapshot = readTheaterSnapshot('a');
  mock.method(globalThis, 'fetch', async () => {
    const chats = JSON.parse(readStorageString('yyphone:wechat-chats')!); chats[0].activeArchiveId = 'other';
    writeStoredValue('yyphone:wechat-chats', chats);
    return Response.json({ choices: [{ message: { content: JSON.stringify(film) } }] });
  });
  await assert.rejects(generateTheaterFilm(snapshot, new AbortController().signal), /存档已切换/);
  assert.notEqual(activeMemoryArchive('a'), snapshot.archiveKey);
  const controller = new AbortController();
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => { controller.abort(); return Response.json({ choices: [{ message: { content: JSON.stringify(film) } }] }); });
  await assert.rejects(generateTheaterFilm(readTheaterSnapshot('a'), controller.signal), { name: 'AbortError' });
});

test('an empty archive does not send an API request or invent a replacement movie', async () => {
  let called = false; mock.method(globalThis, 'fetch', async () => { called = true; return Response.json({}); });
  await assert.rejects(generateTheaterFilm({ ...readTheaterSnapshot('a'), sources: [] }, new AbortController().signal), /还没有/);
  assert.equal(called, false);
});

test('echo and montage frames use unique originals in source order and cannot display authored or non-chat quotes', () => {
  const snapshot = readTheaterSnapshot('a');
  const result = parseTheaterFilm(JSON.stringify({ ...film, openingQuoteId: 'm1', scenes: [
    { ...film.scenes[0], sourceIds: ['c1', 'c150', 'm1'], shot: 'echo', fragmentIds: ['c150', 'c1', 'c150', 'm1', 'invented'], aside: '我那时只看见自己的着急。' },
    { ...film.scenes[0], shot: 'echo', fragmentIds: ['c1', 'invented'] },
    { ...film.scenes[0], shot: 'montage', fragmentIds: ['c150'], aside: '回头看，我也有偏见。' },
    { ...film.scenes[0], shot: 'letter', aside: '这张多余的纸页应当省掉。' },
  ] }), snapshot);
  assert.equal(result.scenes[0].shot, 'echo');
  assert.deepEqual(result.scenes[0].fragments.map(s => s.id), ['c1', 'c150']);
  assert.equal(result.scenes[1].shot, 'closeup');
  assert.equal(result.scenes[1].fragments.length, 0);
  assert.equal(result.scenes[2].fragments[0].text, '晚安，灯替你留着');
  assert.equal(result.scenes[3].aside, '');
  assert.equal(result.openingQuote?.id, 'c150');
  assert(!JSON.stringify(result).includes('伪造'));
  const unsupportedOpening = parseTheaterFilm(JSON.stringify({ ...film, openingQuoteId: 'c1' }), snapshot);
  assert.equal(unsupportedOpening.openingQuote?.id, 'c150');
});

test('character viewpoint respects linked world-book entries, keeps long persona and makes one read-only request', async () => {
  const contacts = JSON.parse(readStorageString('pocketos:wechat-contacts')!);
  contacts[0].persona += '。'.repeat(2700) + '完整人设末尾';
  contacts[0].worldBooks = [{ bookId: 'ours', entryId: 'one' }];
  writeStoredValue('pocketos:wechat-contacts', contacts);
  writeStoredValue('yyphone:world-books', [
    { id: 'ours', name: '角色背景', entries: [{ id: 'one', title: '价值观', content: '珍惜独立，不擅长承认自己的偏见', depth: 'front' }, { id: 'two', title: '未绑定', content: 'NEVER_UNLINKED_ENTRY', depth: 'front' }] },
    { id: 'other', name: '别人的背景', entries: [{ id: 'one', title: '别人的设定', content: 'NEVER_OTHER_BOOK', depth: 'front' }] },
  ]);
  const before = persisted(); const snapshot = readTheaterSnapshot('a');
  assert.match(snapshot.persona, /完整人设末尾/);
  assert.match(snapshot.worldBook!, /珍惜独立/); assert(!snapshot.worldBook!.includes('NEVER_'));
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++; const body = JSON.parse(String(init?.body)); const system = body.messages[0].content;
    assert.match(system, /叙述者“我”始终是给定角色/);
    assert.match(system, /全片围绕这一件事/);
    assert.match(system, /不能创造过去发生过/);
    assert.match(system, /echo/);
    const payload = JSON.parse(body.messages.at(-1).content);
    assert.equal(payload.worldBook, snapshot.worldBook); assert(!String(init?.body).includes('NEVER_'));
    return Response.json({ choices: [{ message: { content: JSON.stringify(film) } }] });
  });
  await generateTheaterFilm(snapshot, new AbortController().signal);
  assert.equal(calls, 1); assert.deepEqual(persisted(), before);
});
