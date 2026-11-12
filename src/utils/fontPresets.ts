import { readStoredValue } from './localStorage';
import { isFontSettings, type FontSettings } from './fontSettings';

export const FONT_PRESETS_KEY = 'yyphone:font-presets';
export interface FontPreset { id: string; name: string; settings: FontSettings }
export const isFontPresetList = (value: unknown): value is FontPreset[] => Array.isArray(value) &&
  value.every(item => item && typeof item.id === 'string' && !!item.id && typeof item.name === 'string' &&
    !!item.name.trim() && item.name.length <= 40 && isFontSettings(item.settings)) &&
  new Set(value.map(item => item.id)).size === value.length;

export function readFontPresets() {
  return readStoredValue(FONT_PRESETS_KEY, [] as FontPreset[], isFontPresetList);
}

export function createFontPreset(name: string, settings: FontSettings, existing: FontPreset[]): FontPreset {
  const label = name.trim();
  if (!label || label.length > 40) throw new Error('请填写 1～40 字的字体预设名称。');
  if (existing.some(item => item.name === label)) throw new Error('已有同名字体预设，请换一个名称。');
  if (!isFontSettings(settings)) throw new Error('当前字体设置无效，无法保存预设。');
  return { id: `font-${crypto.randomUUID()}`, name: label, settings: {
    family: settings.family, scale: settings.scale,
    ...(settings.url ? { url: settings.url } : {}),
    ...(settings.file ? { file: { ...settings.file } } : {}),
  } };
}
