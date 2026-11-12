import { useEffect, useRef, useState } from 'react';
import { Image, Upload } from 'lucide-react';
import { getActiveApiPreset } from '../utils/aiApi';
import type { ChatOverrides } from '../utils/chatOverrides';
import { compressWallpaper } from '../utils/imageFile';
import { ApiModelPicker } from './ApiModelPicker';
import { ChatApiConnectionTest } from './ChatApiConnectionTest';
import { captureChatCombination, type ChatAppearance } from '../utils/chatAppearance';

export function ChatOverrideSettings({ value, onChange, onBusyChange, appearance }: {
  value: ChatOverrides; onChange: (patch: ChatOverrides) => void; onBusyChange: (busy: boolean) => void; appearance?: ChatAppearance;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; onBusyChange(false); }; }, [onBusyChange]);
  const api = value.secondaryApi ?? { endpoint: '', apiKey: '', model: '' };
  const editApi = (patch: Partial<typeof api>) => { onChange({ secondaryApi: { ...api, ...patch } }); setError(''); };
  const upload = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); onBusyChange(true); setError('');
    try { const url = await compressWallpaper(file); if (mounted.current) onChange({ backgroundUrl: url }); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '背景上传失败。'); }
    finally { if (mounted.current) { setBusy(false); onBusyChange(false); } }
  };
  return <>
    {appearance && <section style={{ order: 3 }} className="space-y-2 rounded-2xl border border-pink-100 bg-pink-50/40 p-3">
      <label className="flex items-center justify-between gap-3 text-xs font-semibold text-[#2C4A5C]">单独应用美化预设<input type="checkbox" aria-label="单独应用美化预设" checked={value.customAppearanceEnabled === true} onChange={event => onChange({
        customAppearanceEnabled: event.target.checked,
        ...(event.target.checked && !value.appearancePreset ? { appearancePreset: { scope: 'all', preset: { id: 'current', name: '当前美化', ...captureChatCombination(appearance) } } } : {}),
      })}/></label>
      {!value.customAppearanceEnabled ? <p className="text-[10px] text-slate-400">跟随美化工坊当前应用的页面。</p> : <>
        <select aria-label="本对话美化预设" className="w-full rounded-xl border border-pink-100 bg-white px-3 py-2 text-xs" value="" onChange={event => {
          const [scope, id] = JSON.parse(event.target.value) as ['page' | 'all', string];
          const preset = (scope === 'page' ? appearance.pagePresets : appearance.presets)?.find(p => p.id === id);
          if (preset) onChange({ appearancePreset: { scope, preset: structuredClone(preset) } });
        }}>
          <option value="">{value.appearancePreset?.preset.name ?? '选择美化预设'}</option>
          <optgroup label="页面预设">{appearance.pagePresets?.map(p => <option key={p.id} value={JSON.stringify(['page', p.id])}>{p.name}</option>)}</optgroup>
          <optgroup label="整套搭配">{appearance.presets.map(p => <option key={p.id} value={JSON.stringify(['all', p.id])}>{p.name}</option>)}</optgroup>
        </select>
        <p className="text-[10px] text-slate-400">保存设置后仅用于本对话。深色模式跟随系统。</p>
      </>}
    </section>}
    <details style={{ order: 3 }} className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-[#2C4A5C]">本对话聊天背景</summary>
      <div className="mt-3 space-y-2">
        <p className="text-[10px] text-slate-400">只用于当前对话，未设置时跟随全局美化；深色模式不显示背景图。</p>
        <label className="block space-y-1 text-[11px] text-slate-600">背景图片链接<input aria-label="本对话背景链接" type="url" disabled={busy} value={value.backgroundUrl?.startsWith('data:') ? '' : value.backgroundUrl ?? ''} placeholder={value.backgroundUrl?.startsWith('data:') ? '已使用上传的背景' : '留空跟随全局背景'} onChange={event => onChange({ backgroundUrl: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"/></label>
        {value.backgroundUrl && <img src={value.backgroundUrl} alt="本对话背景预览" className="h-28 w-full rounded-xl object-cover"/>}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white px-3 py-2"><Upload size={13}/>{busy ? '正在处理…' : '上传聊天背景'}<input aria-label="上传本对话背景" type="file" accept="image/*" disabled={busy} className="hidden" onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }}/></label>
          <button type="button" disabled={busy} onClick={() => onChange({ backgroundUrl: undefined })} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2"><Image size={13}/>跟随全局背景</button>
        </div>
      </div>
    </details>
    <details style={{ order: 7 }} className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-[#2C4A5C]">本对话副 API</summary>
      <div className="mt-3 space-y-3">
        <p className="text-[10px] text-slate-400">只用于当前对话的回复；全部留空则使用主 API。修改后点击下方「保存设置」。</p>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
          <button type="button" className="rounded-full bg-white px-3 py-2" onClick={() => {
            try { const main = getActiveApiPreset(); onChange({ secondaryApi: { endpoint: main.endpoint, apiKey: main.apiKey, model: main.model ?? '', temperature: main.temperature } }); setError(''); }
            catch (cause) { setError(cause instanceof Error ? cause.message : '请先配置主 API。'); }
          }}>从主 API 载入</button>
          <button type="button" className="rounded-full bg-white px-3 py-2" onClick={() => { onChange({ secondaryApi: undefined }); setError(''); }}>恢复主 API</button>
        </div>
        {([['endpoint', '对话 API 地址', 'url'], ['apiKey', '对话 API Key', 'password'], ['model', '对话模型', 'text']] as const).map(([key, label, type]) => <label key={key} className="block space-y-1 text-[11px] text-slate-600"><span>{label}</span><input aria-label={label} type={type} autoComplete="off" autoCapitalize="off" spellCheck={false} value={api[key] ?? ''} onChange={event => editApi({ [key]: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"/></label>)}
        <ApiModelPicker label="对话" identity={JSON.stringify([api.endpoint, api.apiKey])} resolveConnection={() => api} model={api.model ?? ''} onSelect={model => editApi({ model })}/>
        {!!api.endpoint.trim() && !!api.apiKey.trim() && !!api.model?.trim() && <ChatApiConnectionTest connection={api}/>}
      </div>
    </details>
    {error && <p style={{ order: 15 }} role="alert" className="text-[11px] text-rose-600">{error}</p>}
  </>;
}
