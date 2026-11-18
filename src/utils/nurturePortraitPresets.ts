import { readStoredValue, writeStoredValue } from './localStorage';
import { validPortrait, validateTouchReplies, type Portrait } from './nurtureGame';

export type PortraitPreset = { id: string; name: string; portrait: Portrait };
const keyFor = (userId: string) => `yyphone:nurture-portrait-presets:${encodeURIComponent(userId || 'default')}`;
export function readPortraitPresets(userId: string): PortraitPreset[] {
  return structuredClone(readStoredValue<PortraitPreset[]>(keyFor(userId), [], (v): v is PortraitPreset[] => Array.isArray(v) && v.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && validPortrait(p.portrait))));
}
export function savePortraitPreset(userId: string, name: string, portrait: Portrait, id?: string) {
  if (!name.trim() || name.trim().length > 100) throw new Error('请填写 1～100 字的预设名称。');
  if (!validPortrait(portrait) || !portrait.image) throw new Error('请先上传立绘。');
  validateTouchReplies(portrait);
  const presets = readPortraitPresets(userId);
  if (id && !presets.some(p => p.id === id)) throw new Error('该预设已删除，请另存为新预设。');
  const preset = { id: id ?? crypto.randomUUID(), name: name.trim(), portrait: structuredClone(portrait) };
  const next = id ? presets.map(p => p.id === id ? preset : p) : [...presets, preset];
  writeStoredValue(keyFor(userId), next);
  return preset;
}
export function deletePortraitPreset(userId: string, id: string) {
  writeStoredValue(keyFor(userId), readPortraitPresets(userId).filter(p => p.id !== id));
}
