import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { EMPTY_OFFLINE_API, OFFLINE_API_KEY, readOfflineApi, resolveOfflineApi, saveOfflineApi } from './offlineApi';
import { generateOfflineChoices, generateOfflineText, summarizeOfflineStory } from './offlineAi';
import { createDefaultPresets, normalizeStory, type OfflineStory } from './offlineData';
import { getActiveApiPreset } from './aiApi';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const main = { id: 'main', name: '主接口', endpoint: 'https://main.invalid/v1', apiKey: 'main-key', model: 'main-model' };
const secondary = { endpoint: 'https://offline.invalid/v1', apiKey: 'offline-key', model: 'story-model' };
const story: OfflineStory = { id: 's', title: '雨', characterIds: [], personaId: '', worldBookIds: [], presetId: '',
  wechatContextCount: 0, autoChoices: false, contextMessages: 20, ended: false, createdAt: '2026-11-08T10:00:00Z', updatedAt: '2026-11-08T10:00:00Z',
  messages: [{ id: 'm', role: 'ai', versions: ['他们一起走进书店。'], versionIndex: 0, createdAt: '2026-11-08T10:00:00Z' }] };
beforeEach(async () => { values.clear(); await clearDbStorage(); writeStoredValue('yyphone:api-presets', [main]); });
afterEach(() => mock.restoreAll());

test('offline generation falls back to main when empty, uses its own API for all tasks, and can return to main without changing it', async () => {
  const calls: Array<{ url: string; key: string; model: string }> = [];
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)); calls.push({ url: String(url), key: (init?.headers as Record<string,string>).Authorization, model: body.model });
    const content = body.messages.at(-1).content.includes('只返回 JSON：{"choices"') ? '{"choices":["去看书","问他的意见","挑本新书"]}' : '他们走到了窗边。';
    return Response.json({ choices: [{ message: { content } }] });
  });
  assert.equal(resolveOfflineApi(), undefined);
  await generateOfflineText(story, createDefaultPresets()[0], [], 'opening');
  assert.equal(calls.at(-1)?.url, 'https://main.invalid/v1/chat/completions');
  saveOfflineApi(secondary);
  await generateOfflineText(story, createDefaultPresets()[0], story.messages, 'continue');
  assert.equal((await generateOfflineChoices(story, createDefaultPresets()[0], story.messages)).length, 3);
  assert.match(await summarizeOfflineStory(story, createDefaultPresets()[0]), /窗边/);
  for (const call of calls.slice(1)) assert.deepEqual(call, { url: 'https://offline.invalid/v1/chat/completions', key: 'Bearer offline-key', model: 'story-model' });
  assert.equal(getActiveApiPreset().model, 'main-model');
  assert.ok(!JSON.stringify(normalizeStory(story)).includes('offline-key'));
  saveOfflineApi({ ...EMPTY_OFFLINE_API });
  await generateOfflineText(story, createDefaultPresets()[0], [], 'opening');
  assert.equal(calls.at(-1)?.model, 'main-model');
});

test('a complete secondary API works without any main API, and incomplete/invalid settings do not overwrite the saved connection', async () => {
  writeStoredValue('yyphone:api-presets', []);
  saveOfflineApi(secondary);
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ choices: [{ message: { content: '书店的门开着。' } }] }); });
  assert.equal((await generateOfflineText(story, undefined, [], 'opening')).text, '书店的门开着。');
  const before = readStorageString(OFFLINE_API_KEY);
  for (const bad of [{ ...secondary, model: '' }, { ...secondary, endpoint: 'not-a-url' }, { ...secondary, apiKey: '' }]) assert.throws(() => saveOfflineApi(bad));
  assert.equal(readStorageString(OFFLINE_API_KEY), before);
  assert.deepEqual(readOfflineApi(), secondary);
  writeStoredValue(OFFLINE_API_KEY, { ...secondary, model: '' });
  await assert.rejects(generateOfflineText(story, undefined, [], 'opening'), /补齐线下副 API/);
  assert.equal(calls, 1);
});
