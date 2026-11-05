import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ao3App } from '../apps/Ao3App';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { generateAo3Chapter, generateAo3Continuation } from './ao3Generation';
import { shareAo3Work } from './ao3Share';
import { clearAo3Data, exportAo3Data, importAo3Data, lockAo3PenName, readAo3PenName, readAo3Settings, saveAo3Prompt, AO3_NARRATIVE_RULES } from './ao3Settings';
import { toMessageContent } from './buildPrompt';
import { generateAo3Discovery, type Ao3DiscoveryOptions } from './ao3Discovery';
import { AO3_KEY, ao3DraftFromWork, ao3WordCount, emptyAo3Filters, filterAo3Works, initialAo3State as emptyAo3State, isAo3State,
  newAo3Draft, publishAo3Draft, readAo3Draft, readAo3State, splitAo3Tags, updateAo3, writeAo3Draft, writeAo3State, type Ao3State, type Ao3Work } from './ao3Data';

const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; } };
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, setTimeout, clearTimeout } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
beforeEach(async () => { await clearDbStorage(); values.clear(); mock.method(Math, 'random', () => 0.9); });
afterEach(() => mock.restoreAll());
const now = '2026-11-05T12:00:00.000Z';
test('AO3 backup round-trips settings, drafts and archive; invalid imports preserve data and clearing leaves chats untouched', async () => {
  saveAo3Prompt('克制的文风，评论区轻松一些');
  writeAo3State(initialAo3State()); writeAo3Draft(newAo3Draft('writer'));
  writeStoredValue('yyphone:wechat-chats', [{ id: 'keep', messages: [] }]);
  const backup = exportAo3Data();
  await assert.rejects(importAo3Data({ ...backup, state: { works: [] } }), /格式/);
  assert.deepEqual(exportAo3Data(), backup);
  await clearAo3Data(); assert.equal(readAo3State().works.length, 0); assert.equal(readAo3Draft(), null); assert.equal(readAo3Settings().prompt, '');
  assert.ok(readStorageString('yyphone:wechat-chats')!.includes('keep'));
  await importAo3Data(JSON.parse(JSON.stringify(backup))); assert.deepEqual(exportAo3Data(), backup);
});
test('creation prompt includes saved AO3 preferences and role-aware first-person dream narrative rules', async () => {
  setupDiscovery(); saveAo3Prompt('测试偏好：短段落，评论爱讨论细节');
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    const system = request.messages[0].content;
    assert.ok(system.includes('测试偏好：短段落，评论爱讨论细节'));
    assert.ok(system.includes(AO3_NARRATIVE_RULES));
    assert.match(system, /角色第一人称/); assert.match(system, /路人作者的正文使用第三人称/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult()) } }] });
  });
  await generateAo3Discovery(discoveryOptions(), 'user', new AbortController().signal);
});
function initialAo3State(): Ao3State {
  const base: Ao3Work = { ...publishAo3Draft({ ...newAo3Draft('test-author'), title: '测试作品',
    chapters: [{ title: '测试第一章', body: '测试正文。\n\n保留段落。' }] }), owned: false, createdAt: now, updatedAt: now };
  return { ...emptyAo3State(), works: [
    { ...base, id: 'test-rain', tags: ['雨夜'] },
    { ...base, id: 'test-moon', title: '月亮测试', author: 'paper_satellite', fandom: '测试星海',
      relationship: '领航员 / 通讯员', tags: ['Slow Burn'], rating: 'Teen And Up Audiences', category: 'Other', complete: false,
      chapters: [...base.chapters, { title: '测试第二章', body: '后续正文。' }] },
    { ...base, id: 'test-breakfast' },
  ] };
}
test('new archives are empty and legacy sample cleanup persists without removing user works or interactions', () => {
  assert.deepEqual(readAo3State(), emptyAo3State());
  const fixtures = initialAo3State().works;
  const own = { ...fixtures[0], id: 'my-work', owned: true };
  const generated = { ...fixtures[1], id: 'generated', generation: { authorType: 'passerby' as const, topic: 'fandom' as const } };
  const works = [...fixtures.map((w, i) => ({ ...w, id: ['ao3-sample-rain', 'ao3-sample-moon', 'ao3-sample-breakfast'][i] })), own, generated];
  const ids = works.map(w => w.id);
  writeAo3State({ ...emptyAo3State(), works, bookmarks: ids, later: ids, kudosed: ids,
    history: ids.map(workId => ({ workId, chapter: 0, readAt: now })) });
  const clean = readAo3State();
  assert.deepEqual(clean.works, [own, generated]);
  for (const key of ['bookmarks', 'later', 'kudosed'] as const) assert.deepEqual(clean[key], ['my-work', 'generated']);
  assert.deepEqual(clean.history.map(h => h.workId), ['my-work', 'generated']);
  assert.ok(isAo3State(clean));
  assert.deepEqual(JSON.parse(readStorageString(AO3_KEY)!), clean);
  assert.deepEqual(readAo3State(), clean);
});
test('AO3 sharing sends complete chapters and comments to the selected chat as a readable, independent fiction snapshot', () => {
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡' }]);
  const work = initialAo3State().works[1];
  work.comments = [{ id: 'c', author: '读者甲', body: '喜欢第二章的薄荷', createdAt: now }];
  shareAo3Work(work, 'a');
  const chats = JSON.parse(readStorageString('yyphone:wechat-chats')!);
  assert.deepEqual(chats[0].participantIds, ['a']);
  const message = chats[0].messages[0]; assert.equal(message.kind, 'link'); assert.equal(message.source, 'AO3');
  const prompt = toMessageContent(message);
  for (const chapter of work.chapters) assert.ok(prompt.includes(chapter.body));
  assert.ok(prompt.includes('读者甲：喜欢第二章的薄荷')); assert.ok(prompt.includes('不是现实经历'));
  work.chapters[0].body = '后来编辑过的正文'; work.comments = [];
  assert.ok(!readStorageString('yyphone:wechat-chats')!.includes('后来编辑过的正文'));
  assert.equal(readStorageString('yyphone:memory-items'), null);
});
test('sharing to missing or blocked contacts creates no message', () => {
  const work = initialAo3State().works[0];
  assert.throws(() => shareAo3Work(work, 'deleted'), /通讯录/);
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡' }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'a-chat', type: 'direct', participantIds: ['a'], blocked: true, messages: [] }]);
  assert.throws(() => shareAo3Work(work, 'a'), /拉黑/);
  assert.equal(JSON.parse(readStorageString('yyphone:wechat-chats')!)[0].messages.length, 0);
});

