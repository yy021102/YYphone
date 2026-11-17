import { useState } from 'react';
import { Check, ChevronDown, Download, Smartphone } from 'lucide-react';
import { DEFAULT_LAUNCHER_ICON, LAUNCHER_ICONS, launcherIconPaths, readLauncherIcon, saveLauncherIcon, type LauncherIconId } from '../utils/launcherIcons';
import './launcherIconSettings.css';

export function LauncherIconSettings() {
  const [selected, setSelected] = useState(readLauncherIcon);
  const [error, setError] = useState('');
  const paths = launcherIconPaths(selected);
  const current = LAUNCHER_ICONS.find(icon => icon.id === selected)!;
  const choose = (id: LauncherIconId) => {
    try { saveLauncherIcon(id); setSelected(id); setError(''); }
    catch { setError('图标选择未能保存，请重试。'); }
  };
  return <details className="glass-card launcher-icon-settings" onToggle={event => {
    if (event.currentTarget.open) { setSelected(readLauncherIcon()); setError(''); }
  }}>
    <summary className="launcher-gallery-entry">
      <span className="launcher-entry-symbol"><Smartphone size={18}/></span>
      <strong>小手机图标</strong><img src={paths.image} alt=""/><small>{current.name}</small>
      <ChevronDown className="launcher-expand-arrow" size={15}/>
    </summary>
    <div className="launcher-icon-content">
      <div className="launcher-icon-grid" role="group" aria-label="小手机图标">
        {LAUNCHER_ICONS.map(icon => <button key={icon.id} type="button" aria-label={`选择${icon.name}桌面图标`} aria-pressed={selected === icon.id} onClick={() => choose(icon.id)}>
          <span className="launcher-icon-preview"><img src={launcherIconPaths(icon.id).image} alt={icon.name} loading="lazy"/>{selected === icon.id && <i><Check size={13}/></i>}</span>
          <span>{icon.name}{icon.id === DEFAULT_LAUNCHER_ICON && <small>默认</small>}</span>
        </button>)}
      </div>
      <footer className="launcher-icon-footer">
        <div><span>当前图标 · {current.name}</span><a href={paths.image} download={`歪歪机-${current.name}.png`}><Download size={14}/>保存图标</a></div>
        <details><summary>桌面图标没有更新？</summary><p>如果浏览器不支持直接更换图标，请先导出整机备份，再在浏览器打开歪歪机网页，选择图标后添加到手机桌面，最后按需导入备份。备份完成前请保留旧入口。</p></details>
        {error && <p role="alert">{error}</p>}
      </footer>
    </div>
  </details>;
}
