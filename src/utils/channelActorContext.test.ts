import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChannelActorContext, channelWorldContext } from './channelActorContext';
import { emptyChannelProfile } from './channelProfile';
import { clearDbStorage } from './dbStorage';
import { writeStoredValue } from './localStorage';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, localStorage: { getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } } });

test('original personas and exact bound book entries survive platform book selection; private sources stay per role and opt-in', async () => {
  await clearDbStorage();
  const contacts = [{ id: 'a', name: '角色甲', persona: 'ORIGINAL_PERSONA_A', worldBooks: [{ bookId: 'bound-a', entryId: 'used' }] },
    { id: 'b', name: '角色乙', persona: 'ORIGINAL_PERSONA_B', worldBooks: [{ bookId: 'bound-b' }] }];
  writeStoredValue('pocketos:wechat-contacts', contacts);
  writeStoredValue('yyphone:world-books', [
    { id: 'global', name: '公共世界', isGlobal: true, entries: [{ id: 'g', title: '公共', content: 'GLOBAL_WORLD', depth: 'front' }] },
    { id: 'platform', name: '平台书', entries: [{ id: 'p', title: '平台', content: 'PLATFORM_WORLD', depth: 'front' }] },
    { id: 'bound-a', name: '甲绑定书', entries: [{ id: 'used', title: '甲条目', content: 'BOUND_WORLD_A', depth: 'front' }, { id: 'not-used', title: '未绑定条目', content: 'UNLINKED_ENTRY', depth: 'back' }] },
    { id: 'bound-b', name: '乙绑定书', entries: [{ id: 'b', title: '乙条目', content: 'BOUND_WORLD_B', depth: 'front' }] },
  ]);
  writeStoredValue('yyphone:wechat-chats', contacts.map(contact => ({ id: `chat-${contact.id}`, type: 'direct', participantIds: [contact.id], currentChatHistoryCount: 2,
    messages: ['OLD', 'RECENT', 'LATEST'].map((text, index) => ({ id: `${contact.id}${index}`, senderId: index === 2 ? 'user' : contact.id, createdAt: `2026-10-26T12:0${index}:00Z`, text: `${text}_CHAT_${contact.id.toUpperCase()}` })) })));
  writeStoredValue('yyphone:memory-items', contacts.map(contact => ({ id: `memory-${contact.id}`, charId: contact.id, content: `CORE_MEMORY_${contact.id.toUpperCase()}`, category: 'core', importance: 5, pinned: true,
    createdAt: '2026-10-25', updatedAt: '2026-10-25', recallCount: 0, source: 'manual' })));
  writeStoredValue('yyphone:memory-journal', [{ id: 'journal-a', charId: 'a', level: 1, from: '2026-01-01', to: '2026-01-02', content: 'JOURNAL_MEMORY_A', createdAt: '2026-01-03', messageCount: 10, source: 'manual' }]);
  writeStoredValue('yyphone:memory-growth', [{ id: 'growth-a', charId: 'a', status: 'active', relationship: 'GROWTH_MEMORY_A', changes: '', habits: '', createdAt: '2026-01-03', basedOnUntil: '' }]);
  const settings = emptyChannelProfile().settings; settings.worldBookIds = ['platform']; settings.roles = [{ contactId: 'a', identity: '', persona: 'PLATFORM_PERSONA_A', relationToUser: '' }];
  const actors = [{ id: 'a', name: '旧昵称', persona: 'STALE_PERSONA' }, { id: 'a', name: '重复' }, { id: 'stranger:new', name: '路人' }];
  let result = await buildChannelActorContext(actors, contacts, settings, '日常'); assert.equal(result.length, 1);
  assert.equal(result[0].originalPersona, 'ORIGINAL_PERSONA_A'); assert(result[0].worldBook.includes('BOUND_WORLD_A')); assert(result[0].worldBook.includes('GLOBAL_WORLD'));
  assert(!result[0].worldBook.includes('UNLINKED_ENTRY')); assert(!JSON.stringify(result).includes('BOUND_WORLD_B'));
  assert(!JSON.stringify(result).includes('CHAT_')); assert(!JSON.stringify(result).includes('CORE_MEMORY'));
  assert(channelWorldContext(settings).includes('PLATFORM_WORLD')); assert(channelWorldContext(settings).includes('GLOBAL_WORLD'));
  settings.roles[0].injectChatContext = true;
  result = await buildChannelActorContext(actors, contacts, settings, '日常');
  assert(JSON.stringify(result).includes('RECENT_CHAT_A')); assert(!JSON.stringify(result).includes('OLD_CHAT_A')); assert(!JSON.stringify(result).includes('CHAT_B'));
  assert(!JSON.stringify(result).includes('CORE_MEMORY_A'));
  settings.roles[0].injectChatContext = false; settings.roles[0].injectMemory = true;
  result = await buildChannelActorContext(actors, contacts, settings, '日常');
  assert(JSON.stringify(result).includes('CORE_MEMORY_A')); assert(JSON.stringify(result).includes('JOURNAL_MEMORY_A')); assert(JSON.stringify(result).includes('GROWTH_MEMORY_A'));
  assert(!JSON.stringify(result).includes('CHAT_A')); assert(!JSON.stringify(result).includes('CORE_MEMORY_B'));
  settings.roles[0].injectMemory = false;
  result = await buildChannelActorContext(actors, contacts, settings, '日常'); assert(!JSON.stringify(result).includes('CORE_MEMORY_A'));
  assert.deepEqual(await buildChannelActorContext([{ id: 'stranger:new', name: '路人' }], contacts, settings, '日常'), []);
});
