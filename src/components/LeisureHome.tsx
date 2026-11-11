import type { ReactNode } from 'react';
import type { AppIconOverrides, AppId, AppMetadata, BeautySettings } from '../types';
import { SECOND_PAGE_APPS } from '../data/mockData';
import { HomeSystemDock } from './HomeSystemDock';

export function LeisureHome({ homeStyle = 'classic', appIcons, dockApps, onOpenApp, renderIcon, navigation }: {
  homeStyle?: BeautySettings['homeStyle']; appIcons: AppIconOverrides; dockApps: AppMetadata[];
  onOpenApp: (id: AppId) => void; renderIcon: (name: string, className?: string) => ReactNode; navigation: ReactNode;
}) {
  const appButton = (app: AppMetadata) => <button type="button" key={app.id}
    className={`leisure-app${appIcons[app.id] ? ' has-custom-icon' : ''}`} onClick={() => onOpenApp(app.id)}>
    <span className={`leisure-app-icon${appIcons[app.id] ? ' home-custom-icon' : homeStyle === 'classic' ? ` bg-gradient-to-br ${app.color}` : ''}`}>
      {appIcons[app.id] ? <img src={appIcons[app.id]} alt="" /> : renderIcon(app.iconName, `leisure-app-glyph ${homeStyle === 'classic' ? app.textColor ?? '' : ''}`)}
    </span><span>{app.name}</span>
  </button>;
  return <main className={`home-desktop leisure-home leisure-${homeStyle}`} aria-label="第2页桌面">
    <div className="leisure-scroll">
      <nav className="leisure-app-grid" aria-label="第2页应用">{SECOND_PAGE_APPS.map(appButton)}</nav>
    </div>
    <HomeSystemDock homeStyle={homeStyle} apps={dockApps} appIcons={appIcons} onOpenApp={onOpenApp} renderIcon={renderIcon}/>
    {navigation}
  </main>;
}
