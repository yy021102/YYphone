import { HomeAppearance, UserProfile, WidgetAppearance } from '../types';
import { readWidgetAppearance } from './widgetAppearance';

export const CALENDAR_APPEARANCE_KEY = 'yyphone:calendar-appearance';
export const MUSIC_APPEARANCE_KEY = 'yyphone:music-appearance';

export const captureHomeAppearance = (profile: UserProfile): HomeAppearance => ({
  calendar: readWidgetAppearance(CALENDAR_APPEARANCE_KEY),
  music: readWidgetAppearance(MUSIC_APPEARANCE_KEY),
  profile: {
    avatarUrl: profile.avatarUrl ?? '',
    coverImageUrl: profile.coverImageUrl ?? '',
    avatarFrameEnabled: profile.avatarFrameEnabled ?? false,
    avatarFrame: profile.avatarFrame,
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isWidgetAppearance = (value: unknown): value is WidgetAppearance =>
  isRecord(value) &&
  typeof value.background === 'string' &&
  typeof value.disc === 'string' &&
  typeof value.note === 'string';

export const isHomeAppearance = (value: unknown): value is HomeAppearance => {
  if (!isRecord(value) || !isWidgetAppearance(value.calendar) || !isWidgetAppearance(value.music)) return false;
  const profile = value.profile;
  if (!isRecord(profile) || (profile.avatarUrl !== undefined && typeof profile.avatarUrl !== 'string') ||
    typeof profile.coverImageUrl !== 'string' || typeof profile.avatarFrameEnabled !== 'boolean') return false;
  const frame = profile.avatarFrame;
  return frame === undefined || (
    isRecord(frame) && typeof frame.enabled === 'boolean' &&
    typeof frame.color1 === 'string' && typeof frame.color2 === 'string' &&
    typeof frame.angle === 'number' && Number.isFinite(frame.angle) &&
    typeof frame.width === 'number' && Number.isFinite(frame.width) && frame.width >= 0
  );
};

/** Shared themes never include the player's personal avatar. */
export const portableHomeBeauty = <T extends import('../types').BeautySettings>(settings: T): T => {
  if (!settings.homeAppearance) return { ...settings };
  const { avatarUrl: _avatar, ...profile } = settings.homeAppearance.profile;
  return { ...settings, homeAppearance: { ...settings.homeAppearance, profile } };
};
export const isDesktopAppearance = (value: unknown): value is import('../types').DesktopAppearance =>
  isRecord(value) && (value.textColor === undefined || typeof value.textColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.textColor)) &&
  ['iconOpacity', 'panelOpacity'].every(key => value[key] === undefined || typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1);
