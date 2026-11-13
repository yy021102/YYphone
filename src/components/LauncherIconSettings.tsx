import { useState } from 'react';
import { Check, ChevronDown, Download, Smartphone } from 'lucide-react';
import { LAUNCHER_ICONS, launcherIconPaths, readLauncherIcon, saveLauncherIcon, type LauncherIconId } from '../utils/launcherIcons';

export function LauncherIconSettings() {
  const [selected, setSelected] = useState(readLauncherIcon), [error, setError] = useState('');
  const choose = (id: LauncherIconId) => {
    try { saveLauncherIcon(id); setSelected(id); setError(''); }
    catch { setError('图标选择未能保存，请重试。'); }
  };
  const paths = launcherIconPaths(selected), current = LAUNCHER_ICONS.find(icon => icon.id === selected)!;
  return <details className="glass-card group rounded-2xl p-3 launcher-icon-settings">
    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[#2C4A5C]"><Smartphone size={14} className="text-sky-500"/><span className="flex-1">手机桌面图标</span><ChevronDown size={13} className="text-slate-400 transition-transform group-open:rotate-180"/></summary>
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-4 gap-2">{LAUNCHER_ICONS.map(icon => <button key={icon.id} type="button" aria-label={`选择${icon.name}桌面图标`} aria-pressed={selected === icon.id} onClick={() => choose(icon.id)} className="min-w-0 space-y-1.5 text-center text-[10px] text-slate-500">
        <span className={`relative block aspect-square overflow-hidden rounded-2xl border-2 ${selected === icon.id ? 'border-sky-300 shadow-sm' : 'border-white/70'}`}><img src={launcherIconPaths(icon.id).image} alt={icon.name} className="h-full w-full object-cover" loading="lazy"/>{selected === icon.id && <span className="absolute right-0.5 bottom-0.5 rounded-full bg-white p-0.5 text-sky-500"><Check size={11}/></span>}</span><span>{icon.name}</span>
      </button>)}</div>
      <a href={paths.image} download={`歪歪机-${current.name}.png`} className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-[11px] text-slate-600"><Download size={12}/>保存图标</a>
      <p className="text-[10px] leading-relaxed text-slate-500">如果浏览器不支持直接更换图标，请先导出整机备份，再在浏览器打开歪歪机网页，选择图标后添加到手机桌面，最后按需导入备份。备份完成前请保留旧入口。</p>
      {error && <p role="alert" className="text-[11px] text-rose-500">{error}</p>}
    </div>
  </details>;
}