test('original archive fixtures validate; corrupted references, duplicate works and chapter positions are rejected', () => {
  const state = initialAo3State();
  assert.ok(isAo3State(state));
  assert.equal(isAo3State({ ...state, bookmarks: ['missing'] }), false);
  assert.equal(isAo3State({ ...state, works: [state.works[0], state.works[0]] }), false);
  assert.equal(isAo3State({ ...state, history: [{ workId: state.works[0].id, chapter: 8, readAt: now }] }), false);
  assert.equal(isAo3State({ ...state, works: [{ ...state.works[0], chapters: [] }] }), false);
});
test('search includes title, author, relationship and tags, combines filters and excludes terms', () => {
  const { works } = initialAo3State(), filters = emptyAo3Filters();
  for (const query of ['月亮', 'PAPER_SATELLITE', 'Slow Burn', '领航员 / 通讯员']) assert.deepEqual(filterAo3Works(works, { ...filters, query }).map(w => w.id), ['test-moon']);
  assert.equal(filterAo3Works(works, { ...filters, fandom: 'Original Work', complete: 'complete' }).length, 2);
  assert.equal(filterAo3Works(works, { ...filters, rating: 'Teen And Up Audiences', category: 'Other', complete: 'ongoing' }).length, 1);
  assert.equal(filterAo3Works(works, { ...filters, exclude: '雨夜, Slow Burn' }).length, 1);
  const sorted = filterAo3Works([{ ...works[0], kudos: 1 }, { ...works[1], kudos: 9 }], { ...filters, sort: 'kudos' });
  assert.equal(sorted[0].id, works[1].id);
  assert.deepEqual(splitAo3Tags('日常， Slow Burn;日常\nHappy Ending'), ['日常', 'Slow Burn', 'Happy Ending']);
  assert.equal(ao3WordCount([{ title: '', body: '你好 hello world 123' }]), 5);
});
test('kudos is idempotent, bookmarks and later toggle independently and all archive data persists', () => {
  let state = initialAo3State(); const id = state.works[0].id;
  state = updateAo3(updateAo3(state, { type: 'kudos', id }), { type: 'kudos', id });
  assert.equal(state.works[0].kudos, 1);
  state = updateAo3(updateAo3(state, { type: 'bookmark', id }), { type: 'later', id });
  state = updateAo3(state, { type: 'bookmark', id });
  assert.deepEqual(state.bookmarks, []); assert.deepEqual(state.later, [id]);
  writeAo3State(state); assert.deepEqual(readAo3State(), state); assert.ok(isAo3State(state));
});
test('chapter history resumes the latest chapter, only entry counts a hit, invalid positions do not change state', () => {
  let state = initialAo3State(); const id = 'test-moon';
  state = updateAo3(state, { type: 'read', id, chapter: 0, now, countHit: true });
  state = updateAo3(state, { type: 'read', id, chapter: 1, now });
  assert.equal(state.history.length, 1); assert.equal(state.history[0].chapter, 1);
  assert.equal(state.works.find(w => w.id === id)!.hits, 1);
  assert.equal(updateAo3(state, { type: 'read', id, chapter: 99, now }), state);
  assert.ok(isAo3State(state));
});
test('drafts preserve line breaks; publishing/editing preserves reader interactions, clamps removed chapter history', () => {
  const draft = { ...newAo3Draft('writer'), title: '新故事', chapters: [{ title: '初见', body: '第一段\n\n第二段' }, { title: '再见', body: '后来。' }] };
  writeAo3Draft(draft); assert.deepEqual(readAo3Draft(), draft);
  const work = publishAo3Draft(draft); let state = updateAo3(initialAo3State(), { type: 'publish', work });
  state = updateAo3(state, { type: 'kudos', id: work.id });
  state = updateAo3(state, { type: 'comment', id: work.id, comment: { id: 'comment', author: 'reader', body: '喜欢！\n再读一次。', createdAt: now } });
  state = updateAo3(state, { type: 'read', id: work.id, chapter: 1, now, countHit: true });
  const changed = publishAo3Draft({ ...ao3DraftFromWork(work), title: '修订', chapters: [work.chapters[0]] }, work);
  state = updateAo3(state, { type: 'publish', work: changed });
  const saved = state.works.find(w => w.id === work.id)!;
  assert.equal(saved.kudos, 1); assert.equal(saved.comments.length, 1); assert.equal(saved.hits, 1);
  assert.equal(saved.createdAt, work.createdAt); assert.equal(state.history[0].chapter, 0);
  assert.equal(saved.chapters[0].body, '第一段\n\n第二段'); assert.ok(isAo3State(state));
  writeAo3Draft(null); assert.equal(readAo3Draft(), null);
});
test('deletion removes only owned works and their references, leaving other works intact', () => {
  const sample = initialAo3State(); assert.equal(updateAo3(sample, { type: 'delete', id: sample.works[0].id }), sample);
  assert.throws(() => publishAo3Draft({ ...newAo3Draft('a'), title: '空白' }), /请填写/);
  const work = publishAo3Draft({ ...newAo3Draft('a'), title: '我的作品', chapters: [{ title: '', body: '正文' }] });
  let state = updateAo3(sample, { type: 'publish', work });
  state = updateAo3(state, { type: 'bookmark', id: work.id }); state = updateAo3(state, { type: 'later', id: work.id });
  state = updateAo3(state, { type: 'kudos', id: work.id }); state = updateAo3(state, { type: 'read', id: work.id, chapter: 0, now });
  state = updateAo3(state, { type: 'delete', id: work.id }); assert.deepEqual(state, sample);
  assert.throws(() => publishAo3Draft(ao3DraftFromWork(work)), /原作品/);
});
test('reader-provided text is escaped and the app exposes real navigation/search rather than external login', () => {
  const state = initialAo3State(); state.works[0].title = '<img src=x onerror=alert(1)>';
  writeAo3State(state);
  const markup = renderToStaticMarkup(createElement(Ao3App, { onBack: () => {}, userName: 'reader' }));
  assert.ok(markup.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(markup.includes('搜索作品') && markup.includes('私人文库'));
  assert.ok(!markup.includes('<img src=x') && !markup.includes('type="password"'));
  assert.doesNotMatch(markup, /AO3 风格模拟|内容仅保存在小手机中/);
  assert.match(markup, /为喜欢的故事，留一个位置/);
});
test('chapter generation uses one configured request and selected character only, preserving draft and avoiding chat/memory writes', async () => {
  writeStoredValue('yyphone:api-presets', [{ id: 'qa', name: 'QA', endpoint: 'https://ao3.invalid/v1', apiKey: 'test', model: 'qa' }]);
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '甲', persona: '甲的人设', worldBooks: [] }, { id: 'b', name: '乙', persona: '不应出现的人设', worldBooks: [] }]);
  const draft = newAo3Draft('reader'); writeAo3Draft(draft); let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    calls++; const request = String(options?.body);
    assert.ok(request.includes('甲的人设') && request.includes('雪夜重逢')); assert.ok(!request.includes('不应出现的人设'));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: '归人', summary: '一场雪。', chapterTitle: '雪夜', body: '门外下着雪。\n\n他回来了。' }) } }] });
  });
  const result = await generateAo3Chapter(draft, 0, ['a'], '雪夜重逢', new AbortController().signal);
  assert.equal(calls, 1); assert.equal(result.title, '归人'); assert.ok(result.body.includes('\n\n'));
  assert.deepEqual(readAo3Draft(), draft); assert.equal(readStorageString('yyphone:wechat-chats'), null); assert.equal(readStorageString('yyphone:memory-items'), null);
});
test('failed or cancelled generation never overwrites a saved draft', async () => {
  writeStoredValue('yyphone:api-presets', [{ id: 'qa', name: 'QA', endpoint: 'https://ao3.invalid/v1', apiKey: 'test', model: 'qa' }]);
  const draft = newAo3Draft('reader'); draft.chapters[0].body = '原稿'; writeAo3Draft(draft);
  mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: '{"body":""}' } }] }));
  await assert.rejects(generateAo3Chapter(draft, 0, [], '', new AbortController().signal), /原稿已保留/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(generateAo3Chapter(draft, 0, [], '', controller.signal));
  assert.deepEqual(readAo3Draft(), draft);
});

