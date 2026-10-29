import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Backpack, BookOpen, Compass, Download, Flame, LoaderCircle, MessageCircle, Pause, Play, Plus, RotateCcw, ScrollText, Send, Share2, Shield, Sparkles, Upload, Users, X } from 'lucide-react';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { AdventureWorldEditor } from './AdventureWorldEditor';
import { blankWorld, builtinWorlds, CUSTOM_WORLDS_KEY, isCustomWorlds, validateAdventureWorld, type AdventureWorld, type CustomWorlds } from './adventureWorldData';
import { SceneArtwork, type Choice, type Scene, type WorldId } from './textAdventureWorlds';

export type AdventureRequest = {
  worldId: WorldId;
  companionId: string;
  world: AdventureWorld;
  turn: number;
  scene: Scene;
  decision: string;
  decisionBy: 'player' | 'companion';
  recentEvents: string[];
  summaries: string[];
  items: string[];
  stats: { courage: number; insight: number; fate: number };
  recentInteractions: Array<{ role: 'user' | 'companion'; text: string }>;
};
export type AdventureBeat = { scene: Scene; companionAction: string; summary: string; gainedItem: string };
export type AdventureInteractionRequest = {
  world: AdventureWorld; companionId: string; scene: Scene; turn: number;
  message: string; recentEvents: string[]; latestSummary: string;
  interactions: Array<{ role: 'user' | 'companion'; text: string }>;
};
export type AdventureShare = {
  id: string; worldTitle: string; worldTag: string; turn: number;
  chapter: string; place: string; sceneTitle: string; progress: string;
  companionId: string; companionName: string; status: 'paused' | 'completed';
};
type Props = {
  userName: string;
  contacts: Array<{ id: string; name: string }>;
  worldBooks: Array<{ id: string; name: string }>;
  onAdvance: (request: AdventureRequest) => Promise<AdventureBeat>;
  onInteract: (request: AdventureInteractionRequest) => Promise<string>;
  onGenerateWorld: (idea: string) => Promise<AdventureWorld>;
  onShare: (snapshot: AdventureShare, recipients: string[]) => void;
};
export type AdventureSession = {
  worldId: WorldId; companionId: string; turn: number; scene: Scene;
  stats: { courage: number; insight: number; fate: number };
  items: string[]; events: string[]; summaries: string[]; companionAction: string;
  interactions?: Array<{ role: 'user' | 'companion'; text: string }>;
  pausedAt?: string; endedAt?: string;
};
type Sessions = Record<string, AdventureSession>;
export const adventureSessionKey = (worldId: string, companionId: string) => JSON.stringify([worldId, companionId]);
/** Legacy saves used only the world ID; keep each journey under its actual companion. */
export const restoreAdventureSessions = (saved: Sessions): Sessions => Object.fromEntries(
  Object.values(saved).map(session => [adventureSessionKey(session.worldId, session.companionId), session])
);
const KEY = 'yyppphh_text_adventure_sessions_v1';
const isSessionMap = (value: unknown): value is Sessions => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(item => item && typeof item === 'object'
    && typeof item.worldId === 'string' && typeof item.companionId === 'string'
    && typeof item.turn === 'number' && item.scene && typeof item.scene === 'object'
    && typeof item.scene.title === 'string' && typeof item.scene.text === 'string'
    && Array.isArray(item.scene.choices) && Array.isArray(item.events)
    && Array.isArray(item.summaries) && Array.isArray(item.items)
    && item.stats && typeof item.stats === 'object');
};

function initialSession(entry: AdventureWorld, companionId: string): AdventureSession {
  return { worldId: entry.world.id, companionId, turn: 0, scene: entry.world.scenes[0], stats: { courage: 0, insight: 0, fate: 0 }, items: [], events: [], summaries: [], companionAction: '', interactions: [] };
}

