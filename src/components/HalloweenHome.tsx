import { useEffect, useState, type ReactNode } from 'react';
import { Mail, Package, Pencil } from 'lucide-react';
import type { AppIconOverrides, AppId, AppMetadata, UserProfile } from '../types';
import { HalloweenTown } from './HalloweenArt';
import { ListenTogetherWidget } from './ListenTogetherWidget';
import { frameGradient } from '../utils/avatarFrame';

export function HalloweenHome({ userProfile, apps, dockApps, appIcons, wallpaperUrl, onOpenApp, renderIcon, onEditProfile, onOpenNotes }: {
  userProfile: UserProfile; apps: AppMetadata[]; dockApps: AppMetadata[]; appIcons: AppIconOverrides; wallpaperUrl?: string;
  onOpenApp: (id: AppId) => void; renderIcon: (name: string, className?: string) => ReactNode;
  onEditProfile: () => void; onOpenNotes: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  const appButton = (app: AppMetadata) => <button type="button" key={app.id} className={`hw-market-app${appIcons[app.id] ? ' has-custom-icon' : ''}`} onClick={() => onOpenApp(app.id)}>
    <span className="hw-market-app-icon">{appIcons[app.id] ? <img src={appIcons[app.id]} alt=""/> : renderIcon(app.iconName, 'hw-market-glyph')}{!!app.badge && <small className="hw-market-badge">{app.badge}</small>}</span><span>{app.name}</span>
  </button>;
  return <main className={`home-desktop halloween-home hw-market${wallpaperUrl ? ' hw-market-custom' : ''}`} aria-label="南瓜夜宴桌面" style={wallpaperUrl ? { backgroundImage: `url(${JSON.stringify(wallpaperUrl)})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}>
    {!wallpaperUrl && <svg className="halloween-home-art" viewBox="0 0 390 820" preserveAspectRatio="none" aria-hidden="true"><g fill="#edd4ae">{[[22,123],[370,62],[355,372],[31,613],[367,737],[47,291]].map(([x,y],i)=><path key={i} opacity=".5" d={`M${x} ${y-4}Q${x} ${y} ${x+4} ${y}Q${x} ${y} ${x} ${y+4}Q${x} ${y} ${x-4} ${y}Q${x} ${y} ${x} ${y-4}Z`}/>)}</g><path d="M0 14q195 57 390 0M0 805q195-45 390 0" fill="none" stroke="#d3bba8" strokeWidth=".7" opacity=".2"/></svg>}
    <header className="hw-market-header"><span>南瓜街 <i>✦</i> 夜间营业</span><div><button type="button" aria-label="编辑资料" onClick={onEditProfile}><Pencil size={15}/></button><button type="button" aria-label="小纸条" onClick={onOpenNotes}><Mail size={16}/></button><button type="button" aria-label="物品" onClick={() => onOpenApp('inventory')}><Package size={16}/></button></div></header>
    <div className="hw-market-scroll">
      <section className="hw-market-window" aria-label="夜间糖果铺">
        <div className="hw-market-shop-name"><span>THE MIDNIGHT MARKET</span><h1>南瓜夜宴</h1><i>✧</i></div>
        <div className="hw-market-shop-art" aria-hidden="true"><HalloweenTown lit/></div>
        <button type="button" className="hw-market-clock" aria-label="打开日历" onClick={() => onOpenApp('calendar')}><small>今夜营业中</small><strong>{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</span></button>
      </section>
      <section className="hw-market-pass">
        <button type="button" aria-label="编辑头像与资料" className="hw-market-avatar" onClick={onEditProfile} style={userProfile.avatarFrame?.enabled ? { background: frameGradient(userProfile.avatarFrame), padding: userProfile.avatarFrame.width } : undefined}>{userProfile.avatarUrl ? <img src={userProfile.avatarUrl} alt={`${userProfile.name}的头像`}/> : <span>{userProfile.name.trim().slice(0,1) || 'U'}</span>}</button>
        <div><small>{userProfile.handle}</small><h2>{userProfile.name}</h2><p>{userProfile.signature}</p></div><span className="hw-market-pass-stamp" aria-hidden="true">夜游<br/>通行</span>
      </section>
      <div className="hw-market-section-label"><span>夜间百货</span><i>✦</i><small>随心逛逛</small></div>
      <section className="hw-market-cabinet">
        <nav className="hw-market-tools" aria-label="系统应用">{dockApps.map(appButton)}</nav>
        <nav className="hw-market-shelves" aria-label="日常应用">{apps.map(appButton)}</nav>
      </section>
      <details className="hw-market-music"><summary><span>♫ 一起听</span><small>掀开音乐盒 <i>＋</i></small></summary><div><ListenTogetherWidget/></div></details>
      <footer className="hw-market-footer"><span>{userProfile.location} · {userProfile.mood}</span><span>{userProfile.stats.moments} 动态 / {userProfile.stats.notes} 随笔</span></footer>
    </div>
  </main>;
}
