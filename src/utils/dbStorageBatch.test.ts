import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearDbStorage, getCachedStorageItem, setStorageItemsAtomically } from './dbStorage';

const values = new Map<string, string>();
let failOnce = '';
const localStorage = { getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (key === failOnce) { failOnce = ''; throw new Error('quota'); } values.set(key, value); },
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; } };
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });

test('platform import commits both records while preserving other apps and rolls back incomplete writes', async () => {
  await clearDbStorage();
  await setStorageItemsAtomically({ content: { posts: ['old'] }, profile: { nickname: 'old' }, unrelated: 'keep' });
  failOnce = 'profile';
  await assert.rejects(setStorageItemsAtomically({ content: { posts: ['new'] }, profile: { nickname: 'new' } }), /quota/);
  assert.deepEqual(getCachedStorageItem('content').value, { posts: ['old'] });
  assert.deepEqual(JSON.parse(values.get('content')!), { posts: ['old'] });
  assert.deepEqual(JSON.parse(values.get('profile')!), { nickname: 'old' });
  await setStorageItemsAtomically({ content: { posts: ['new'] }, profile: { nickname: 'new' } });
  assert.deepEqual(getCachedStorageItem('content').value, { posts: ['new'] });
  assert.equal(getCachedStorageItem('unrelated').value, 'keep');
});
