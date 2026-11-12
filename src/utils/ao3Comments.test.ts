import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ao3Comments } from '../components/Ao3Comments';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { ao3ShareContent } from './ao3Share';
import { createAo3CommentPlan, generateAo3ChapterUpdate, generateAo3Comments, parseAo3Comments, type Ao3CommentPlan } from './ao3Comments';
import { exportAo3Data, importAo3Data, clearAo3Data, readAo3WorldBookIds, ao3WorldBooks, ao3TopPrompt, saveAo3GenerationSettings } from './ao3Settings';
import { generateAo3Discovery } from './ao3Discovery';
import { ao3ChapterComments, initialAo3State, isAo3Work, newAo3Draft, publishAo3Draft, readAo3State, updateAo3, writeAo3State, type Ao3Comment, type Ao3Work } from './ao3Data';

const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; } };
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, setTimeout, clearTimeout } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
beforeEach(async () => { await clearDbStorage(); values.clear(); mock.method(Math, 'random', () => 0.9); });
afterEach(() => mock.restoreAll());
const now = '2026-11-05T12:00:00.000Z';
test('AO3 merges bound role books with explicit selections, deduplicates them, and keeps global deselection through backups', async () => {
  const entry = (content: string) => [{ id: content, title: content, content, depth: 'front' }];
  writeStoredValue('yyphone:world-books', [
    { id: 'global', name: '全局书', isGlobal: true, entries: entry('全局内容') },
    { id: 'optional', name: '可选书', entries: entry('可选内容') },
  ]);
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', worldBooks: [{ bookId: 'optional' }] }]);
  assert.deepEqual(readAo3WorldBookIds(), ['global']);
  assert.match(ao3WorldBooks(['a']).join(''), /全局内容/);
  assert.match(ao3WorldBooks(['a']).join(''), /可选内容/);
  saveAo3GenerationSettings({ prompt: '文风', topPrompt: '置顶要求', worldBookIds: ['optional'] });
  assert.doesNotMatch(ao3WorldBooks(['a']).join(''), /全局内容/);
  assert.match(ao3WorldBooks([]).join(''), /可选内容/);
  assert.equal(ao3WorldBooks(['a', 'a']).length, 1, 'a selected and role-bound book is only read once');
  const backup = exportAo3Data();
  saveAo3GenerationSettings({ prompt: '', topPrompt: '', worldBookIds: [] });
  assert.equal(ao3WorldBooks(['a']).length, 1);
  assert.match(ao3WorldBooks(['a'])[0], /可选内容/);
  assert.deepEqual(ao3WorldBooks([]), []);
  await importAo3Data(backup);
  assert.equal(ao3TopPrompt(), '置顶要求');
  assert.deepEqual(readAo3WorldBookIds(), ['optional']);
  await assert.rejects(importAo3Data({ ...backup, settings: { ...backup.settings, worldBookIds: [false] } }), /格式不支持/);
  assert.deepEqual(readAo3WorldBookIds(), ['optional']);
});

