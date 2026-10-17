import { useCallback, useEffect, useState } from 'react';
import { readStoredValue, writeStoredValue } from './localStorage';
import { WidgetAppearance } from '../types';

export type { WidgetAppearance } from '../types';

const EMPTY: WidgetAppearance = { background: '', disc: '', note: '' };

const isAppearance = (value: unknown): value is Partial<WidgetAppearance> =>
  typeof value === 'object' && value !== null;

export const readWidgetAppearance = (key: string): WidgetAppearance => {
  const stored = readStoredValue<Partial<WidgetAppearance>>(key, {}, isAppearance);
  return {
    background: typeof stored.background === 'string' ? stored.background : '',
    disc: typeof stored.disc === 'string' ? stored.disc : '',
    note: typeof stored.note === 'string' ? stored.note : '',
  };
};

export const useWidgetAppearance = (key: string) => {
  const [appearance, setAppearance] = useState<WidgetAppearance>(() => readWidgetAppearance(key));

  useEffect(() => {
    setAppearance(readWidgetAppearance(key));
  }, [key]);

  const patch = useCallback(
    (next: Partial<WidgetAppearance>) => {
      setAppearance((current) => {
        const merged = { ...current, ...next };
        writeStoredValue(key, merged);
        return merged;
      });
    },
    [key]
  );

  return { appearance, patch, reset: (field: keyof WidgetAppearance) => patch({ [field]: EMPTY[field] }) };
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取。'));
    image.src = src;
  });

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片无法读取。'));
    reader.readAsDataURL(file);
  });

// Local files are downscaled (and optionally center-cropped to a square) so they stay small in storage.
export const imageFileToDataUrl = async (
  file: File,
  options: { maxSize: number; square?: boolean }
): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。');
  const image = await loadImage(await readFileAsDataUrl(file));
  const { naturalWidth: width, naturalHeight: height } = image;
  const side = Math.min(width, height);
  const source = options.square
    ? { x: (width - side) / 2, y: (height - side) / 2, w: side, h: side }
    : { x: 0, y: 0, w: width, h: height };
  const scale = Math.min(1, options.maxSize / Math.max(source.w, source.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.w * scale));
  canvas.height = Math.max(1, Math.round(source.h * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('图片无法处理。');
  context.drawImage(image, source.x, source.y, source.w, source.h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
};

export const validateImageUrl = (value: string): string => {
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('请输入 http(s) 开头的图片链接。');
  return url;
};
