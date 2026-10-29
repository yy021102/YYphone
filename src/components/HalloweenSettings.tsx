import { useEffect, useState } from 'react';
import { ChevronDown, Ghost, ArrowRight } from 'lucide-react';
import { HalloweenReward } from './HalloweenReward';
import { HALLOWEEN_CHANGE, HALLOWEEN_OPEN, readHalloweenBest, readHalloweenSettings, saveHalloweenSettings } from '../utils/halloween';

export function HalloweenSettings() {
  const [settings, setSettings] = useState(readHalloweenSettings), [best, setBest] = useState(readHalloweenBest);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => { setSettings(readHalloweenSettings()); setBest(readHalloweenBest()); };
    window.addEventListener(HALLOWEEN_CHANGE, refresh);
    return () => window.removeEventListener(HALLOWEEN_CHANGE, refresh);
  }, []);
  const toggle = async (enabled: boolean) => {
    if (busy) return;
    const previous = settings;
    setSettings({ enabled }); setBusy(true); setError('');
    try { await saveHalloweenSettings({ enabled }); setSettings({ enabled }); }
    catch { setSettings(previous); setError('设置暂时没能保存，请重试。'); }
    finally { setBusy(false); }
  };
  return <details className="birthday-settings halloween-settings group">
    <summary><span className="birthday-settings-icon"><Ghost size={21}/></span><span className="birthday-settings-title"><strong>万圣节开屏</strong><small>幽灵糖果屋 · 今夜准许捣蛋</small></span><ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180"/></summary>
    <div className="birthday-settings-content">
      <label className="birthday-setting-row"><span>万圣节来讨糖<small>10 月 29 日—11 月 1 日，每天首次回到桌面时出现</small></span><input className="birthday-switch" aria-label="开启万圣节开屏" type="checkbox" disabled={busy} checked={settings.enabled} onChange={event => void toggle(event.target.checked)}/></label>
      <button type="button" onClick={() => window.dispatchEvent(new Event(HALLOWEEN_OPEN))}>去糖果屋玩一局 <ArrowRight size={14}/></button>
      <p className="hw-settings-note">离线也能玩{best === undefined ? '' : ` · 本季最高 ${best} / 3`}</p>
      <HalloweenReward/>
      {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
    </div>
  </details>;
}