test('AO3 honors bound entry ranges, excludes unrelated roles and inactive entries, and only expands books when explicitly selected', () => {
  const entry = (id: string, extra = {}) => ({ id, title: id, content: `CONTENT_${id}`, depth: 'front', ...extra });
  writeStoredValue('yyphone:world-books', [
    { id: 'role', name: '角色背景', entries: [entry('bound'), entry('unbound'), entry('off', { activation: 'disabled' })] },
    { id: 'other', name: '他人背景', entries: [entry('private')] },
  ]);
  writeStoredValue('pocketos:wechat-contacts', [
    { id: 'a', worldBooks: [{ bookId: 'role', entryId: 'bound' }] },
    { id: 'b', worldBooks: [{ bookId: 'role', entryId: 'bound' }] },
    { id: 'c', worldBooks: [{ bookId: 'other' }] },
  ]);
  saveAo3GenerationSettings({ prompt: '', worldBookIds: [] });
  assert.deepEqual(ao3WorldBooks(['a', 'b']), ['【角色背景 / bound】\nCONTENT_bound']);
  saveAo3GenerationSettings({ prompt: '', worldBookIds: ['role', 'role'] });
  assert.deepEqual(ao3WorldBooks(['a', 'b']), ['【角色背景 / bound】\nCONTENT_bound', '【角色背景 / unbound】\nCONTENT_unbound']);
});
const original: Ao3Comment = { id: 'original', author: '纸船', body: '喜欢初章的结尾。', createdAt: now };
function setup(authorType: 'passerby' | 'character' = 'passerby'): Ao3Work {
  writeStoredValue('yyphone:api-presets', [{ id: 'qa', name: 'QA', endpoint: 'https://ao3.invalid/v1', apiKey: 'test', model: 'qa' }]);
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '沉静且有主见', worldBooks: [] },
    { id: 'unrelated', name: '无关角色', persona: '不应发送的其他角色人设' }]);
  writeStoredValue('yyphone:character-npcs', [{ id: 'npc-a', name: '周晴', persona: '熟悉林渡的老友，爽朗直率', linkedCharIds: ['a'] },
    { id: 'npc-other', name: '不应出现的NPC', persona: '其他角色的私有资料', linkedCharIds: ['unrelated'] }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'private', type: 'direct', participantIds: ['a'], messages: [{ text: '不应发送的私聊' }] }]);
  const work: Ao3Work = { ...publishAo3Draft({ ...newAo3Draft('anonymous_pen'), title: '纸页上的故事',
    characters: '林渡，小满', chapters: [{ title: '初章', body: '第一章原文。\n\n结尾留下一个约定。' }, { title: '再见', body: '他们终于重逢。' }] }),
  owned: false, comments: [original], generation: { authorType, topic: 'couple', pairCharId: 'a', pairCharName: '林渡', playerName: '小满',
    ...(authorType === 'character' ? { authorCharId: 'a', authorCharName: '林渡' } : {}) } };
  writeAo3State({ ...initialAo3State(), works: [work] });
  return work;
}
function generated(plan: Ao3CommentPlan) {
  const comments: Record<string, unknown>[] = Array.from({ length: plan.count }, (_, i) => ({
    speakerId: 'reader', author: `路人${i}`, body: `对正文细节的评论${i}`, ...(plan.replyTo ? { replyTo: plan.replyTo } : {}),
  }));
  const required = plan.participants.find(p => p.speakerId === plan.requiredSpeakerId);
  if (required) comments[1] = { speakerId: required.speakerId, body: '这个约定后面应该还会有下文。',
    ...(plan.replyTo ? { replyTo: plan.replyTo } : required.isAuthor ? { replyTo: 'new:0' } : {}) };
  const npc = plan.participants.find(p => p.identity.type === 'npc');
  if (npc && npc.speakerId !== required?.speakerId) comments[2] = { speakerId: npc.speakerId, body: '这个人的脾气我可太熟悉了。', ...(plan.replyTo ? { replyTo: plan.replyTo } : {}) };
  return comments;
}
const completion = (comments: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify({ comments }) } }] });
function mockComments(inspect?: (input: Record<string, unknown>, plan: Ao3CommentPlan) => void) {
  return mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body)), input = JSON.parse(body.messages.at(-1).content);
    inspect?.(input, input.commentPlan);
    return completion(generated(input.commentPlan));
  });
}

test('ordinary participation has an exact 50% boundary; forced comments always require the primary character and only linked NPCs', () => {
  const work = setup();
  mock.method(Math, 'random', () => 0.499999);
  let plan = createAo3CommentPlan(work, 5);
  assert.deepEqual(plan.participants.map(p => p.identity.id), ['a', 'npc-a']);
  assert.ok(plan.requiredSpeakerId);
  mock.method(Math, 'random', () => 0.5);
  plan = createAo3CommentPlan(work, 5);
  assert.deepEqual(plan.participants, []); assert.equal(plan.requiredSpeakerId, undefined);
  plan = createAo3CommentPlan(work, 3, true);
  assert.equal(plan.requiredSpeakerId, 'character:a');
  let draw = 0;
  mock.method(Math, 'random', () => draw++ === 0 ? 0.1 : 0.99);
  assert.equal(createAo3CommentPlan(work, 5).requiredSpeakerId, 'npc:npc-a');
  writeStoredValue('yyphone:character-npcs', []);
  assert.deepEqual(createAo3CommentPlan(work, 3, true).participants.map(p => p.identity.id), ['a']);
  assert.throws(() => createAo3CommentPlan({ ...work, generation: undefined, characters: [] }, 3, true), /没有可用/);
  writeStoredValue('pocketos:wechat-contacts', []);
  assert.throws(() => createAo3CommentPlan(work, 3, true), /没有可用/);
});

test('stories without an associated character still generate three reader replies to user comments', async () => {
  const source = setup();
  const user: Ao3Comment = { ...original, id: 'user-only', author: '小满', identity: { type: 'user', id: 'user' } };
  const work = { ...source, generation: undefined, characters: [], comments: [user] };
  mockComments((_input, plan) => { assert.deepEqual(plan.participants, []); assert.equal(plan.replyTo, user.id); });
  const replies = await generateAo3Comments(work, 'reply', new AbortController().signal, user.id);
  assert.equal(replies.length, 3);
  assert.ok(replies.every(c => c.replyTo === user.id && !c.identity));
});

