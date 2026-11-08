import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { hasNpcOwners, readCharacterNpcs, userNpcContext, writeCharacterNpcs } from './characterNpcs';
import { buildPrompt } from './buildPrompt';
import { deleteWeChatContact } from './deleteWeChatContact';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: () => true, localStorage: {
  getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(), key: (index: number) => [...storage.keys()][index] ?? null, get length() { return storage.size; },
} } });
const people = [{ id: 'a', name: '林渡', persona: '自然', worldBooks: [] }];
const profiles = ['one', 'two'].map(id => ({ id, name: id, nickname: id, identity: '学生', personality: '', background: '', speakingStyle: '' }));
beforeEach(async () => {
  await clearDbStorage();
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts': people,
    'pocketos:personas': { profiles, activeProfileId: 'one' },
    'yyphone:wechat-chats': [{ id: 'chat', type: 'direct', participantIds: ['a'], noteName: '', context: '', avatars: {}, messages: [] }],
    'yyphone:character-npcs': [
      { id: 'user-only', name: '阿岚', avatarUrl: '', persona: '是我的姐姐，开花店', linkedCharIds: [], linkedUserIds: ['one'] },
      { id: 'shared', name: '阿远', avatarUrl: '', persona: '青梅竹马', linkedCharIds: ['a'], linkedUserIds: ['one'] },
      { id: 'other-user', name: '另一身份的朋友', avatarUrl: '', persona: '只属于另一个人设', linkedCharIds: [], linkedUserIds: ['two'] },
    ],
  });
});

test('user-only NPCs survive normalization and shared NPCs retain user ownership after character unbinding', () => {
  const npcs = readCharacterNpcs();
  assert.equal(npcs.length, 3);
  writeCharacterNpcs(npcs, people);
  const stored = readCharacterNpcs();
  assert.deepEqual(stored.find(npc => npc.id === 'shared')?.linkedUserIds, ['one']);
  writeCharacterNpcs(stored.map(npc => ({ ...npc, linkedCharIds: [] })), []);
  const unbound = readCharacterNpcs().find(npc => npc.id === 'shared')!;
  assert.deepEqual(unbound.linkedCharIds, [], 'obsolete legacy charId must not restore a removed character link');
  assert.deepEqual(unbound.linkedUserIds, ['one']);
  assert.equal(hasNpcOwners(unbound), true);
});

test('normal chat includes only the active user identity NPCs and treats them as background, not automatic group participants', () => {
  const prompt = JSON.stringify(buildPrompt({ chatId: 'chat', currentInput: '今天去花店了', timeAwarenessEnabled: false }));
  assert.match(prompt, /阿岚/);
  assert.match(prompt, /是我的姐姐，开花店/);
  assert.doesNotMatch(prompt, /另一身份的朋友|只属于另一个人设/);
  assert.match(prompt, /不等于你已认识每个人/);
  writeStoredValue('pocketos:personas', { profiles, activeProfileId: 'two' });
  const switched = JSON.stringify(buildPrompt({ chatId: 'chat', currentInput: '你好', timeAwarenessEnabled: false }));
  assert.match(switched, /另一身份的朋友/);
  assert.doesNotMatch(switched, /阿岚|开花店/);
  assert.equal(userNpcContext('missing'), '');
});

test('deleting a character preserves user-bound NPCs and their existing group membership', async () => {
  writeStoredValue('yyphone:wechat-chats', [{ id: 'chat', type: 'direct', participantIds: ['a'], messages: [] },
    { id: 'group', type: 'group', participantIds: ['a', 'npc:shared', 'npc:user-only'], messages: [] }]);
  await deleteWeChatContact('a');
  const npcs = readCharacterNpcs();
  assert.equal(npcs.length, 3);
  assert.deepEqual(npcs.find(npc => npc.id === 'shared')?.linkedCharIds, []);
  const chats = JSON.parse(readStorageString('yyphone:wechat-chats')!);
  assert.deepEqual(chats.find((chat: { id: string }) => chat.id === 'group').participantIds, ['npc:shared', 'npc:user-only']);
});
