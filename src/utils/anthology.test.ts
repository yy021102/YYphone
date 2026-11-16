import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { ANTHOLOGY_KEY, ANTHOLOGY_DRAFT_KEY, ANTHOLOGY_GENRES, ANTHOLOGY_STYLES, createAnthologyManuscript, defaultAnthologyDraft, isUserManuscript, readAnthologyDraft, readAnthologyArticles, saveAnthologyArticle, saveGeneratedAnthologyArticle, favoriteAnthologyArticle, deleteAnthologyArticle, anthologyExportText, type AnthologyArticle } from './anthology';
import { anthologyWritingGuidance } from './anthologyPrompts';
import { anthologyContext, generateAnthologyArticle, shareAnthologyArticle } from './anthologyGeneration';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; },
} } });
const draft = () => ({ ...defaultAnthologyDraft(), authorId: 'a', direction: '讨论效率崇拜', material: '材料：一些人用忙碌证明价值。' });
const manuscript = (): AnthologyArticle => ({ id: 'article', authorId: 'a', authorName: '林渡', authorAvatar: '', title: '关于忙碌', body: '有些事情，不能只看它用了多少时间。', genre: 'essay', style: 'restrained', favorite: false,
  createdAt: '2026-11-16T10:00:00Z', updatedAt: '2026-11-16T10:00:00Z', draft: draft() });
beforeEach(async () => {
  values.clear(); await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '作者关注人的尊严，温和但有判断。', worldBooks: [{ bookId: 'w' }] }, { id: 'b', name: '小夏', persona: '好奇' }]);
  writeStoredValue('yyphone:api-presets', [{ id: 'main', name: '主 API', endpoint: 'https://anthology.invalid/v1', apiKey: 'fixture', model: 'model' }]);
  writeStoredValue('yyphone:world-books', [{ id: 'w', name: '作者的世界', isGlobal: true, entries: [{ id: 'e', title: '身份', content: '作者在旧书店工作。', depth: 'front' }] }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'chat-a', type: 'direct', participantIds: ['a'], activeArchiveId: 'current', context: '角色与读者认识，但有独立的生活。', messages: [
    { senderId: 'user', text: 'CHAT_SECRET_OLD', createdAt: '2026-11-14' }, { senderId: 'a', text: 'CHAT_SECRET_RECENT', createdAt: '2026-11-15' },
    { senderId: 'a', text: 'THOUGHT_SECRET', kind: 'thought', createdAt: '2026-11-15' }, { senderId: 'a', text: 'HIDDEN_SECRET', hidden: true, createdAt: '2026-11-15' },
  ] }, { id: 'chat-b', type: 'direct', participantIds: ['b'], messages: [{ senderId: 'b', text: 'OTHER_ROLE_SECRET', createdAt: '2026-11-15' }] }]);
  writeStoredValue('yyphone:memory-items', [
    { charId: 'a', archiveKey: JSON.stringify(['a', 'current']), content: 'CURRENT_MEMORY', importance: 4 },
    { charId: 'a', archiveKey: JSON.stringify(['a', 'old']), content: 'OLD_ARCHIVE_SECRET', importance: 5 },
    { charId: 'b', content: 'OTHER_MEMORY_SECRET' },
  ]);
  writeStoredValue('yyphone:memory-journal', [{ charId: 'a', archiveKey: JSON.stringify(['a', 'current']), content: 'CURRENT_JOURNAL', to: '2026-11-15' }]);
});
afterEach(() => mock.restoreAll());

test('default generation excludes optional conversations/memories and deduplicates bound/global world books', () => {
  const context = anthologyContext(draft()), encoded = JSON.stringify(context);
  assert.equal(context.worldBooks.length, 1);
  assert.match(encoded, /作者关注人的尊严/); assert.match(encoded, /作者在旧书店工作/);
  assert.ok(!('recentConversations' in context) && !('memories' in context));
  assert.ok(!encoded.includes('CHAT_SECRET') && !encoded.includes('CURRENT_MEMORY'));
});

test('optional sources are bounded to this author/current archive and never include hidden messages or thoughts', () => {
  const context = anthologyContext({ ...draft(), attachChats: true, chatCount: 1, attachMemories: true }), encoded = JSON.stringify(context);
  assert.equal(context.recentConversations?.length, 1);
  assert.match(encoded, /CHAT_SECRET_RECENT/); assert.match(encoded, /CURRENT_MEMORY/); assert.match(encoded, /CURRENT_JOURNAL/);
  for (const secret of ['CHAT_SECRET_OLD', 'THOUGHT_SECRET', 'HIDDEN_SECRET', 'OTHER_ROLE_SECRET', 'OLD_ARCHIVE_SECRET', 'OTHER_MEMORY_SECRET']) assert.ok(!encoded.includes(secret), secret);
});

