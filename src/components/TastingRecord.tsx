import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

export function TastingRecord({ createdAt, label, disabled, onDelete, children }: {
  createdAt: string; label: string; disabled: boolean; onDelete: () => Promise<unknown>; children: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  return <>
    <div className="flex items-center justify-between gap-2">
      <small>{new Date(createdAt).toLocaleString('zh-CN')}</small>
      <button type="button" className="shrink-0 rounded-lg p-2 opacity-60 disabled:opacity-25" aria-label={label} disabled={disabled} onClick={() => setConfirm(true)}><Trash2 size={14}/></button>
    </div>
    {children}
    {confirm && <div role="group" aria-label="确认删除这条记录" className="mt-2 rounded-xl bg-white/50 p-3 text-xs">
      <p>删除这条记录？已同步的聊天内容会保留。</p>
      <div className="mt-2 flex gap-4">
        <button type="button" disabled={disabled} onClick={() => void onDelete().then(() => setConfirm(false))}>确认删除</button>
        <button type="button" disabled={disabled} onClick={() => setConfirm(false)}>保留</button>
      </div>
    </div>}
  </>;
}