const discoveryOptions = (patch: Partial<Ao3DiscoveryOptions> = {}): Ao3DiscoveryOptions => ({
  authorType: 'passerby', topic: 'couple', charId: 'a', fandom: '', direction: '', tone: '自由发挥', rating: 'Teen And Up Audiences', includeExperiences: true, ...patch,
});
const discoveryResult = (patch: Record<string, unknown> = {}) => ({ title: '楼下那盏灯', author: 'paper_ship', fandom: '排球少年',
  relationship: '模型写错的 CP', characters: ['模型写错的人物'], tags: ['日常', 'Slow Burn'], category: 'Other', warning: 'No Archive Warnings Apply',
  summary: '总有人把灯留着。', notes: '想写一个慢慢靠近的故事。', comments: Array.from({ length: 5 }, (_, i) => ({ author: '读者' + i, body: '喜欢这个细节' + i })), chapterTitle: '灯下', body: '他在楼下停了片刻。\n\n那盏灯还亮着。', ...patch });
function setupDiscovery() {
  writeStoredValue('yyphone:api-presets', [{ id: 'qa', name: 'QA', endpoint: 'https://ao3.invalid/v1', apiKey: 'test', model: 'qa' }]);
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '沉静而有主见', worldBooks: [] }, { id: 'b', name: '另一位', persona: '不应发出的其他角色', worldBooks: [] }]);
  writeStoredValue('pocketos:personas', { activeProfileId: 'player', profiles: [{ id: 'player', name: '人设名称不是昵称', nickname: '小满', identity: '书店店员', personality: '慢热但坚定', background: '住在海边', speakingStyle: '直率' }] });
  writeStoredValue('yyphone:wechat-chats', [{ id: 'main', type: 'direct', participantIds: ['a'], activeArchiveId: 'two', archiveRevision: 3, context: '正在熟悉彼此', messages: [
    { id: 'u', senderId: 'user', kind: 'text', text: '那天一起修好了书架', createdAt: now },
    { id: 'a', senderId: 'a', kind: 'text', text: '螺丝还在抽屉里', createdAt: now },
    { id: 'thought', senderId: 'a', kind: 'thought', text: '隐藏的心声不该发出', createdAt: now },
    { id: 'hidden', senderId: 'user', kind: 'text', text: '隐藏消息不该发出', hidden: true, createdAt: now },
  ] }, { id: 'other', type: 'direct', participantIds: ['b'], messages: [{ id: 'other-message', senderId: 'b', text: '其他人的聊天不该发出', createdAt: now }] }]);
  writeStoredValue('yyphone:memory-items', [
    { id: 'current', charId: 'a', archiveKey: JSON.stringify(['a', 'two']), content: '这条是当前存档记忆' },
    { id: 'old', charId: 'a', archiveKey: JSON.stringify(['a', 'one']), content: '旧分支记忆不该发出' },
  ]);
  writeAo3Draft({ ...newAo3Draft('user'), title: '未发布的草稿', chapters: [{ title: '', body: '这份草稿不该改变' }] });
}
test('passerby CP writing uses player identity but never sends private chats, memories or other characters', async () => {
  setupDiscovery(); let calls = 0;
  const chats = readStorageString('yyphone:wechat-chats'), memories = readStorageString('yyphone:memory-items'), draft = readAo3Draft();
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    calls++; const body = JSON.parse(String(options?.body)); const materials = JSON.parse(body.messages.at(-1).content);
    assert.equal(materials.authorType, 'passerby'); assert.equal(materials.topic, 'couple');
    assert.equal(materials.player.name, '小满'); assert.equal(materials.direction, ''); assert.equal(materials.tone, '自由发挥');
    assert.equal(materials.experiences, undefined);
    assert.doesNotMatch(body.messages.at(-1).content, /一起修好了书架|当前存档记忆|其他角色|其他人的聊天|隐藏的心声/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult()) } }] });
  });
  const work = await generateAo3Discovery(discoveryOptions({ includeExperiences: false }), '桌面昵称', new AbortController().signal);
  assert.equal(calls, 1); assert.equal(work.relationship, '林渡 / 小满'); assert.deepEqual(work.characters, ['林渡', '小满']);
  assert.equal(work.fandom, '你与我 | Our Own Universe'); assert.equal(work.owned, false); assert.equal(work.generation?.authorType, 'passerby');
  assert.ok(work.tags.includes('CP向')); assert.ok(isAo3State(updateAo3(initialAo3State(), { type: 'discover', work })));
  assert.equal(readStorageString('yyphone:wechat-chats'), chats); assert.equal(readStorageString('yyphone:memory-items'), memories); assert.deepEqual(readAo3Draft(), draft);
});
test('passerby fiction prioritizes the active persona real name rather than online nickname, without changing character-author naming', async () => {
  setupDiscovery();
  writeStoredValue('pocketos:personas', { activeProfileId: 'player', profiles: [
    { id: 'other', realName: '不应使用的另一人设真名' },
    { id: 'player', realName: '许知夏', nickname: '今天也想睡觉', identity: '书店店员' },
  ] });
  const names: string[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)), input = JSON.parse(body.messages.at(-1).content);
    names.push(input.player.name);
    assert.doesNotMatch(JSON.stringify(input), /不应使用的另一人设真名/);
    assert.match(body.messages[0].content, /不从聊天称呼推断并改成玩家网名/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult({ body: `${input.player.name}走进了书店。` })) } }] });
  });
  const passerby = await generateAo3Discovery(discoveryOptions({ includeExperiences: false }), '桌面昵称', new AbortController().signal);
  assert.equal(passerby.relationship, '林渡 / 许知夏');
  assert.deepEqual(passerby.characters, ['林渡', '许知夏']);
  assert.equal(passerby.generation?.playerName, '许知夏');
  assert.match(passerby.chapters[0].body, /许知夏/);
  assert.doesNotMatch(passerby.chapters[0].body, /今天也想睡觉|桌面昵称/);
  const character = await generateAo3Discovery(discoveryOptions({ authorType: 'character', includeExperiences: false }), '桌面昵称', new AbortController().signal);
  assert.equal(character.generation?.playerName, '今天也想睡觉');
  assert.deepEqual(names, ['许知夏', '今天也想睡觉']);
});
test('changing real name during passerby generation rejects stale fiction', async () => {
  setupDiscovery();
  writeStoredValue('pocketos:personas', { activeProfileId: 'p', profiles: [{ id: 'p', realName: '许知夏', nickname: '网名' }] });
  mock.method(globalThis, 'fetch', async () => {
    writeStoredValue('pocketos:personas', { activeProfileId: 'p', profiles: [{ id: 'p', realName: '新真名', nickname: '网名' }] });
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult()) } }] });
  });
  await assert.rejects(generateAo3Discovery(discoveryOptions(), 'user', new AbortController().signal), /人设已变化/);
  assert.equal(readAo3State().works.length, 0);
});
test('character CP writing optionally uses only current main-account experiences, then keeps a consistent anonymous pen name', async () => {
  setupDiscovery(); const requests: Record<string, unknown>[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body)); const materials = JSON.parse(body.messages.at(-1).content); requests.push(materials);
    assert.doesNotMatch(JSON.stringify(materials), /旧分支记忆|其他人的聊天|隐藏消息|隐藏的心声|不应发出的其他角色/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult({ author: requests.length === 1 ? 'night_window' : 'should_not_replace_pen_name' })) } }] });
  });
  const first = await generateAo3Discovery(discoveryOptions({ authorType: 'character', direction: '平行世界，在书店重逢' }), 'user', new AbortController().signal);
  assert.match(JSON.stringify(requests[0].experiences), /一起修好了书架/); assert.doesNotMatch(JSON.stringify(requests[0].experiences), /当前存档记忆/);
  assert.equal(first.generation?.authorCharId, 'a'); assert.equal(first.generation?.authorCharName, '林渡'); assert.ok(first.tags.includes('梦向'));
  writeAo3State(updateAo3(readAo3State(), { type: 'discover', work: first }));
  const second = await generateAo3Discovery(discoveryOptions({ authorType: 'character', includeExperiences: false }), 'user', new AbortController().signal);
  assert.equal(requests[1].experiences, undefined); assert.equal(second.author, 'night_window'); assert.equal(requests[1].knownPenName, 'night_window');
  assert.equal(readAo3State().works.filter(w => w.owned).length, 0);
});
test('character pen names remain locked after every work is deleted and follow configured forum names for new stories', async () => {
    setupDiscovery();
    let requests = 0;
    const names: unknown[] = [];
    mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body)), input = JSON.parse(body.messages.at(-1).content);
      names.push(input.knownPenName); requests++;
      return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult({ author: `random_${requests}` })) } }] });
    });
    const options = discoveryOptions({ authorType: 'character', includeExperiences: false });
    const first = await generateAo3Discovery(options, 'user', new AbortController().signal);
    assert.equal(first.author, 'random_1'); assert.equal(readAo3PenName('a'), first.author);
    let state = updateAo3(readAo3State(), { type: 'discover', work: first });
    state = updateAo3(state, { type: 'delete', id: first.id }); writeAo3State(state);
    assert.equal(state.works.length, 0);
    const second = await generateAo3Discovery(options, 'user', new AbortController().signal);
    assert.equal(second.author, first.author); assert.equal(names[1], first.author);
    writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', forumHandle: '@forum_name', persona: '沉静' }]);
    const third = await generateAo3Discovery(options, 'user', new AbortController().signal);
    assert.equal(third.author, 'forum_name'); assert.equal(names[2], 'forum_name');
    assert.equal(first.author, 'random_1');
    writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', forumHandle: '新的论坛名' }]);
    assert.equal((await generateAo3Discovery(options, 'user', new AbortController().signal)).author, '新的论坛名');
    assert.equal(readAo3PenName('b'), undefined);
  });
  test('pen-name settings survive prompt edits and backup round trips; legacy backups and invalid imports are handled safely', async () => {
    setupDiscovery(); lockAo3PenName('a', 'locked_name'); lockAo3PenName('a', 'should_not_replace');
    assert.equal(readAo3PenName('a'), 'locked_name');
    saveAo3Prompt('保留笔名的偏好');
    assert.equal(readAo3PenName('a'), 'locked_name');
    const backup = exportAo3Data();
    await clearAo3Data(); assert.equal(readAo3PenName('a'), undefined);
    await importAo3Data(backup);
    assert.equal(readAo3PenName('a'), 'locked_name'); assert.equal(readAo3Settings().prompt, '保留笔名的偏好');
    await assert.rejects(importAo3Data({ ...backup, settings: { prompt: '', penNames: { a: 123 } } }), /备份内容不完整/);
    assert.equal(readAo3PenName('a'), 'locked_name');
    await importAo3Data({ ...backup, settings: { prompt: '旧版本备份' } });
    assert.equal(readAo3PenName('a'), undefined); assert.equal(readAo3Settings().prompt, '旧版本备份');
  });
  test('failed or cancelled character fiction never locks a newly invented pen name', async () => {
    setupDiscovery();
    const options = discoveryOptions({ authorType: 'character', includeExperiences: false });
    mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult({ comments: [] })) } }] }));
    await assert.rejects(generateAo3Discovery(options, 'user', new AbortController().signal), /五条评论/);
    assert.equal(readAo3PenName('a'), undefined);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(generateAo3Discovery(options, 'user', controller.signal));
    assert.equal(readAo3PenName('a'), undefined);
  });
