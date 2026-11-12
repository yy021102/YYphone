import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString } from './localStorage';
import { deleteImagePromptPreset, IMAGE_PROMPT_PRESETS_KEY, readImagePromptPresets, saveImagePromptPreset } from './imagePromptPresets';
import { personaStorageKey } from './personaStorage';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; },
} } });
beforeEach(async () => { await clearDbStorage(); });

test('shared prompt library persists names and text without storing role or API configuration', async () => {
  const chats = [{ id: 'a', imageGenerationPrompt: '角色专属内容' }, { id: 'b' }];
  await setStorageItemsAtomically({ 'yyphone:wechat-chats': chats, 'yyphone:image-generation': { apiKey: 'not-in-library' } });
  const preset = await saveImagePromptPreset(' 清新水彩 ', ' 低饱和\n水彩纸纹理 ');
  assert.deepEqual(readImagePromptPresets(), [{ id: preset.id, name: '清新水彩', prompt: '低饱和\n水彩纸纹理' }]);
  assert.equal(personaStorageKey(IMAGE_PROMPT_PRESETS_KEY, 'another-persona'), IMAGE_PROMPT_PRESETS_KEY);
  assert.deepEqual(JSON.parse(readStorageString('yyphone:wechat-chats')!), chats);
  assert.doesNotMatch(readStorageString(IMAGE_PROMPT_PRESETS_KEY)!, /not-in-library|角色专属内容/);
  await saveImagePromptPreset('更新后的名字', '更新后的风格', preset.id);
  assert.equal(readImagePromptPresets()[0].prompt, '更新后的风格');
  await deleteImagePromptPreset(preset.id);
  assert.deepEqual(readImagePromptPresets(), []);
  assert.deepEqual(JSON.parse(readStorageString('yyphone:wechat-chats')!), chats, 'library changes do not overwrite applied chat prompts');
});

test('concurrent saves preserve both presets and reject invalid or duplicate input without losing data', async () => {
  await Promise.all([saveImagePromptPreset('水彩', '水彩笔触'), saveImagePromptPreset('胶片', '胶片颗粒')]);
  assert.equal(readImagePromptPresets().length, 2);
  const saved = readStorageString(IMAGE_PROMPT_PRESETS_KEY);
  await assert.rejects(saveImagePromptPreset('水彩', '另一个'), /同名/);
  await assert.rejects(saveImagePromptPreset('', '内容'), /名称/);
  await assert.rejects(saveImagePromptPreset('空内容', ' '), /提示词/);
  await assert.rejects(saveImagePromptPreset('过长', 'x'.repeat(2001)), /提示词/);
  await assert.rejects(saveImagePromptPreset('丢失', '新内容', 'missing'), /不存在/);
  assert.equal(readStorageString(IMAGE_PROMPT_PRESETS_KEY), saved);
});

test('invalid stored libraries are reported rather than silently overwritten', async () => {
  await setStorageItemsAtomically({ [IMAGE_PROMPT_PRESETS_KEY]: { broken: true } });
  await assert.rejects(saveImagePromptPreset('新预设', '新内容'), /未覆盖/);
  assert.deepEqual(JSON.parse(readStorageString(IMAGE_PROMPT_PRESETS_KEY)!), { broken: true });
});
