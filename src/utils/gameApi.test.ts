import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { getActiveApiPreset, requestConfiguredAiText } from './aiApi';
import { requestChatReply } from './chatReply';
import { EMPTY_GAME_API, GAME_API_KEY, getGameApiConnection, readGameApi, saveGameApi } from './gameApi';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null,
  get length() { return values.size; },
} } });
const main = { id: 'main', name: '主 API', endpoint: 'https://main.invalid/v1', apiKey: 'main-key', model: 'main-model', maxTokens: 5000, stream: false };
const secondary = { endpoint: 'https://games.invalid/v1', apiKey: 'games-key', model: 'game-model' };
beforeEach(async () => { values.clear(); await clearDbStorage(); writeStoredValue('yyphone:api-presets', [main]); });
afterEach(() => mock.restoreAll());

test('game dialogue and structured game generation use a separate API, restore main and never change other API settings', async () => {
  const mainBefore = readStorageString('yyphone:api-presets');
  writeStoredValue('yyphone:offline-api', { ...secondary, model: 'offline-model' });
  const offlineBefore = readStorageString('yyphone:offline-api');
  const models: string[] = [];
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)); models.push(body.model);
    assert.equal(String(url), `https://${body.model === 'main-model' ? 'main' : 'games'}.invalid/v1/chat/completions`);
    return Response.json({ choices: [{ message: { content: '{"reply":["轮到你啦"],"word":"蓝色"}' } }] });
  });
  const messages = [{ role: 'user' as const, content: '游戏中的一句话' }];
  await requestChatReply(messages, getGameApiConnection(), () => {});
  saveGameApi(secondary);
  await requestChatReply(messages, getGameApiConnection(), () => {});
  assert.match(await requestConfiguredAiText('同词相遇', '公开词语', { api: getGameApiConnection(), includeGlobalWorldBooks: false }), /蓝色/);
  saveGameApi({ ...EMPTY_GAME_API });
  await requestChatReply(messages, getGameApiConnection(), () => {});
  assert.deepEqual(models, ['main-model', 'game-model', 'game-model', 'main-model']);
  assert.equal(readStorageString('yyphone:api-presets'), mainBefore);
  assert.equal(readStorageString('yyphone:offline-api'), offlineBefore);
  assert.equal(getActiveApiPreset().model, 'main-model');
});

test('games can use a complete secondary API without configuring a main API', async () => {
  writeStoredValue('yyphone:api-presets', []);
  saveGameApi(secondary);
  assert.deepEqual(getGameApiConnection(), secondary);
  assert.deepEqual(readGameApi(), secondary);
});

test('incomplete or invalid game API settings preserve the saved connection; partial imported settings cannot fall back to main', () => {
  saveGameApi(secondary);
  const before = readStorageString(GAME_API_KEY);
  for (const bad of [{ ...secondary, model: '' }, { ...secondary, endpoint: 'not-a-url' }, { ...secondary, apiKey: '' }]) {
    assert.throws(() => saveGameApi(bad)); assert.equal(readStorageString(GAME_API_KEY), before);
  }
  writeStoredValue(GAME_API_KEY, { ...secondary, model: '' });
  assert.throws(() => getGameApiConnection(), /补齐游戏副 API/);
});
