import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString } from './localStorage';
import { deleteWeChatContact } from './deleteWeChatContact';
import { regeneratedReplyIds } from './chatRegeneration';
import { buildPrompt } from './buildPrompt';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const read = (key: string) => JSON.parse(readStorageString(key) ?? 'null');
beforeEach(async () => {
  await clearDbStorage();
  const message = { id: 'history', senderId: 'a', text: '之前一起看过海', createdAt: '2026-10-26T12:00:00Z' };
  const base = { type: 'direct', noteName: '', context: '', avatars: {}, messages: [], updatedAt: message.createdAt };
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts': [{ id: 'a', name: '林渡', avatarUrl: 'a.png', persona: '温柔', worldBooks: [] }, { id: 'b', name: '时予', avatarUrl: '', persona: '活泼', worldBooks: [] }],
    'yyphone:character-npcs': [{ id: 'shared', name: '朋友', avatarUrl: '', persona: '', linkedCharIds: ['a', 'b'] }, { id: 'orphan', name: '管家', avatarUrl: '', persona: '', linkedCharIds: ['a'] }],
    'yyphone:wechat-chats': [
      { ...base, id: 'direct-a', participantIds: ['a'], messages: [message], archives: [{ id: 'old', messages: [message] }] },
      { ...base, id: 'direct-b', participantIds: ['b'], attachHistory: true, attachedHistoryContactId: 'a', attachedHistoryChatIds: ['direct-a'], attachedHistoryCounts: { 'direct-a': 200 } },
      { ...base, id: 'npc-chat', participantIds: ['npc:orphan'] },
      { ...base, id: 'group', type: 'group', participantIds: ['a', 'b', 'npc:shared', 'npc:orphan'], groupTitle: '朋友们', groupNicknames: { a: '阿渡', b: '小予' }, avatars: { a: 'override.png' }, messages: [message], archives: [{ id: 'group-old', messages: [message] }] },
    ],
  });
});
afterEach(() => mock.restoreAll());

test('deleting a character removes direct chats and all archives, group membership and obsolete mounted links, preserving historical group authors', async () => {
  const before = read('yyphone:wechat-chats').find((chat: any) => chat.id === 'group');
  await deleteWeChatContact('a');
  assert.deepEqual(read('pocketos:wechat-contacts').map((c: any) => c.id), ['b']);
  const npcs = read('yyphone:character-npcs'); assert.equal(npcs.length, 1); assert.deepEqual(npcs[0].linkedCharIds, ['b']); assert.equal(npcs[0].charId, 'b');
  const chats = read('yyphone:wechat-chats'); assert.deepEqual(chats.map((c: any) => c.id), ['direct-b', 'group']);
  const group = chats[1]; assert.deepEqual(group.participantIds, ['b', 'npc:shared']);
  assert.deepEqual(group.messages, before.messages); assert.deepEqual(group.archives, before.archives);
  assert.deepEqual(group.formerParticipants.a, { name: '阿渡', avatarUrl: 'override.png' });
  assert.equal(group.groupNicknames.a, undefined); assert.equal(group.avatars.a, undefined);
  assert.equal(chats[0].attachedHistoryContactId, undefined); assert.deepEqual(chats[0].attachedHistoryChatIds, []); assert.deepEqual(chats[0].attachedHistoryCounts, {});
  const prompt = buildPrompt({ chatId: 'group', timeAwarenessEnabled: false }).map(m => m.content).join('\n');
  assert.match(prompt, /阿渡（ID：a）/); assert.match(prompt, /之前一起看过海/);
  assert(!prompt.includes('林渡（温柔）'));
});

test('deleting the last character leaves a readable empty group with its complete history', async () => {
  await deleteWeChatContact('a'); await deleteWeChatContact('b');
  const chats = read('yyphone:wechat-chats'); assert.equal(chats.length, 1); assert.equal(chats[0].id, 'group');
  assert.deepEqual(chats[0].participantIds, []); assert.equal(chats[0].messages[0].text, '之前一起看过海');
  assert.equal(chats[0].formerParticipants.a.name, '阿渡'); assert.equal(chats[0].formerParticipants.b.name, '小予');
});

test('contact deletion storage failure leaves contacts, chats, and NPC links unchanged together', async () => {
  const keys = ['pocketos:wechat-contacts', 'yyphone:wechat-chats', 'yyphone:character-npcs'];
  const before = keys.map(readStorageString); let failed = false;
  mock.method(window.localStorage, 'setItem', (key: string, value: string) => { if (key === 'yyphone:wechat-chats' && !failed) { failed = true; throw new Error('quota'); } values.set(key, value); });
  await assert.rejects(deleteWeChatContact('a'), /quota/); assert.deepEqual(keys.map(readStorageString), before);
});

test('regeneration targets an entire response batch without deleting earlier turns, user messages or context notes', () => {
  const messages = [{ id: 'old', senderId: 'a', replyBatchId: 'old-batch' }, { id: 'u', senderId: 'user' },
    { id: 'photo', senderId: 'a', kind: 'image', replyBatchId: 'new-batch' }, { id: 'n', senderId: 'narrator', replyBatchId: 'new-batch' }, { id: 'text', senderId: 'a', replyBatchId: 'new-batch' }];
  assert.deepEqual([...regeneratedReplyIds(messages)], ['photo', 'n', 'text']);
  assert.deepEqual([...regeneratedReplyIds([...messages, { id: 'context', senderId: 'narrator', kind: 'context-note' }])], []);
  assert.deepEqual([...regeneratedReplyIds([...messages, { id: 'new-user', senderId: 'user' }])], []);
  assert.deepEqual([...regeneratedReplyIds([{ id: 'legacy', senderId: 'a' }])], ['legacy']);
});
