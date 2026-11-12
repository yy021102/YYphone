import React from 'react';
import { ChevronDown, ListMusic, MoreHorizontal, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, UserRound } from 'lucide-react';
import { musicPlayer, type MusicPlayerState } from '../utils/musicPlayer';
import { formatMusicTime } from '../utils/musicPlayback';
import { VinylRecord } from './DesktopTemplateArt';
import type { MusicDecoration } from '../types';
import { musicBubbleBackground, normalizeMusicDecoration } from '../utils/musicDecoration';

interface Person { name: string; avatarUrl?: string }
export const DEFAULT_LISTENING_CAPTION = '相距520公里，正在一起听';
export function MusicListeningStage({ player, user, companion, disc, caption, decoration, onBack, onSettings, onLibrary }: {
  player: MusicPlayerState; user: Person; companion?: Person; disc: string;
  caption?: string;
  decoration?: MusicDecoration;
  onBack: () => void; onSettings: () => void; onLibrary: () => void;
}) {
  const track = player.tracks.find(item => item.id === player.currentTrackId);
  const mode = player.playbackMode;
  const modeLabel = mode === 'single' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环';
  const ModeIcon = mode === 'single' ? Repeat1 : mode === 'shuffle' ? Shuffle : Repeat;
  const progress = player.duration > 0 ? Math.min(1, player.currentTime / player.duration) : 0;
  const style = normalizeMusicDecoration(decoration);
  const hasBubbles = !!(style.userBubble.text.trim() || style.companionBubble.text.trim());
  const bubble = (data: MusicDecoration['userBubble'], label: string) => <span className="music-listener-bubble" aria-label={label} aria-hidden={!data.text.trim()} data-empty={!data.text.trim() || undefined} style={{ '--music-bubble-color': musicBubbleBackground(data.color, data.opacity) } as React.CSSProperties}><span className="music-listener-bubble-text">{data.text}</span></span>;
  const person = (value: Person, label: string) => <span className="music-listener" title={value.name}><span className="music-listener-photo">{value.avatarUrl ? <img src={value.avatarUrl} alt={label} referrerPolicy="no-referrer"/> : <UserRound aria-label={label}/>}</span></span>;
  return <div className="music-listening-stage">
    <header className="music-listening-header"><button type="button" data-swipe-back aria-label="返回上一级" onClick={onBack}><ChevronDown size={27}/></button><button type="button" aria-label="一起听设置" onClick={onSettings}><MoreHorizontal size={25}/></button></header>
    <button type="button" className="music-listeners" data-bubbles={hasBubbles || undefined} aria-label="选择一起听的角色" onClick={onSettings}>
      <span className="music-listener-pair">{person(user, '我的头像')}{person(companion || { name: '选择角色' }, '角色头像')}<svg className="music-listener-wires" viewBox="0 0 220 132" preserveAspectRatio="none" aria-hidden="true"><path d="M20 42 C-1 66 14 98 40 124 M200 42 C221 66 206 98 180 124" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M20 40l-3 8 M200 40l3 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg></span>
      {hasBubbles && <span className="music-listener-bubbles">{bubble(style.userBubble, '我的装饰气泡')}{bubble(style.companionBubble, '角色装饰气泡')}</span>}
      <span className="music-listening-status">{caption?.trim() || DEFAULT_LISTENING_CAPTION}</span>
    </button>
    <div className="music-listening-record" aria-label="正在播放的唱片"><span className="music-listening-vinyl" data-disc-mode={style.discMode}><VinylRecord artwork={disc || track?.cover} playing={player.isPlaying} color="#19191c"/><span className="music-listening-disc-shadow"/></span></div>
    <div className="music-listening-song"><h2>{track?.title || '还没有播放音乐'}</h2><p>{track ? track.artists || '未知歌手' : '从播放列表选一首歌'}</p></div>
    <div className="music-listening-progress"><input type="range" min={0} max={100} step={0.1} value={progress * 100} disabled={!track} aria-label="一起听播放进度" style={{ '--music-progress': `${progress * 100}%` } as React.CSSProperties} onChange={event => musicPlayer.seek(Number(event.target.value) / 100)}/><span>{formatMusicTime(player.currentTime)}</span><span>{player.duration > 0 ? formatMusicTime(player.duration) : '--:--'}</span></div>
    <div className="music-listening-controls">
      <button type="button" aria-label={`播放模式：${modeLabel}`} title={modeLabel} onClick={() => musicPlayer.setPlaybackMode(mode === 'list' ? 'single' : mode === 'single' ? 'shuffle' : 'list')}><ModeIcon size={20}/></button>
      <button type="button" aria-label="上一首" disabled={player.tracks.length < 2} onClick={() => musicPlayer.previous()}><SkipBack size={23} fill="currentColor"/></button>
      <button type="button" className="music-listening-play" aria-label={player.isPlaying ? '暂停音乐' : '播放音乐'} disabled={!track} onClick={() => void musicPlayer.togglePlay()}>{player.isPlaying ? <Pause size={32} fill="currentColor"/> : <Play size={32} fill="currentColor"/>}</button>
      <button type="button" aria-label="下一首" disabled={player.tracks.length < 2} onClick={() => musicPlayer.next()}><SkipForward size={23} fill="currentColor"/></button>
      <button type="button" aria-label="播放列表" onClick={onLibrary}><ListMusic size={21}/></button>
    </div>
    {player.error && <p className="music-listening-error" role="alert">{player.error}</p>}
  </div>;
}
