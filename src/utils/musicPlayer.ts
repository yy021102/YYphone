import { useSyncExternalStore } from 'react';
import { deleteAudioBlob, getAudioBlob, saveAudioBlob } from './audioStorage';
import { readStoredValue, writeStoredValue } from './localStorage';
import { musicSongUrl, NETEASE_SESSION_EVENT, readMusicSession, type NeteaseSong } from './neteaseMusic';
import {
  isMusicSettings,
  isMusicTrackList,
  MUSIC_PLAYBACK_KEY,
  MUSIC_SETTINGS_KEY,
  MUSIC_TRACKS_KEY,
  MusicPlaybackSnapshot,
  MusicTrack,
  MusicTrackDetails,
  readMusicPlaybackSnapshot,
} from './musicPlayback';

export interface MusicPlayerState {
  tracks: MusicTrack[];
  currentTrackId: string;
  companionId: string;
  togetherEnabled: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string;
  playbackMode: 'list' | 'single' | 'shuffle';
}

const SNAPSHOT_INTERVAL_MS = 5000;

let state: MusicPlayerState = {
  tracks: [],
  currentTrackId: '',
  companionId: '',
  togetherEnabled: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  error: '',
  playbackMode: 'list',
};
let loaded = false;
let audio: HTMLAudioElement | null = null;
let loadedTrackId = '';
let objectUrl = '';
let loadToken = 0;
let playAttempt = 0;
let remoteController: AbortController | null = null;
let remoteLoadedAt = 0;
let lastSnapshotAt = 0;
const listeners = new Set<() => void>();

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const setState = (patch: Partial<MusicPlayerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const currentTrack = () => state.tracks.find((track) => track.id === state.currentTrackId);

const saveSnapshot = () => {
  const track = currentTrack();
  lastSnapshotAt = Date.now();
  const snapshot: MusicPlaybackSnapshot = {
    trackId: track?.id ?? '',
    title: track?.title ?? '',
    positionSec: audio?.currentTime ?? 0,
    durationSec: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
    isPlaying: !!track && !!audio && !audio.paused && !audio.ended,
    companionId: state.companionId,
    togetherEnabled: state.togetherEnabled,
    updatedAt: lastSnapshotAt,
  };
  writeStoredValue(MUSIC_PLAYBACK_KEY, snapshot);
};

const saveTracks = (tracks: MusicTrack[]) => {
  writeStoredValue(MUSIC_TRACKS_KEY, tracks);
  setState({ tracks });
};

const saveSettings = () => {
  writeStoredValue(MUSIC_SETTINGS_KEY, {
    currentTrackId: state.currentTrackId,
    companionId: state.companionId,
    togetherEnabled: state.togetherEnabled,
    playbackMode: state.playbackMode,
  });
};

const ensureLoaded = () => {
  if (loaded) return;
  loaded = true;
  window.addEventListener?.(NETEASE_SESSION_EVENT, () => {
    if (!readMusicSession() && currentTrack()?.source === 'netease') {
      stopAndUnload();
      saveSnapshot();
    }
  });
  const tracks = readStoredValue(MUSIC_TRACKS_KEY, [] as MusicTrack[], isMusicTrackList);
  const settings = readStoredValue(
    MUSIC_SETTINGS_KEY,
    { currentTrackId: '', companionId: '', togetherEnabled: false },
    isMusicSettings
  );
  state = {
    ...state,
    tracks,
    currentTrackId: tracks.some((track) => track.id === settings.currentTrackId)
      ? settings.currentTrackId
      : '',
    companionId: settings.companionId,
    togetherEnabled: settings.togetherEnabled,
    playbackMode: settings.playbackMode === 'single' || settings.playbackMode === 'shuffle' ? settings.playbackMode : 'list',
  };
  // 页面重新载入后音频不会继续播放，清除上次遗留的“正在播放”状态。
  const previous = readMusicPlaybackSnapshot();
  if (previous?.isPlaying) writeStoredValue(MUSIC_PLAYBACK_KEY, { ...previous, isPlaying: false });
};

const getAudio = () => {
  if (audio) return audio;
  const element = new Audio();
  element.preload = 'metadata';
  element.addEventListener('play', () => {
    setState({ isPlaying: true, error: '' });
    saveSnapshot();
  });
  element.addEventListener('pause', () => {
    setState({ isPlaying: false, currentTime: element.currentTime });
    saveSnapshot();
  });
  element.addEventListener('ended', () => {
    // 列表循环：播完自动下一首；只有一首时重新播放这一首。
    const tracks = state.tracks;
    if (tracks.length === 0) return;
    if (tracks.length === 1 || state.playbackMode === 'single') {
      element.currentTime = 0;
      void element.play().catch(() => undefined);
      return;
    }
    musicPlayer.next();
  });
  element.addEventListener('seeked', () => {
    setState({ currentTime: element.currentTime });
    saveSnapshot();
  });
  element.addEventListener('timeupdate', () => {
    setState({ currentTime: element.currentTime });
    if (!element.paused && Date.now() - lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) saveSnapshot();
  });
  const syncDuration = () =>
    setState({ duration: Number.isFinite(element.duration) ? element.duration : 0 });
  element.addEventListener('loadedmetadata', syncDuration);
  element.addEventListener('durationchange', syncDuration);
  element.addEventListener('error', () => {
    if (!element.src) return;
    loadedTrackId = '';
    setState({ isPlaying: false, error: currentTrack()?.source === 'netease' ? '这首歌播放失败，可重试或换一首。' : '无法播放该音频，请检查链接或文件。' });
    saveSnapshot();
  });
  audio = element;
  return element;
};

const releaseObjectUrl = () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
};

