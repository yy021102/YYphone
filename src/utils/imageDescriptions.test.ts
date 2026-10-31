import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { buildPrompt, toMessageContent, type OpenAiMessage, type PromptConversation } from './buildPrompt';
import { requestChatReply, withChatResponseFormat } from './chatReply';
import { imageDescriptionText, imageSourceKey, pendingImageTargets, validateImageDescriptions } from './imageDescriptions';
import { toOpenAiMessages, toGeminiContents } from './chatVision';
import { describeForSummary } from './journalData';
import { snapshotFavoriteMessage, favoriteShareContent } from './wechatFavorites';

const values = new Map<string, string>();
const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; } };
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, setTimeout, clearTimeout } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
const key = 'yyphone:wechat-chats';
const photo = (id = 'photo') => ({ id, senderId: 'user', kind: 'image', text: '拍摄的照片', imageUrl: 'data:image/jpeg;base64,AQID', createdAt: '2026-11-01T10:00:00Z' });
const chat = (id = 'chat'): PromptConversation => ({ id, activeArchiveId: 'one', archiveRevision: 1, type: 'direct', participantIds: ['a'], noteName: '', context: '', messages: [photo()] });
const api = { endpoint: 'https://vision.invalid/v1', apiKey: 'test', model: 'vision' };
const readChats = () => JSON.parse(readStorageString(key) || '[]') as PromptConversation[];
const prompt = (id = 'chat', extra: Record<string, unknown> = {}) => buildPrompt({ chatId: id, structuredHistory: true, ...extra });
const descriptions = (messages: OpenAiMessage[]) => pendingImageTargets(messages).map(t => ({ imageId: t.imageId, description: '一只灰白色的猫趴在浅蓝色窗台上，前爪压着一张写着“周日”的纸条，旁边有绿色的杯子。' }));
const response = (data: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(data) } }] });
const result = (messages: OpenAiMessage[]) => ({ reply: ['它还压着你的纸条呢'], thought: '它很放松。', speakerId: 'a', imageDescriptions: descriptions(messages) });
beforeEach(async () => {
  await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '', worldBooks: [] }]);
  writeStoredValue(key, [chat()]);
});
afterEach(() => mock.restoreAll());

test('one OpenAI reply describes the photo and persists hidden metadata; later history and regeneration are text-only', async () => {
  const first = prompt(); let calls = 0;
  mock.method(globalThis, 'fetch', async (_: unknown, init?: RequestInit) => {
    calls++; const body = JSON.parse(String(init?.body));
    assert(body.messages.some((m: any) => Array.isArray(m.content) && m.content.some((p: any) => p.type === 'image_url')));
    assert(body.messages.some((m: any) => typeof m.content === 'string' && m.content.includes('首次图片内容记录')));
    assert(!JSON.stringify(body).includes('archiveRevision'));
    return response(result(first));
  });
  const before = readChats()[0].messages[0];
  const reply = await requestChatReply(withChatResponseFormat(first, '返回聊天JSON'), api, () => {}, undefined, { requireThought: true });
  assert.deepEqual(reply.reply, ['它还压着你的纸条呢']); assert.equal(calls, 1);
  const saved = readChats()[0].messages[0];
  assert.equal(saved.imageUrl, before.imageUrl); assert.equal(saved.text, before.text); assert.equal(saved.createdAt, before.createdAt);
  assert.match(imageDescriptionText(saved), /灰白色的猫/); assert.equal(readChats()[0].messages.length, 1);
  for (const regenerate of [false, true]) {
    const next = prompt('chat', { regenerate }); assert.equal(pendingImageTargets(next).length, 0);
    assert(!next.some(m => m.images?.length)); assert.match(next.at(-1)!.content, /纸条/);
    assert(!JSON.stringify(toOpenAiMessages(next)).includes('image_url'));
    assert(!JSON.stringify(toGeminiContents(next)).includes('inlineData'));
    assert(!JSON.stringify(next).includes('AQID'));
  }
  const stored = readChats(); stored[0].messages.push({ id: 'text', senderId: 'user', text: '它旁边是什么颜色的杯子', createdAt: '2026-11-01T10:01:00Z' }); writeStoredValue(key, stored);
  const second = prompt(); assert.match(second.map(m => m.content).join('\n'), /绿色的杯子/); assert(!second.some(m => m.images?.length));
  mock.restoreAll(); mock.method(globalThis, 'fetch', async (_: unknown, init?: RequestInit) => {
    calls++; assert(!JSON.stringify(JSON.parse(String(init?.body))).includes('image_url')); return response({ reply: ['绿色的'], thought: '旁边的杯子。', speakerId: 'a' });
  });
  await requestChatReply(second, api, () => {}, undefined, { requireThought: true }); assert.equal(calls, 2);
  assert.match(describeForSummary(saved as any), /灰白色的猫/);
});

