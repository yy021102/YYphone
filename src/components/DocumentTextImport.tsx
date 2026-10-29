import { useEffect, useRef, useState } from 'react';
import { readTextDocument, TEXT_DOCUMENT_ACCEPT } from '../utils/textDocument';

export function DocumentTextImport({ label, value, onChange, includeHyperlinks = false }: {
  label: string; value: string; onChange: (text: string) => void; includeHyperlinks?: boolean;
}) {
  const [mode, setMode] = useState('append'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), latest = useRef(value); latest.current = value;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return <div className="mt-2 space-y-1.5">
    <div className="flex items-center gap-2">
      <label className={`cursor-pointer rounded-lg bg-sky-50 px-3 py-1.5 text-[10px] font-semibold text-sky-700 ${busy ? 'opacity-50' : ''}`}>{busy ? '读取中…' : '导入 TXT / Word'}<input type="file" accept={TEXT_DOCUMENT_ACCEPT} aria-label={`导入${label}文档`} disabled={busy} className="hidden" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        const before = value, selectedMode = mode;
        setBusy(true); setError('');
        void readTextDocument(file, includeHyperlinks).then(text => {
          if (!alive.current) return;
          if (latest.current !== before) throw new Error('读取期间文本已修改，请重新导入。');
          onChange(selectedMode === 'append' && before.trim() ? `${before}\n\n${text}` : text);
        }).catch(cause => { if (alive.current) setError(cause instanceof Error ? cause.message : '文档读取失败。'); })
          .finally(() => { if (alive.current) setBusy(false); });
      }} /></label>
      {!!value.trim() && <select aria-label={`${label}文档导入方式`} disabled={busy} value={mode} onChange={event => setMode(event.target.value)} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-normal text-slate-500"><option value="append">追加内容</option><option value="replace">替换内容</option></select>}
    </div>
    {error && <p role="alert" className="text-[10px] font-normal text-rose-500">{error}</p>}
  </div>;
}
