import { useState } from 'react';
import type { JournalRange } from '../utils/journalRange';

export const JournalRegenerator = ({ total, busy, onGenerate }: {
  total: number; busy: boolean; onGenerate: (range: JournalRange) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('1');
  const [end, setEnd] = useState('');
  const first = Number(start);
  const last = end === '' ? total : Number(end);
  const valid = Number.isInteger(first) && Number.isInteger(last) && first >= 1 && last >= first && last <= total;
  return <div className="space-y-2 text-[11px] text-slate-500">
    <button type="button" disabled={busy || total === 0} onClick={() => setOpen(!open)}
      className="rounded-full border border-sky-100 bg-white px-3 py-1.5 text-sky-600 disabled:opacity-50">
      重新生成 / 指定聊天范围
    </button>
    {open && <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
      <p>按当前存档可整理消息从早到晚编号，共 {total} 条。无视旧整理进度，删除后也能重做；默认全部。</p>
      <div className="flex items-center gap-2">
        <span>第</span><input aria-label="重新生成起始条数" type="number" min={1} max={total} value={start}
          disabled={busy} onChange={(event) => setStart(event.target.value)} className="w-20 rounded-lg border p-1.5" />
        <span>至</span><input aria-label="重新生成结束条数" type="number" min={1} max={total} value={end}
          placeholder={String(total)} disabled={busy} onChange={(event) => setEnd(event.target.value)} className="w-20 rounded-lg border p-1.5" /><span>条</span>
      </div>
      <p>包含首尾；每250条生成一篇。重做会替换与所选范围重叠的旧篇及上层压缩摘要，未被覆盖的下层原篇恢复。聊天原文不变；全部成功后才保存。</p>
      <button type="button" disabled={busy || !valid} onClick={() => {
        if (window.confirm(`重新整理第 ${first} 至 ${last} 条？预计 ${Math.ceil((last - first + 1) / 250)} 次请求，将替换重叠的旧流水账。`)) {
          void onGenerate({ start: first, end: last });
        }
      }} className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-700 disabled:opacity-50">
        {busy ? '生成中…' : '确认重新生成'}
      </button>
    </div>}
  </div>;
};