test('Gemini combines inline image and description output in the first reply and sends no image bytes next time', async () => {
  const messages = prompt(); let calls = 0;
  mock.method(globalThis, 'fetch', async (_: unknown, init?: RequestInit) => {
    calls++; const body = JSON.parse(String(init?.body));
    assert(body.contents.some((m: any) => m.parts.some((p: any) => p.inlineData?.data === 'AQID')));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result(messages)) }] } }] });
  });
  await requestChatReply(messages, { ...api, endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-flash' }, () => {});
  assert.equal(calls, 1); assert(!JSON.stringify(toGeminiContents(prompt())).includes('inlineData'));
});

test('old photos and mounted histories get distinct source IDs and cache on their original messages only', async () => {
  const main = chat(); main.attachHistory = true; main.attachedHistoryChatIds = ['other'];
  main.messages = [photo('same-id'), { id: 'new', senderId: 'user', text: '看看之前的图', createdAt: '2026-11-01T10:01:00Z' }];
  const other = chat('other'); other.messages = [photo('same-id')];
  writeStoredValue(key, [main, other, chat('not-mounted')]);
  const messages = prompt(); const targets = pendingImageTargets(messages); assert.equal(targets.length, 2); assert.notEqual(targets[0].imageId, targets[1].imageId);
  mock.method(globalThis, 'fetch', async () => response(result(messages)));
  await requestChatReply(messages, api, () => {});
  const saved = readChats(); assert(imageDescriptionText(saved[0].messages[0])); assert(imageDescriptionText(saved[1].messages[0])); assert.equal(imageDescriptionText(saved[2].messages[0]), '');
  assert.equal(pendingImageTargets(prompt()).length, 0);
});

test('missing or fabricated descriptors use the existing one correction; repeated bad output cannot mark a photo as read', async () => {
  const messages = prompt(); let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return response(calls === 1 ? { reply: ['猫'], thought: '猫。' } : result(messages)); });
  await requestChatReply(messages, api, () => {}); assert.equal(calls, 2); assert(imageDescriptionText(readChats()[0].messages[0]));
  writeStoredValue(key, [chat()]); calls = 0;
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => { calls++; return response({ ...result(messages), imageDescriptions: [{ imageId: 'invented-id', description: '不存在的图片' }] }); });
  await assert.rejects(requestChatReply(prompt(), api, () => {}), /纠正一次后仍无效/); assert.equal(calls, 2); assert.equal(imageDescriptionText(readChats()[0].messages[0]), '');
  assert.throws(() => validateImageDescriptions({ imageDescriptions: [] }, pendingImageTargets(prompt())), /不可遗漏/);
});

test('network failure and cancellation save no descriptor and keep the photo eligible for a later retry', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('offline'); });
  await assert.rejects(requestChatReply(prompt(), api, () => {}), /offline/); assert.equal(calls, 1); assert.equal(imageDescriptionText(readChats()[0].messages[0]), '');
  mock.restoreAll(); const controller = new AbortController(), messages = prompt();
  mock.method(globalThis, 'fetch', async () => { controller.abort(); return response(result(messages)); });
  await assert.rejects(requestChatReply(messages, api, () => {}, undefined, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(imageDescriptionText(readChats()[0].messages[0]), ''); assert.equal(pendingImageTargets(prompt()).length, 1);
});

