import { readSetting, SETTINGS_KEYS } from './settings';

export type OpeningStyle = 'pearl' | 'across' | 'cream';

export const OPENING_STYLES = [
  { id: 'pearl', name: '珍珠极光', description: '双 Y 玻璃与柔和折光' },
  { id: 'across', name: '屏幕两端', description: '隔着玻璃，微光相触' },
  { id: 'cream', name: '奶油来信', description: '蝴蝶结与泡泡字的甜梦' },
] as const;

export const isOpeningStyle = (value: unknown): value is OpeningStyle => OPENING_STYLES.some(style => style.id === value);

export function readOpeningStyle(): OpeningStyle {
  const saved = readSetting<OpeningStyle | 'rain'>(SETTINGS_KEYS.openingStyle, 'pearl',
    (value): value is OpeningStyle | 'rain' => value === 'rain' || isOpeningStyle(value));
  return saved === 'rain' ? 'pearl' : saved;
}
