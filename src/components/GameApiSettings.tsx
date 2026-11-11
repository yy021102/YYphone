import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getActiveApiPreset } from '../utils/aiApi';
import { EMPTY_GAME_API, readGameApi, saveGameApi } from '../utils/gameApi';
import { ApiModelPicker } from './ApiModelPicker';
import { ChatApiConnectionTest } from './ChatApiConnectionTest';

export function GameApiSettings({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState(readGameApi);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const edit = (patch: Partial<typeof draft>) => { setDraft(current => ({ ...current, ...patch })); setMessage(''); setError(''); };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  return <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="游戏 API 设置" onClick={event => event.stopPropagation()} className="max-h-full w-full max-w-md overflow-y-auto rounded-[26px] border border-white bg-gradient-to-br from-[#fff7fb] to-[#edf6ff] p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-[#2C4A5C]">游戏副 API</h2><button type="button" data-swipe-back aria-label="关闭游戏 API 设置" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500"><X size={17}/></button></div>
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-slate-500">用于游戏出题、剧情和角色发言。全部留空使用主 API。</p>
        <div className="flex gap-2 text-[11px] text-slate-600">
          <button type="button" className="rounded-full bg-white px-3 py-2" onClick={() => {
            try { const api = getActiveApiPreset(); setDraft({ endpoint: api.endpoint, apiKey: api.apiKey, model: api.model ?? '', temperature: api.temperature, maxTokens: api.maxTokens, stream: api.stream }); setMessage(''); setError(''); }
            catch (cause) { setError(cause instanceof Error ? cause.message : '请先配置主 API。'); }
          }}>从主 API 载入</button>
          <button type="button" className="rounded-full bg-white px-3 py-2" onClick={() => { setDraft({ ...EMPTY_GAME_API }); setMessage(''); setError(''); }}>恢复主 API</button>
        </div>
        {([['endpoint', '游戏 API 地址', 'text'], ['apiKey', '游戏 API Key', 'password'], ['model', '游戏模型', 'text']] as const).map(([key, label, type]) => <label key={key} className="block space-y-1 text-[11px] text-slate-600"><span>{label}</span><input aria-label={label} type={type} inputMode={key === 'endpoint' ? 'url' : undefined} autoComplete="off" autoCapitalize="off" spellCheck={false} value={draft[key]} onChange={event => edit({ [key]: event.target.value })} className="w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-xs outline-none"/></label>)}
        <ApiModelPicker label="游戏" identity={JSON.stringify([draft.endpoint, draft.apiKey])} resolveConnection={() => draft} model={draft.model} onSelect={model => edit({ model })}/>
        {!!draft.endpoint.trim() && !!draft.apiKey.trim() && !!draft.model.trim() && <ChatApiConnectionTest connection={draft}/>}
        <button type="button" className="w-full rounded-full bg-gradient-to-r from-[#F5C6D6] to-[#BFD9F0] py-2.5 text-xs font-bold text-[#5F6F7E]" onClick={() => {
          try { saveGameApi(draft); setError(''); setMessage('已保存'); }
          catch (cause) { setMessage(''); setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); }
        }}>保存游戏 API</button>
        {message && <p role="status" className="text-[11px] text-emerald-700">{message}</p>}
        {error && <p role="alert" className="break-words text-[11px] text-rose-600">{error}</p>}
      </div>
    </section>
  </div>;
}
