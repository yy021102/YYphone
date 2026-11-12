import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { ACTIVE_IMAGE_PRESET_KEY, deleteImageGenerationPreset, IMAGE_PRESETS_KEY, readImageGenerationPresets, saveImageGenerationPreset, selectImageGenerationPreset } from './imageGenerationPresets';
import { generateImage, resolveImageApi, imageDimensions, imageSizeOptions, type ImageGenerationSettings } from './imageGeneration';
const values = new Map<string, string>(); let failKey = '';
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { if (k === failKey) { failKey = ''; throw Error('QUOTA_TEST'); } values.set(k, v); },
  removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const config: ImageGenerationSettings = { provider: 'openai', endpoint: 'https://image.invalid/v1', apiKey: 'image-key', model: 'custom-image', size: 'landscape' };
const read = (k: string) => JSON.parse(readStorageString(k) || 'null');
beforeEach(async () => { failKey = ''; await clearDbStorage(); writeStoredValue('yyphone:api-presets', [{ id: 'main', endpoint: 'MAIN_UNCHANGED' }]); });
afterEach(() => mock.restoreAll());

test('9:16 is saved in presets and reaches every provider in portrait orientation', async () => {
  let body: any;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response('mock rejection after inspecting request', { status: 400 });
  });
  for (const provider of ['openai', 'novelai', 'gemini', 'imagen'] as const) {
    const dimensions = imageDimensions(provider, 'tallscreen');
    assert.equal(dimensions.width / dimensions.height, 9 / 16);
    assert.equal(dimensions.aspectRatio, '9:16');
    assert(imageSizeOptions(provider).some(option => option.value === 'tallscreen' && option.label.includes('9:16')));
    await assert.rejects(generateImage('竖屏壁纸', { provider, endpoint: 'https://mock.invalid', apiKey: 'key', model: 'image-model', size: 'tallscreen' }));
    if (provider === 'openai') assert.equal(body.size, '864x1536');
    if (provider === 'novelai') assert.deepEqual([body.parameters.width, body.parameters.height], [576, 1024]);
    if (provider === 'gemini') assert.equal(body.generationConfig.imageConfig.aspectRatio, '9:16');
    if (provider === 'imagen') assert.equal(body.parameters.aspectRatio, '9:16');
  }
  const preset = await saveImageGenerationPreset('竖屏', { ...config, size: 'tallscreen' });
  assert.equal((await selectImageGenerationPreset(preset.id)).size, 'tallscreen');
  assert.equal(imageDimensions('openai', 'widescreen').aspectRatio, '16:9');
});

test('16:9 reaches each image provider using its own size parameter', async () => {
  let body: any;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response('mock rejection after inspecting request', { status: 400 });
  });
  for (const provider of ['openai', 'novelai', 'gemini', 'imagen'] as const) {
    await assert.rejects(generateImage('花园', { provider, endpoint: 'https://mock.invalid', apiKey: 'key', model: 'image-model', size: 'widescreen' }));
    if (provider === 'openai') assert.equal(body.size, '1536x864');
    if (provider === 'novelai') assert.deepEqual([body.parameters.width, body.parameters.height], [1024, 576]);
    if (provider === 'gemini') assert.equal(body.generationConfig.imageConfig.aspectRatio, '16:9');
    if (provider === 'imagen') assert.equal(body.parameters.aspectRatio, '16:9');
  }
});

test('16:9 is an exact provider ratio and survives preset save/select without changing older dimensions', async () => {
  for (const provider of ['openai', 'novelai', 'gemini', 'imagen'] as const) {
    const dimensions = imageDimensions(provider, 'widescreen');
    assert.equal(dimensions.aspectRatio, '16:9'); assert.equal(dimensions.width / dimensions.height, 16 / 9);
    assert(imageSizeOptions(provider).some(option => option.value === 'widescreen' && option.label.includes('16:9')));
    if (provider === 'novelai') { assert.equal(dimensions.width % 64, 0); assert.equal(dimensions.height % 64, 0); }
  }
  const preset = await saveImageGenerationPreset('宽屏', { ...config, size: 'widescreen' });
  assert.equal((await selectImageGenerationPreset(preset.id)).size, 'widescreen');
  assert.equal(imageDimensions('openai', 'landscape').size, '1536x1024');
});
test('saving and selecting presets restores provider, endpoint, key, model and size without modifying the main API', async () => {
  const a = await saveImageGenerationPreset('横图', config); const b = await saveImageGenerationPreset('谷歌', { provider: 'gemini', endpoint: 'https://google.invalid', apiKey: 'google-key', model: 'gemini-image', size: 'square' });
  assert.equal(readImageGenerationPresets().length, 2); assert.equal(read(ACTIVE_IMAGE_PRESET_KEY), b.id);
  assert.deepEqual(await selectImageGenerationPreset(a.id), config); assert.deepEqual(read('yyphone:image-generation'), config); assert.equal(read('yyphone:api-presets')[0].endpoint, 'MAIN_UNCHANGED');
  await deleteImageGenerationPreset(a.id); assert.equal(readImageGenerationPresets().length, 1); assert.deepEqual(read('yyphone:image-generation'), config); assert.equal(read(ACTIVE_IMAGE_PRESET_KEY), '');
});
test('rapid preset saves serialize without losing either preset, and blank fields keep provider matching semantics', async () => {
  await Promise.all([saveImageGenerationPreset('一', config), saveImageGenerationPreset('二', { ...config, model: 'second' })]); assert.equal(readImageGenerationPresets().length, 2);
  const empty = { provider: 'gemini', endpoint: '', apiKey: '', model: '' } as const;
  const saved = await saveImageGenerationPreset('跟随', empty); assert.equal(saved.settings.apiKey, ''); assert.equal(saved.settings.size, 'square');
  assert.equal(resolveImageApi(empty, { endpoint: 'https://generativelanguage.googleapis.com', apiKey: 'google' }).apiKey, 'google');
  assert.equal(resolveImageApi(empty, { endpoint: 'https://other.invalid/v1', apiKey: 'wrong' }).apiKey, '');
});
test('a failed atomic save leaves both the previous active config and preset library intact; invalid data never overwrites it', async () => {
  await saveImageGenerationPreset('原来', config); const keys = [IMAGE_PRESETS_KEY, ACTIVE_IMAGE_PRESET_KEY, 'yyphone:image-generation']; const before = keys.map(k => readStorageString(k));
  failKey = ACTIVE_IMAGE_PRESET_KEY; await assert.rejects(saveImageGenerationPreset('失败', { ...config, model: 'new' }), /QUOTA_TEST/); assert.deepEqual(keys.map(k => readStorageString(k)), before);
  writeStoredValue(IMAGE_PRESETS_KEY, { bad: true }); await assert.rejects(saveImageGenerationPreset('不能覆盖', config), /数据异常/); assert.deepEqual(read(IMAGE_PRESETS_KEY), { bad: true });
});
