import { useState } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { getActiveApiPreset } from '../utils/aiApi';
import { EMPTY_OFFLINE_API, readOfflineApi, saveOfflineApi } from '../utils/offlineApi';
import { ApiModelPicker } from './ApiModelPicker';
import { ChatApiConnectionTest } from './ChatApiConnectionTest';

export function OfflineApiSettings() {
  const [draft, setDraft] = useState(readOfflineApi);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const edit = (patch: Partial<typeof draft>) => { setDraft(current => ({ ...current, ...patch })); setMessage(''); setError(''); };
  return <details className="group rounded-[22px] border border-white/90 bg-white/75 p-3.5 backdrop-blur-xl">
    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#6F7F8E]"><Settings size={15}/><span className="flex-1">剧情 API</span><ChevronDown size={14} className="transition-transform group-open:rotate-180"/></summary>
    <div className="mt-3 space-y-3">
      <p className="text-[10px] leading-relaxed text-slate-400">全部留空使用主 API；填写后用于线下开场、续写、重写、行动建议与剧情摘要。</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-full bg-white px-3 py-1.5 text-[11px] text-slate-600" onClick={() => {
          try { const api = getActiveApiPreset(); edit({ endpoint: api.endpoint, apiKey: api.apiKey, model: api.model ?? '' }); }
          catch (cause) { setError(cause instanceof Error ? cause.message : '请先配置主 API。'); }
        }}>从主 API 载入</button>
        <button type="button" className="rounded-full bg-white px-3 py-1.5 text-[11px] text-slate-600" onClick={() => edit({ ...EMPTY_OFFLINE_API })}>清空配置</button>
      </div>
      {([['endpoint', '线下 API 地址', 'url'], ['apiKey', '线下 API Key', 'password'], ['model', '线下模型', 'text']] as const).map(([key, label, type]) => <label key={key} className="block space-y-1 text-[11px] text-slate-600">
        <span>{label}</span><input aria-label={label} type={type} autoComplete="off" autoCapitalize="off" spellCheck={false} value={draft[key]} onChange={e => edit({ [key]: e.target.value })} className="w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-xs outline-none"/>
      </label>)}
      <ApiModelPicker label="线下" identity={JSON.stringify([draft.endpoint, draft.apiKey])} resolveConnection={() => draft} model={draft.model} onSelect={model => edit({ model })}/>
      {!!draft.endpoint.trim() && !!draft.apiKey.trim() && !!draft.model.trim() && <ChatApiConnectionTest connection={draft}/>}
      <button type="button" className="w-full rounded-full bg-gradient-to-r from-[#F5C6D6] to-[#BFD9F0] py-2 text-xs font-bold text-[#5F6F7E]" onClick={() => {
        try { saveOfflineApi(draft); setError(''); setMessage('剧情 API 已保存。'); }
        catch (cause) { setMessage(''); setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); }
      }}>保存剧情 API</button>
      {message && <p role="status" className="text-[11px] text-emerald-700">{message}</p>}
      {error && <p role="alert" className="break-words text-[11px] text-rose-600">{error}</p>}
    </div>
  </details>;
}
