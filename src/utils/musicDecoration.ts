import type { MusicDecoration } from '../types';

export function normalizeMusicDecoration(value: unknown): MusicDecoration {
  const record = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const source = record(value);
  const bubble = (input: unknown) => {
    const data = record(input);
    return {
      text: typeof data.text === 'string' ? data.text.slice(0, 40) : '',
      color: typeof data.color === 'string' && /^#[a-f\d]{6}$/i.test(data.color) ? data.color : '#626268',
      opacity: typeof data.opacity === 'number' && Number.isFinite(data.opacity) ? Math.min(100, Math.max(0, data.opacity)) : 70,
    };
  };
  return { discMode: source.discMode === 'image' ? 'image' : 'vinyl', darkenBackground: source.darkenBackground !== false, userBubble: bubble(source.userBubble), companionBubble: bubble(source.companionBubble) };
}

export function musicBubbleBackground(color: string, opacity: number): string {
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  return `rgb(${channels.join(' ')} / ${opacity / 100})`;
}
