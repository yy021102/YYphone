import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { readOfflineMemories, saveOfflineMemory, type OfflineStory } from './offlineData';
import { offlineSummaryRanges, offlineSummaryBatches, readOfflineSummarySettings, saveOfflineSummarySettings, saveOfflineSummaryBatches } from './offlineSummary';
import { summarizeOfflineStory } from './offlineAi';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const story: OfflineStory = { id: 's', title: '雨后', characterIds: ['a'], personaId: '', worldBookIds: [], presetId: '',
  wechatContextCount: 0, autoChoices: false, contextMessages: 20, ended: false, createdAt: '2026-11-16T10:00:00Z', updatedAt: '2026-11-16T10:00:00Z',
  messages: Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, role: 'ai' as const, versions: [`本批独有事件${i}`], versionIndex: 0, createdAt: '2026-11-16T10:00:00Z' })) };
beforeEach(async () => {
  values.clear(); await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '温和', avatarUrl: '' }]);
  writeStoredValue('yyphone:wechat-chats', []);
  writeStoredValue('yyphone:api-presets', [{ id: 'main', name: '测试', endpoint: 'https://summary.invalid/v1', apiKey: 'fixture', model: 'model' }]);
});
afterEach(() => mock.restoreAll());

test('batch ranges are exact, inclusive and reject out-of-bounds/fractional input', () => {
  assert.deepEqual(offlineSummaryRanges(story, 2, 5, 2).map(b => [b.from, b.to, b.messageIds]), [[2, 3, ['m1', 'm2']], [4, 5, ['m3', 'm4']]]);
  for (const args of [[0, 3, 2], [1, 6, 2], [3, 2, 2], [1, 5, 0], [1.5, 5, 2]]) assert.throws(() => offlineSummaryRanges(story, args[0], args[1], args[2]));
});

test('manual batches need no API; append, exact replacement and overlap protection preserve prior memory', () => {
  mock.method(globalThis, 'fetch', async () => { throw new Error('Manual summaries must never call AI'); });
  saveOfflineSummaryBatches(story, [{ messageIds: ['m0', 'm1'], summary: '外部总结一' }]);
  saveOfflineSummaryBatches(story, [{ messageIds: ['m2', 'm3'], summary: '外部总结二' }]);
  assert.equal(readOfflineMemories().length, 1);
  assert.equal(offlineSummaryBatches('s').length, 2);
  saveOfflineSummaryBatches(story, [{ messageIds: ['m0', 'm1'], summary: '改好的第一批' }]);
  assert.equal(offlineSummaryBatches('s').length, 2);
  const original = JSON.stringify(readOfflineMemories());
  assert.throws(() => saveOfflineSummaryBatches(story, [{ messageIds: ['m1', 'm2'], summary: '重叠' }]), /重叠/);
  assert.equal(JSON.stringify(readOfflineMemories()), original);
  assert.throws(() => saveOfflineSummaryBatches(story, [{ messageIds: ['missing'], summary: '过期' }]), /范围已变化/);
  const chats = JSON.parse(readStorageString('yyphone:wechat-chats')!);
  assert.equal(chats.length, 1);
  assert.equal(chats[0].messages.length, 1);
  assert.match(chats[0].messages[0].aiContext, /改好的第一批[\s\S]*外部总结二/);
});

test('old whole-story memories survive appending, and explicit replacement replaces all batches', () => {
  saveOfflineMemory(story, '旧版完整总结');
  saveOfflineSummaryBatches(story, [{ messageIds: ['m4'], summary: '新增第五条' }]);
  assert.match(readOfflineMemories()[0].summary, /旧版完整总结[\s\S]*新增第五条/);
  saveOfflineSummaryBatches(story, [{ messageIds: story.messages.map(m => m.id), summary: '重写整篇' }], true);
  assert.equal(offlineSummaryBatches('s').length, 1);
  assert.ok(!readOfflineMemories()[0].summary.includes('旧版完整总结'));
});

test('custom summary settings persist and only selected records are sent without a task token cap', async () => {
  saveOfflineSummarySettings({ prompt: '按观察笔记写，保留日期', maxChars: 300, batchSize: 2 });
  assert.equal(readOfflineSummarySettings().prompt, '按观察笔记写，保留日期');
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++; const body = JSON.parse(String(init?.body));
    assert.ok(!Object.hasOwn(body, 'max_tokens'));
    assert.match(body.messages.at(-1).content, /按观察笔记写，保留日期/);
    assert.match(body.messages.at(-1).content, /最多 300 字/);
    assert.ok(!body.messages.at(-1).content.includes('本批独有事件0'));
    assert.ok(body.messages.at(-1).content.includes('本批独有事件2'));
    return Response.json({ choices: [{ message: { content: '林渡在雨后去了书店。' } }] });
  });
  await summarizeOfflineStory({ ...story, messages: story.messages.slice(2, 4) }, undefined);
  assert.equal(calls, 1);
  assert.equal(readOfflineMemories().length, 0); // Generation is a draft, never a write.
});

test('failed or overlong summaries never save partial memory and stop after one refinement', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ choices: [{ message: { content: '长'.repeat(400) } }] }); });
  const settings = { prompt: '', maxChars: 100, batchSize: 2 };
  await assert.rejects(summarizeOfflineStory(story, undefined, { settings, signal: controller.signal }));
  assert.equal(calls, 0);
  await assert.rejects(summarizeOfflineStory(story, undefined, { settings }), /未满足 100 字/);
  assert.equal(calls, 2);
  assert.equal(readOfflineMemories().length, 0);
});