test('ordinary fandom may be random or specified, and character authorship does not turn it into a user pairing', async () => {
  setupDiscovery(); const requests: Record<string, unknown>[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body)); requests.push(JSON.parse(body.messages.at(-1).content));
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult({ relationship: '甲 / 乙', characters: ['甲', '乙'] })) } }] });
  });
  const random = await generateAo3Discovery(discoveryOptions({ topic: 'fandom', charId: '' }), 'user', new AbortController().signal);
  assert.equal(random.fandom, '排球少年'); assert.equal(random.relationship, '甲 / 乙'); assert.equal(requests[0].character, undefined); assert.equal((requests[0].player as { name: string }).name, '小满');
  const specified = await generateAo3Discovery(discoveryOptions({ topic: 'fandom', authorType: 'character', fandom: '指定的小说', direction: '写并肩冒险' }), 'user', new AbortController().signal);
  assert.equal(specified.fandom, '指定的小说'); assert.equal((requests[1].player as { name: string }).name, '小满'); assert.equal(requests[1].experiences, undefined);
  assert.equal(specified.generation?.authorCharId, 'a'); assert.equal(specified.generation?.pairCharId, undefined); assert.equal(requests.length, 2);
});
test('discovered works stay distinct from player posts and can be removed with their bookmarks and reading history', async () => {
  setupDiscovery(); mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult()) } }] }));
  const work = await generateAo3Discovery(discoveryOptions(), 'user', new AbortController().signal);
  let state = updateAo3(initialAo3State(), { type: 'discover', work });
  assert.equal(updateAo3(state, { type: 'discover', work }), state);
  state = updateAo3(state, { type: 'bookmark', id: work.id }); state = updateAo3(state, { type: 'read', id: work.id, chapter: 0, now });
  writeAo3State(state); assert.ok(isAo3State(readAo3State())); assert.equal(readAo3State().works.filter(w => w.owned).length, 0);
  assert.throws(() => updateAo3(state, { type: 'publish', work }), /作品内容不完整/);
  state = updateAo3(state, { type: 'delete', id: work.id }); assert.deepEqual(state, initialAo3State());
});
test('missing characters, malformed replies, failed HTTP, and aborted discovery do not add works or overwrite drafts', async () => {
  setupDiscovery(); const draft = readAo3Draft(), original = readAo3State(); let calls = 0;
  const fetchStub = mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ choices: [{ message: { content: '{"title":"只有标题"}' } }] }); });
  await assert.rejects(generateAo3Discovery(discoveryOptions({ charId: 'deleted' }), 'user', new AbortController().signal), /选择/);
  assert.equal(calls, 0);
  await assert.rejects(generateAo3Discovery(discoveryOptions(), 'user', new AbortController().signal), /完整作品/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(generateAo3Discovery(discoveryOptions(), 'user', controller.signal));
  assert.equal(calls, 1);
  fetchStub.mock.mockImplementation(async () => { calls++; return new Response('QA unavailable', { status: 503 }); });
  await assert.rejects(generateAo3Discovery(discoveryOptions(), 'user', new AbortController().signal), /503/);
  assert.equal(calls, 2); assert.deepEqual(readAo3State(), original); assert.deepEqual(readAo3Draft(), draft);
});
test('switching persona or archive during generation discards stale character fiction instead of publishing it', async () => {
  setupDiscovery(); let switchArchive = false;
  mock.method(globalThis, 'fetch', async () => {
    if (switchArchive) writeStoredValue('yyphone:wechat-chats', [{ id: 'main', type: 'direct', participantIds: ['a'], activeArchiveId: 'another', messages: [] }]);
    else writeStoredValue('pocketos:personas', { profiles: [], activeProfileId: 'other' });
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult()) } }] });
  });
  await assert.rejects(generateAo3Discovery(discoveryOptions(), 'user', new AbortController().signal), /人设已变化/);
  setupDiscovery(); switchArchive = true;
  await assert.rejects(generateAo3Discovery(discoveryOptions({ authorType: 'character' }), 'user', new AbortController().signal), /存档已变化/);
  assert.equal(readAo3State().works.length, 0);
});