const prepareTrack = async (track: MusicTrack) => {
  const element = getAudio();
  const token = ++loadToken;
  remoteController?.abort();
  remoteController = null;
  if (loadedTrackId === track.id && (track.source !== 'netease' || Date.now() - remoteLoadedAt < 10 * 60_000)) return element;
  element.pause();
  let source = track.url ?? '';
  let nextObjectUrl = '';
  if (track.source === 'file') {
    const blob = await getAudioBlob(track.id);
    if (!blob) throw new Error('本地音频文件已丢失，请重新上传。');
    nextObjectUrl = URL.createObjectURL(blob);
    source = nextObjectUrl;
  } else if (track.source === 'netease') {
    remoteController = new AbortController();
    source = await musicSongUrl(track.neteaseId!, remoteController.signal);
  }
  if (token !== loadToken) {
    if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    throw new Error('已切换到其他音乐。');
  }
  releaseObjectUrl();
  objectUrl = nextObjectUrl;
  element.src = source;
  loadedTrackId = track.id;
  remoteLoadedAt = Date.now();
  setState({ currentTime: 0, duration: 0, error: '' });
  return element;
};

const stopAndUnload = () => {
  playAttempt += 1;
  loadToken += 1;
  remoteController?.abort();
  remoteController = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  releaseObjectUrl();
  loadedTrackId = '';
  setState({ isPlaying: false, currentTime: 0, duration: 0 });
};

const playTrack = async (track: MusicTrack) => {
  const attempt = ++playAttempt;
  if (audio && state.currentTrackId !== track.id) audio.pause();
  setState({ currentTrackId: track.id, error: '' });
  saveSettings();
  try {
    const element = await prepareTrack(track);
    if (attempt !== playAttempt) return;
    await element.play();
  } catch (error) {
    if (attempt !== playAttempt) return;
    if (error instanceof Error && error.message === '已切换到其他音乐。') return;
    console.error('Could not play audio.', error);
    setState({
      isPlaying: false,
      error: error instanceof Error ? error.message : '无法播放该音频。',
    });
    saveSnapshot();
  }
};

const deriveTitle = (raw: string) =>
  raw.replace(/\.[a-z0-9]{2,5}$/i, '').trim() || '未命名音乐';

