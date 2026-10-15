import { useSyncExternalStore } from 'react';
import { deleteAudioBlob, getAudioBlob, saveAudioBlob } from './audioStorage';
import { readStoredValue, writeStoredValue } from './localStorage';
import {
  isMusicSettings,
  isMusicTrackList,
  MUSIC_PLAYBACK_KEY,
  MUSIC_SETTINGS_KEY,
  MUSIC_TRACKS_KEY,
  MusicPlaybackSnapshot,
  MusicTrack,
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
};
let loaded = false;
let audio: HTMLAudioElement | null = null;
let loadedTrackId = '';
let objectUrl = '';
let loadToken = 0;
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
  });
};

const ensureLoaded = () => {
  if (loaded) return;
  loaded = true;
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
    setState({ isPlaying: false, error: '无法播放该音频，请检查链接或文件。' });
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
  if (loadedTrackId === track.id) return element;
  const token = ++loadToken;
  element.pause();
  let source = track.url ?? '';
  let nextObjectUrl = '';
  if (track.source === 'file') {
    const blob = await getAudioBlob(track.id);
    if (!blob) throw new Error('本地音频文件已丢失，请重新上传。');
    nextObjectUrl = URL.createObjectURL(blob);
    source = nextObjectUrl;
  }
  if (token !== loadToken) {
    if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    throw new Error('已切换到其他音乐。');
  }
  releaseObjectUrl();
  objectUrl = nextObjectUrl;
  element.src = source;
  loadedTrackId = track.id;
  setState({ currentTime: 0, duration: 0, error: '' });
  return element;
};

const stopAndUnload = () => {
  loadToken += 1;
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
  try {
    const element = await prepareTrack(track);
    setState({ currentTrackId: track.id, error: '' });
    saveSettings();
    await element.play();
  } catch (error) {
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
    void playTrack(state.tracks[(index + 1) % state.tracks.length]);
  },
  seek(ratio: number) {
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.min(Math.max(ratio, 0), 1) * audio.duration;
  },
  addUrlTrack(rawUrl: string, rawTitle: string) {
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
      title: rawTitle.trim() || fallbackTitle,
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
  async addFileTrack(file: File) {
    ensureLoaded();
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name)) {
      throw new Error('请选择音频文件（如 MP3）。');
    }
    const track: MusicTrack = {
      id: newId(),
      title: deriveTitle(file.name),
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