test('generation creates a draft with independent-perspective rules and never writes chats or memories', async () => {
  const before = ['yyphone:wechat-chats', 'yyphone:memory-items', 'yyphone:memory-journal'].map(readStorageString);
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)), source = JSON.parse(body.messages[1].content);
    assert.match(body.messages[0].content, /不固定用/); assert.match(body.messages[0].content, /不声称做过联网查证/);
    assert.equal(source.author.id, 'a'); assert.equal(source.genre.label, '杂文'); assert.equal(source.style.label, '锋利思辨');
    assert.match(source.genre.instructions, /态度口号/);
    assert.match(source.style.references, /鲁迅.*王小波/);
    assert.match(source.style.instructions, /检验反例/);
    assert.match(body.messages[0].content, /不是逐项打卡的检查表/);
    assert.ok(!body.messages[1].content.includes('汪曾祺')); // Unselected presets must not expand request context.
    assert.ok(!Object.hasOwn(body, 'max_tokens')); assert.ok(!('memories' in source));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: '时间的价签', body: '书店里有一只停了的钟。人们依然知道什么时候该离开，这大约说明了什么。' }) } }] });
  });
  const result = await generateAnthologyArticle({ ...draft(), genre: 'essay', style: 'sharp' }, new AbortController().signal);
  assert.equal(result.authorName, '林渡'); assert.equal(result.title, '时间的价签');
  assert.deepEqual(readAnthologyArticles(), []);
  assert.deepEqual(['yyphone:wechat-chats', 'yyphone:memory-items', 'yyphone:memory-journal'].map(readStorageString), before);
});

test('generation guidance leaves the compact UI descriptions unchanged and custom requirements stay explicit', async () => {
  const compact = JSON.stringify({ genres: ANTHOLOGY_GENRES, styles: ANTHOLOGY_STYLES });
  const selected = anthologyWritingGuidance({ genre: 'narrative', style: 'plain' });
  assert.equal(selected.genre.hint, ANTHOLOGY_GENRES.find(g => g.id === 'narrative')!.hint);
  assert.equal(selected.style.hint, ANTHOLOGY_STYLES.find(s => s.id === 'plain')!.hint);
  assert.match(selected.style.references, /汪曾祺、杨绛/);
  assert.ok(selected.style.instructions.length > selected.style.hint.length);
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)), source = JSON.parse(body.messages[1].content);
    assert.equal(source.genre.id, 'poetry'); assert.match(source.genre.instructions, /分行/);
    assert.equal(source.style.id, 'custom'); assert.match(source.style.references, /不额外指定作家/);
    assert.equal(source.customStyle, '用短诗行，情绪坦率，不回避愤怒');
    assert.ok(!Object.hasOwn(body, 'max_tokens'));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: '窗边', body: '风从没有名字的地方来\n我没有关窗\n那些没有想明白的话\n还在桌上摊着' }) } }] });
  });
  const result = await generateAnthologyArticle({ ...draft(), genre: 'poetry', style: 'custom', customStyle: '用短诗行，情绪坦率，不回避愤怒' }, new AbortController().signal);
  assert.match(result.body, /\n/);
  assert.equal(JSON.stringify({ genres: ANTHOLOGY_GENRES, styles: ANTHOLOGY_STYLES }), compact);
});

test('stopped, incomplete or invalid requests do not yield a manuscript or destroy an existing one', async () => {
  saveAnthologyArticle(manuscript());
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => { controller.abort(); return Response.json({ choices: [{ message: { content: '{"title":"晚到的稿件","body":"这篇完整的内容虽然已经返回，但用户已经停止了本次写作请求。"}' } }] }); });
  await assert.rejects(generateAnthologyArticle(draft(), controller.signal));
  await assert.rejects(generateAnthologyArticle({ ...draft(), style: 'custom' }, new AbortController().signal), /自定义/);
  assert.equal(readAnthologyArticles()[0].title, '关于忙碌');
});

test('manuscripts retain concurrent favorites, reject stale overwrites and remain exportable after author deletion', () => {
  const original = manuscript(); saveAnthologyArticle(original); favoriteAnthologyArticle(original.id);
  const edited = saveAnthologyArticle({ ...original, title: '另一种时间' }, original);
  assert.equal(edited.favorite, true);
  assert.throws(() => saveAnthologyArticle({ ...original, body: '过期重写' }, original), /原稿已修改/);
  writeStoredValue('pocketos:wechat-contacts', []);
  assert.match(anthologyExportText(readAnthologyArticles()[0]), /另一种时间[\s\S]*林渡/);
  deleteAnthologyArticle(original.id); assert.equal(readAnthologyArticles().length, 0);
  assert.throws(() => saveAnthologyArticle(original, original), /删除/);
  writeStoredValue(ANTHOLOGY_KEY, { broken: true });
  assert.throws(readAnthologyArticles, /原数据已保留/); assert.throws(() => saveAnthologyArticle(original), /原数据已保留/);
});

