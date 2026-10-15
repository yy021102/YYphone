import React, { useEffect, useRef, useState } from 'react';
import { Link2, Music2, Pause, Pencil, Play, SkipForward, Trash2, Upload, X } from 'lucide-react';
import { musicPlayer, useMusicPlayer } from '../utils/musicPlayer';
import { formatMusicTime } from '../utils/musicPlayback';
import { readStoredValue } from '../utils/localStorage';
import { useWidgetAppearance } from '../utils/widgetAppearance';
import { WidgetImagePicker } from './WidgetImagePicker';

interface CompanionOption {
  id: string;
  name: string;
}

const CONTACTS_STORAGE_KEY = 'pocketos:wechat-contacts';

const readCompanionOptions = (): CompanionOption[] =>
  readStoredValue(CONTACTS_STORAGE_KEY, [] as CompanionOption[], (value): value is CompanionOption[] =>
    Array.isArray(value)
  ).flatMap((contact) =>
    contact && typeof contact.id === 'string' && typeof contact.name === 'string'
      ? [{ id: contact.id, name: contact.name }]
      : []
  );

export const ListenTogetherWidget: React.FC = () => {
  const player = useMusicPlayer();
  const { appearance, patch } = useWidgetAppearance('yyphone:music-appearance');
  const [panelOpen, setPanelOpen] = useState(false);
  const [companions, setCompanions] = useState<CompanionOption[]>([]);
  const [urlDraft, setUrlDraft] = useState('');
  const [panelError, setPanelError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const track = player.tracks.find((item) => item.id === player.currentTrackId);
  const companion = companions.find((item) => item.id === player.companionId);
  const progress = player.duration > 0 ? Math.min(player.currentTime / player.duration, 1) : 0;
  const hasTracks = player.tracks.length > 0;

  useEffect(() => {
    setCompanions(readCompanionOptions());
  }, [panelOpen]);

  const openPanel = () => {
    setPanelError('');
    setPanelOpen(true);
  };

  const handleAddUrl = () => {
    try {
      const added = musicPlayer.addUrlTrack(urlDraft, '');
      setUrlDraft('');
      setPanelError('');
      musicPlayer.selectTrack(added.id);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '无法添加该链接。');
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const added = await musicPlayer.addFileTrack(file);
      setPanelError('');
      musicPlayer.selectTrack(added.id);
    } catch (error) {
      console.error('Could not add audio file.', error);
      setPanelError(error instanceof Error ? error.message : '无法保存该音频文件。');
    } finally {
      setUploading(false);
    }
  };

  const commitRename = () => {
    if (editingId) musicPlayer.renameTrack(editingId, editingTitle);
    setEditingId('');
  };

  const subtitle = !hasTracks
    ? ''
    : player.togetherEnabled && companion
      ? `与 ${companion.name} 一起听`
      : '未开启一起听';

  return (
    <>
      <div
        style={appearance.background ? { backgroundImage: `url("${appearance.background}")` } : undefined}
        className={`rounded-[clamp(20px,4.8vw,28px)] p-[clamp(9px,2.4vw,13px)] aspect-square flex flex-col justify-between overflow-hidden relative shadow-sm bg-cover bg-center ${
          appearance.background ? 'border border-white/70' : 'glass-card'
        }`}
      >
        <div className="flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-[clamp(20px,5vw,24px)] h-[clamp(20px,5vw,24px)] rounded-lg bg-sky-100/90 text-sky-700 flex items-center justify-center">
              <Music2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[clamp(11px,2.8vw,13px)] font-bold text-[#587589]">一起听</span>
          </div>
          <span className="flex items-center gap-0.5">
            <span className={`w-1 h-2 rounded-full bg-sky-400 ${player.isPlaying ? 'animate-pulse' : 'opacity-50'}`} />
            <span className={`w-1 h-3 rounded-full bg-pink-400 delay-100 ${player.isPlaying ? 'animate-pulse' : 'opacity-50'}`} />
            <span className={`w-1 h-1.5 rounded-full bg-sky-400 delay-200 ${player.isPlaying ? 'animate-pulse' : 'opacity-50'}`} />
          </span>
        </div>

        <div className="flex items-center gap-2.5 my-auto z-10 min-h-0">
          <button
            type="button"
            onClick={openPanel}
            aria-label="添加或管理音乐"
            className="relative shrink-0 cursor-pointer active:scale-95 transition-transform"
          >
            <div
              className={`w-[clamp(36px,9.5vw,48px)] h-[clamp(36px,9.5vw,48px)] rounded-full p-0.5 shadow-sm bg-gradient-to-tr from-sky-300 via-pink-200 to-indigo-300 border border-white/80 flex items-center justify-center ${
                player.isPlaying ? 'animate-spin [animation-duration:8s]' : ''
              }`}
            >
              {appearance.disc ? (
                <div
                  className="h-full w-full rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${appearance.disc}")` }}
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-slate-800/80 border border-white flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                </div>
              )}
            </div>
          </button>

          {hasTracks ? (
            <button type="button" onClick={openPanel} className="flex-1 min-w-0 text-left cursor-pointer">
              <h4 className="text-[clamp(11px,2.8vw,12.5px)] font-bold text-[#587589] truncate">
                {track?.title ?? '点击选择音乐'}
              </h4>
              <p className="text-[clamp(9px,2.2vw,10.5px)] text-slate-500 truncate mt-0.5">
                {player.error || subtitle}
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={openPanel}
              className="flex-1 min-w-0 text-left text-[clamp(10px,2.4vw,11.5px)] font-semibold leading-snug text-slate-500 cursor-pointer"
            >
              还没有添加音乐，点击上传
            </button>
          )}
        </div>

        <div className="space-y-1 z-10 shrink-0">
          <div
            role="slider"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              musicPlayer.seek((event.clientX - rect.left) / rect.width);
            }}
            className="w-full py-1 cursor-pointer"
          >
            <div className="w-full bg-white/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-200 to-pink-200 h-full"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[8.5px] text-slate-400 font-mono">{formatMusicTime(player.currentTime)}</span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (hasTracks) void musicPlayer.togglePlay();
                  else openPanel();
                }}
                aria-label={player.isPlaying ? '暂停' : '播放'}
                className="w-[clamp(22px,6vw,28px)] h-[clamp(22px,6vw,28px)] rounded-full bg-white/80 hover:bg-white text-[#587589] flex items-center justify-center shadow-2xs active:scale-90 transition-all cursor-pointer"
              >
                {player.isPlaying ? (
                  <Pause className="w-3 h-3 fill-[#587589]" />
                ) : (
                  <Play className="w-3 h-3 fill-[#587589] ml-0.5" />
                )}
              </button>
              <button
                onClick={() => musicPlayer.next()}
                disabled={player.tracks.length < 2}
                aria-label="下一首"
                className="w-[clamp(20px,5vw,24px)] h-[clamp(20px,5vw,24px)] rounded-full hover:bg-white/50 text-slate-500 flex items-center justify-center active:scale-90 transition-all cursor-pointer disabled:opacity-40"
              >
                <SkipForward className="w-3 h-3" />
              </button>
            </div>

            <span className="text-[8.5px] text-slate-400 font-mono">
              {player.duration > 0 ? formatMusicTime(player.duration) : '--:--'}
            </span>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {panelOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPanelOpen(false);
          }}
        >
          <div className="w-full max-w-sm max-h-[88%] overflow-y-auto rounded-3xl bg-white/90 backdrop-blur-2xl border border-white p-4 shadow-2xl space-y-3.5 text-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#2C4A5C]">一起听</h2>
              <button
                aria-label="关闭"
                onClick={() => setPanelOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <section className="space-y-2 rounded-2xl bg-sky-50/60 border border-white/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#2C4A5C]">和 TA 一起听</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={player.togetherEnabled}
                  aria-label="一起听开关"
                  onClick={() => musicPlayer.setTogetherEnabled(!player.togetherEnabled)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
                    player.togetherEnabled ? 'bg-emerald-400' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      player.togetherEnabled ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              <select
                value={player.companionId}
                onChange={(event) => musicPlayer.setCompanion(event.target.value)}
                aria-label="选择一起听的角色"
                className="w-full rounded-xl bg-white border border-slate-200 px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="">{companions.length === 0 ? '微信中还没有角色' : '请选择角色'}</option>
                {companions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <p className="text-[10px] leading-snug text-slate-500">
                {player.togetherEnabled && !player.companionId
                  ? '请先选择一位角色。'
                  : '开启后，只有所选角色在聊天中会知道你正在听的歌和播放进度；暂停或换人后，不再告知。'}
              </p>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-bold text-[#2C4A5C]">添加音乐</p>
              <div className="flex gap-2">
                <input
                  value={urlDraft}
                  onChange={(event) => setUrlDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') handleAddUrl(); }}
                  placeholder="粘贴音频链接 https://..."
                  aria-label="音频链接"
                  className="min-w-0 flex-1 rounded-xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  disabled={!urlDraft.trim()}
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-sky-400 to-pink-400 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
                >
                  <Link2 className="w-3 h-3" />添加
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-dashed border-sky-300 px-3 py-2.5 text-xs font-bold text-sky-600 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />{uploading ? '正在保存…' : '选择本地音频文件（MP3）'}
              </button>
              {panelError && <p role="alert" className="text-[11px] font-bold text-rose-500">{panelError}</p>}
            </section>

            <section className="space-y-1.5">
              <p className="text-xs font-bold text-[#2C4A5C]">音乐列表</p>
              {!hasTracks && (
                <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">
                  还没有添加音乐，点击上传
                </p>
              )}
              {player.tracks.map((item) => {
                const isCurrent = item.id === player.currentTrackId;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${
                      isCurrent ? 'bg-sky-50 border-sky-200' : 'bg-white/70 border-slate-100'
                    }`}
                  >
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitRename();
                          if (event.key === 'Escape') setEditingId('');
                        }}
                        maxLength={80}
                        aria-label="音乐标题"
                        className="min-w-0 flex-1 rounded-lg bg-white border border-sky-300 px-2 py-1 text-xs font-bold outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrent && player.isPlaying) void musicPlayer.togglePlay();
                          else musicPlayer.selectTrack(item.id);
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#2C4A5C]">
                          {isCurrent && player.isPlaying
                            ? <Pause className="w-3 h-3 shrink-0 text-sky-500" />
                            : <Play className="w-3 h-3 shrink-0 text-slate-400" />}
                          <span className="truncate">{item.title}</span>
                        </span>
                        <span className="block truncate pl-[18px] text-[10px] text-slate-400">
                          {item.source === 'file' ? item.fileName || '本地文件' : item.url}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`修改标题 ${item.title}`}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingTitle(item.title);
                      }}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除 ${item.title}`}
                      onClick={() => {
                        if (window.confirm(`删除「${item.title}」？`)) musicPlayer.removeTrack(item.id);
                      }}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </section>

            <WidgetImagePicker
              label="唱片图案"
              value={appearance.disc}
              square
              round
              maxSize={240}
              onChange={(value) => patch({ disc: value })}
            />
            <WidgetImagePicker
              label="播放器背景"
              value={appearance.background}
              maxSize={900}
              onChange={(value) => patch({ background: value })}
            />
          </div>
        </div>
      )}
    </>
  );
};
