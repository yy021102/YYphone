import { useEffect, useRef, useState } from 'react';
import { deleteImagePromptPreset, readImagePromptPresets, saveImagePromptPreset } from '../utils/imagePromptPresets';

export function ImagePromptPresets({ value, onChange }: { value: string; onChange: (prompt: string) => void }) {
  const [presets, setPresets] = useState(readImagePromptPresets);
  const [selected, setSelected] = useState(() => readImagePromptPresets().find(item => item.prompt === value)?.id ?? '');
  const [name, setName] = useState(() => readImagePromptPresets().find(item => item.prompt === value)?.name ?? '');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const act = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '预设保存失败，请重试。'); }
    finally { if (alive.current) setBusy(false); }
  };
  const save = (replace: boolean) => act(async () => {
    const preset = await saveImagePromptPreset(name, value, replace ? selected : undefined);
    if (alive.current) { setPresets(readImagePromptPresets()); setSelected(preset.id); setName(preset.name); setNotice('提示词预设已保存。'); }
  });
  return <fieldset aria-label="生图提示词预设" disabled={busy} className="min-w-0 space-y-2 rounded-xl border border-white bg-white/50 p-3">
    <label className="block text-[11px] font-semibold text-[#2C4A5C]">生图提示词预设
      <select aria-label="选择生图提示词预设" value={selected} onChange={event => {
        const id = event.target.value, preset = readImagePromptPresets().find(item => item.id === id);
        setSelected(id); setError(''); setNotice('');
        if (preset) { onChange(preset.prompt); setName(preset.name); }
        else if (id) setError('该预设已不存在，请重新打开对话设置。');
        else setName('');
      }} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal outline-none">
        <option value="">选择已保存的提示词</option>{presets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <div className="flex min-w-0 gap-2">
      <input aria-label="生图提示词预设名称" value={name} maxLength={50} onChange={event => setName(event.target.value)} placeholder="预设名称" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none" />
      <button type="button" disabled={!name.trim() || !value.trim()} onClick={() => void save(false)} className="shrink-0 rounded-lg bg-sky-100 px-3 py-2 text-[11px] font-semibold text-sky-700 disabled:opacity-40">存为新预设</button>
    </div>
    <div className="flex gap-2">
      <button type="button" aria-label="更新生图提示词预设" disabled={!selected || !name.trim() || !value.trim()} onClick={() => void save(true)} className="flex-1 rounded-lg bg-sky-100 py-2 text-[11px] font-semibold text-sky-700 disabled:opacity-40">更新所选预设</button>
      <button type="button" aria-label="删除生图提示词预设" disabled={!selected} onClick={() => void act(async () => {
        await deleteImagePromptPreset(selected);
        if (alive.current) { setPresets(readImagePromptPresets()); setSelected(''); setName(''); setNotice('预设已删除，当前提示词保留。'); }
      })} className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-500 disabled:opacity-40">删除预设</button>
    </div>
    <p className="text-[10px] leading-relaxed text-slate-400">所有角色共用，选择后保存对话设置即可使用。</p>
    {notice && <p role="status" className="text-[10px] text-sky-700">{notice}</p>}
    {error && <p role="alert" className="text-[10px] text-rose-500">{error}</p>}
  </fieldset>;
}