test('initial discovery generates five threaded comments in the same request, including character and NPC, without unmasking a character author', async () => {
  for (const authorType of ['passerby', 'character'] as const) {
    setup(authorType); mock.method(Math, 'random', () => 0.1); let calls = 0;
    mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
      calls++; const body = JSON.parse(String(options?.body)), input = JSON.parse(body.messages.at(-1).content);
      assert.equal(input.commentPlan.count, 5);
      assert.doesNotMatch(JSON.stringify(input), /不应出现的NPC|其他角色的私有资料/);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ title: '新作品', author: 'anonymous_pen', fandom: '同人',
        chapterTitle: '开篇', body: '一段独立故事。', comments: generated(input.commentPlan) }) } }] });
    });
    const work = await generateAo3Discovery({ authorType, topic: 'couple', charId: 'a', fandom: '', direction: '', tone: '自由发挥',
      rating: 'Teen And Up Audiences', includeExperiences: false }, '小满', new AbortController().signal);
    assert.equal(calls, 1); assert.equal(work.comments.length, 5); assert.ok(isAo3Work(work));
    const character = work.comments.find(c => c.identity?.type === 'character')!;
    assert.equal(character.identity?.id, 'a');
    assert.equal(character.author, authorType === 'character' ? 'anonymous_pen' : '林渡');
    if (authorType === 'character') assert.equal(character.replyTo, work.comments[0].id);
    assert.equal(work.comments.find(c => c.identity?.type === 'npc')?.author, '周晴');
  }
});

test('extra generation appends exactly three comments with a guaranteed character and preserves all previous content and concurrent interactions', async () => {
  const work = setup();
  const chats = readStorageString('yyphone:wechat-chats');
  let calls = 0;
  mockComments((input, plan) => {
    calls++; assert.equal(plan.count, 3); assert.equal(plan.requiredSpeakerId, 'character:a');
    assert.deepEqual((input.work as Ao3Work).chapters, work.chapters.slice(0, 1));
    assert.deepEqual(input.comments, [original]);
    assert.ok(plan.participants.some(p => p.persona.includes('沉静')));
    assert.doesNotMatch(JSON.stringify(input), /不应发送的私聊|不应发送的其他角色人设|不应出现的NPC/);
  });
  const comments = await generateAo3Comments(work, 'extra', new AbortController().signal);
  assert.equal(calls, 1); assert.equal(comments.length, 3);
  assert.deepEqual(readAo3State().works[0], work);
  let state = updateAo3(readAo3State(), { type: 'kudos', id: work.id });
  state = updateAo3(state, { type: 'bookmark', id: work.id });
  state = updateAo3(state, { type: 'comments', work, comments });
  assert.deepEqual(state.works[0].chapters, work.chapters);
  assert.deepEqual(state.works[0].comments, [original, ...comments]);
  assert.equal(state.works[0].kudos, 1); assert.deepEqual(state.bookmarks, [work.id]);
  writeAo3State(state); assert.deepEqual(readAo3State(), state);
  assert.equal(readStorageString('yyphone:wechat-chats'), chats);
  assert.throws(() => updateAo3(state, { type: 'comments', work, comments }), /回复关系无效/);
  assert.throws(() => updateAo3(initialAo3State(), { type: 'comments', work, comments }), /已修改或删除/);
  const edited = { ...state.works[0], chapters: [{ title: '', body: '改稿' }] };
  assert.throws(() => updateAo3({ ...state, works: [edited] }, { type: 'comments', work, comments: comments.map(c => ({ ...c, id: crypto.randomUUID() })) }), /已修改或删除/);
});

test('user can comment on the story or reply to a comment, and all three automatic replies target that exact user message', async () => {
  for (const probability of [0.1, 0.9]) {
    let work = setup('character'); mock.method(Math, 'random', () => probability);
    const comment: Ao3Comment = { id: 'user-post', author: '小满', body: '这里是在回收前面的伏笔吗？', createdAt: now,
      replyTo: original.id, identity: { type: 'user', id: 'user' } };
    const state = updateAo3(readAo3State(), { type: 'comment', id: work.id, comment });
    writeAo3State(state); work = state.works[0];
    mockComments((_input, plan) => { assert.equal(plan.replyTo, comment.id); assert.equal(plan.count, 3); });
    const replies = await generateAo3Comments(work, 'reply', new AbortController().signal, comment.id);
    assert.equal(replies.length, 3); assert.ok(replies.every(c => c.replyTo === comment.id));
    assert.equal(replies.some(c => c.identity?.type === 'character'), probability < 0.5);
    const result = updateAo3(state, { type: 'comments', work, comments: replies });
    assert.equal(result.works[0].comments.length, 5);
    assert.ok(isAo3Work(result.works[0]));
    assert.match(ao3ShareContent(result.works[0]), /回复 小满：这里是在回收前面的伏笔吗/);
    await assert.rejects(generateAo3Comments(work, 'reply', new AbortController().signal, original.id), /找不到你的留言/);
  }
});

