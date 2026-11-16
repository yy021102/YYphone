import { useEffect, useState, type ComponentProps, type CSSProperties } from 'react';
import { Mail, Package, Pencil, Pause, Play, SkipForward, Music2 } from 'lucide-react';
import type { MinimalHome } from './MinimalHome';
import { HomeSystemDock } from './HomeSystemDock';
import { musicPlayer, useMusicPlayer } from '../utils/musicPlayer';
import { formatMusicTime } from '../utils/musicPlayback';
import { SnowCap, Snowflake } from './ChristmasSnowArt';

export function ChristmasHome({ userProfile, apps, dockApps, appIcons, onOpenApp, renderIcon, onEditProfile, onOpenNotes, wallpaperUrl, navigation }: Omit<ComponentProps<typeof MinimalHome>, 'variant'>) {
  const [now, setNow] = useState(() => new Date());
  const player = useMusicPlayer(), track = player.tracks.find(t => t.id === player.currentTrackId);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  const play = () => { if (track) void musicPlayer.togglePlay(); else onOpenApp('music'); };
  return <main className={`home-desktop christmas-home christmas-snow-home${wallpaperUrl ? ' has-wallpaper' : ''}`} aria-label="雪夜来信桌面">
    <div className="xmas-desktop-scroll">
      <header className="xmas-desktop-header"><span>WINTER POST <i>❄</i></span><div><button type="button" aria-label="编辑资料" onClick={onEditProfile}><Pencil size={15}/></button><button type="button" aria-label="小纸条" onClick={onOpenNotes}><Mail size={16}/></button><button type="button" aria-label="物品" onClick={() => onOpenApp('inventory')}><Package size={16}/></button></div></header>
      <section className="xmas-profile">
        <button className="xmas-snow-avatar" type="button" aria-label="编辑头像与资料" onClick={onEditProfile} style={{ '--snow-frame': userProfile.avatarFrame?.enabled ? `${Math.max(2,userProfile.avatarFrame.width)}px` : '3px' } as CSSProperties}>
          <span>{userProfile.avatarUrl ? <img src={userProfile.avatarUrl} alt={`${userProfile.name}的头像`}/> : userProfile.name.trim().slice(0,1) || 'U'}</span><SnowCap/><i className="xmas-avatar-crystal"><Snowflake/></i>
        </button>
        <div className="xmas-profile-copy"><small>{userProfile.handle}</small><h1>{userProfile.name}</h1><p>{userProfile.signature}</p></div>
        <button className="xmas-date-stamp" type="button" aria-label="打开日历" onClick={() => onOpenApp('calendar')}><small>{now.toLocaleDateString('en',{month:'short'}).toUpperCase()}</small><strong>{String(now.getDate()).padStart(2,'0')}</strong><span>{now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</span></button>
      </section>
      <section className="xmas-ice-music" data-desktop-widget aria-label="冰雪唱片一起听">
        <div className="xmas-record-holder"><button className={`xmas-ice-record${player.isPlaying ? ' is-playing' : ''}`} type="button" aria-label="打开一起听" onClick={() => onOpenApp('music')}><Snowflake/><span className="xmas-record-center"/><i className="xmas-record-glint"/></button><span className="xmas-record-needle"/></div>
        <div className="xmas-music-copy"><small>SNOWFALL RADIO</small><button className="xmas-song-title" type="button" onClick={() => onOpenApp('music')}>{track?.title || '一起听雪落'}</button><p>{track?.artists || '选一首冬日的歌'}</p><div className="xmas-music-controls"><button type="button" onClick={play} aria-label={player.isPlaying ? '暂停' : '播放'}>{player.isPlaying ? <Pause size={15}/> : <Play size={15}/>}</button><button type="button" aria-label="下一首" disabled={player.tracks.length<2} onClick={() => musicPlayer.next()}><SkipForward size={15}/></button><button type="button" aria-label="音乐列表" onClick={() => onOpenApp('music')}><Music2 size={15}/></button><span>{formatMusicTime(player.currentTime)}</span></div>{player.error && <p role="status">{player.error}</p>}</div>
      </section>
      <div className="xmas-desktop-divider"><span/>❄<span/></div>
      <nav className="xmas-app-grid" aria-label="日常应用">{apps.map(app => <button type="button" key={app.id} onClick={() => onOpenApp(app.id)} className="xmas-app"><span className={`xmas-app-tile${appIcons[app.id] ? ' home-custom-icon' : ''}`}>{appIcons[app.id] ? <img src={appIcons[app.id]} alt=""/> : renderIcon(app.iconName,'xmas-app-glyph')}{!!app.badge && <small>{app.badge}</small>}</span><span>{app.name}</span></button>)}</nav>
      <footer className="xmas-home-footer"><span>{userProfile.location} · {userProfile.mood}</span><span>冬日的信，慢慢寄。</span></footer>
    </div>
    <HomeSystemDock homeStyle="christmas" apps={dockApps} appIcons={appIcons} onOpenApp={onOpenApp} renderIcon={renderIcon}/>{navigation}
  </main>;
}
