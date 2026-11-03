import { readSetting, SETTINGS_KEYS } from './settings';

export type OpeningStyle = 'pearl' | 'rain' | 'across' | 'cream';

export const OPENING_STYLES = [
  { id: 'pearl', name: '珍珠极光', description: '双 Y 玻璃与柔和折光' },
  { id: 'rain', name: '窗边细雨', description: '真实雨窗与渐显英文' },
  { id: 'across', name: '屏幕两端', description: '隔着玻璃，微光相触' },
  { id: 'cream', name: '奶油来信', description: '蝴蝶结与泡泡字的甜梦' },
] as const;

export const isOpeningStyle = (value: unknown): value is OpeningStyle => OPENING_STYLES.some(style => style.id === value);

export function readOpeningStyle(): OpeningStyle {
  return readSetting(SETTINGS_KEYS.openingStyle, 'pearl', isOpeningStyle);
}

export function openingMedia(base = import.meta.env?.BASE_URL ?? '/') {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return {
    video: `${prefix}openings/rain-window.mp4`,
    poster: `${prefix}openings/rain-window-poster.webp`,
  };
}