test('parser rejects missing guaranteed characters, fabricated NPCs, false aliases, invalid threads, self-replies and incomplete batches', () => {
  const work = setup('character'), plan = createAo3CommentPlan(work, 3, true);
  const valid = generated(plan);
  const parsed = parseAo3Comments(valid, plan, work.comments, work.author);
  assert.equal(parsed[1].author, work.author); assert.equal(parsed[1].replyTo, parsed[0].id);
  assert.throws(() => parseAo3Comments(valid.slice(1), plan, work.comments, work.author), /未完整生成/);
  assert.throws(() => parseAo3Comments(valid.map(c => ({ ...c, speakerId: 'reader', author: '路人' })), plan, work.comments, work.author), /没有收到要求的角色/);
  assert.throws(() => parseAo3Comments([{ ...valid[0], speakerId: 'npc:invented' }, ...valid.slice(1)], plan, work.comments, work.author), /未授权/);
  assert.throws(() => parseAo3Comments([{ ...valid[0], author: '林渡' }, ...valid.slice(1)], plan, work.comments, work.author), /冒充/);
  assert.throws(() => parseAo3Comments([{ ...valid[0], replyTo: 'new:2' }, ...valid.slice(1)], plan, work.comments, work.author), /楼层不存在/);
  assert.throws(() => parseAo3Comments([valid[0], { ...valid[1], replyTo: undefined }, valid[2]], plan, work.comments, work.author), /需要回复/);
  assert.throws(() => parseAo3Comments([{ ...valid[0], body: ' ' }, ...valid.slice(1)], plan, work.comments, work.author), /正文不完整/);
  const ownComment = { ...original, identity: { type: 'character' as const, id: 'a' } };
  assert.throws(() => parseAo3Comments([valid[0], { ...valid[1], replyTo: original.id }, valid[2]], plan, [ownComment], work.author), /需要回复其他读者/);
  const replyPlan = createAo3CommentPlan(work, 3, true, 'user-post');
  assert.throws(() => parseAo3Comments(valid, replyPlan, [original, { ...original, id: 'user-post' }], work.author), /没有回复你的留言/);
});

test('legacy comments remain valid, but broken, cyclic, duplicate or forward reply references are rejected atomically', () => {
  const work = setup();
  assert.ok(isAo3Work(work));
  const reply = { ...original, id: 'reply', replyTo: original.id, identity: { type: 'user' as const, id: 'user' } };
  assert.ok(isAo3Work({ ...work, comments: [original, reply] }));
  for (const comments of [[reply, original], [original, original], [{ ...original, replyTo: original.id }], [{ ...original, identity: { type: 'invented', id: 'x' } }]]) {
    assert.equal(isAo3Work({ ...work, comments }), false);
  }
  assert.throws(() => updateAo3(readAo3State(), { type: 'comment', id: work.id, comment: { ...reply, replyTo: 'missing' } }), /回复关系无效/);
  assert.deepEqual(readAo3State().works[0], work);
});

test('HTTP errors, missing characters, deleted NPCs, malformed AI replies and cancellation never erase the user message', async () => {
  let work = setup();
  const user: Ao3Comment = { id: 'user', author: '小满', body: '期待下文', createdAt: now, identity: { type: 'user', id: 'user' } };
  writeAo3State(updateAo3(readAo3State(), { type: 'comment', id: work.id, comment: user })); work = readAo3State().works[0];
  mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  await assert.rejects(generateAo3Comments(work, 'reply', new AbortController().signal, user.id), /503/);
  mock.method(globalThis, 'fetch', async () => completion([]));
  await assert.rejects(generateAo3Comments(work, 'extra', new AbortController().signal), /未完整生成/);
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => { controller.abort(); return completion([]); });
  await assert.rejects(generateAo3Comments(work, 'extra', controller.signal));
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const plan = JSON.parse(JSON.parse(String(options?.body)).messages.at(-1).content).commentPlan;
    writeStoredValue('yyphone:character-npcs', []);
    return completion(generated(plan));
  });
  await assert.rejects(generateAo3Comments(work, 'extra', new AbortController().signal), /NPC 已变化/);
  assert.deepEqual(readAo3State().works[0], work);
  writeStoredValue('pocketos:wechat-contacts', []);
  await assert.rejects(generateAo3Comments(work, 'extra', new AbortController().signal), /没有可用/);
});

