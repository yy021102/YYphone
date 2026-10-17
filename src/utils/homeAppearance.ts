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
  if (!isRecord(profile) || typeof profile.avatarUrl !== 'string' ||
    typeof profile.coverImageUrl !== 'string' || typeof profile.avatarFrameEnabled !== 'boolean') return false;
  const frame = profile.avatarFrame;
  return frame === undefined || (
    isRecord(frame) && typeof frame.enabled === 'boolean' &&
    typeof frame.color1 === 'string' && typeof frame.color2 === 'string' &&
    typeof frame.angle === 'number' && Number.isFinite(frame.angle) &&
    typeof frame.width === 'number' && Number.isFinite(frame.width) && frame.width >= 0
  );
};
