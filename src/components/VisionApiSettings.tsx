import { useState } from 'react';
import { ScanEye } from 'lucide-react';
import { getActiveApiPreset } from '../utils/aiApi';
import { readVisionApi, saveVisionApi } from '../utils/visionApi';
import { ApiModelPicker } from './ApiModelPicker';

export function VisionApiSettings({ presets }: { presets: Array<{ id: string; name: string; endpoint: string; apiKey: string; model?: string }> }) {
  const [draft, setDraft] = useState(readVisionApi);
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const edit = (patch: Partial<typeof draft>) => { setDraft(current => ({ ...current, ...patch })); setNotice(''); setError(''); };
  const save = (next = draft) => {
    try { saveVisionApi(next); setDraft(next); setNotice('已保存'); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
  };
  return <section className="settings-card space-y-3">
    <label className="flex items-center gap-3 text-sm font-semibold text-[#2C4A5C]">
      <span className="rounded-xl bg-sky-50 p-2 text-sky-500"><ScanEye size={18}/></span>
      <span className="flex-1">识图启用副 API</span>
      <input type="checkbox" checked={draft.enabled} onChange={event => {
        const next = { ...draft, enabled: event.target.checked };
        if (!next.enabled) save(next); else edit({ enabled: true });
      }}/>
    </label>
    {draft.enabled && <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-500">首次识图由副 API 记录图片内容，聊天仍使用原 API，之后复用图片描述。</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="载入识图 API 预设" value="" onChange={event => { const api = presets.find(p => p.id === event.target.value); if (api) edit({ endpoint: api.endpoint, apiKey: api.apiKey, model: api.model ?? '' }); }} className="min-w-0 flex-1 rounded-xl bg-white/80 px-2 py-2 text-xs">
          <option value="">从 API 预设载入</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button type="button" className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700" onClick={() => {
          try { const api = getActiveApiPreset(); edit({ endpoint: api.endpoint, apiKey: api.apiKey, model: api.model ?? '' }); }
          catch (cause) { setError(cause instanceof Error ? cause.message : '请先配置主 API'); }
        }}>载入主 API</button>
      </div>
      {([['endpoint', '识图 API 地址', 'text'], ['apiKey', '识图 API Key', 'password'], ['model', '识图模型', 'text']] as const).map(([key, label, type]) => <label key={key} className="block space-y-1 text-[11px] text-slate-600"><span>{label}</span><input aria-label={label} type={type} autoComplete="off" autoCapitalize="off" spellCheck={false} value={draft[key]} onChange={event => edit({ [key]: event.target.value })} className="w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-xs outline-none"/></label>)}
      <ApiModelPicker label="识图" identity={JSON.stringify([draft.endpoint, draft.apiKey])} resolveConnection={() => draft} model={draft.model} onSelect={model => edit({ model })}/>
      <button type="button" className="w-full rounded-xl bg-sky-50 py-2 text-xs font-semibold text-sky-700" onClick={() => save()}>保存识图 API</button>
    </div>}
    {notice && draft.enabled && <p role="status" className="text-[11px] text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
  </section>;
}