test('comment UI exposes replies, role badges and append controls, escapes user text, and enables random-role updates only for passerby fandom works', () => {
  const work = setup();
  const comments: Ao3Comment[] = [original, { ...original, id: 'u', author: '小满', body: '<script>danger</script>', replyTo: original.id, identity: { type: 'user', id: 'user' } },
    { ...original, id: 'c', author: '林渡', replyTo: 'u', identity: { type: 'character', id: 'a' } }];
  const markup = renderToStaticMarkup(createElement(Ao3Comments, { work: { ...work, comments }, userName: '小满', onAction: () => true }));
  assert.match(markup, /更新评论/); assert.doesNotMatch(markup, /新评论只会追加|角色必出现/); assert.match(markup, /回复 小满/); assert.match(markup, /ao3-comment-reply/);
  assert.match(markup, /角色/); assert.match(markup, /&lt;script&gt;/); assert.doesNotMatch(markup, /<script>danger/);
  const unrelated = renderToStaticMarkup(createElement(Ao3Comments, { work: { ...work, generation: undefined, characters: [] }, userName: '小满', onAction: () => true }));
  assert.match(unrelated, /disabled=""[^>]*>更新评论/);
  assert.match(unrelated, /本篇暂无可用的通讯录评论角色/);
  const fandom = { ...work, characters: ['其他CP人物'], generation: { authorType: 'passerby' as const, topic: 'fandom' as const } };
  const fandomMarkup = renderToStaticMarkup(createElement(Ao3Comments, { work: fandom, userName: '小满', onAction: () => true }));
  assert.doesNotMatch(fandomMarkup, /disabled=""[^>]*>更新评论/);
  assert.match(fandomMarkup, /随机邀请一位通讯录角色/);
  writeStoredValue('pocketos:wechat-contacts', []);
  const emptyMarkup = renderToStaticMarkup(createElement(Ao3Comments, { work: fandom, userName: '小满', onAction: () => true }));
  assert.match(emptyMarkup, /disabled=""[^>]*>更新评论/);
});

test('other-CP passerby works randomly select one contact as a reader, with only their existing NPCs and a 50% participation boundary', () => {
  const source = setup();
  const work = { ...source, characters: ['原作人物甲', '原作人物乙'], generation: { authorType: 'passerby' as const, topic: 'fandom' as const } };
  let draws = [0.499999, 0];
  mock.method(Math, 'random', () => draws.shift() ?? 0);
  let plan = createAo3CommentPlan(work, 5);
  assert.deepEqual(plan.participants.map(p => p.identity.id), ['a', 'npc-a']);
  assert.equal(plan.requiredSpeakerId, 'character:a');
  assert.ok(plan.participants.every(p => !p.isAuthor));
  draws = [0.5];
  plan = createAo3CommentPlan(work, 5);
  assert.deepEqual(plan.participants, []); assert.equal(plan.requiredSpeakerId, undefined);
  draws = [0.1, 0.99];
  plan = createAo3CommentPlan(work, 5);
  assert.deepEqual(plan.participants.map(p => p.identity.id), ['unrelated', 'npc-other']);
  assert.equal(plan.requiredSpeakerId, 'character:unrelated');
  for (const draw of [0, 0.99]) {
    draws = [draw];
    plan = createAo3CommentPlan(work, 3, true);
    assert.equal(plan.requiredSpeakerId, draw === 0 ? 'character:a' : 'character:unrelated');
  }
  writeStoredValue('pocketos:wechat-contacts', []);
  assert.deepEqual(createAo3CommentPlan(work, 5).participants, []);
  assert.throws(() => createAo3CommentPlan(work, 3, true), /没有可用的评论角色/);
  assert.deepEqual(work.characters, ['原作人物甲', '原作人物乙']);
});