test('both authors can use exactly the latest 150 visible messages; AU separates plot while retaining settings and five comments in one call', async () => {
  setupDiscovery();
  const chats = JSON.parse(readStorageString('yyphone:wechat-chats')!);
  chats[0].messages = Array.from({ length: 170 }, (_, i) => ({ id: String(i), senderId: i % 2 ? 'a' : 'user', kind: 'text', text: `对话序号${i}`, createdAt: now }));
  writeStoredValue('yyphone:wechat-chats', chats); let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    calls++; const body = JSON.parse(String(options?.body)); const input = JSON.parse(body.messages.at(-1).content);
    assert.equal(input.experiences.messages.length, 150);
    assert.equal(input.experiences.messages[0].text, '对话序号20');
    assert.equal(input.experiences.messages.at(-1).text, '对话序号169');
    assert.equal(input.relationshipSupplement, '正在熟悉彼此'); assert.equal(input.player.name, '小满');
    assert.equal(input.continuity, 'independent');
    assert.match(body.messages[0].content, /不要给 player 凭空添加/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult()) } }] });
  });
  for (const authorType of ['passerby', 'character'] as const) {
    const work = await generateAo3Discovery(discoveryOptions({ authorType, tone: '平行世界 AU' }), 'user', new AbortController().signal);
    assert.equal(work.comments.length, 5); assert.equal(new Set(work.comments.map(c => c.id)).size, 5);
  }
  assert.equal(calls, 2);
});
test('incomplete comments reject the entire generation without extra API calls or partial publication', async () => {
  setupDiscovery(); let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify(discoveryResult({ comments: [{ author: '读者', body: '喜欢' }] })) } }] }); });
  await assert.rejects(generateAo3Discovery(discoveryOptions(), 'user', new AbortController().signal), /五条评论/);
  assert.equal(calls, 1); assert.equal(readAo3State().works.length, 0);
});

