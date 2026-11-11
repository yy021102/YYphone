import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { activePersonaRecordSpace, clearDbStorage, getAllCachedStorageItems, getStorageItem, replaceDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStoredValue, readStorageString, writeStoredValue } from './localStorage';
import { personaHasRecords, switchPersonaRecords } from './personaRecords';
import { PERSONA_COLLECTION_KEY, PERSONA_RECORDS_KEY } from './personaStorage';
import type { PersonaCollection } from '../types';

const values = new Map<string, string>();
let rejectWrite = false;
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (rejectWrite && key === PERSONA_RECORDS_KEY) throw new Error('fixture quota'); values.set(key, value); },
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const profiles = ['modern', 'fantasy', 'shared'].map(id => ({ id, name: id, identity: '', personality: '', background: '', speakingStyle: '' }));
const collection = (activeProfileId: string): PersonaCollection => ({ profiles, activeProfileId });
const contentKeys = ['yyphone:wechat-chats', 'yyphone:wechat-moments', 'yyphone:memory-items', 'yyphone:memory-journal', 'yyphone:memory-embeddings', 'yyphone:couple-spaces', 'yyphone:couple-rewards', 'yyphone:alias-accounts', 'yyphone:check-phone-data', 'yyphone:offline-stories', 'yyphone:channels:life-v1'];
const read = (key: string) => readStoredValue<unknown>(key, null, (_value): _value is unknown => true);
const reload = async () => replaceDbStorage(getAllCachedStorageItems());
beforeEach(async () => { rejectWrite = false; await clearDbStorage(); writeStoredValue(PERSONA_COLLECTION_KEY, collection('modern')); });

test('independent personas preserve original progress, start clean, isolate all relationship memories and restore both ways after reload', async () => {
  for (const key of contentKeys) writeStoredValue(key, [{ marker: 'modern' }]);
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '甲' }]);
  writeStoredValue('yyphone:api-presets', [{ apiKey: 'shared-api' }]);
  writeStoredValue('yyphone:world-books', [{ name: '共用世界书' }]);
  assert.deepEqual(await switchPersonaRecords(collection('fantasy'), 'independent'), { reload: true });
  // This old document continues writing only to the old records until it is unloaded.
  assert.equal(activePersonaRecordSpace(), 'legacy');
  writeStoredValue('yyphone:wechat-chats', [{ marker: 'modern-late-result' }]);
  await reload();
  assert.notEqual(activePersonaRecordSpace(), 'legacy');
  for (const key of contentKeys) assert.equal(read(key), null, key);
  assert.deepEqual(read('pocketos:wechat-contacts'), [{ id: 'a', name: '甲' }]);
  assert.deepEqual(read('yyphone:api-presets'), [{ apiKey: 'shared-api' }]);
  assert.deepEqual(read('yyphone:world-books'), [{ name: '共用世界书' }]);
  await setStorageItemsAtomically(Object.fromEntries(contentKeys.map(key => [key, [{ marker: 'fantasy' }]])));
  assert.deepEqual(await getStorageItem('yyphone:wechat-chats', { fresh: true }), [{ marker: 'fantasy' }]);
  await switchPersonaRecords(collection('modern')); await reload();
  assert.deepEqual(read('yyphone:wechat-chats'), [{ marker: 'modern-late-result' }]);
  for (const key of contentKeys.slice(1)) assert.deepEqual(read(key), [{ marker: 'modern' }]);
  await switchPersonaRecords(collection('fantasy')); await reload();
  for (const key of contentKeys) assert.deepEqual(read(key), [{ marker: 'fantasy' }]);
});

test('shared personas reuse the chosen records; backups preserve independent spaces and namespace writes never fall back to legacy data', async () => {
  writeStoredValue('yyphone:wechat-chats', ['original']);
  await switchPersonaRecords(collection('fantasy'), 'independent'); await reload();
  assert.equal(readStorageString('yyphone:wechat-chats'), null);
  writeStoredValue('yyphone:wechat-chats', ['fantasy']);
  assert.deepEqual(await switchPersonaRecords(collection('shared'), 'shared'), { reload: false });
  assert.deepEqual(read('yyphone:wechat-chats'), ['fantasy']);
  const backup = getAllCachedStorageItems();
  await clearDbStorage(); await replaceDbStorage(backup);
  assert.deepEqual(read('yyphone:wechat-chats'), ['fantasy']);
  await switchPersonaRecords(collection('modern')); await reload();
  assert.deepEqual(read('yyphone:wechat-chats'), ['original']);
});

test('failed durable switches leave the identity, mappings and original records intact', async () => {
  writeStoredValue('yyphone:wechat-chats', ['safe']);
  rejectWrite = true;
  await assert.rejects(switchPersonaRecords(collection('fantasy'), 'independent'), /quota/);
  rejectWrite = false;
  assert.equal(personaHasRecords('fantasy'), false);
  assert.equal((read(PERSONA_COLLECTION_KEY) as PersonaCollection).activeProfileId, 'modern');
  assert.deepEqual(read('yyphone:wechat-chats'), ['safe']);
});