test('other-CP discovery generates random contact comments without making that contact the fictional CP or exposing private chats', async () => {
  setup(); mock.method(Math, 'random', () => 0.1);
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '沉静且有主见', worldBooks: [{ bookId: 'comment-book' }] },
    { id: 'unrelated', name: '无关角色', persona: '不应发送的其他角色人设', worldBooks: [{ bookId: 'other-book' }] }]);
  writeStoredValue('yyphone:world-books', [
    { id: 'comment-book', name: '评论角色背景', entries: [{ id: 'entry', title: '角色口吻', content: '只供评论使用的角色背景', depth: 'front' }] },
    { id: 'other-book', name: '未选中的角色背景', entries: [{ id: 'other', title: '角色背景', content: '不应发送的其他角色世界书', depth: 'front' }] },
  ]);
  saveAo3GenerationSettings({ prompt: '', topPrompt: '本次前置要求', worldBookIds: ['comment-book'] });
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body)), input = JSON.parse(body.messages.at(-1).content);
    assert.equal(input.character, undefined); assert.equal(input.experiences, undefined);
    assert.match(input.worldBooks, /只供评论使用的角色背景/);
    assert.match(input.worldBooks + input.commentWorldBooks, /只供评论使用的角色背景/);
    assert.equal((JSON.stringify(input).match(/只供评论使用的角色背景/g) ?? []).length, 1);
    assert.ok(body.messages[0].content.startsWith('本次前置要求'));
    assert.match(body.messages[0].content, /只是偶然读到作品的读者/);
    assert.equal(input.commentPlan.requiredSpeakerId, 'character:a');
    assert.doesNotMatch(JSON.stringify(input), /不应发送的私聊|不应发送的其他角色人设|不应发送的其他角色世界书|其他角色的私有资料/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: '其他CP的新故事', author: 'anonymous_pen', fandom: '原作',
      relationship: '原作人物甲 / 原作人物乙', characters: ['原作人物甲', '原作人物乙'], chapterTitle: '开篇', body: '其他CP的独立正文。', comments: generated(input.commentPlan) }) } }] });
  });
  const work = await generateAo3Discovery({ authorType: 'passerby', topic: 'fandom', charId: '', fandom: '原作', direction: '', tone: '自由发挥',
    rating: 'Teen And Up Audiences', includeExperiences: true }, '小满', new AbortController().signal);
  assert.equal(work.comments.length, 5);
  assert.equal(work.comments.find(c => c.identity?.type === 'character')?.identity?.id, 'a');
  assert.equal(work.comments.find(c => c.identity?.type === 'npc')?.identity?.id, 'npc-a');
  assert.deepEqual(work.characters, ['原作人物甲', '原作人物乙']);
  assert.equal(work.relationship, '原作人物甲 / 原作人物乙');
  assert.deepEqual(work.generation, { authorType: 'passerby', topic: 'fandom' });
});

test('other-CP updates append three comments with a guaranteed random character; chapter comments and user replies share the same reader pool', async () => {
  const source = setup();
  let work = { ...source, characters: ['原作人物甲', '原作人物乙'], generation: { authorType: 'passerby' as const, topic: 'fandom' as const } };
  writeAo3State({ ...initialAo3State(), works: [work] });
  mock.method(Math, 'random', () => 0.99);
  mockComments((input, plan) => {
    assert.deepEqual(plan.participants.map(p => p.identity.id), ['unrelated', 'npc-other']);
    assert.equal(plan.requiredSpeakerId, 'character:unrelated');
    assert.doesNotMatch(JSON.stringify(input), /不应发送的私聊|熟悉林渡的老友/);
  });
  const comments = await generateAo3Comments(work, 'extra', new AbortController().signal, undefined, 1);
  assert.equal(comments.length, 3); assert.ok(comments.every(c => c.chapter === 1));
  assert.equal(comments[1].identity?.id, 'unrelated');
  const state = updateAo3(readAo3State(), { type: 'comments', work, comments });
  assert.deepEqual(ao3ChapterComments(state.works[0], 0), [original]);
  assert.deepEqual(state.works[0].chapters, source.chapters);
  writeAo3State(state); assert.deepEqual(readAo3State(), state);
  mock.method(Math, 'random', () => 0.1);
  const user: Ao3Comment = { ...original, id: 'other-cp-user', chapter: 1, identity: { type: 'user', id: 'user' } };
  work = { ...work, comments: [...work.comments, user] };
  mockComments((_input, plan) => assert.equal(plan.requiredSpeakerId, 'character:a'));
  const replies = await generateAo3Comments(work, 'reply', new AbortController().signal, user.id, 1);
  assert.ok(replies.every(c => c.replyTo === user.id && c.chapter === 1));
  const chapterComments = await generateAo3Comments(work, 'chapter', new AbortController().signal, undefined, 1);
  assert.equal(chapterComments.length, 5); assert.equal(chapterComments[1].identity?.id, 'a');
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const plan = JSON.parse(JSON.parse(String(options?.body)).messages.at(-1).content).commentPlan;
    writeStoredValue('pocketos:wechat-contacts', []);
    return completion(generated(plan));
  });
  await assert.rejects(generateAo3Comments(work, 'extra', new AbortController().signal, undefined, 1), /角色或关联 NPC 已变化/);
  assert.deepEqual(readAo3State(), state);
});

