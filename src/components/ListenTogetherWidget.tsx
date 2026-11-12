import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Music2, Pause, Pencil, Play, SkipForward, Trash2, Upload, X } from 'lucide-react';
import { musicPlayer, useMusicPlayer } from '../utils/musicPlayer';
import { formatMusicTime, type MusicTrackDetails } from '../utils/musicPlayback';
import { readStoredValue } from '../utils/localStorage';
import { useWidgetAppearance } from '../utils/widgetAppearance';
import { MUSIC_APPEARANCE_KEY } from '../utils/homeAppearance';
import { WidgetImagePicker } from './WidgetImagePicker';
import { NeteaseMusicPanel } from './NeteaseMusicPanel';
import { VinylRecord } from './DesktopTemplateArt';
import { DEFAULT_LISTENING_CAPTION, MusicListeningStage } from './MusicListeningStage';
import { readWeChatUserProfile } from '../utils/coupleSpaceData';

interface CompanionOption {
  id: string;
  name: string;
  avatarUrl?: string;
}

const CONTACTS_STORAGE_KEY = 'pocketos:wechat-contacts';
const emptyTrackDetails: MusicTrackDetails = { title: '', artists: '', mood: '' };

function TrackDetailsFields({ value, onChange, disabled = false, editing = false }: { value: MusicTrackDetails; onChange: (value: MusicTrackDetails) => void; disabled?: boolean; editing?: boolean }) {
  const fieldClass = 'mt-1 w-full min-w-0 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-sky-400';
  return <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
    <label>歌名<input value={value.title} disabled={disabled} maxLength={120} autoFocus={editing} placeholder="留空自动填写" aria-label={editing ? '编辑歌名' : '添加歌名'} onChange={event => onChange({ ...value, title: event.target.value })} className={fieldClass}/></label>
    <label>歌手<input value={value.artists} disabled={disabled} maxLength={120} placeholder="歌手名字" aria-label={editing ? '编辑歌手' : '添加歌手'} onChange={event => onChange({ ...value, artists: event.target.value })} className={fieldClass}/></label>
    <label className="col-span-2">歌曲氛围<textarea value={value.mood} disabled={disabled} maxLength={600} rows={2} placeholder="例如：轻柔的钢琴，像雨天里安静的陪伴" aria-label={editing ? '编辑歌曲氛围' : '添加歌曲氛围'} onChange={event => onChange({ ...value, mood: event.target.value })} className={`${fieldClass} resize-none`}/></label>
  </div>;
}

const readCompanionOptions = (): CompanionOption[] =>
  readStoredValue(CONTACTS_STORAGE_KEY, [] as CompanionOption[], (value): value is CompanionOption[] =>
    Array.isArray(value)
  ).flatMap((contact) =>
    contact && typeof contact.id === 'string' && typeof contact.name === 'string'
      ? [{ id: contact.id, name: contact.name, avatarUrl: typeof contact.avatarUrl === 'string' ? contact.avatarUrl : '' }]
      : []
  );

function MusicPanelLayer({ container, children }: { container?: HTMLElement; children: React.ReactNode }) {
  return container ? createPortal(children, container) : children;
}

