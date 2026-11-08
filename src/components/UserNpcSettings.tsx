import { useEffect, useRef, useState } from 'react';
import { Pencil, Unlink, Users } from 'lucide-react';
import { hasNpcOwners, type CharacterNpc } from '../utils/characterNpcs';
import { compressImageFile } from '../utils/imageFile';
import { DocumentTextImport } from './DocumentTextImport';

const empty = { id: '', name: '', avatarUrl: '', persona: '' };
export function UserNpcSettings({ personaId, npcs, onSave }: {
  personaId: string; npcs: CharacterNpc[]; onSave: (npcs: CharacterNpc[]) => boolean;
}) {
  const [draft, setDraft] = useState(empty), [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const linked = npcs.filter(npc => npc.linkedUserIds?.includes(personaId));
  const available = npcs.filter(npc => !npc.linkedUserIds?.includes(personaId));
  const save = (next: CharacterNpc[]) => { try {
    if (!onSave(next)) { setError('保存失败，请重试。'); return false; }
    setError(''); return true;
  } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试。'); return false; } };
  const upload = async (file?: File) => {
    if (!file) return; setBusy(true); setError('');
    const id = draft.id;
    try { const avatarUrl = await compressImageFile(file); if (alive.current) setDraft(current => current.id === id ? { ...current, avatarUrl } : current); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '图片处理失败。'); }
    finally { if (alive.current) setBusy(false); }
  };
  return <details className="rounded-2xl border border-white bg-white/50 p-3">
    <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#526D80]"><Users className="h-4 w-4" />关联 NPC<span className="ml-auto text-[10px] font-normal text-slate-400">{linked.length}</span></summary>
    <div className="mt-3 space-y-3">
      <p className="text-[10px] text-slate-400">关联随当前人设保存，可与角色共享同一个 NPC。</p>
      {linked.map(npc => <div key={npc.id} className="flex items-start gap-2 rounded-xl bg-white/80 p-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-100 to-pink-100 text-xs text-slate-500">{npc.avatarUrl ? <img src={npc.avatarUrl} alt="" className="h-full w-full object-cover" /> : npc.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold text-slate-600">{npc.name}</p><p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-400 line-clamp-3">{npc.persona}</p></div>
        <button type="button" disabled={busy} aria-label={`编辑${npc.name}`} onClick={() => setDraft({ id: npc.id, name: npc.name, avatarUrl: npc.avatarUrl, persona: npc.persona })} className="p-1 text-slate-400"><Pencil size={13} /></button>
        <button type="button" disabled={busy} aria-label={`解除关联${npc.name}`} onClick={() => {
          const next = npcs.map(item => item.id === npc.id ? { ...item, linkedUserIds: item.linkedUserIds?.filter(id => id !== personaId) } : item).filter(hasNpcOwners);
          if (save(next) && draft.id === npc.id) setDraft(empty);
        }} className="p-1 text-rose-300"><Unlink size={13} /></button>
      </div>)}
      <div className="space-y-2 rounded-xl bg-white/70 p-3">
        <p className="text-[11px] font-semibold text-slate-600">{draft.id ? '编辑 NPC' : '新建并关联 NPC'}</p>
        {draft.id && <p className="text-[10px] text-slate-400">共享 NPC 的资料修改会同步到其他关联。</p>}
        <label className="block text-[10px] text-slate-500">NPC 名称<input aria-label="用户关联 NPC 名称" value={draft.name} maxLength={80} onChange={e => setDraft({ ...draft, name: e.target.value })} className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-xs outline-none" /></label>
        <label className="block text-[10px] text-slate-500">头像链接<input aria-label="用户关联 NPC 头像链接" value={draft.avatarUrl} onChange={e => setDraft({ ...draft, avatarUrl: e.target.value })} className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-xs outline-none" /></label>
        <label className="block text-[10px] text-slate-500">上传 NPC 头像<input type="file" accept="image/*" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = ''; }} className="mt-1 block w-full text-[10px]" /></label>
        <label className="block text-[10px] text-slate-500">人物设定<textarea aria-label="用户关联 NPC 设定" value={draft.persona} onChange={e => setDraft({ ...draft, persona: e.target.value })} rows={4} placeholder="性格、背景、与你的关系，例如家人、朋友或同事" className="mt-1 w-full resize-y rounded-xl border border-white bg-white px-3 py-2 text-xs leading-relaxed outline-none" /></label>
        <DocumentTextImport key={draft.id || 'new-user-npc'} label="用户关联NPC人设" value={draft.persona} onChange={persona => setDraft(current => ({ ...current, persona }))} />
        <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => {
          if (!draft.name.trim()) { setError('请填写 NPC 名称。'); return; }
          const existing = npcs.find(npc => npc.id === draft.id);
          if (draft.id && !existing) { setError('这个 NPC 已不存在，请重新选择。'); return; }
          const npc: CharacterNpc = { ...existing, ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim(), persona: draft.persona.trim(), avatarUrl: draft.avatarUrl.trim(), linkedCharIds: existing?.linkedCharIds ?? [], linkedUserIds: [...new Set([...(existing?.linkedUserIds ?? []), personaId])] };
          if (save(existing ? npcs.map(item => item.id === npc.id ? npc : item) : [...npcs, npc])) setDraft(empty);
        }} className="flex-1 rounded-xl bg-gradient-to-r from-sky-100 to-pink-100 px-3 py-2 text-[11px] font-semibold text-[#5C7488] disabled:opacity-40">{draft.id ? '保存 NPC 修改' : '新建并关联 NPC'}</button>
        {draft.id && <button type="button" disabled={busy} onClick={() => setDraft(empty)} className="px-2 text-[10px] text-slate-400">取消</button>}</div>
      </div>
      {available.length > 0 && <div className="space-y-2 rounded-xl bg-white/60 p-3">
        <p className="text-[11px] font-semibold text-slate-500">绑定已有 NPC</p>
        <div className="max-h-36 space-y-1 overflow-y-auto">{available.map(npc => <label key={npc.id} className="flex items-center gap-2 py-1 text-[11px] text-slate-600"><input type="checkbox" checked={selected.includes(npc.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, npc.id] : ids.filter(id => id !== npc.id))} />{npc.name}</label>)}</div>
        <button type="button" disabled={!selected.length} onClick={() => { if (save(npcs.map(npc => selected.includes(npc.id) ? { ...npc, linkedUserIds: [...new Set([...(npc.linkedUserIds ?? []), personaId])] } : npc))) setSelected([]); }} className="w-full rounded-xl bg-sky-50 py-2 text-[11px] font-semibold text-sky-700 disabled:opacity-40">绑定所选 NPC</button>
      </div>}
      {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
    </div>
  </details>;
}
