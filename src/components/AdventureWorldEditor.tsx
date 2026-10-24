import { useState } from 'react';
import { LoaderCircle, Sparkles, X } from 'lucide-react';
import { WORLD_PALETTES, type AdventureWorld, validateAdventureWorld } from './adventureWorldData';
import type { WorldLore } from './textAdventureLore';

type Props = {
  initial: AdventureWorld;
  worldBooks: Array<{ id: string; name: string }>;
  onSave: (entry: AdventureWorld) => void;
  onGenerate: (idea: string) => Promise<AdventureWorld>;
  onClose: () => void;
};
type LoreList = 'rules' | 'factions' | 'npcs' | 'conflicts' | 'secrets';
const fields: Array<{ key: LoreList; label: string; hint: string }> = [
  { key: 'rules', label: '世界规则', hint: '一行一条；说明能力、代价与边界' },
  { key: 'factions', label: '阵营与利益', hint: '一行一个；写清目标和矛盾' },
  { key: 'npcs', label: '关键 NPC', hint: '一行一个；人物、动机与隐瞒' },
  { key: 'conflicts', label: '当前冲突', hint: '一行一条；会自行发展的危机' },
  { key: 'secrets', label: '隐藏真相', hint: '一行一条；仅供剧情主持人使用' },
];