test('explicit sharing includes the complete article once and distinguishes fiction/thought from real events', () => {
  const original = manuscript(); shareAnthologyArticle(original, ['a', 'a']); shareAnthologyArticle(original, ['a']);
  const chats = JSON.parse(readStorageString('yyphone:wechat-chats')!);
  const notes = chats.find((c: any) => c.id === 'chat-a').messages.filter((m: any) => m.source === 'anthology');
  assert.equal(notes.length, 1); assert.match(notes[0].aiContext, /不是新发生的经历或对话承诺/); assert.match(notes[0].aiContext, /不能只看它用了多少时间/);
  assert.equal(chats.find((c: any) => c.id === 'chat-b').messages.length, 1);
});

test('successful generation stores the original choices on the article and atomically resets the next writing form', async () => {
  const choices = { ...draft(), attachChats: true, attachMemories: true, customStyle: '上一轮的要求', manuscriptId: 'source' };
  writeStoredValue(ANTHOLOGY_DRAFT_KEY, choices);
  const saved = await saveGeneratedAnthologyArticle({ ...manuscript(), draft: choices });
  assert.deepEqual(saved.draft, choices);
  assert.deepEqual(readAnthologyDraft(), defaultAnthologyDraft());
  writeStoredValue(ANTHOLOGY_DRAFT_KEY, choices);
  await assert.rejects(saveGeneratedAnthologyArticle(manuscript()));
  assert.deepEqual(readAnthologyDraft(), choices); // A failed save must not clear retry input.
});

test('personal manuscripts retain user authorship, share as user writing and only the selected manuscript enters generation', async () => {
  writeStoredValue('pocketos:personas', { activeProfileId: 'u', profiles: [
    { id: 'u', name: '现代人设', realName: '小月亮', nickname: '月亮', identity: '刚毕业', personality: '好奇且重视自主', background: '最近在准备考试', speakingStyle: '自然简短', faceReferenceImage: 'PHOTO_SECRET' },
    { id: 'other', name: '其他身份', personality: 'INACTIVE_PERSONA_SECRET' },
  ] });
  const own = { ...createAnthologyManuscript(), title: '忙碌与空白', body: '我最近在想，把日程排满是不是一种逃避，也不确定留白应该是什么样的。' };
  saveAnthologyArticle(own);
  saveAnthologyArticle({ ...createAnthologyManuscript(), title: '另一篇', body: 'UNSELECTED_MANUSCRIPT_SECRET' });
  assert.equal(own.authorName, '小月亮'); assert.ok(isUserManuscript(own));
  const context = anthologyContext({ ...draft(), manuscriptId: own.id });
  assert.equal(context.respondingToManuscript?.body, own.body);
  assert.equal(context.userPersona.personality, '好奇且重视自主');
  const encoded = JSON.stringify(context);
  for (const hidden of ['PHOTO_SECRET', 'INACTIVE_PERSONA_SECRET', 'UNSELECTED_MANUSCRIPT_SECRET', 'CHAT_SECRET_RECENT']) assert.ok(!encoded.includes(hidden));
  shareAnthologyArticle(own, ['a']);
  const chats = JSON.parse(readStorageString('yyphone:wechat-chats')!);
  assert.match(chats[0].messages.at(-1).aiContext, /个人手稿，由玩家自己写作/);
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)), input = JSON.parse(body.messages[1].content);
    assert.equal(input.respondingToManuscript.id, own.id);
    assert.equal(input.userPersona.name, '小月亮');
    assert.match(body.messages[0].content, /不为表现独立而刻意唱反调/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: '留白的用处', body: '人有时并不需要马上给空白找一个用途。承认此刻没有答案，也许比重新填满它更困难。' }) } }] });
  });
  const result = await generateAnthologyArticle({ ...draft(), manuscriptId: own.id }, new AbortController().signal);
  assert.equal(result.sourceManuscript?.id, own.id); assert.equal(result.sourceManuscript?.authorName, '小月亮');
  assert.equal(readAnthologyArticles().find(a => a.id === own.id)?.body, own.body);
  assert.equal(readAnthologyArticles().length, 2); // Response generation alone does not publish or alter personal writing.
});

test('responding to a deleted or edited manuscript cannot silently use a stale source', async () => {
  const own = { ...createAnthologyManuscript(), title: '原手稿', body: '我想留一点时间，不急于替它安排用途。' }; saveAnthologyArticle(own);
  await assert.rejects(generateAnthologyArticle({ ...draft(), manuscriptId: 'missing' }, new AbortController().signal), /已不存在/);
  mock.method(globalThis, 'fetch', async () => {
    saveAnthologyArticle({ ...own, body: '这是我重新修改过的手稿，讨论的是另一件事情。' }, own);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: '旧回应', body: '这一篇虽然已经完整生成，但在生成期间它依据的手稿已经修改了。' }) } }] });
  });
  await assert.rejects(generateAnthologyArticle({ ...draft(), manuscriptId: own.id }, new AbortController().signal), /已修改或删除/);
  assert.equal(readAnthologyArticles().length, 1); assert.match(readAnthologyArticles()[0].body, /重新修改/);
});
