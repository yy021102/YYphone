import { initializeDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, readStoredValue } from './localStorage';

export const IMAGE_PROMPT_PRESETS_KEY = 'yyphone:image-prompt-presets';
export interface ImagePromptPreset { id: string; name: string; prompt: string }
const valid = (value: unknown): value is ImagePromptPreset[] => Array.isArray(value) && value.every(item =>
  item && typeof item.id === 'string' && !!item.id && typeof item.name === 'string' && !!item.name.trim() && item.name.length <= 50 &&
  typeof item.prompt === 'string' && !!item.prompt.trim() && item.prompt.length <= 2000) && new Set(value.map(item => item.id)).size === value.length;
export const readImagePromptPresets = () => readStoredValue(IMAGE_PROMPT_PRESETS_KEY, [] as ImagePromptPreset[], valid);
function strictPresets(): ImagePromptPreset[] {
  const value: unknown = JSON.parse(readStorageString(IMAGE_PROMPT_PRESETS_KEY) ?? '[]');
  if (!valid(value)) throw new Error('生图提示词预设数据异常，未覆盖已有预设。');
  return value;
}
let writes: Promise<unknown> = Promise.resolve();
function update<T>(action: () => Promise<T>): Promise<T> {
  const next = writes.then(async () => { await initializeDbStorage(); return action(); });
  writes = next.catch(() => {}); return next;
}
export function saveImagePromptPreset(name: string, prompt: string, id?: string) {
  return update(async () => {
    const label = name.trim(), content = prompt.trim();
    if (!label || label.length > 50) throw new Error('请填写 50 字以内的预设名称。');
    if (!content || content.length > 2000) throw new Error('请填写 2000 字以内的生图提示词。');
    const all = strictPresets();
    if (id && !all.some(item => item.id === id)) throw new Error('该预设已不存在，请另存为新预设。');
    if (all.some(item => item.id !== id && item.name === label)) throw new Error('已有同名预设，请更换名称或更新原预设。');
    const preset = { id: id ?? crypto.randomUUID(), name: label, prompt: content };
    await setStorageItemsAtomically({ [IMAGE_PROMPT_PRESETS_KEY]: id ? all.map(item => item.id === id ? preset : item) : [...all, preset] });
    return preset;
  });
}
export function deleteImagePromptPreset(id: string) {
  return update(async () => {
    await setStorageItemsAtomically({ [IMAGE_PROMPT_PRESETS_KEY]: strictPresets().filter(item => item.id !== id) });
  });
}
