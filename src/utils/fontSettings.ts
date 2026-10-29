import { readSetting, SETTINGS_KEYS } from './settings';

export const FONT_FAMILIES = {
  system: { label: '默认无衬线', value: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
  serif: { label: '宋体 / 衬线', value: '"Noto Serif SC", "Songti SC", SimSun, serif' },
  rounded: { label: '圆体', value: '"Yuanti SC", "Hiragino Maru Gothic ProN", "Microsoft YaHei", sans-serif' },
} as const;

export interface FontSettings {
  scale: number;
  family: keyof typeof FONT_FAMILIES;
  url?: string;
  file?: { name: string; dataUrl: string };
}

export const MAX_FONT_BYTES = 30 * 1024 * 1024;
const isFontFile = (value: unknown): value is NonNullable<FontSettings['file']> => !!value && typeof value === 'object' &&
  typeof (value as any).name === 'string' && typeof (value as any).dataUrl === 'string' &&
  (value as any).dataUrl.length <= Math.ceil(MAX_FONT_BYTES / 3) * 4 + 64 &&
  /^data:font\/(?:ttf|otf|woff2?);base64,[A-Za-z0-9+/]+={0,2}$/.test((value as any).dataUrl);

export async function readFontFile(file: File): Promise<NonNullable<FontSettings['file']>> {
  if (!/\.(?:ttf|otf|woff2?)$/i.test(file.name)) throw new Error('请选择 TTF、OTF、WOFF 或 WOFF2 字体文件。');
  if (!file.size || file.size > MAX_FONT_BYTES) throw new Error('字体文件需小于 30 MB，且不能为空。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = Array.from(bytes.slice(0, 4), byte => String.fromCharCode(byte)).join('');
  const format = signature === '\x00\x01\x00\x00' || signature === 'true' ? 'ttf' : signature === 'OTTO' ? 'otf' : signature === 'wOFF' ? 'woff' : signature === 'wOF2' ? 'woff2' : '';
  if (!format) throw new Error('文件内容不是可识别的字体，请确认文件完整。');
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return { name: file.name, dataUrl: `data:font/${format};base64,${btoa(binary)}` };
}

export const DEFAULT_FONT_SETTINGS: FontSettings = { scale: 1, family: 'system' };

export const readFontSettings = (): FontSettings =>
  readSetting(SETTINGS_KEYS.font, DEFAULT_FONT_SETTINGS, (value): value is FontSettings => {
    if (!value || typeof value !== 'object') return false;
    const settings = value as Partial<FontSettings>;
    return typeof settings.scale === 'number' && Number.isFinite(settings.scale) &&
      settings.scale >= 0.85 && settings.scale <= 1.3 &&
      typeof settings.family === 'string' && Object.hasOwn(FONT_FAMILIES, settings.family) &&
      (settings.file === undefined || isFontFile(settings.file)) && (settings.url === undefined || (typeof settings.url === 'string' &&
        (!settings.url || /^https?:\/\//i.test(settings.url))));
  });

export const normalizeFontUrl = (input: string): string => {
  if (!input.trim()) return '';
  const url = new URL(input.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('字体链接必须使用 HTTP 或 HTTPS。');
  return url.href;
};