export function parseAdventureBeat(value: Record<string, unknown>, turn: number, requireCompanion = false): AdventureBeat {
  const string = (item: unknown, name: string, max: number) => {
    if (typeof item !== 'string' || !item.trim()) throw new Error(`剧情缺少${name}，请重试。`);
    return item.trim().slice(0, max);
  };
  const rawChoices = value.choices;
  if (!Array.isArray(rawChoices) || rawChoices.length < 2 || rawChoices.length > 4) throw new Error('剧情选项格式不正确，请重试。');
  const choices: Choice[] = rawChoices.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error('剧情选项格式不正确，请重试。');
    const entry = raw as Record<string, unknown>;
    const trait = entry.trait;
    return {
      title: string(entry.title, `选项${index + 1}标题`, 50),
      detail: string(entry.detail, `选项${index + 1}说明`, 100),
      ...(trait === 'courage' ? { courage: 1 } : trait === 'insight' ? { insight: 1 } : trait === 'fate' ? { fate: 1 } : {}),
    };
  });
  const reply = value.reply;
  const text = Array.isArray(reply) && typeof reply[0] === 'string' ? reply[0] : '';
  const scene: Scene = {
    chapter: string(value.chapter, '章节', 40), place: string(value.place, '地点', 50),
    title: string(value.title, '标题', 70), text: string(text, '正文', 1800), choices,
  };
  if (requireCompanion && (typeof value.companionAction !== 'string' || !value.companionAction.trim())) {
    throw new Error('剧情缺少同行角色的反应，请重试。');
  }
  return {
    scene,
    companionAction: typeof value.companionAction === 'string' ? value.companionAction.trim().slice(0, 320) : '',
    summary: turn % 4 === 0 && typeof value.summary === 'string' ? value.summary.trim().slice(0, 1000) : '',
    gainedItem: typeof value.gainedItem === 'string' ? value.gainedItem.trim().slice(0, 30) : '',
  };
}