test('late results cannot restore deleted messages, describe replacement images or write across archive revisions', async () => {
  const changes = [
    (c: PromptConversation) => { c.messages = []; },
    (c: PromptConversation) => { c.messages[0].imageUrl = 'data:image/jpeg;base64,BAUG'; },
    (c: PromptConversation) => { c.activeArchiveId = 'other'; },
    (c: PromptConversation) => { c.archiveRevision = 3; },
  ];
  for (const change of changes) {
    writeStoredValue(key, [chat()]); const messages = prompt();
    mock.restoreAll(); mock.method(globalThis, 'fetch', async () => { const latest = readChats(); change(latest[0]); writeStoredValue(key, latest); return response(result(messages)); });
    await requestChatReply(messages, api, () => {});
    assert(readChats()[0].messages.every(m => !m.imageDescription));
  }
  writeStoredValue(key, [chat()]); const messages = prompt(); mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => { writeStoredValue(key, []); return response(result(messages)); });
  await requestChatReply(messages, api, () => {}); assert.deepEqual(readChats(), []);
});

test('description persistence merges current storage without dropping new chat messages or changing unrelated metadata', async () => {
  const messages = prompt();
  mock.method(globalThis, 'fetch', async () => {
    const latest = readChats(); latest[0].messages.push({ id: 'concurrent', senderId: 'user', text: '我又发了一句', createdAt: '2026-11-01T10:02:00Z' });
    latest[0].noteName = '新备注'; writeStoredValue(key, latest); return response(result(messages));
  });
  await requestChatReply(messages, api, () => {});
  assert.equal(readChats()[0].messages.length, 2); assert.equal(readChats()[0].noteName, '新备注');
  const backup = JSON.parse(JSON.stringify(readChats())); writeStoredValue(key, backup);
  assert.equal(pendingImageTargets(prompt()).length, 0); assert.match(toMessageContent(backup[0].messages[0]), /窗台/);
});

test('a changed picture invalidates only its descriptor; out-of-window photos, stickers and text images cause no vision request', () => {
  const c = chat(); c.messages[0].imageDescription = { sourceKey: imageSourceKey(c.messages[0].imageUrl!), text: '旧图：灰白色的猫' }; writeStoredValue(key, [c]);
  assert.equal(pendingImageTargets(prompt()).length, 0);
  c.messages[0].imageUrl = 'data:image/jpeg;base64,BAUG'; writeStoredValue(key, [c]); assert.equal(pendingImageTargets(prompt()).length, 1); assert(!toMessageContent(c.messages[0]).includes('旧图'));
  c.messages.push({ id: 'sticker', senderId: 'user', kind: 'sticker', text: '开心', imageUrl: 'data:image/png;base64,AQID', createdAt: '2026-11-01T10:01:00Z' },
    { id: 'text-image', senderId: 'user', kind: 'image', text: '窗外的云', createdAt: '2026-11-01T10:02:00Z' },
    { id: 'new-text', senderId: 'user', text: '换个话题', createdAt: '2026-11-01T10:03:00Z' });
  c.currentChatHistoryCount = 1; writeStoredValue(key, [c]); const messages = prompt();
  assert.equal(pendingImageTargets(messages).length, 0); assert(!messages.some(m => m.images?.length));
});

test('a saved picture can be forwarded from favorites with its objective descriptor and without character thoughts', () => {
  const image = { ...photo(), imageDescription: { sourceKey: imageSourceKey(photo().imageUrl), text: '灰白色的猫' }, thought: 'private thought' };
  const snapshot = snapshotFavoriteMessage(image);
  assert(!JSON.stringify(snapshot).includes('private thought'));
  const shared = favoriteShareContent({ id: 'favorite', sourceChatId: 'chat', sourceMessageId: 'photo', sourceChatTitle: '林渡', sourceSenderName: '我', savedAt: '', message: snapshot });
  assert.equal(imageDescriptionText(shared), '灰白色的猫');
});
