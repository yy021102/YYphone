import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { ANTHOLOGY_KEY, ANTHOLOGY_DRAFT_KEY, createAnthologyManuscript, defaultAnthologyDraft, isUserManuscript, readAnthologyArticles, readAnthologyDraft, saveAnthologyArticle, type AnthologyArticle } from './anthology';
import { clearAnthologyData, createAnthologyArchive, importAnthologyArchive } from './anthologyArchive';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const article = (id: string): AnthologyArticle => ({ id, authorId: 'author', authorName: '林渡', authorAvatar: '', title: `文章${id}`, body: '这是保存在本地的完整文章。',
  genre: 'narrative', style: 'plain', favorite: true, createdAt: '2026-11-16', updatedAt: '2026-11-16', draft: defaultAnthologyDraft() });
beforeEach(async () => { values.clear(); await clearDbStorage(); });

test('export/clear/import round-trips articles, favorites and writing options without touching chats', async () => {
  saveAnthologyArticle(article('a'));
  writeStoredValue(ANTHOLOGY_DRAFT_KEY, { ...defaultAnthologyDraft(), customStyle: '保留短句', direction: '窗边' });
  writeStoredValue('yyphone:wechat-chats', [{ messages: [{ source: 'anthology', text: '已分享文章' }] }]);
  const chats = readStorageString('yyphone:wechat-chats'), archive = createAnthologyArchive();
  await clearAnthologyData(); assert.equal(readAnthologyArticles().length, 0); assert.deepEqual(readAnthologyDraft(), defaultAnthologyDraft());
  assert.equal(readStorageString('yyphone:wechat-chats'), chats);
  const result = await importAnthologyArchive(JSON.parse(JSON.stringify(archive)), 'merge');
  assert.deepEqual(result, { added: 1, kept: 0 }); assert.equal(readAnthologyArticles()[0].favorite, true);
  assert.equal(readAnthologyDraft().customStyle, '保留短句'); assert.equal(readStorageString('yyphone:wechat-chats'), chats);
});

test('merge preserves local edits while explicit replacement restores the backup', async () => {
  saveAnthologyArticle(article('a')); const archive = createAnthologyArchive();
  saveAnthologyArticle({ ...article('a'), body: '本地修改后的正文' }, article('a')); saveAnthologyArticle(article('b'));
  assert.deepEqual(await importAnthologyArchive(archive, 'merge'), { added: 0, kept: 1 });
  assert.equal(readAnthologyArticles().find(a => a.id === 'a')?.body, '本地修改后的正文'); assert.equal(readAnthologyArticles().length, 2);
  await importAnthologyArchive(archive, 'replace'); assert.deepEqual(readAnthologyArticles(), archive.articles);
});

test('invalid archives and duplicate IDs fail before changing any data', async () => {
  saveAnthologyArticle(article('a')); const original = readStorageString(ANTHOLOGY_KEY), draft = readStorageString(ANTHOLOGY_DRAFT_KEY), archive = createAnthologyArchive();
  for (const bad of [{}, { ...archive, version: 99 }, { ...archive, articles: [...archive.articles, ...archive.articles] }, { ...archive, draft: {} }, { ...archive, articles: [{ title: '不完整' }] }]) {
    await assert.rejects(importAnthologyArchive(bad, 'replace'), /有效的文集备份/);
    assert.equal(readStorageString(ANTHOLOGY_KEY), original); assert.equal(readStorageString(ANTHOLOGY_DRAFT_KEY), draft);
  }
});

test('archives preserve personal manuscript ownership and response references while accepting legacy character articles', async () => {
  const own = { ...createAnthologyManuscript(), title: '我的观察', body: '写下一些自己的想法。' };
  saveAnthologyArticle(own);
  saveAnthologyArticle({ ...article('response'), sourceManuscript: { id: own.id, title: own.title, authorName: own.authorName }, draft: { ...defaultAnthologyDraft(), manuscriptId: own.id } });
  const archive = JSON.parse(JSON.stringify(createAnthologyArchive()));
  await clearAnthologyData(); await importAnthologyArchive(archive, 'replace');
  assert.equal(readAnthologyArticles().filter(isUserManuscript).length, 1);
  const response = readAnthologyArticles().find(a => a.id === 'response')!;
  assert.equal(response.sourceManuscript?.id, own.id); assert.equal(response.draft.manuscriptId, own.id);
  assert.equal(isUserManuscript(response), false);
});
