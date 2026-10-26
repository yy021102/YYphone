import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Mail, MapPin, Package, Pencil } from 'lucide-react';
import type { AppIconOverrides, AppId, AppMetadata, UserProfile } from '../types';
import { ListenTogetherWidget } from './ListenTogetherWidget';
import { frameGradient } from '../utils/avatarFrame';

export function MinimalHome({ userProfile, apps, dockApps, appIcons, onOpenApp, renderIcon, onEditProfile, onOpenNotes }: { userProfile: UserProfile; apps: AppMetadata[]; dockApps: AppMetadata[]; appIcons: AppIconOverrides; onOpenApp: (id: AppId) => void; renderIcon: (name: string, className?: string) => ReactNode; onEditProfile: () => void; onOpenNotes: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15000); return () => window.clearInterval(timer); }, []);
  const appButton = (app: AppMetadata) => <button type="button" key={app.id} onClick={() => onOpenApp(app.id)} className="minimal-app"><span className={`minimal-app-tile${appIcons[app.id] ? ' has-custom-icon' : ''}`}>{appIcons[app.id] ? <img src={appIcons[app.id]} alt="" /> : renderIcon(app.iconName, 'minimal-app-glyph')}{!!app.badge && <small className="minimal-app-badge">{app.badge}</small>}</span><span>{app.name}</span></button>;
  return <main className="minimal-home" aria-label="素简纸白桌面">
    <div className="minimal-home-scroll">
      <header className="minimal-home-header"><span>YY<span className="minimal-wordmark-dot">.</span> PHONE</span><div><button type="button" aria-label="编辑资料" onClick={onEditProfile}><Pencil size={15} /></button><button type="button" aria-label="小纸条" onClick={onOpenNotes}><Mail size={16} /></button><button type="button" aria-label="物品" onClick={() => onOpenApp('inventory')}><Package size={16} /></button></div></header>
      <section className="minimal-profile"><div className="minimal-profile-copy"><small>{userProfile.handle}</small><h1>{userProfile.name}</h1><p>{userProfile.signature}</p></div><button type="button" className="minimal-profile-avatar" aria-label="编辑头像与资料" onClick={onEditProfile} style={userProfile.avatarFrame?.enabled ? { background: frameGradient(userProfile.avatarFrame), padding: userProfile.avatarFrame.width } : undefined}>{userProfile.avatarUrl ? <img src={userProfile.avatarUrl} alt={`${userProfile.name}的头像`} /> : <span>{userProfile.name.trim().slice(0, 1) || 'U'}</span>}</button></section>
      <section className="minimal-day"><div><button type="button" className="minimal-clock" aria-label="打开日历" onClick={() => onOpenApp('calendar')}>{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</button><p>{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p><span><MapPin size={11} />{userProfile.location}<i />{userProfile.mood}</span></div><button type="button" className="minimal-date-tile" aria-label="查看日历" onClick={() => onOpenApp('calendar')}><small>{now.toLocaleDateString('en', { month: 'short' }).toUpperCase()}</small><strong>{String(now.getDate()).padStart(2, '0')}</strong><ArrowUpRight size={14} /></button></section>
      <div className="minimal-section-label"><span>日常</span><small>01 — {String(apps.length).padStart(2, '0')}</small></div>
      <nav className="minimal-app-grid" aria-label="日常应用">{apps.map(appButton)}</nav>
      <details className="minimal-music"><summary><span>一起听</span><span className="minimal-music-indicator">音乐与播放 <span>＋</span></span></summary><div><ListenTogetherWidget /></div></details>
      <footer className="minimal-home-caption"><span>{userProfile.stats.moments} 动态 / {userProfile.stats.notes} 随笔</span><span>慢慢生活</span></footer>
    </div>
    <nav className="minimal-dock" aria-label="系统应用">{dockApps.map(appButton)}</nav>
  </main>;
}
