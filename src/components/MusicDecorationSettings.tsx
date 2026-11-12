import React from 'react';
import type { MusicDecoration } from '../types';
import { normalizeMusicDecoration } from '../utils/musicDecoration';

export function MusicDecorationSettings({ value, onChange }: { value?: MusicDecoration; onChange: (value: MusicDecoration) => void }) {
  const style = normalizeMusicDecoration(value);
  const patchBubble = (owner: 'userBubble' | 'companionBubble', patch: Partial<MusicDecoration['userBubble']>) => onChange({ ...style, [owner]: { ...style[owner], ...patch } });
  return <section className="music-decoration-settings space-y-3 rounded-2xl bg-sky-50/60 border border-white/80 p-3">
    <div className="flex items-center justify-between gap-2"><strong className="text-xs text-[#2C4A5C]">播放页外观</strong><button type="button" onClick={() => onChange(normalizeMusicDecoration(undefined))} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">恢复默认</button></div>
    <div className="flex items-center justify-between text-[11px] text-slate-500"><span>背景压暗</span><button type="button" role="switch" aria-label="背景压暗" aria-checked={style.darkenBackground} onClick={() => onChange({ ...style, darkenBackground: !style.darkenBackground })} className={`relative h-5 w-9 rounded-full transition-colors ${style.darkenBackground ? 'bg-sky-300' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${style.darkenBackground ? 'left-[18px]' : 'left-0.5'}`}/></button></div>
    <div className="flex gap-2" role="group" aria-label="唱片样式">{([['vinyl', '黑胶唱片'], ['image', '完整圆形图片']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={style.discMode === mode} onClick={() => onChange({ ...style, discMode: mode })} className={`flex-1 rounded-xl border px-2 py-2 text-[11px] ${style.discMode === mode ? 'bg-white border-sky-200 text-sky-700' : 'border-transparent bg-white/40 text-slate-500'}`}>{label}</button>)}</div>
    {([['userBubble', '我的气泡'], ['companionBubble', '角色气泡']] as const).map(([owner, label]) => <div key={owner} className="space-y-2 rounded-xl bg-white/60 p-2.5">
      <label className="block text-[11px] font-semibold text-slate-500">{label}<input aria-label={`${label}文字`} value={style[owner].text} maxLength={40} onChange={event => patchBubble(owner, { text: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal outline-none focus:border-sky-400"/></label>
      <div className="flex items-center gap-3"><label className="flex shrink-0 items-center gap-2 text-[10px] text-slate-500">颜色<input type="color" aria-label={`${label}颜色`} value={style[owner].color} onChange={event => patchBubble(owner, { color: event.target.value })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"/></label><label className="min-w-0 flex-1 text-[10px] text-slate-500">不透明度 {style[owner].opacity}%<input type="range" min={0} max={100} step={1} aria-label={`${label}不透明度`} value={style[owner].opacity} onChange={event => patchBubble(owner, { opacity: Number(event.target.value) })} className="mt-1 block w-full accent-slate-400"/></label></div>
    </div>)}
    <p className="text-[10px] text-slate-400">气泡文字留空即可隐藏。</p>
  </section>;
}
