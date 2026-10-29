import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { fetchApiModels, filterApiModels, type ApiModel, type ModelListConnection } from '../utils/apiModels';

export function ApiModelPicker({ label, identity, resolveConnection, model, onSelect }: {
  label: string; identity: string; resolveConnection: () => ModelListConnection; model: string; onSelect: (id: string) => void;
}) {
  const [models, setModels] = useState<ApiModel[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, ApiModel[]>());
  const [query, setQuery] = useState('');
  const current = useRef(identity); current.current = identity;
  useEffect(() => { setModels(cache.current.get(identity) ?? []); setQuery(''); setError(''); setBusy(false); request.current?.abort(); request.current = null; return () => request.current?.abort(); }, [identity]);
  const load = async () => {
    if (request.current) return;
    const controller = new AbortController(), key = identity;
    request.current = controller; setBusy(true); setError('');
    try { const list = await fetchApiModels(resolveConnection(), controller.signal); if (!controller.signal.aborted && current.current === key) { cache.current.set(key, list); setModels(list); } }
    catch (cause) { if (!controller.signal.aborted && current.current === key) setError(cause instanceof Error ? cause.message : '模型拉取失败。'); }
    finally { if (!controller.signal.aborted && current.current === key) { setBusy(false); request.current = null; } }
  };
  const filtered = filterApiModels(models, query);
  return <div className="space-y-2">
    <button type="button" aria-label={`拉取${label}模型`} disabled={busy} onClick={() => void load()} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white bg-white/80 py-2 text-xs font-semibold text-[#526b82] disabled:opacity-50"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />{busy ? '正在拉取模型…' : '拉取模型'}</button>
    {!!models.length && <>
      <label className="relative block"><Search aria-hidden="true" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" aria-label={`搜索${label}模型`} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索模型名称或 ID" className="w-full min-w-0 rounded-xl border border-white bg-white/70 py-2 pl-9 pr-3 text-xs text-slate-700 outline-none" /></label>
      <label className="block text-[11px] text-slate-600">接口返回的模型<select aria-label={`选择${label}模型`} value={filtered.some(m => m.id === model) ? model : ''} onChange={e => { if (e.target.value) onSelect(e.target.value); }} className="mt-1 w-full min-w-0 rounded-xl border border-white bg-white/70 px-3 py-2 text-xs text-slate-700"><option value="">选择模型</option>{filtered.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      {!filtered.length && <p role="status" className="text-[10px] text-slate-400">没有匹配的模型</p>}
    </>}
    {!!models.length && <p role="status" className="text-[10px] text-emerald-700">模型列表已更新。</p>}
    {error && <p role="alert" className="break-words text-[10px] text-rose-600">{error}</p>}
  </div>;
}
