import type { DesktopAppearance } from '../types';

export function DesktopAppearanceSettings({ value, onChange }: { value: DesktopAppearance; onChange: (value: DesktopAppearance) => void }) {
  return <details className="glass-card rounded-2xl p-4">
    <summary className="cursor-pointer text-xs font-semibold text-slate-600">桌面文字与透明度</summary>
    <div className="mt-4 space-y-4 text-xs text-slate-600">
      <label className="flex items-center justify-between">桌面文字颜色<input aria-label="桌面文字颜色" type="color" value={value.textColor ?? '#587589'} onChange={e => onChange({ ...value, textColor: e.target.value })}/></label>
      {([{ key: 'iconOpacity', label: '默认图标不透明度' }, { key: 'panelOpacity', label: '卡片背景不透明度' }] as const).map(({ key, label }) => <label key={key} className="block">{label}<span className="float-right">{value[key] === undefined ? '默认' : `${Math.round(value[key]! * 100)}%`}</span><input aria-label={label} className="mt-2 w-full accent-sky-500" type="range" min="0" max="100" value={Math.round((value[key] ?? (key === 'iconOpacity' ? 1 : .65)) * 100)} onChange={e => onChange({ ...value, [key]: Number(e.target.value) / 100 })}/></label>)}
      <p className="text-[10px] text-slate-400">卡片仅调整背景，文字与按钮保持清晰；上传的图标不受影响。</p>
      <button type="button" className="w-full rounded-xl bg-white/70 py-2" onClick={() => onChange({})}>恢复默认桌面样式</button>
    </div>
  </details>;
}