export const musicPlayer = {
  addNeteaseTracks(songs: NeteaseSong[]) {
    ensureLoaded();
    const tracks = [...state.tracks];
    const result: MusicTrack[] = [];
    for (const song of songs) {
      const existing = tracks.find(t => t.source === 'netease' && t.neteaseId === song.id);
      if (existing) { result.push(existing); continue; }
      const track: MusicTrack = { id: `netease-${song.id}`, title: song.name, source: 'netease', neteaseId: song.id, artists: song.artists, cover: song.cover, createdAt: Date.now() };
      tracks.push(track); result.push(track);
    }
    saveTracks(tracks);
    if (!state.currentTrackId && result[0]) { setState({ currentTrackId: result[0].id }); saveSettings(); }
    return result;
  },
  selectTrack(id: string) {
    ensureLoaded();
    const track = state.tracks.find((item) => item.id === id);
    if (track) void playTrack(track);
  },
  async togglePlay() {
    ensureLoaded();
    const track = currentTrack() ?? state.tracks[0];
    if (!track) return;
    if (loadedTrackId === track.id && audio && !audio.paused) {
      audio.pause();
      return;
    }
    await playTrack(track);
  },
  next() {
    ensureLoaded();
    if (state.tracks.length === 0) return;
    const index = state.tracks.findIndex((track) => track.id === state.currentTrackId);
    const nextIndex = state.playbackMode === 'shuffle' && state.tracks.length > 1
      ? (Math.max(index, 0) + 1 + Math.floor(Math.random() * (state.tracks.length - 1))) % state.tracks.length
      : (index + 1) % state.tracks.length;
    void playTrack(state.tracks[nextIndex]);
  },
  previous() {
    ensureLoaded();
    if (!state.tracks.length) return;
    const index = state.tracks.findIndex(track => track.id === state.currentTrackId);
    void playTrack(state.tracks[(Math.max(index, 0) - 1 + state.tracks.length) % state.tracks.length]);
  },
  setPlaybackMode(playbackMode: MusicPlayerState['playbackMode']) {
    ensureLoaded();
    if (!['list', 'single', 'shuffle'].includes(playbackMode)) return;
    setState({ playbackMode });
    saveSettings();
  },
  seek(ratio: number) {
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.min(Math.max(ratio, 0), 1) * audio.duration;
  },
  addUrlTrack(rawUrl: string, rawTitle: string, details: Partial<MusicTrackDetails> = {}) {
    ensureLoaded();
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new Error('请输入有效的音频链接。');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('音频链接需以 http:// 或 https:// 开头。');
    }
    const fallbackTitle = deriveTitle(decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? ''));
    const track: MusicTrack = {
      id: newId(),
      title: rawTitle.trim().slice(0, 120) || fallbackTitle,
      artists: (details.artists || '').trim().slice(0, 120),
      mood: (details.mood || '').trim().slice(0, 600),
      source: 'url',
      url: parsed.toString(),
      createdAt: Date.now(),
    };
    saveTracks([...state.tracks, track]);
    if (!state.currentTrackId) {
      setState({ currentTrackId: track.id });
      saveSettings();
    }
    return track;
  },
  async addFileTrack(file: File, details: Partial<MusicTrackDetails> = {}) {
    ensureLoaded();
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name)) {
      throw new Error('请选择音频文件（如 MP3）。');
    }
    const track: MusicTrack = {
      id: newId(),
      title: details.title?.trim().slice(0, 120) || deriveTitle(file.name),
      artists: (details.artists || '').trim().slice(0, 120),
      mood: (details.mood || '').trim().slice(0, 600),
      source: 'file',
      fileName: file.name,
      createdAt: Date.now(),
    };
    await saveAudioBlob(track.id, file);
    saveTracks([...state.tracks, track]);
    if (!state.currentTrackId) {
      setState({ currentTrackId: track.id });
      saveSettings();
    }
    return track;
  },
  renameTrack(id: string, title: string) {
    ensureLoaded();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    saveTracks(state.tracks.map((track) => (track.id === id ? { ...track, title: nextTitle } : track)));
    if (id === state.currentTrackId) saveSnapshot();
  },
  updateTrackDetails(id: string, details: MusicTrackDetails) {
    ensureLoaded();
    const title = details.title.trim().slice(0, 120);
    if (!title) return;
    saveTracks(state.tracks.map(track => track.id === id ? { ...track, title, artists: details.artists.trim().slice(0, 120), mood: details.mood.trim().slice(0, 600) } : track));
    if (id === state.currentTrackId) saveSnapshot();
  },
  removeTrack(id: string) {
    ensureLoaded();
    const removed = state.tracks.find((track) => track.id === id);
    if (!removed) return;
    const wasCurrent = id === state.currentTrackId;
    if (wasCurrent) stopAndUnload();
    saveTracks(state.tracks.filter((track) => track.id !== id));
    if (wasCurrent) {
      setState({ currentTrackId: state.tracks[0]?.id ?? '' });
      saveSettings();
      saveSnapshot();
    }
    if (removed.source === 'file') {
      void deleteAudioBlob(id).catch((error: unknown) => {
        console.warn('Could not delete stored audio file.', error);
      });
    }
  },
  setCompanion(companionId: string) {
    ensureLoaded();
    setState({ companionId });
    saveSettings();
    saveSnapshot();
  },
  setTogetherEnabled(togetherEnabled: boolean) {
    ensureLoaded();
    setState({ togetherEnabled });
    saveSettings();
    saveSnapshot();
  },
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => {
  ensureLoaded();
  return state;
};

export const useMusicPlayer = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