export function TextAdventureSimulator({ userName, contacts, worldBooks, onAdvance, onInteract, onGenerateWorld, onShare }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<Sessions>(() => restoreAdventureSessions(readStoredValue(KEY, {} as Sessions, isSessionMap)));
  const [customWorlds, setCustomWorlds] = useState<CustomWorlds>(() => readStoredValue(CUSTOM_WORLDS_KEY, {} as CustomWorlds, isCustomWorlds));
  const [worldId, setWorldId] = useState<WorldId | null>(null);
  const [companionId, setCompanionId] = useState('');
  const [panel, setPanel] = useState<'story' | 'bag' | 'journal' | 'codex'>('story');
  const [draft, setDraft] = useState('');
  const [talkDraft, setTalkDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRecipients, setShareRecipients] = useState<string[]>([]);
  const [shareNotice, setShareNotice] = useState('');
  const [editing, setEditing] = useState<AdventureWorld | null>(null);
  const builtin = builtinWorlds();
  const allWorlds = [...builtin.map(entry => customWorlds[entry.world.id] ?? entry),
    ...Object.values(customWorlds).filter(entry => !builtin.some(item => item.world.id === entry.world.id))];
  const session = worldId ? sessions[adventureSessionKey(worldId, companionId)] : undefined;
  const entry = allWorlds.find(item => item.world.id === worldId);
  const world = entry?.world;
  const companion = contacts.find(item => item.id === session?.companionId);

  const save = (next: Sessions) => {
    // An older request may finish after another journey was opened; update only its own save.
    const latest = restoreAdventureSessions(readStoredValue(KEY, {} as Sessions, isSessionMap));
    const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== sessions[key]));
    const merged = { ...latest, ...changes };
    setSessions(merged); writeStoredValue(KEY, merged);
  };
  const saveWorlds = (next: CustomWorlds) => { setCustomWorlds(next); writeStoredValue(CUSTOM_WORLDS_KEY, next); };
  useEffect(() => { rootRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [worldId, session?.turn]);

  const enter = (id: WorldId) => {
    const selected = allWorlds.find(item => item.world.id === id);
    if (!selected) return;
    const key = adventureSessionKey(id, companionId);
    if (!sessions[key]) save({ ...sessions, [key]: initialSession(selected, companionId) });
    setWorldId(id); setPanel('story'); setError(''); setDraft('');
  };
  const restart = () => {
    if (!worldId || !entry || busy) return;
    save({ ...sessions, [adventureSessionKey(worldId, companionId)]: initialSession(entry, companionId) });
    setConfirmRestart(false); setPanel('story'); setDraft(''); setError('');
  };
  const advance = async (decision: string, by: 'player' | 'companion', choice?: Choice) => {
    if (!session || !entry || session.pausedAt || session.endedAt || busy || !decision.trim()) return;
    setBusy(true); setError('');
    const nextTurn = session.turn + 1;
    const choiceEvent = `${by === 'companion' ? companion?.name ?? '同行者' : userName}：${decision.trim()}`;
    try {
      const nextStats = {
        courage: session.stats.courage + (choice?.courage ?? 0),
        insight: session.stats.insight + (choice?.insight ?? 0),
        fate: session.stats.fate + (choice?.fate ?? 0),
      };
      const introItem = session.turn === 0 ? choice?.item : undefined;
      const provisionalItems = introItem && !session.items.includes(introItem) ? [...session.items, introItem] : session.items;
      const beat = await onAdvance({ worldId: session.worldId, world: entry, companionId: session.companionId, turn: nextTurn,
        scene: session.scene, decision: decision.trim(), decisionBy: by,
        recentEvents: session.events.slice(-12), summaries: session.summaries, items: provisionalItems, stats: nextStats,
        recentInteractions: (session.interactions ?? []).slice(-12) });
      const nextItems = beat.gainedItem && !provisionalItems.includes(beat.gainedItem)
        ? [...provisionalItems, beat.gainedItem] : provisionalItems;
      const events = [...session.events, `${session.scene.chapter}｜${choiceEvent}`,
        `${beat.scene.chapter}｜${beat.scene.title}：${beat.scene.text.slice(0, 150)}${beat.gainedItem ? `；获得${beat.gainedItem}` : ''}`,
        ...(companion && beat.companionAction ? [`${companion.name}｜${beat.companionAction}`] : [])];
      const summary = nextTurn % 4 === 0
        ? beat.summary || `${session.summaries.at(-1) ?? ''}；第${nextTurn - 3}—${nextTurn}回合：${events.slice(-8).join('；')}`.slice(-1000) : '';
      save({ ...sessions, [adventureSessionKey(session.worldId, session.companionId)]: { ...session, turn: nextTurn, scene: beat.scene, stats: nextStats,
        items: nextItems, events, summaries: summary ? [...session.summaries, summary] : session.summaries,
        companionAction: beat.companionAction } });
      setDraft(''); setPanel('story');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '剧情生成失败，请重试。'); }
    finally { setBusy(false); }
  };

  const interact = async () => {
    if (!session || !entry || !session.companionId || session.pausedAt || session.endedAt || busy || !talkDraft.trim()) return;
    const message = talkDraft.trim();
    setBusy(true); setError('');
    try {
      const answer = await onInteract({ world: entry, companionId: session.companionId, scene: session.scene,
        turn: session.turn, message, recentEvents: session.events.slice(-10), latestSummary: session.summaries.at(-1) ?? '',
        interactions: (session.interactions ?? []).slice(-16) });
      if (!answer.trim()) throw new Error('同行角色没有回答，请重试。');
      const interactions = [...(session.interactions ?? []), { role: 'user' as const, text: message },
        { role: 'companion' as const, text: answer.trim() }].slice(-200);
      save({ ...sessions, [adventureSessionKey(session.worldId, session.companionId)]: { ...session, interactions } });
      setTalkDraft('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '交流失败，请重试。'); }
    finally { setBusy(false); }
  };

  const exportWorld = (selected: AdventureWorld) => {
    const blob = new Blob([JSON.stringify({ format: 'yyppphh-adventure-world-v1', ...selected }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${selected.world.title || '异世界'}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importWorld = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      if (file.size > 2_000_000) throw new Error('世界文件不能超过 2 MB。');
      const parsed: unknown = JSON.parse(await file.text());
      const imported = validateAdventureWorld(parsed, `custom-${crypto.randomUUID()}`);
      saveWorlds({ ...customWorlds, [imported.world.id]: imported });
      setEditing(imported);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法导入世界文件。'); }
    if (importRef.current) importRef.current.value = '';
  };
  const beginShare = () => {
    if (!session || busy) return;
    if (!session.pausedAt && !session.endedAt) save({ ...sessions, [adventureSessionKey(session.worldId, session.companionId)]: { ...session, pausedAt: new Date().toISOString() } });
    setShareRecipients(contacts.some(contact => contact.id === session.companionId) ? [session.companionId] : []);
    setShareNotice(''); setShareOpen(true);
  };
  const share = () => {
    if (!session || !world || shareRecipients.length === 0) return;
    const snapshot: AdventureShare = {
      id: crypto.randomUUID(), worldTitle: world.title, worldTag: world.tag, turn: session.turn,
      chapter: session.scene.chapter, place: session.scene.place, sceneTitle: session.scene.title,
      progress: `${session.summaries.at(-1) ? `${session.summaries.at(-1)}\n` : ''}当前场景：${session.scene.text}`.slice(0, 600),
      companionId: session.companionId, companionName: companion?.name ?? '',
      status: session.endedAt ? 'completed' : 'paused',
    };
    onShare(snapshot, shareRecipients);
    setShareNotice(`已把${session.endedAt ? '完结' : '暂停'}进度分享给 ${shareRecipients.length} 位角色。`);
    setShareOpen(false);
  };

  return <div ref={rootRef} className="text-adventure-app relative flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-[#11171c] text-[#f6f0e7]">
    {!world || !session ? <div className="mx-auto max-w-[520px] px-4 pb-12 pt-7">
      <div className="mb-7"><p className="text-[10px] font-bold tracking-[.3em] text-[#d4b79a]">PORTAL · STORY WORLDS</p><h2 className="mt-3 font-serif text-3xl font-semibold tracking-wide">下一段人生，<br/>从这里开始。</h2><p className="mt-3 text-xs leading-6 text-[#b7b9b8]">选一座世界，或亲手创造一座。你和同行者的决定会留下真实的痕迹。</p></div>
      <label className="mb-5 block rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-[#c5c8c5]">同行角色 <span className="text-[#8d9692]">· 可选</span><select value={companionId} onChange={event => setCompanionId(event.target.value)} className="mt-2 w-full rounded-lg bg-[#243037] px-3 py-2.5 text-sm text-white outline-none"><option value="">独自踏上旅途</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
      <div className="mb-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditing(blankWorld())} className="flex items-center justify-center gap-2 rounded-xl border border-[#d5bc99]/45 bg-[#d5bc99]/10 py-3 text-xs text-[#e5cfac]"><Plus size={15}/>新增 / AI 创造</button><button type="button" onClick={() => importRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-xs text-[#d8ddd8]"><Upload size={15}/>导入世界</button><input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void importWorld(event.target.files?.[0])}/></div>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
      <div className="space-y-3">{allWorlds.map((entry, index) => { const option = entry.world; return <button key={option.id} type="button" onClick={() => enter(option.id)} className={`group relative block min-h-40 w-full overflow-hidden rounded-[22px] bg-gradient-to-br ${option.card} p-5 text-left shadow-[0_15px_30px_rgba(0,0,0,.2)] active:scale-[.98]`}><div className="absolute -right-7 -top-9 h-40 w-40 rounded-full border border-white/15"/><div className="absolute -right-2 top-3 h-28 w-28 rounded-full border border-white/20"/><div className="absolute bottom-0 right-3 text-[85px] leading-none opacity-20">{index === 0 ? '✦' : index === 1 ? '☯' : index === 2 ? '☾' : '✧'}</div><span className="relative rounded-full border border-white/40 px-2 py-1 text-[10px] tracking-widest text-white/90">{option.tag}</span><h3 className="relative mt-5 font-serif text-2xl font-bold tracking-wider">{option.title}</h3><p className="relative mt-2 max-w-[82%] text-xs leading-5 text-white/80">{option.subtitle}</p><span className="relative mt-3 block text-[11px] text-white/90">{sessions[adventureSessionKey(option.id, companionId)] ? `${sessions[adventureSessionKey(option.id, companionId)]!.endedAt ? '已结束' : sessions[adventureSessionKey(option.id, companionId)]!.pausedAt ? '已暂停' : '继续旅程'} · 第 ${sessions[adventureSessionKey(option.id, companionId)]!.turn + 1} 回合` : '开启新旅程'}</span><ArrowRight className="absolute bottom-5 right-5 h-5 w-5"/></button>; })}</div>
      <p className="mt-6 text-center text-[11px] text-[#7f8d8a]">旅程保存在当前设备 · 动态剧情需要聊天 API</p>
    </div> : <div className="mx-auto min-h-full max-w-[540px] bg-[#171e23]">
      <div className="relative h-52 overflow-hidden bg-[#263540]"><SceneArtwork world={world.id}/><div className="absolute inset-0 bg-gradient-to-t from-[#171e23] via-transparent to-black/30"/><button type="button" onClick={() => setWorldId(null)} aria-label="返回世界选择" className="absolute left-4 top-4 rounded-full border border-white/30 bg-black/30 p-2 backdrop-blur"><ArrowLeft className="h-4 w-4"/></button><div className="absolute right-4 top-4 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-[10px] tracking-widest backdrop-blur">{world.tag}</div><div className="absolute bottom-4 left-5"><p className="text-[10px] tracking-[.25em]" style={{ color: world.accent }}>{session.scene.chapter} · 第 {session.turn + 1} 回合</p><h2 className="mt-1 font-serif text-2xl font-bold">{world.title}</h2></div></div>
      <div className="relative px-4 pb-12"><div className="-mt-1 flex items-center gap-2 text-[11px] text-[#a9b6b4]"><Compass className="h-3.5 w-3.5"/>{session.scene.place}<span className="ml-auto">{userName}{companion ? ` · 与${companion.name}同行` : ' · 独行'}</span></div>
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditing(entry)} className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-[#d5dcd5]">编辑世界</button><button type="button" onClick={() => exportWorld(entry)} className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-[#d5dcd5]"><Download size={12}/>导出世界</button></div>
        {(entry.worldBookIds ?? []).length > 0 && <p className="mt-2 text-right text-[10px] text-[#b9c9bd]">已绑定世界书：{worldBooks.filter(book => (entry.worldBookIds ?? []).includes(book.id)).map(book => book.name).join('、') || '当前设备缺少对应世界书'}</p>}
        <div className="mt-4 rounded-2xl border border-[#d7bd97]/25 bg-[#d7bd97]/[0.07] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11px] text-[#dfcfb5]">{session.endedAt ? '旅程已结束 · 可以分享结局' : session.pausedAt ? '旅程已暂停 · 随时可以继续' : '旅程进行中 · 可以暂停分享'}</span><span className="text-lg text-[#d7bd97]">✧</span></div>{shareNotice && <p className="mt-1 text-[10px] text-[#bad3c3]">{shareNotice}</p>}<div className="mt-2 flex gap-2">{!session.endedAt && (session.pausedAt ? <button type="button" onClick={() => save({ ...sessions, [adventureSessionKey(session.worldId, session.companionId)]: { ...session, pausedAt: undefined } })} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#d7bd97] py-2 text-[11px] font-semibold text-[#25323a]"><Play size={12}/>继续旅程</button> : <button type="button" onClick={beginShare} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#d7bd97] py-2 text-[11px] font-semibold text-[#25323a] disabled:opacity-40"><Pause size={12}/>暂停并分享</button>)}{(session.pausedAt || session.endedAt) && <button type="button" onClick={beginShare} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#d7bd97]/40 py-2 text-[11px] text-[#e8d1ac]"><Share2 size={12}/>分享进度卡</button>}{!session.endedAt && <button type="button" onClick={() => setConfirmEnd(true)} disabled={busy} className="flex-1 rounded-lg border border-white/15 py-2 text-[11px] text-[#aebdb7] disabled:opacity-40">结束旅程</button>}</div></div>
        <div className="mt-5 grid grid-cols-3 gap-2">{([{ icon: Shield, label: '胆识', value: session.stats.courage }, { icon: Sparkles, label: '洞察', value: session.stats.insight }, { icon: Flame, label: '命数', value: session.stats.fate }] as const).map(({ icon: Icon, label, value }) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><div className="flex items-center gap-1.5 text-[10px] text-[#aab6b0]"><Icon className="h-3.5 w-3.5"/>{label}</div><p className="mt-1 font-serif text-lg" style={{ color: world.accent }}>{String(value).padStart(2, '0')}</p></div>)}</div>
        <div className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10 pb-3">{([{ id: 'story', label: '剧情', icon: BookOpen }, { id: 'bag', label: '行囊', icon: Backpack }, { id: 'journal', label: '旅程', icon: ScrollText }, { id: 'codex', label: '世界', icon: Users }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setPanel(id)} className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs ${panel === id ? 'bg-white/10 text-white' : 'text-[#85928f]'}`}><Icon className="h-3.5 w-3.5"/>{label}</button>)}</div>
        {panel === 'story' && <><div className="mt-6"><div className="flex items-center gap-2"><span className="h-px w-6" style={{ background: world.accent }}/><span className="text-[10px] tracking-[.2em] text-[#a3aaa7]">命运正在展开</span></div><h3 className="mt-3 font-serif text-[23px] font-semibold leading-8">{session.scene.title}</h3><p className="mt-4 whitespace-pre-wrap border-l-2 pl-4 text-[14px] leading-8 text-[#d1d3cf]" style={{ borderColor: world.accent }}>{session.scene.text}</p></div>
          {session.companionAction && companion && <div className="mt-5 rounded-xl border border-[#baa681]/25 bg-[#baa681]/10 px-4 py-3"><p className="text-[10px] tracking-widest" style={{ color: world.accent }}>{companion.name}的行动</p><p className="mt-2 text-xs leading-6 text-[#d8d1c3]">{session.companionAction}</p></div>}
          {companion && <div className="mt-5 rounded-2xl border border-white/10 bg-[#1e2a31] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[#e4d0ae]"><MessageCircle size={15}/>与{companion.name}说话 <span className="ml-auto text-[10px] font-normal text-[#84928e]">不推进剧情</span></p><div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{(session.interactions ?? []).length ? (session.interactions ?? []).slice(-12).map((message, index) => <div key={index} className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-5 ${message.role === 'user' ? 'ml-auto bg-[#547267] text-white' : 'bg-[#344147] text-[#eeeae2]'}`}><span className="mb-1 block text-[10px] opacity-65">{message.role === 'user' ? userName : companion.name}</span>{message.text}</div>) : <p className="py-3 text-center text-[11px] text-[#82908d]">可以问 TA 的看法，也可以闲聊片刻。</p>}</div>{!session.pausedAt && !session.endedAt && <div className="mt-3 flex gap-2"><input value={talkDraft} onChange={event => setTalkDraft(event.target.value)} maxLength={500} disabled={busy} onKeyDown={event => { if (event.key === 'Enter') void interact(); }} placeholder={`对${companion.name}说些什么…`} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#172229] px-3 py-2.5 text-xs text-white outline-none placeholder:text-[#82908d]"/><button type="button" onClick={() => void interact()} disabled={busy || !talkDraft.trim()} className="rounded-xl bg-[#d7bd97] px-3 text-[#23313a] disabled:opacity-40" aria-label="发送给同行角色"><Send size={15}/></button></div>}</div>}
          {!session.pausedAt && !session.endedAt && <><div className="mt-8 space-y-2.5"><p className="mb-3 text-[10px] font-bold tracking-[.2em] text-[#919c98]">做出你的选择</p>{session.scene.choices.map((choice, index) => <button key={`${choice.title}-${index}`} type="button" disabled={busy} onClick={() => advance(choice.title, 'player', choice)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#222d31] px-4 py-3.5 text-left hover:border-white/30 active:bg-[#34433f] disabled:opacity-50"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/25 font-serif text-xs" style={{ color: world.accent }}>{index + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{choice.title}</span><span className="mt-1 block text-[11px] text-[#9baaa4]">{choice.detail}</span></span><ArrowRight className="h-4 w-4 text-[#84928d]"/></button>)}</div><div className="mt-5 flex gap-2"><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={400} disabled={busy} onKeyDown={event => { if (event.key === 'Enter') advance(draft, 'player'); }} placeholder="或者，直接说出你的行动…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#222d31] px-3 text-xs text-white outline-none placeholder:text-[#82908d]"/><button type="button" onClick={() => advance(draft, 'player')} disabled={busy || !draft.trim()} aria-label="提交自由行动" className="rounded-xl px-3 py-3 text-[#d6c2a2] disabled:opacity-40" style={{ background: '#2d393c' }}><Send className="h-4 w-4"/></button></div>{companion && <button type="button" onClick={() => advance('由同行角色根据自身判断决定下一步行动；不要替玩家做决定。', 'companion')} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#c6ad87]/35 py-3 text-xs text-[#ddc9a9] disabled:opacity-40"><Users size={14}/>让{companion.name}决定下一步</button>}</>}
          {busy && <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#d0c1a7]"><LoaderCircle size={15} className="animate-spin"/>世界正在回应你们的行动…</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-200">{error}</p>}
        </>}
        {panel === 'bag' && <div className="mt-6"><h3 className="font-serif text-xl">随身行囊</h3><p className="mt-2 text-xs text-[#8d9a96]">物品从选择中获得，新的线索会在剧情里留下痕迹。</p>{session.items.length ? <div className="mt-5 grid grid-cols-2 gap-2">{session.items.map(item => <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs"><Backpack className="h-4 w-4" style={{ color: world.accent }}/>{item}</div>)}</div> : <p className="mt-8 rounded-xl border border-dashed border-white/15 p-7 text-center text-xs text-[#8d9a96]">行囊还是空的</p>}</div>}
        {panel === 'journal' && <div className="mt-6"><h3 className="font-serif text-xl">旅程记录</h3><p className="mt-2 text-xs text-[#8d9a96]">每四回合整理一次剧情纪要，供后续剧情接续。</p>{session.summaries.map((summary, index) => <div key={index} className="mt-4 rounded-xl border border-[#bda783]/25 bg-[#bda783]/10 p-4"><p className="text-[10px] tracking-widest text-[#d0b78f]">第 {index * 4 + 1}—{(index + 1) * 4} 回合纪要</p><p className="mt-2 text-xs leading-6 text-[#d5d4cd]">{summary}</p></div>)}{session.events.length ? <div className="mt-5 space-y-3 border-l border-white/15 pl-4">{session.events.map((entry, index) => <p key={index} className="relative text-xs leading-6 text-[#c6d0c8]"><span className="absolute -left-[21px] top-2 h-2 w-2 rounded-full" style={{ background: world.accent }}/>{entry}</p>)}</div> : <p className="mt-8 rounded-xl border border-dashed border-white/15 p-7 text-center text-xs text-[#8d9a96]">第一步还没有写下</p>}</div>}
        {panel === 'codex' && <div className="mt-6 space-y-5"><div><h3 className="font-serif text-xl">世界档案</h3><p className="mt-2 text-xs leading-6 text-[#bec7c2]">{world.subtitle}</p></div><div><p className="text-[10px] tracking-widest text-[#d5bc99]">正在酝酿的冲突</p>{entry.lore.conflicts.map(item => <p key={item} className="mt-2 border-l border-[#d5bc99]/40 pl-3 text-xs leading-6 text-[#bbc4bd]">{item}</p>)}</div><div><p className="text-[10px] tracking-widest text-[#d5bc99]">活在这里的人</p>{entry.lore.npcs.map(item => <p key={item} className="mt-2 border-l border-[#d5bc99]/40 pl-3 text-xs leading-6 text-[#bbc4bd]">{item.split('：')[0]}</p>)}</div><p className="text-[11px] text-[#8e9994]">档案只记录表面线索。更深的秘密要在旅途中发现。</p></div>}
        <button type="button" onClick={() => setConfirmRestart(true)} className="mt-9 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-xs text-[#8d9a96]"><RotateCcw size={14}/>重开这个世界</button>
      </div>
    </div>}
    {confirmRestart && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-6"><div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#263038] p-5"><button type="button" onClick={() => setConfirmRestart(false)} className="float-right text-[#a9b3ad]"><X size={18}/></button><h3 className="font-serif text-lg">重开这个世界？</h3><p className="mt-3 text-xs leading-6 text-[#bfc8c2]">当前世界的剧情、行囊和纪要会从序章重新开始。</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => setConfirmRestart(false)} className="flex-1 rounded-xl border border-white/20 py-2.5 text-xs">再想想</button><button type="button" onClick={restart} className="flex-1 rounded-xl bg-[#dcc29e] py-2.5 text-xs font-semibold text-[#263038]">确认重开</button></div></div></div>}
    {confirmEnd && session && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-6"><div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#263038] p-5"><button type="button" onClick={() => setConfirmEnd(false)} className="float-right text-[#a9b3ad]"><X size={18}/></button><h3 className="font-serif text-lg">在这里结束旅程？</h3><p className="mt-3 text-xs leading-6 text-[#bfc8c2]">结局会停在当前场景。之后仍可查看和分享，想从头再玩可以重开。</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => setConfirmEnd(false)} className="flex-1 rounded-xl border border-white/20 py-2.5 text-xs">继续游玩</button><button type="button" onClick={() => { save({ ...sessions, [adventureSessionKey(session.worldId, session.companionId)]: { ...session, endedAt: new Date().toISOString(), pausedAt: undefined } }); setConfirmEnd(false); setShareRecipients(contacts.some(contact => contact.id === session.companionId) ? [session.companionId] : []); setShareOpen(true); }} className="flex-1 rounded-xl bg-[#dcc29e] py-2.5 text-xs font-semibold text-[#263038]">结束并选择分享</button></div></div></div>}
    {shareOpen && session && world && <div className="fixed inset-0 z-[135] flex items-end justify-center bg-black/80 px-3 sm:items-center" onClick={() => setShareOpen(false)}><div role="dialog" aria-modal="true" aria-label="分享文字冒险进度" onClick={event => event.stopPropagation()} className="w-full max-w-[480px] rounded-t-3xl border border-[#ddc5a2]/25 bg-[#1c2932] p-5 pb-8 shadow-2xl sm:rounded-3xl"><div className="flex items-center justify-between"><div><p className="text-[10px] tracking-[.2em] text-[#d8bc91]">ADVENTURE POSTCARD</p><h3 className="mt-1 font-serif text-xl">分享这段旅程</h3></div><button type="button" onClick={() => setShareOpen(false)} className="rounded-full p-2 text-[#a6b4ae]"><X size={19}/></button></div><div className={`mt-5 rounded-2xl bg-gradient-to-br ${world.card} p-[1px]`}><div className="rounded-2xl bg-[#1c2932]/90 p-4"><p className="text-[10px] tracking-widest text-[#e1c9a2]">{session.endedAt ? '已完结' : '暂停中'} · 第 {session.turn + 1} 回合</p><h4 className="mt-2 font-serif text-xl">{world.title}</h4><p className="mt-2 text-xs text-[#c4d0c8]">{session.scene.chapter} · {session.scene.place}</p><p className="mt-3 text-sm text-[#f1e7d7]">{session.scene.title}</p><p className="mt-2 line-clamp-3 text-xs leading-5 text-[#afbbb6]">{session.scene.text}</p><p className="mt-4 border-t border-white/15 pt-3 text-[10px] text-[#afbbb6]">{companion ? `${userName} 与 ${companion.name}的沉浸式文字冒险` : `${userName}的沉浸式文字冒险`} · 游戏番外</p></div></div><p className="mt-5 text-xs text-[#aebbb4]">发送给角色</p><div className="mt-2 max-h-32 space-y-1 overflow-y-auto">{contacts.map(contact => <label key={contact.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"><input type="checkbox" checked={shareRecipients.includes(contact.id)} onChange={event => setShareRecipients(previous => event.target.checked ? [...previous, contact.id] : previous.filter(id => id !== contact.id))} className="accent-[#d8bc91]"/>{contact.name}{contact.id === session.companionId && <span className="text-[10px] text-[#d8bc91]">同行者</span>}</label>)}</div><p className="mt-3 text-[11px] leading-5 text-[#899b94]">角色会看到这是共同扮演的游戏进度，不会把剧情当成现实中的穿越经历。</p><button type="button" onClick={share} disabled={shareRecipients.length === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d8bc91] py-3 text-sm font-semibold text-[#26323a] disabled:opacity-40"><Share2 size={15}/>发送进度卡片</button></div></div>}
    {editing && <AdventureWorldEditor key={editing.world.id} initial={editing} worldBooks={worldBooks} onClose={() => setEditing(null)} onGenerate={onGenerateWorld} onSave={saved => { saveWorlds({ ...customWorlds, [saved.world.id]: saved }); setEditing(null); }}/>} 
  </div>;
}
