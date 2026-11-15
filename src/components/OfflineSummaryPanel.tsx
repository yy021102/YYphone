import { useEffect, useRef, useState } from 'react';
import { BookOpen, Loader2, X } from 'lucide-react';
import { type OfflinePreset, type OfflineStory } from '../utils/offlineData';
import { summarizeOfflineStory } from '../utils/offlineAi';
import { offlineSummaryBatches, offlineSummaryRanges, readOfflineSummarySettings, saveOfflineSummarySettings } from '../utils/offlineSummary';

export interface OfflineSummaryDraft { from: number; to: number; messageIds: string[]; summary: string }
const field = 'w-full rounded-xl border border-white bg-white/75 p-2.5 text-xs text-slate-600 outline-none';
const button = 'rounded-xl border border-white bg-white/80 px-3 py-2 text-xs text-slate-600 disabled:opacity-40';

export function OfflineSummaryPanel({ story, preset, onClose, onBusy, onSave }: {
  story: OfflineStory; preset?: OfflinePreset; onClose: () => void; onBusy: (busy: boolean) => void;
  onSave: (drafts: OfflineSummaryDraft[], replace: boolean, end: boolean) => void;
}) {
  const [settings, setSettings] = useState(readOfflineSummarySettings);
  const [saved] = useState(() => offlineSummaryBatches(story.id));
  const covered = new Set(saved.flatMap(b => b.messageIds));
  let next = 0; while (next < story.messages.length && covered.has(story.messages[next].id)) next++;
  const [from, setFrom] = useState(String(next < story.messages.length ? next + 1 : 1));
  const [to, setTo] = useState(String(story.messages.length));
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [manual, setManual] = useState(''), [drafts, setDrafts] = useState<OfflineSummaryDraft[]>([]);
  const [replace, setReplace] = useState(false), [end, setEnd] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  const ranges = () => offlineSummaryRanges(story, Number(from), Number(to), mode === 'manual' ? story.messages.length : settings.batchSize);
  const saveSettings = () => { saveOfflineSummarySettings(settings); setNotice('总结设置已保存。'); };
  const generate = async () => {
    if (controller.current) return;
    const active = new AbortController();
    try {
      const batches = ranges(); saveOfflineSummarySettings(settings);
      controller.current = active; setBusy(true); onBusy(true); setError(''); setNotice(''); setDrafts([]);
      for (const [index, range] of batches.entries()) {
        setNotice(`正在整理第 ${index + 1} / ${batches.length} 批`);
        const summary = await summarizeOfflineStory({ ...story, messages: story.messages.slice(range.from - 1, range.to) }, preset, { settings, signal: active.signal });
        active.signal.throwIfAborted();
        setDrafts(previous => [...previous, { ...range, summary }]);
      }
      setNotice('总结草稿已生成，确认后保存。');
    } catch (cause) {
      if (!active.signal.aborted) setError(cause instanceof Error ? cause.message : '生成失败，已完成的草稿会保留。');
      else setNotice('已停止，已完成的草稿可以编辑或保存。');
    } finally { controller.current = null; setBusy(false); onBusy(false); }
  };
  const save = () => {
    try {
      const output = mode === 'manual' ? [{ ...ranges()[0], summary: manual.trim() }] : drafts;
      if (!output.length || output.some(d => !d.summary.trim())) throw new Error('请先填写或生成总结。');
      if (replace && saved.length && !window.confirm('这会替换本故事全部已保存的总结，确认继续？')) return;
      onSave(output, replace, end);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，草稿已保留。'); }
  };
  return <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-3 backdrop-blur-xs">
    <section role="dialog" aria-modal="true" aria-label="总结记忆" className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-[26px] border border-white bg-gradient-to-br from-[#f6faff] to-[#fff4f9] p-4 shadow-xl">
      <header className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold text-[#5b7485]"><BookOpen size={17}/>总结记忆</h3><button type="button" className={button} aria-label="关闭总结记忆" disabled={busy} onClick={onClose}><X size={16}/></button></header>
      <div className="min-h-0 space-y-3 overflow-y-auto text-xs text-slate-500">
        <div className="flex gap-2">{(['ai', 'manual'] as const).map((value, i) => <button type="button" key={value} className={button} disabled={busy} aria-pressed={mode === value} onClick={() => { setMode(value); setError(''); }}>{i ? '粘贴外部总结' : 'AI 总结'}</button>)}</div>
        <p>共 {story.messages.length} 条剧情{next ? ` · 已连续总结至第 ${next} 条` : ''}。相同范围保存会更新该批，其他批次保留。</p>
        <div className="grid grid-cols-2 gap-3"><label>从第几条<input aria-label="总结起始条数" className={field} type="number" min={1} max={story.messages.length} disabled={busy} value={from} onChange={e => { setFrom(e.target.value); setDrafts([]); }}/></label><label>到第几条<input aria-label="总结结束条数" className={field} type="number" min={1} max={story.messages.length} disabled={busy} value={to} onChange={e => { setTo(e.target.value); setDrafts([]); }}/></label></div>
        <details className="rounded-2xl bg-white/45 p-3"><summary className="cursor-pointer">总结设置</summary><div className="mt-3 space-y-3">
          <label className="block">自定义总结提示词<textarea aria-label="线下总结提示词" rows={4} className={field} disabled={busy} value={settings.prompt} onChange={e => setSettings({ ...settings, prompt: e.target.value })} placeholder="例如：按日期记录关键事件，重点保留关系变化和未完成的约定。"/></label>
          <div className="grid grid-cols-2 gap-3"><label>每批最多字数<input aria-label="线下总结字数限制" className={field} type="number" min={100} max={20000} disabled={busy} value={settings.maxChars || ''} onChange={e => setSettings({ ...settings, maxChars: Number(e.target.value) })}/></label><label>每批消息条数<input aria-label="线下总结分批条数" className={field} type="number" min={1} disabled={busy} value={settings.batchSize || ''} onChange={e => { setSettings({ ...settings, batchSize: Number(e.target.value) }); setDrafts([]); }}/></label></div>
          <p>字数限制用于 AI 生成，手动粘贴的内容不会被截断。设置可用于其他故事。</p>
          <button type="button" className={button} disabled={busy} onClick={() => { try { saveSettings(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '设置保存失败。'); } }}>保存总结设置</button>
        </div></details>
        {mode === 'manual' ? <label className="block">总结正文<textarea aria-label="外部总结正文" rows={7} className={field} disabled={busy} value={manual} onChange={e => setManual(e.target.value)} placeholder="粘贴你自己写的，或其他 AI 总结的内容。保存不调用 API。"/></label> : <>
          <button type="button" className={button} disabled={busy} onClick={() => void generate()}>{busy ? <Loader2 className="mr-1 inline animate-spin" size={14}/> : null}分批生成总结</button>
          {drafts.map((draft, index) => <label key={`${draft.from}-${draft.to}`} className="block">第 {draft.from}～{draft.to} 条 · {draft.summary.length} 字<textarea aria-label={`第${draft.from}至${draft.to}条总结`} rows={5} className={field} disabled={busy} value={draft.summary} onChange={e => setDrafts(current => current.map((d, i) => i === index ? { ...d, summary: e.target.value } : d))}/></label>)}
        </>}
        {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="text-rose-600">{error}</p>}
        {saved.length > 0 && <details className="rounded-2xl bg-white/45 p-3"><summary className="cursor-pointer">已保存的总结 · {saved.length} 批</summary>{saved.map(batch => {
          const start = story.messages.findIndex(m => m.id === batch.messageIds[0]), last = story.messages.findIndex(m => m.id === batch.messageIds.at(-1));
          return <details key={batch.id} className="mt-3"><summary>{start < 0 || last < 0 ? '此前总结（范围未记录或已变化）' : `第 ${start + 1}～${last + 1} 条`}</summary><p className="my-2 whitespace-pre-wrap leading-relaxed">{batch.summary}</p><button type="button" className={button} disabled={busy} onClick={() => { setMode('manual'); setManual(batch.summary); setFrom(String(start < 0 ? 1 : start + 1)); setTo(String(last < 0 ? story.messages.length : last + 1)); setReplace(start < 0 || last < 0); }}>编辑这一批</button></details>;
        })}</details>}
        <label className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={replace} onChange={e => setReplace(e.target.checked)}/>替换本故事全部总结</label>
        <label className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={end} onChange={e => setEnd(e.target.checked)}/>同时标记剧情结束（仍可继续书写）</label>
        <div className="flex gap-2"><button type="button" className={button} disabled={busy} onClick={save}>保存到角色记忆</button>{busy && <button type="button" className={button} onClick={() => controller.current?.abort()}>停止生成</button>}</div>
      </div>
    </section>
  </div>;
}