test('追更 sends all complete previous chapters and original author context, then appends without overwriting metadata or interactions', async () => {
  setupDiscovery();
  const work: Ao3Work = { ...initialAo3State().works[0], id: 'continued', complete: true, author: 'anonymous_author',
    generation: { authorType: 'character', topic: 'couple', authorCharId: 'a', authorCharName: '林渡', pairCharId: 'a', pairCharName: '林渡', playerName: '小满' } };
  let state = { ...emptyAo3State(), works: [work] };
  writeAo3State(state);
  const draft = readAo3Draft(), chats = readStorageString('yyphone:wechat-chats');
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    calls++;
    const body = JSON.parse(String(options?.body)), input = JSON.parse(body.messages.at(-1).content);
    assert.equal(input.chapter, work.chapters.length + 1);
    assert.deepEqual(input.previousChapters, work.chapters);
    assert.equal(input.currentChapter.body, '');
    assert.equal(input.author, 'anonymous_author');
    assert.deepEqual(input.generation, work.generation);
    assert.equal(input.rating, work.rating);
    assert.equal(input.cast.length, 1); assert.equal(input.cast[0].name, '林渡');
    assert.match(body.messages[0].content, /必须承接最后一章/);
    assert.doesNotMatch(JSON.stringify(input), /不应发出的其他角色|隐藏的心声/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ chapterTitle: `续章${calls}`, body: `后续发展${calls}。\n\n不是重写。`, title: '不应覆盖标题' }) } }] });
  });
  const chapter = await generateAo3Continuation(work, new AbortController().signal);
  assert.equal(readAo3State().works[0].chapters.length, 1);
  state = updateAo3(state, { type: 'kudos', id: work.id });
  state = updateAo3(state, { type: 'bookmark', id: work.id });
  state = updateAo3(state, { type: 'comment', id: work.id, comment: { id: 'new-comment', author: 'reader', body: '期待后续', createdAt: now } });
  state = updateAo3(state, { type: 'read', id: work.id, chapter: 0, now, countHit: true });
  const before = state.works[0];
  state = updateAo3(state, { type: 'continue', work, chapter, now });
  assert.deepEqual(state.works[0], { ...before, chapters: [...work.chapters, chapter], complete: false, updatedAt: now });
  assert.deepEqual(state.bookmarks, [work.id]);
  assert.equal(state.history[0].chapter, 0);
  assert.throws(() => updateAo3(state, { type: 'continue', work, chapter, now }), /已修改或删除/);
  assert.throws(() => updateAo3(emptyAo3State(), { type: 'continue', work, chapter, now }), /已修改或删除/);
  // Later chapters must receive even the beginning of a long first chapter.
  work.chapters = [{ title: '长章', body: '必须保留的开头' + '中'.repeat(6000) }, ...Array.from({ length: 3 }, (_, i) => ({ title: `旧章${i}`, body: '旧章正文' }))];
  const next = await generateAo3Continuation(work, new AbortController().signal);
  state = updateAo3({ ...emptyAo3State(), works: [work] }, { type: 'continue', work, chapter: next, now });
  writeAo3State(state);
  assert.deepEqual(readAo3State(), state); assert.ok(isAo3State(state));
  assert.equal(calls, 2); assert.deepEqual(readAo3Draft(), draft);
  assert.equal(readStorageString('yyphone:wechat-chats'), chats);
});
test('failed, cancelled, malformed or over-limit continuations preserve the archive', async () => {
  setupDiscovery();
  const state = initialAo3State(), work = state.works[0]; writeAo3State(state);
  let response = '{"body":""}';
  mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: response } }] }));
  await assert.rejects(generateAo3Continuation(work, new AbortController().signal), /原稿已保留/);
  response = 'not json';
  await assert.rejects(generateAo3Continuation(work, new AbortController().signal));
  response = JSON.stringify({ body: 'x'.repeat(200001) });
  await assert.rejects(generateAo3Continuation(work, new AbortController().signal), /原稿已保留/);
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => {
    controller.abort();
    return Response.json({ choices: [{ message: { content: '{"body":"不应保存"}' } }] });
  });
  await assert.rejects(generateAo3Continuation(work, controller.signal));
  mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  await assert.rejects(generateAo3Continuation(work, new AbortController().signal), /503/);
  const full = { ...work, chapters: Array.from({ length: 100 }, () => work.chapters[0]) };
  await assert.rejects(generateAo3Continuation(full, new AbortController().signal), /100 章上限/);
  assert.throws(() => updateAo3({ ...state, works: [full] }, { type: 'continue', work: full, chapter: work.chapters[0], now }), /100 章上限/);
  assert.deepEqual(readAo3State(), state);
});