export function AdventureWorldEditor({ initial, worldBooks, onSave, onGenerate, onClose }: Props) {
  const [draft, setDraft] = useState<AdventureWorld>(initial);
  const [listTexts, setListTexts] = useState<Record<LoreList, string>>(() => ({
    rules: initial.lore.rules.join('\n'), factions: initial.lore.factions.join('\n'),
    npcs: initial.lore.npcs.join('\n'), conflicts: initial.lore.conflicts.join('\n'),
    secrets: initial.lore.secrets.join('\n'),
  }));
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const world = draft.world;
  const opening = world.scenes[0];
  const updateWorld = (patch: Partial<typeof world>) => setDraft(previous => ({ ...previous, world: { ...previous.world, ...patch } }));
  const updateOpening = (patch: Partial<typeof opening>) => updateWorld({ scenes: [{ ...opening, ...patch }] });
  const updateLore = (patch: Partial<WorldLore>) => setDraft(previous => ({ ...previous, lore: { ...previous.lore, ...patch } }));
  const generate = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const generated = await onGenerate(idea.trim());
      setDraft({ ...generated, worldBookIds: draft.worldBookIds ?? [], world: { ...generated.world, id: initial.world.id } });
      setListTexts({ rules: generated.lore.rules.join('\n'), factions: generated.lore.factions.join('\n'),
        npcs: generated.lore.npcs.join('\n'), conflicts: generated.lore.conflicts.join('\n'),
        secrets: generated.lore.secrets.join('\n') });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '生成世界失败，请重试。'); }
    finally { setBusy(false); }
  };
  const save = () => {
    try {
      const lists = Object.fromEntries(fields.map(field => [field.key,
        listTexts[field.key].split('\n').map(item => item.trim()).filter(Boolean)])) as Record<LoreList, string[]>;
      onSave(validateAdventureWorld({ ...draft, lore: { ...draft.lore, ...lists } }, initial.world.id));
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '世界内容不完整。'); }
  };
  const input = 'mt-1.5 w-full rounded-xl border border-white/15 bg-[#1d2932] px-3 py-2.5 text-xs leading-5 text-white outline-none placeholder:text-[#82908f] focus:border-[#d6ba90]/70';
  return <div className="fixed inset-0 z-[140] flex items-end justify-center bg-[#070d13]/85 backdrop-blur-sm sm:items-center" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label="编辑异世界" onClick={event => event.stopPropagation()} className="max-h-[94vh] w-full max-w-[540px] overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#16212a] px-5 pb-7 pt-5 text-[#f4eee6] sm:rounded-[26px]">
      <div className="flex items-center justify-between"><div><p className="text-[10px] tracking-[.22em] text-[#d6ba90]">WORLD BUILDER</p><h2 className="mt-1 font-serif text-xl">打造一座异世界</h2></div><button type="button" onClick={onClose} className="rounded-full p-2 text-[#a8b3af]"><X size={20}/></button></div>
      <div className="mt-5 rounded-2xl border border-[#d6ba90]/25 bg-[#d6ba90]/10 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[#e4cda8]"><Sparkles size={15}/>让 AI 帮你构思</p><textarea value={idea} onChange={event => setIdea(event.target.value)} maxLength={1000} rows={3} placeholder="选填：想要的时代、气质、核心冲突、禁忌、NPC……留空也能随机生成。" className={input} /><button type="button" onClick={generate} disabled={busy} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d8be97] py-2.5 text-xs font-semibold text-[#243039] disabled:opacity-50">{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Sparkles size={14}/>} {busy ? '正在构思世界…' : 'AI 生成可编辑草稿'}</button><p className="mt-2 text-[10px] leading-5 text-[#b9aea0]">生成后先检查与修改，保存时才会加入世界列表。</p></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><label className="text-[11px] text-[#c9d0ca]">世界名称<input value={world.title} onChange={event => updateWorld({ title: event.target.value })} maxLength={50} placeholder="例如：无月之城" className={input}/></label><label className="text-[11px] text-[#c9d0ca]">世界类型<input value={world.tag} onChange={event => updateWorld({ tag: event.target.value })} maxLength={30} placeholder="例如：蒸汽奇谭" className={input}/></label></div>
      <label className="mt-3 block text-[11px] text-[#c9d0ca]">一句话简介<input value={world.subtitle} onChange={event => updateWorld({ subtitle: event.target.value })} maxLength={200} className={input}/></label>
      <div className="mt-4"><p className="text-[11px] text-[#c9d0ca]">世界配色</p><div className="mt-2 grid grid-cols-4 gap-2">{WORLD_PALETTES.map(palette => <button key={palette.card} type="button" onClick={() => updateWorld({ card: palette.card, accent: palette.accent })} className={`rounded-xl border px-1 py-2 text-[11px] ${world.card === palette.card ? 'border-white text-white' : 'border-white/10 text-white/70'} bg-gradient-to-br ${palette.card}`}>{palette.label}</button>)}</div></div>
      <label className="mt-5 block text-[11px] text-[#c9d0ca]">核心设定<textarea value={draft.lore.premise} onChange={event => updateLore({ premise: event.target.value })} rows={4} placeholder="历史、日常生活、权力结构，以及表面下真正发生的事" className={input}/></label>
      {fields.map(field => <label key={field.key} className="mt-4 block text-[11px] text-[#c9d0ca]">{field.label}<span className="ml-2 text-[#82908f]">{field.hint}</span><textarea value={listTexts[field.key]} onChange={event => setListTexts(previous => ({ ...previous, [field.key]: event.target.value }))} rows={3} className={input}/></label>)}
      <label className="mt-4 block text-[11px] text-[#c9d0ca]">叙事氛围<textarea value={draft.lore.tone} onChange={event => updateLore({ tone: event.target.value })} rows={2} placeholder="语言质感、节奏、希望避免的套路" className={input}/></label>
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-semibold text-[#e4cda8]">关联世界书</p><p className="mt-1 text-[11px] leading-5 text-[#9eaaa6]">勾选后，世界书条目会参与这个世界的剧情和角色互动。</p>{worldBooks.length ? <div className="mt-3 space-y-2">{worldBooks.map(book => <label key={book.id} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs"><input type="checkbox" checked={(draft.worldBookIds ?? []).includes(book.id)} onChange={event => setDraft(previous => ({ ...previous, worldBookIds: event.target.checked ? [...(previous.worldBookIds ?? []), book.id] : (previous.worldBookIds ?? []).filter(id => id !== book.id) }))} className="accent-[#d8be97]"/>{book.name}</label>)}</div> : <p className="mt-3 text-[11px] text-[#82908f]">暂无世界书，可先在世界书应用中创建。</p>}{(draft.worldBookIds ?? []).some(id => !worldBooks.some(book => book.id === id)) && <p className="mt-2 text-[11px] text-amber-200">有绑定的世界书在当前设备中找不到；导入后可重新选择。</p>}</div>
      <div className="mt-7 border-t border-white/10 pt-5"><p className="font-serif text-lg">固定开场</p><p className="mt-1 text-[11px] text-[#9eaaa6]">开场白与三个选项由你设定；此后的剧情会随行动变化。</p><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-[11px] text-[#c9d0ca]">章节<input value={opening.chapter} onChange={event => updateOpening({ chapter: event.target.value })} className={input}/></label><label className="text-[11px] text-[#c9d0ca]">地点<input value={opening.place} onChange={event => updateOpening({ place: event.target.value })} className={input}/></label></div><label className="mt-3 block text-[11px] text-[#c9d0ca]">场景标题<input value={opening.title} onChange={event => updateOpening({ title: event.target.value })} className={input}/></label><label className="mt-3 block text-[11px] text-[#c9d0ca]">开场白<textarea value={opening.text} onChange={event => updateOpening({ text: event.target.value })} rows={5} className={input}/></label>
        {opening.choices.map((choice, index) => <div key={index} className="mt-3 grid grid-cols-[32px_1fr] items-center gap-2"><span className="text-center font-serif text-lg text-[#d6ba90]">{index + 1}</span><div className="space-y-2"><input value={choice.title} onChange={event => updateOpening({ choices: opening.choices.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} placeholder="选项行动" className={input}/><input value={choice.detail} onChange={event => updateOpening({ choices: opening.choices.map((item, i) => i === index ? { ...item, detail: event.target.value } : item) })} placeholder="可能的方向" className={input}/></div></div>)}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
      <button type="button" onClick={save} disabled={busy} className="mt-6 w-full rounded-xl bg-[#d8be97] py-3 text-sm font-semibold text-[#243039] disabled:opacity-50">保存世界</button>
    </div>
  </div>;
}
