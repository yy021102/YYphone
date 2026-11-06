import React, { useEffect, useState } from 'react';

/** Fullscreen is opt-in: Android's system bars are outside the page's CSS viewport. */
export function AndroidFullscreenControl() {
  const [active, setActive] = useState(() => !!document.fullscreenElement);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!/Android/i.test(navigator.userAgent)) return null;
  const supported = !!document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';
  return <div className="p-3.5 space-y-2">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-[#2C4A5C]">全屏显示</p><p className="text-[10px] text-slate-400">隐藏手机系统状态栏和导航栏，退出后恢复</p></div>
      <button type="button" disabled={!supported || busy} aria-pressed={active}
        className="shrink-0 rounded-xl bg-white/80 px-3 py-2 text-xs text-[#2C4A5C] disabled:opacity-50"
        onClick={async () => {
          setBusy(true); setError('');
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
            setActive(!!document.fullscreenElement);
          } catch { setError('当前浏览器未允许全屏，可尝试用 Chrome 打开。'); }
          finally { setBusy(false); }
        }}>{active ? '退出全屏' : '进入全屏'}</button>
    </div>
    {!supported && <p className="text-[10px] text-slate-400">当前浏览器不支持网页全屏。</p>}
    {active && <p className="text-[10px] text-slate-400">可在这里退出全屏；系统返回键通常也可退出。</p>}
    {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
  </div>;
}
