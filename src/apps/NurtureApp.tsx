import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Heart, Settings, Star, Sparkles, Eye, Pause, Play } from 'lucide-react';
import { readAnthologyAuthors } from '../utils/anthology';
import { readNurtureIdentity, ownedProducts } from '../utils/nurtureInventory';
import { advance, generateRound, persistSave, readSave, saveKey, STAT_LABELS, validatePlan, type Save, type Stats, type Step } from '../utils/nurture';
import './nurture.css';
import { NurtureCardArt } from '../components/NurtureCardArt';
import { NurtureInventory } from '../components/NurtureInventory';
import { NurtureTap } from '../components/NurtureTouchEffects';
import { NurtureMemoryPanel, NurtureRoundRecap } from '../components/NurtureMemoryPanel';
import './nurtureStage.css';
import { NurtureStage } from '../components/NurtureStage';
import { NurturePreview } from '../components/NurturePreview';
import { NurtureStatusNote } from '../components/NurtureStatusNote';
import { NurtureSettings } from '../components/NurtureSettings';
import { configureGame, nurtureColorStyle, type NurtureColors } from '../utils/nurtureDesign';
import { cardsForDraw, playbackDuration } from '../utils/nurtureGacha';

const statKeys = Object.keys(STAT_LABELS) as (keyof Stats)[];
const errorText = (e: unknown) => e instanceof Error ? e.message : '操作失败，请重试。';
export function NurtureApp({ onBack }: { onBack: () => void }) {
  const [actors] = useState(readAnthologyAuthors);
  const [actorId, setActorId] = useState(() => actors[0]?.id ?? '');
  const user = readNurtureIdentity();
  const [locked, setLocked] = useState(false);
  const [colors, setColors] = useState<NurtureColors | undefined>();
  return <div className="nurture-app" data-custom-colors={colors ? true : undefined} style={nurtureColorStyle(colors)}><header className="nurture-header"><button disabled={locked} onClick={onBack} aria-label="返回桌面"><ArrowLeft size={20}/></button><div><small>POCKET OF YOU</small><strong>掌心养成</strong></div><select disabled={locked} aria-label="切换玩家角色" value={actorId} onChange={e => setActorId(e.target.value)}>{actors.map(a => <option key={a.id} value={a.id}>{a.name}的游戏</option>)}</select></header>
    {actorId ? <Game key={`${user.id}:${actorId}`} actorId={actorId} user={user} onLock={setLocked} onColors={setColors}/> : <div className="nurture-empty"><Heart/><h2>等待一位玩家</h2><p>先在微信中添加角色，再来看看他们会怎样照顾你。</p></div>}</div>;
}
function Game({ actorId, user, onLock, onColors }: { actorId: string; user: ReturnType<typeof readNurtureIdentity>; onLock: (locked: boolean) => void; onColors: (colors?: NurtureColors) => void }) {
  const actor = readAnthologyAuthors().find(a => a.id === actorId)!;
  const key = saveKey(actorId, user.id);
  const [initial] = useState(() => { try { return { save: readSave(key), error: '' }; } catch(e) { return { save: null, error: errorText(e) }; } });
  const [save, setSave] = useState<Save | null>(initial.save);
  useEffect(() => { onColors(save?.design?.colors); }, [save?.design?.colors, onColors]);
  const [error, setError] = useState(initial.error), [busy, setBusy] = useState(false);
  const [showingLastStep, setShowingLastStep] = useState(false);
  const [preview, setPreview] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settings, setSettings] = useState(false), [tab, setTab] = useState<'home' | 'cards' | 'items' | 'logs'>('home');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  const round = save?.rounds[0], hasPendingSteps = !!round && round.cursor < round.steps.length;
  const playing = hasPendingSteps || showingLastStep;
  const currentStep = useMemo<Step | undefined>(() => round?.cursor ? round.steps[round.cursor - 1] : playing && round ? { kind: 'open', action: '打开掌心养成', thought: round.openingThought ?? round.steps[0]?.thought ?? '', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false } : undefined, [round, playing]);
  useEffect(() => { onLock(busy || playing || preview); return () => onLock(false); }, [busy, playing, preview, onLock]);
  const commit = (next: Save) => { persistSave(key, next); setSave(next); };
  useEffect(() => {
    if (!save || !hasPendingSteps || error || paused) return;
    const timer = window.setTimeout(() => { try { const next = advance(save); commit(next); if (next.rounds[0].cursor === next.rounds[0].steps.length) setShowingLastStep(true); } catch(e) { setError(errorText(e)); } }, playbackDuration(currentStep));
    return () => window.clearTimeout(timer);
  }, [save, hasPendingSteps, error, paused, currentStep]);
  useEffect(() => {
    if (!showingLastStep || paused) return;
    const timer = window.setTimeout(() => setShowingLastStep(false), playbackDuration(round?.steps.at(-1)));
    return () => window.clearTimeout(timer);
  }, [showingLastStep, paused]);
  const generate = async () => {
    if (!save || busy || playing || preview || controller.current) return;
    const active = new AbortController(); controller.current = active; setBusy(true); setPaused(false); setTab('home'); setError('');
    try { const next = await generateRound(save, actorId, active.signal); active.signal.throwIfAborted(); commit(next); setTab('home'); }
    catch(e) { if (!active.signal.aborted) setError(errorText(e)); }
    finally { if (controller.current === active) { controller.current = null; setBusy(false); } }
  };
  if (!save) return <p role="alert" className="nurture-error">{error}</p>;
  return <><div className="nurture-toolbar" inert={preview}><span><span className="nurture-online"/> {actor.name} · {busy ? '正在操作' : playing ? '游戏进行中' : '已登录'}</span><div className="nurture-toolbar-actions">{playing && <button type="button" aria-label={paused ? "\u7ee7\u7eed\u64ad\u653e" : "\u6682\u505c\u64ad\u653e"} title={paused ? "\u7ee7\u7eed\u64ad\u653e" : "\u6682\u505c\u64ad\u653e"} onClick={() => setPaused(p => !p)}>{paused ? <Play size={17}/> : <Pause size={17}/>}</button>}<button aria-label="生成新一轮" title={busy ? '角色正在操作…' : playing ? '正在播放…' : '生成新一轮'} disabled={busy || playing} onClick={() => void generate()}><Sparkles size={17} className={busy ? 'animate-pulse' : undefined}/></button><button aria-label={"\u9884\u89c8\u6e38\u620f\u9875\u9762"} title={"\u9884\u89c8\u6e38\u620f\u9875\u9762"} disabled={busy || playing} onClick={() => setPreview(true)}><Eye size={17}/></button><button aria-label="策划设置" title="策划设置" disabled={busy || playing} onClick={() => setSettings(true)}><Settings size={18}/></button></div></div>
    <div className="nurture-scroll" inert={preview}>
      <nav className="nurture-tabs">{(['home', 'cards', 'items', 'logs'] as const).map((t, i) => <button key={t} disabled={busy || playing} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{['陪伴', `卡册 ${save.collection.length}`, `物品栏 ${ownedProducts(save).filter(i => i.status === 'owned').length}`, '游戏日志'][i]}{t === 'items' && playing && round?.steps[round.cursor - 1]?.kind === 'gift' && <NurtureTap key={`${round.id}:${round.cursor}`}/>}</button>)}</nav>
      {tab === 'home' && <><NurtureStage save={save} userName={save.design?.hero.nickname || save.design?.hero.name || user.name} actorName={actor.name} onConfigure={(plan, design) => { if (busy || playing || preview) return; validatePlan(plan); commit(configureGame(save, plan, design)); }} step={currentStep} busy={busy} playing={playing} paused={paused} onSettings={() => setSettings(true)}/>
      </>}
      {tab === 'cards' && <section><h2 className="nurture-section-title">收集的每一瞬间</h2>{!save.collection.length && <p className="nurture-hint">角色在游戏中抽到的卡面，会珍藏在这里。</p>}<div className="nurture-card-grid">{save.collection.map((c, i) => <article key={i} className="nurture-card"><NurtureCardArt card={c}/><small>{c.rarity}</small><strong>{c.name}</strong><p>{c.description}</p></article>)}</div></section>}
      {tab === 'items' && <NurtureInventory save={save}/>}
      {tab === 'logs' && <section><NurtureMemoryPanel save={save} actorName={actor.name}/><h2 className="nurture-section-title">{actor.name}的游戏日志</h2>{!save.rounds.length && <p className="nurture-hint">日常尚未开始。</p>}{save.rounds.map((r, i) => <details key={r.id} className="nurture-log"><summary>第 {r.number ?? save.rounds.length - i} 轮 · {new Date(r.createdAt).toLocaleString('zh-CN')} · {r.cursor}/{r.steps.length}</summary><NurtureRoundRecap round={r}/>{r.steps.slice(0, r.cursor).map((s, index) => <StepView key={index} step={s} index={index}/>)}</details>)}</section>}
      {error && <p className="nurture-error" role="alert">{error}<button onClick={() => setError('')}>关闭提示</button></p>}
    </div>
    {preview && <NurturePreview save={save} actorName={actor.name} userName={save.design?.hero.nickname || save.design?.hero.name || user.name} onClose={() => setPreview(false)}/>}
    {settings && <NurtureSettings save={save} userName={user.name} onClose={() => setSettings(false)} onSave={(design, portrait) => { if (busy || playing || preview) return; commit({ ...save, design, portrait }); setSettings(false); }}/>}</>;
}
function StepView({ step: s, index, before }: { step: import('../utils/nurture').Step; index: number; before?: Stats }) {
  return <article className="nurture-step"><small>STEP {String(index + 1).padStart(2, '0')}</small><h3>{s.action}</h3><NurtureStatusNote text={s.statusNote}/><blockquote>“{s.thought}”</blockquote>{s.resultThought && <blockquote>{s.resultThought}</blockquote>}{s.speech && <p className="nurture-speech">{s.speech}</p>}{s.draw && <div className="nurture-draw">{s.card ? <><div className="nurture-draw-history">{cardsForDraw(s).map((card, i) => <div key={i}><NurtureCardArt card={card}/><strong>{card.rarity} ? {card.name}</strong></div>)}</div><Star size={16}/>{s.card.rarity} · {s.card.name}<p>{s.card.description}</p></> : '卡池暂未开放，本次未抽卡。'}</div>}{s.receipt && <p className="nurture-receipt">{s.receipt}</p>}<div className="nurture-deltas">{statKeys.map(k => { const delta = before ? Math.max(0, Math.min(100, before[k] + s.delta[k])) - before[k] : s.delta[k]; return delta !== 0 && <span key={k}>{STAT_LABELS[k]} {delta > 0 ? '+' : ''}{delta}</span>; })}</div></article>;
}