export const ListenTogetherWidget: React.FC<{
  fullScreen?: boolean; onOpen?: () => void; onClose?: () => void;
  modalContainer?: HTMLElement; backgroundImage?: string; variant?: 'vinyl' | 'disc'; artwork?: string; title?: string; note?: string; vinylColor?: string; vinylOpacity?: number;
}> = ({ fullScreen = false, onOpen, onClose, modalContainer, backgroundImage, variant, artwork, title, note, vinylColor, vinylOpacity }) => {
  const player = useMusicPlayer();
  const { appearance, patch } = useWidgetAppearance(MUSIC_APPEARANCE_KEY);
  const background = backgroundImage || appearance.background;
  const [panelOpen, setPanelOpen] = useState(false);
  const [drawer, setDrawer] = useState<'settings' | 'library' | null>(null);
  const [userProfile, setUserProfile] = useState(readWeChatUserProfile);
  const [companions, setCompanions] = useState<CompanionOption[]>([]);
  const [urlDraft, setUrlDraft] = useState('');
  const [newDetails, setNewDetails] = useState<MusicTrackDetails>(emptyTrackDetails);
  const [panelError, setPanelError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingDetails, setEditingDetails] = useState<MusicTrackDetails>(emptyTrackDetails);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const track = player.tracks.find((item) => item.id === player.currentTrackId);
  const companion = companions.find((item) => item.id === player.companionId);
  const progress = player.duration > 0 ? Math.min(player.currentTime / player.duration, 1) : 0;
  const hasTracks = player.tracks.length > 0;

  useEffect(() => {
    const refresh = () => { setCompanions(readCompanionOptions()); setUserProfile(readWeChatUserProfile()); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [panelOpen, fullScreen]);

  useEffect(() => {
    if (!drawer) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setDrawer(null); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawer]);

  const openPanel = () => {
    if (onOpen) { onOpen(); return; }
    setPanelError('');
    setPanelOpen(true);
  };
  const closePanel = () => { if (onClose) onClose(); else setPanelOpen(false); };

  const handleAddUrl = () => {
    try {
      const added = musicPlayer.addUrlTrack(urlDraft, newDetails.title, newDetails);
      setUrlDraft('');
      setNewDetails(emptyTrackDetails);
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
      const added = await musicPlayer.addFileTrack(file, newDetails);
      setNewDetails(emptyTrackDetails);
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
    if (!editingDetails.title.trim()) { setPanelError('请填写歌名。'); return; }
    if (editingId) musicPlayer.updateTrackDetails(editingId, editingDetails);
    setPanelError('');
    setEditingId('');
  };

  const subtitle = !hasTracks
    ? ''
    : player.togetherEnabled && companion
      ? `与 ${companion.name} 一起听`
      : '未开启一起听';
  const togglePlayback = () => {
    if (hasTracks) void musicPlayer.togglePlay();
    else openPanel();
  };

  return (
    <>
      {!fullScreen && (variant === 'disc' ? <div className="free-disc-widget" data-desktop-widget>
        <button type="button" className="free-disc-open" aria-label={`管理唱片音乐${title ? `：${title}` : ''}`} onClick={openPanel}
          title={title || track?.title || '添加或管理音乐'}>
          <VinylRecord artwork={artwork || backgroundImage || appearance.disc} color={vinylColor} opacity={vinylOpacity} playing={player.isPlaying} fullArtwork/>
        </button>
        <button type="button" className="free-disc-play" onClick={togglePlayback} aria-label={player.isPlaying ? '暂停' : '播放'}>
          {player.isPlaying ? <Pause size={15}/> : <Play size={15}/>}
        </button>
        {player.error && <span className="free-disc-error" role="alert">{player.error}</span>}
      </div> : variant === 'vinyl' ? <div className="free-vinyl-widget" data-desktop-widget>
        <span className="free-vinyl-heading"><strong>{title || '慢慢听'}</strong>{note && <small>{note}</small>}</span>
        <button type="button" className="free-vinyl-sleeve" aria-label="添加或管理音乐" onClick={openPanel}
          style={background ? { backgroundImage: `url(${JSON.stringify(background)})` } : undefined}>
          <small>SIDE A · OUR LITTLE PLAYLIST</small><strong>{title || '慢慢听'}</strong><span>{note || '为这一刻留一首歌。'}</span><Music2 size={20}/>
        </button>
        <button type="button" className="free-vinyl-disc-button" aria-label="管理唱片音乐" onClick={openPanel}>
          <VinylRecord artwork={artwork || appearance.disc} color={vinylColor} opacity={vinylOpacity} playing={player.isPlaying}/><span className="free-vinyl-arm" aria-hidden="true"/>
        </button>
        <div className="free-vinyl-controls">
          <span className="free-vinyl-track"><strong>{track?.title || title || '还没有添加音乐'}</strong><small>{player.error || subtitle || note || '点唱片添加音乐'}</small></span>
          <button type="button" onClick={togglePlayback} aria-label={player.isPlaying ? '暂停' : '播放'}>{player.isPlaying ? <Pause size={15}/> : <Play size={15}/>}</button>
          <button type="button" onClick={() => musicPlayer.next()} disabled={player.tracks.length < 2} aria-label="下一首"><SkipForward size={15}/></button>
          <input type="range" min={0} max={100} step={0.1} value={progress * 100} disabled={!hasTracks} aria-label="播放进度" onChange={event => musicPlayer.seek(Number(event.target.value) / 100)}/>
        </div>
      </div> : <div
        data-desktop-widget
        onClick={event => { if (!(event.target as HTMLElement).closest('button,input,[role="slider"]')) openPanel(); }}
        style={background ? { backgroundImage: `url(${JSON.stringify(background)})` } : undefined}
        className={`rounded-[clamp(20px,4.8vw,28px)] p-[clamp(9px,2.4vw,13px)] aspect-square flex flex-col justify-between overflow-hidden relative shadow-sm bg-cover bg-center ${
          background ? 'border border-white/70' : 'glass-card'
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
                onClick={togglePlayback}
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
      </div>)}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.flac,.m4a,.wav,.ogg,.aac"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {(fullScreen || panelOpen) && <MusicPanelLayer container={fullScreen ? undefined : modalContainer}>
        <div
          data-no-desktop-swipe
          role={fullScreen ? undefined : 'dialog'}
          aria-modal={fullScreen ? undefined : true}
          aria-label="一起听"
          className={`music-app ${fullScreen ? 'relative flex-1 min-h-0' : 'absolute inset-0 z-50'}`}
          style={background ? { backgroundImage: `linear-gradient(#211a2677,#211a26aa),url(${JSON.stringify(background)})` } : undefined}
        >
          <MusicListeningStage player={player} user={userProfile} companion={companion} disc={appearance.disc} caption={appearance.note} onBack={closePanel} onSettings={() => setDrawer('settings')} onLibrary={() => setDrawer('library')}/>
          {drawer && <div className="music-drawer-backdrop" onClick={event => { if (event.target === event.currentTarget) setDrawer(null); }}>
          <section className="music-drawer" role="dialog" aria-modal="true" aria-label={drawer === 'settings' ? '一起听设置' : '播放列表'}>
          <header className="music-drawer-header"><div><button type="button" aria-pressed={drawer === 'library'} onClick={() => setDrawer('library')}>音乐</button><button type="button" aria-pressed={drawer === 'settings'} onClick={() => setDrawer('settings')}>设置</button></div><button type="button" data-swipe-back aria-label="关闭面板" onClick={() => setDrawer(null)}><X size={20}/></button></header>
          <div className="music-app-scroll space-y-3.5 text-slate-700">
            {drawer === 'settings' && <>
            <section className="space-y-2 rounded-2xl bg-sky-50/60 border border-white/80 p-3">
              <div className="flex items-center justify-between gap-2"><label htmlFor="music-listening-caption" className="text-xs font-bold text-[#2C4A5C]">头像下方文字</label><button type="button" className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 disabled:opacity-40" disabled={!appearance.note} onClick={() => patch({ note: '' })}>恢复默认</button></div>
              <textarea id="music-listening-caption" rows={2} maxLength={120} value={appearance.note} placeholder={DEFAULT_LISTENING_CAPTION} onChange={event => patch({ note: event.target.value })} className="w-full resize-none rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"/>
            </section>
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

            <WidgetImagePicker label="唱片图案" value={appearance.disc} square round maxSize={1000} onChange={value => patch({ disc: value })}/>
            <WidgetImagePicker label="播放器背景" value={appearance.background} maxSize={1920} onChange={value => patch({ background: value })}/>
            </>}
            <div hidden={drawer !== 'library'}>
            <NeteaseMusicPanel />
            </div>
            {drawer === 'library' && <>

            <section className="space-y-2">
              <p className="text-xs font-bold text-[#2C4A5C]">添加音乐</p>
              <TrackDetailsFields value={newDetails} onChange={setNewDetails} disabled={uploading}/>
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
                  disabled={!urlDraft.trim() || uploading}
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
                <Upload className="w-3.5 h-3.5" />{uploading ? '正在保存…' : '选择本地音频文件'}
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
                      <div className="min-w-0 flex-1 space-y-2">
                        <TrackDetailsFields value={editingDetails} onChange={setEditingDetails} editing/>
                        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId('')} className="rounded-full px-3 py-1.5 text-xs text-slate-400">取消</button><button type="button" onClick={commitRename} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sky-600">保存歌曲信息</button></div>
                      </div>
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
                          {item.artists || (item.source === 'netease' ? '网易云音乐' : item.source === 'file' ? item.fileName || '本地文件' : '音频链接')}
                        </span>
                      </button>
                    )}
                    {editingId !== item.id && <><button
                      type="button"
                      aria-label={`编辑歌曲 ${item.title}`}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingDetails({ title: item.title, artists: item.artists || '', mood: item.mood || '' });
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
                    </>}
                  </div>
                );
              })}
            </section>

            </>}
          </div>
          </section>
          </div>}
        </div>
      </MusicPanelLayer>}
    </>
  );
};

export function MusicApp({ onBack }: { onBack: () => void }) {
  return <ListenTogetherWidget fullScreen onClose={onBack}/>;
}
