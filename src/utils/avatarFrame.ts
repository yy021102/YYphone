import type React from 'react';
import type { AvatarFrameStyle } from '../types';

export type { AvatarFrameStyle };

export const DEFAULT_AVATAR_FRAME: AvatarFrameStyle = {
  enabled: false,
  color1: '#f5c9d9',
  color2: '#cde8f4',
  angle: 135,
  width: 3,
};

/** 一组柔和的渐变预设，点一下就能套用。 */
export const AVATAR_FRAME_PRESETS: Array<{ name: string; color1: string; color2: string }> = [
  { name: '粉蓝', color1: '#f5c9d9', color2: '#cde8f4' },
  { name: '奶油桃', color1: '#fde2c8', color2: '#f8c6d4' },
  { name: '薄荷天空', color1: '#c9ecd9', color2: '#c7def7' },
  { name: '薰衣草', color1: '#dccdf5', color2: '#f7cfe3' },
  { name: '柠檬汽水', color1: '#fbf0b9', color2: '#c4ead9' },
  { name: '晚霞', color1: '#f9c9b5', color2: '#d7c6f2' },
  { name: '云朵', color1: '#ffffff', color2: '#cfe1f3' },
  { name: '樱花', color1: '#fbd3df', color2: '#fff1f5' },
];

export const isAvatarFrame = (value: unknown): value is AvatarFrameStyle =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as AvatarFrameStyle).enabled === 'boolean' &&
  typeof (value as AvatarFrameStyle).color1 === 'string' &&
  typeof (value as AvatarFrameStyle).color2 === 'string';

export const normalizeAvatarFrame = (frame: AvatarFrameStyle | undefined): AvatarFrameStyle => ({
  ...DEFAULT_AVATAR_FRAME,
  ...(frame ?? {}),
});

export const frameGradient = (frame: AvatarFrameStyle) =>
  `linear-gradient(${frame.angle}deg, ${frame.color1}, ${frame.color2})`;

/** 套在头像外层的样式：渐变背景 + 内边距形成边框。未启用时返回 undefined。 */
export const avatarFrameWrapStyle = (frame: AvatarFrameStyle | undefined): React.CSSProperties | undefined =>
  frame?.enabled ? { background: frameGradient(frame), padding: `${frame.width}px` } : undefined;
