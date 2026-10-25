import type { LockScreenAppearance } from '../types';

export const DEFAULT_LOCK_APPEARANCE: LockScreenAppearance = {
  textColor: '#2C4A5C',
  subtitle: '天天开心',
};

export const isLockScreenAppearance = (value: unknown): value is LockScreenAppearance => {
  if (!value || typeof value !== 'object') return false;
  const appearance = value as Partial<LockScreenAppearance>;
  return typeof appearance.textColor === 'string' && /^#[\da-f]{6}$/i.test(appearance.textColor) &&
    typeof appearance.subtitle === 'string' && appearance.subtitle.length <= 200;
};