test('chapter comments are isolated in display, AI context, replies, shared snapshots and backups; legacy comments remain in chapter one', async () => {
  let work = setup();
  const user: Ao3Comment = { ...original, id: 'chapter-two-user', chapter: 1, author: '玩家网名', body: '第二章的约定实现了！', identity: { type: 'user', id: 'user' } };
  work = { ...work, comments: [...work.comments, user] };
  writeAo3State({ ...initialAo3State(), works: [work] });
  mockComments((input, plan) => {
    assert.equal(plan.chapter, 1); assert.equal(plan.replyTo, user.id);
    assert.deepEqual(input.comments, [user]);
    assert.deepEqual(input.currentChapter, { number: 2, ...work.chapters[1] });
    assert.deepEqual((input.work as Ao3Work).chapters, work.chapters);
  });
  const replies = await generateAo3Comments(work, 'reply', new AbortController().signal, user.id, 1);
  assert.ok(replies.every(c => c.chapter === 1 && c.replyTo === user.id));
  const state = updateAo3(readAo3State(), { type: 'comments', work, comments: replies });
  work = state.works[0]; writeAo3State(state);
  assert.deepEqual(ao3ChapterComments(work, 0), [original]);
  assert.equal(ao3ChapterComments(work, 1).length, 4);
  const markup = (chapter: number) => renderToStaticMarkup(createElement(Ao3Comments, { work, chapter, userName: '玩家网名', onAction: () => true }));
  assert.match(markup(0), /喜欢初章的结尾/); assert.doesNotMatch(markup(0), /第二章的约定实现了/);
  assert.match(markup(1), /第二章的约定实现了/); assert.doesNotMatch(markup(1), /喜欢初章的结尾/);
  assert.match(markup(1), /第 2 章评论/);
  assert.equal(work.comments.find(c => c.id === user.id)?.author, '玩家网名');
  const snapshot = ao3ShareContent(work);
  assert.ok(snapshot.indexOf('【第 1 章读者评论】') < snapshot.indexOf(original.body));
  assert.ok(snapshot.indexOf(original.body) < snapshot.indexOf('【第 2 章：'));
  assert.ok(snapshot.indexOf('【第 2 章读者评论】') < snapshot.indexOf(user.body));
  const backup = exportAo3Data(); await clearAo3Data(); await importAo3Data(backup);
  assert.deepEqual(readAo3State(), state);
  await assert.rejects(generateAo3Comments(work, 'reply', new AbortController().signal, user.id, 0), /属于本章/);
  await assert.rejects(generateAo3Comments(work, 'extra', new AbortController().signal, undefined, 2), /章节不存在/);
  assert.throws(() => updateAo3(state, { type: 'comment', id: work.id, comment: { ...user, id: 'cross', chapter: 0, replyTo: user.id } }), /回复关系无效/);
  assert.throws(() => updateAo3(state, { type: 'comments', work, comments: [{ ...user, id: 'missing-chapter', chapter: 2 }] }), /回复关系无效/);
  assert.equal(isAo3Work({ ...work, comments: [{ ...user, chapter: -1 }] }), false);
  assert.equal(isAo3Work({ ...work, comments: [{ ...user, chapter: 0.5 }] }), false);
  assert.equal(isAo3Work({ ...work, comments: [{ ...user, chapter: 2 }] }), false);
});

test('earlier chapter AI comments never receive future text or another chapter discussion', async () => {
  const work = setup();
  work.comments.push({ ...original, id: 'future', chapter: 1, body: '后章不应泄露的评论' });
  mockComments((input, plan) => {
    assert.equal(plan.chapter, 0);
    assert.doesNotMatch(JSON.stringify(input), /后章不应泄露的评论|他们终于重逢/);
    assert.deepEqual(input.comments, [original]);
  });
  const comments = await generateAo3Comments(work, 'extra', new AbortController().signal, undefined, 0);
  assert.ok(comments.every(c => c.chapter === 0));
});

