import type { ReactNode } from 'react';
import type { AppIconOverrides, AppId, AppMetadata, BeautySettings } from '../types';

/** Both desktop pages share the same geometry and icon rendering for each built-in theme. */
export function HomeSystemDock({ homeStyle = 'classic', apps, appIcons, onOpenApp, renderIcon }: {
  homeStyle?: BeautySettings['homeStyle']; apps: AppMetadata[]; appIcons: AppIconOverrides;
  onOpenApp: (id: AppId) => void; renderIcon: (name: string, className?: string) => ReactNode;
}) {
  const classic = homeStyle === 'classic';
  return <nav className="home-system-dock" data-dock-style={homeStyle} aria-label="系统应用">
    {apps.map(app => <button type="button" key={app.id} onClick={() => onOpenApp(app.id)} className="home-system-app">
      <span className={`home-system-icon${appIcons[app.id] ? ' has-custom-icon home-custom-icon' : ''}`}>
        {appIcons[app.id] ? <img src={appIcons[app.id]} alt=""/> : <>
          {classic && <span className={`home-system-icon-wash bg-gradient-to-br ${app.color}`}/>}
          {renderIcon(app.iconName, `home-system-glyph${classic && app.textColor ? ` ${app.textColor}` : ''}`)}
        </>}
      </span>
      <span className="home-system-name">{app.name}</span>
    </button>)}
  </nav>;
}
