import { readStoredValue } from './localStorage';

export const MUSIC_TRACKS_KEY = 'yyphone:music-tracks';
export const MUSIC_SETTINGS_KEY = 'yyphone:music-settings';
export const MUSIC_PLAYBACK_KEY = 'yyphone:music-playback';

export interface MusicTrack {
  id: string;
  title: string;
  source: 'url' | 'file';
  url?: string;
  fileName?: string;
  createdAt: number;
}

export interface MusicSettings {
  currentTrackId: string;
  companionId: string;
  togetherEnabled: boolean;
}

// 播放器在播放/暂停/拖动进度时写入，供聊天提示词读取。
export interface MusicPlaybackSnapshot {
  trackId: string;
  title: string;
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
  companionId: string;
  togetherEnabled: boolean;
  updatedAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isMusicTrackList = (value: unknown): value is MusicTrack[] =>
  Array.isArray(value) &&
  value.every(
    (track) =>
      isRecord(track) &&
      typeof track.id === 'string' &&
      typeof track.title === 'string' &&
      (track.source === 'url' || track.source === 'file') &&
      (track.url === undefined || typeof track.url === 'string') &&
      (track.fileName === undefined || typeof track.fileName === 'string') &&
      typeof track.createdAt === 'number'
  );

export const isMusicSettings = (value: unknown): value is MusicSettings =>
  isRecord(value) &&
  typeof value.currentTrackId === 'string' &&
  typeof value.companionId === 'string' &&
  typeof value.togetherEnabled === 'boolean';

export const isMusicPlaybackSnapshot = (value: unknown): value is MusicPlaybackSnapshot =>
  isRecord(value) &&
  typeof value.trackId === 'string' &&
  typeof value.title === 'string' &&
  typeof value.positionSec === 'number' &&
  typeof value.durationSec === 'number' &&
  typeof value.isPlaying === 'boolean' &&
  typeof value.companionId === 'string' &&
  typeof value.togetherEnabled === 'boolean' &&
  typeof value.updatedAt === 'number';

export const readMusicPlaybackSnapshot = () =>
  readStoredValue<MusicPlaybackSnapshot | null>(
    MUSIC_PLAYBACK_KEY,
    null,
    (value): value is MusicPlaybackSnapshot | null => value === null || isMusicPlaybackSnapshot(value)
  );

export const formatMusicTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const formatSpokenTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes} 分 ${rest} 秒` : `${rest} 秒`;
};

/**
 * 仅当玩家正在播放、已开启“一起听歌”且所选角色在当前聊天中时才返回环境描述；
 * 其他角色、暂停或关闭一起听歌时返回 null。
 */
export const buildListenTogetherContext = (
  participantIds: string[],
  getCompanionName: (id: string) => string | undefined
): string | null => {
  const snapshot = readMusicPlaybackSnapshot();
  if (!snapshot || !snapshot.isPlaying || !snapshot.togetherEnabled) return null;
  if (!snapshot.companionId || !snapshot.title || !participantIds.includes(snapshot.companionId)) return null;
  const companionName = getCompanionName(snapshot.companionId);
  if (!companionName) return null;

  const elapsed = Math.max(0, (Date.now() - snapshot.updatedAt) / 1000);
  const estimated = snapshot.positionSec + elapsed;
  const position = snapshot.durationSec > 0 ? Math.min(estimated, snapshot.durationSec) : estimated;

  return [
    '当前环境：',
    `玩家正在和${companionName}一起听歌，正在播放《${snapshot.title}》，播放到 ${formatSpokenTime(position)}。`,
    `只有${companionName}知道这件事，请${companionName}在合适的时候自然地对此作出回应（例如聊聊这首歌或此刻的氛围），不要生硬复述这条信息。聊天中的其他角色并不知道玩家在听歌，不要让他们提及。`,
  ].join('\n');
};