test('追更 produces a new chapter and five independent comments, then commits them together without replacing old discussions', async () => {
  const work = setup('character'); let calls = 0;
  writeStoredValue('yyphone:world-books', [
    { id: 'global', name: '未勾选全局书', isGlobal: true, entries: [{ id: 'g', title: '背景', content: '不该自动注入的全局内容', depth: 'front' }] },
    { id: 'bound', name: '绑定书', entries: [{ id: 'b', title: '角色背景', content: '角色绑定背景默认读取', depth: 'middle' }] },
  ]);
  const contacts = JSON.parse(readStorageString('pocketos:wechat-contacts')!);
  writeStoredValue('pocketos:wechat-contacts', contacts.map((contact: any) => contact.id === 'a' ? { ...contact, worldBooks: [{ bookId: 'bound' }] } : contact));
  saveAo3GenerationSettings({ prompt: '', topPrompt: '优先前置要求', worldBookIds: [] });
  mock.method(Math, 'random', () => 0.1);
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    calls++;
    const request = JSON.parse(String(options?.body));
    const input = JSON.parse(request.messages.at(-1).content);
    assert.ok(request.messages[0].content.startsWith('优先前置要求'));
    assert.doesNotMatch(JSON.stringify(request), /不该自动注入的全局内容/);
    assert.deepEqual(input.worldBooks, ['【绑定书 / 角色背景】\n角色绑定背景默认读取']);
    if (calls === 1) {
      assert.equal(input.chapter, 3);
      assert.match(input.idea, /希望两人一起去海边，先把误会说清楚/);
      return Response.json({ choices: [{ message: { content: '{"chapterTitle":"新的约定","body":"第三章的新正文。"}' } }] });
    }
    assert.equal(input.commentPlan.count, 5); assert.equal(input.commentPlan.chapter, 2);
    assert.equal(input.currentChapter.body, '第三章的新正文。');
    assert.deepEqual(input.comments, []);
    assert.equal(input.work.chapters.length, 3);
    return completion(generated(input.commentPlan));
  });
  const update = await generateAo3ChapterUpdate(work, new AbortController().signal, '  希望两人一起去海边，先把误会说清楚  ');
  assert.equal(calls, 2); assert.equal(update.comments.length, 5);
  assert.ok(update.comments.every(c => c.chapter === 2));
  assert.equal(update.comments[1].replyTo, update.comments[0].id);
  assert.equal(update.comments[1].author, work.author);
  assert.deepEqual(readAo3State().works[0], work);
  let state = updateAo3(readAo3State(), { type: 'kudos', id: work.id });
  state = updateAo3(state, { type: 'continue', work, ...update, now });
  assert.equal(state.works[0].chapters.length, 3);
  assert.deepEqual(ao3ChapterComments(state.works[0], 0), [original]);
  assert.equal(ao3ChapterComments(state.works[0], 1).length, 0);
  assert.equal(ao3ChapterComments(state.works[0], 2).length, 5);
  assert.equal(state.works[0].kudos, 1);
  writeAo3State(state); assert.deepEqual(readAo3State(), state);
  assert.throws(() => updateAo3({ ...initialAo3State(), works: [work] }, { type: 'continue', work, ...update,
    comments: update.comments.map(c => ({ ...c, chapter: 0 })), now }), /回复跨章/);
});

test('failed or cancelled new-chapter comments never partially save a chapter or overwrite old comments', async () => {
  const work = setup(); let calls = 0;
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls % 2 === 1) return Response.json({ choices: [{ message: { content: '{"chapterTitle":"未保存的续章","body":"新章正文"}' } }] });
    return completion([]);
  });
  await assert.rejects(generateAo3ChapterUpdate(work, controller.signal), /五条评论/);
  assert.deepEqual(readAo3State().works[0], work);
  mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls % 2 === 1) return Response.json({ choices: [{ message: { content: '{"chapterTitle":"未保存的续章","body":"新章正文"}' } }] });
    controller.abort(); return completion([]);
  });
  await assert.rejects(generateAo3ChapterUpdate(work, controller.signal));
  assert.deepEqual(readAo3State().works[0], work);
});

test('removing trailing chapters through the editor removes only their comments and keeps retained chapter threads valid', () => {
  const source = setup();
  const work = { ...source, owned: true, comments: [...source.comments, { ...original, id: 'second', chapter: 1 }] };
  const draft = { ...newAo3Draft(work.author), workId: work.id, title: work.title, chapters: [work.chapters[0]] };
  const published = publishAo3Draft(draft, work);
  const state = updateAo3({ ...initialAo3State(), works: [work] }, { type: 'publish', work: published });
  assert.ok(isAo3Work(state.works[0]));
  assert.deepEqual(state.works[0].comments, [original]);
});
