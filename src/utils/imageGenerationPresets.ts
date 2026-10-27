import { initializeDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, readStoredValue } from './localStorage';
import { defaultImageSize, isImageGenerationSettings, type ImageGenerationSettings } from './imageGeneration';
import { SETTINGS_KEYS } from './settings';

export const IMAGE_PRESETS_KEY = 'yyphone:image-generation-presets';
export const ACTIVE_IMAGE_PRESET_KEY = 'yyphone:active-image-generation-preset';
export interface ImageGenerationPreset { id: string; name: string; settings: ImageGenerationSettings }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const valid = (v: unknown): v is ImageGenerationPreset[] => Array.isArray(v) && v.every(p => record(p) && typeof p.id === 'string' && typeof p.name === 'string' && isImageGenerationSettings(p.settings)) && new Set(v.map(p => p.id)).size === v.length;
export const readImageGenerationPresets = () => readStoredValue(IMAGE_PRESETS_KEY, [], valid);
function strictPresets() { const value: unknown = JSON.parse(readStorageString(IMAGE_PRESETS_KEY) || '[]'); if (!valid(value)) throw new Error('生图预设数据异常，未覆盖原预设。'); return value; }
export function normalizeImageSettings(config: ImageGenerationSettings): ImageGenerationSettings {
  if (!isImageGenerationSettings(config)) throw new Error('生图配置无效。');
  const endpoint = config.endpoint.trim();
  if (endpoint) { let url: URL; try { url = new URL(endpoint); } catch { throw new Error('生图接口地址无效。'); } if (!['http:', 'https:'].includes(url.protocol)) throw new Error('生图接口地址必须使用 HTTP(S)。'); }
  return { provider: config.provider, endpoint, apiKey: config.apiKey.trim(), model: config.model.trim(), size: config.size ?? defaultImageSize(config.provider) };
}
let queue: Promise<unknown> = Promise.resolve();
function update<T>(action: () => Promise<T>): Promise<T> { const run = queue.then(async () => { await initializeDbStorage(); return action(); }); queue = run.catch(() => {}); return run; }
export function saveImageGenerationPreset(name: string, config: ImageGenerationSettings) {
  const label = name.trim(); if (!label || label.length > 40) return Promise.reject(new Error('请填写40字以内的生图预设名称。'));
  const settings = normalizeImageSettings(config);
  return update(async () => {
    const all = strictPresets(), preset = { id: crypto.randomUUID(), name: label, settings };
    await setStorageItemsAtomically({ [IMAGE_PRESETS_KEY]: [...all, preset], [SETTINGS_KEYS.imageGeneration]: settings, [ACTIVE_IMAGE_PRESET_KEY]: preset.id });
    return preset;
  });
}
export function selectImageGenerationPreset(id: string) {
  return update(async () => {
    const preset = strictPresets().find(p => p.id === id); if (!preset) throw new Error('这个生图预设已不存在。');
    const settings = normalizeImageSettings(preset.settings);
    await setStorageItemsAtomically({ [SETTINGS_KEYS.imageGeneration]: settings, [ACTIVE_IMAGE_PRESET_KEY]: id });
    return settings;
  });
}
export function deleteImageGenerationPreset(id: string) {
  return update(async () => {
    const all = strictPresets(), active = readStoredValue(ACTIVE_IMAGE_PRESET_KEY, '', (v): v is string => typeof v === 'string');
    await setStorageItemsAtomically({ [IMAGE_PRESETS_KEY]: all.filter(p => p.id !== id), ...(active === id ? { [ACTIVE_IMAGE_PRESET_KEY]: '' } : {}) });
  });
}
