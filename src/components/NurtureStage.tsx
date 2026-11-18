import { useEffect, useState } from 'react';
import { Heart, Sparkles, ShoppingBag, CalendarDays, MapPin, Gift, X, Gem, Coins, Shirt, Star, Activity } from 'lucide-react';
import { NurtureCardArt } from './NurtureCardArt';
import { memoryFor } from '../utils/nurtureMemory';
import { emptyPortrait, initialWallet } from '../utils/nurtureGame';
import { STAT_LABELS, type Save, type Step } from '../utils/nurture';
import type { Plan } from '../utils/nurture';
import { defaultDesign, type GameDesign } from '../utils/nurtureDesign';
import { NurtureModuleEditor } from './NurtureModuleEditor';
import { NurtureGamePages } from './NurtureGamePages';
import { NurtureGacha } from './NurtureGacha';
import { NurtureTap, NurtureHeartBurst } from './NurtureTouchEffects';
import { NurtureGiftPlayback } from './NurtureInventory';
import { NurtureRecharge } from './NurtureRecharge';
import { NurtureStatusNote } from './NurtureStatusNote';

const modules = [
  { id: 'draw', name: '抽卡', subtitle: '收藏心动', icon: Sparkles },
  { id: 'shop', name: '商城', subtitle: '为你挑选', icon: ShoppingBag },
  { id: 'schedule', name: '日程', subtitle: '慢慢成长', icon: CalendarDays },
  { id: 'date', name: '约会', subtitle: '两个人的时光', icon: MapPin },
  { id: 'event', name: '限时活动', subtitle: '限定的浪漫', icon: Gift },
  { id: 'stats', name: '状态', subtitle: '成长状态', icon: Activity },
];
export function NurtureStage({ save, userName, actorName, step, busy, playing, onSettings, onConfigure, viewOnly = false, paused = false }: { save: Save; userName: string; actorName: string; step?: Step; busy: boolean; playing: boolean; onSettings: () => void; onConfigure?: (plan: Plan, design: GameDesign) => void; viewOnly?: boolean; paused?: boolean }) {
  const [manualPanel, setPanel] = useState('');
  const locked = busy || playing;
  const design = save.design ?? defaultDesign(userName);
  const [openedStep, setOpenedStep] = useState<Step>();
  useEffect(() => {
    if (!playing || !step || busy || paused) return;
    const timer = window.setTimeout(() => setOpenedStep(step), 550);
    return () => window.clearTimeout(timer);
  }, [step, playing, busy, paused]);
  const autoPanel = openedStep === step && playing && step && ['draw', 'shop', 'recharge', 'gift', 'schedule', 'date', 'event', 'status'].includes(step.kind || '') ? step.kind === 'status' ? 'stats' : step.kind! : openedStep === step && playing && step?.draw ? 'draw' : '';
  const panel = locked ? autoPanel : manualPanel;
  const panelTitle = panel === 'gift' ? '物品栏' : panel === 'recharge' ? '充值' : modules.find(m => m.id === panel)?.name;
  useEffect(() => { if (locked) setPanel(''); }, [locked]);
  const [portraitRatio, setPortraitRatio] = useState(1);
  const portrait = save.portrait ?? emptyPortrait(), wallet = save.wallet ?? initialWallet();
  const point = step?.target && portrait.points[step.target];
  const activeEvent = save.event.enabled && Date.parse(save.event.endsAt) > Date.now();
  const liveModule = step?.draw ? 'draw' : step?.kind;
  const tapModule = step?.kind === 'recharge' ? 'shop' : step?.kind === 'daily' || step?.kind === 'status' ? 'stats' : liveModule;
  return <section className="nurture-game-stage" data-playback-paused={paused || undefined} aria-label="游戏主界面">
    <div className="nurture-stage-sky"/><div className="nurture-stage-window"/><div className="nurture-stage-floor"/>
    {playing && step?.kind === 'open' && <div className="nurture-role-opening" aria-label="角色打开游戏"><div><Heart size={36}/></div><strong>掌心养成</strong><small>正在进入你的世界…</small><blockquote>{step.thought}</blockquote></div>}
    <div className="nurture-stage-top"><div><small>陪伴你的第 {save.rounds[0]?.number ?? memoryFor(save).completedRounds} 轮</small><h1>{userName}</h1></div><div className="nurture-wallet"><span><Gem size={12}/>{wallet.gems}</span><span><Coins size={12}/>{wallet.coins}</span></div></div>
    <div className="nurture-stage-portrait">{portrait.image ? <div className="nurture-image-plane" style={{ width: `max(100cqw, calc(100cqh * ${portraitRatio}))`, height: `max(100cqh, calc(100cqw / ${portraitRatio}))` }}><img className="nurture-standing-art" onLoad={e => { const image = e.currentTarget; if (image.naturalWidth && image.naturalHeight) setPortraitRatio(image.naturalWidth / image.naturalHeight); }} src={portrait.image} alt={`${userName}的立绘`} draggable={false}/>{playing && point && <NurtureHeartBurst key={`${save.rounds[0]?.cursor}:${step?.target}`} x={point.x} y={point.y} part={step?.target ?? ""}/>}</div> : viewOnly ? <div className="nurture-game-avatar-empty"><Heart size={65} strokeWidth={1}/><strong>{userName}</strong></div> : <button className="nurture-upload-placeholder" disabled={busy || playing || viewOnly} onClick={onSettings}><Shirt size={50} strokeWidth={1}/><strong>把你带进游戏</strong><span>上传立绘 · 标记触碰部位</span></button>}</div>
    <div className="nurture-side-menu">{modules.slice(0, 2).map(m => <button disabled={locked} key={m.id} className={liveModule === m.id && playing ? 'is-active' : ''} onClick={() => setPanel(m.id)}><m.icon size={23}/><strong>{m.name}</strong>{playing && !busy && tapModule === m.id && <NurtureTap key={`${save.rounds[0]?.id}:${save.rounds[0]?.cursor}`}/>}</button>)}</div>
    {(busy || playing) && <div className="nurture-stage-dialog" aria-live="polite"><span>{busy ? `${actorName}正在思考…` : playing ? step?.target ? `${actorName} · 触碰${step.target}` : `${actorName}正在操作` : userName}</span>{(busy || step?.speech) && <p>{busy ? "\u89d2\u8272\u6b63\u5728\u601d\u8003\u2026" : step?.speech}</p>}{playing && step?.thought && <small>「{step.thought}」</small>}</div>}
    <nav className="nurture-bottom-menu" aria-label="游戏功能">{modules.slice(2).map(m => <button disabled={locked} key={m.id} className={liveModule === m.id && playing ? 'is-active' : ''} onClick={() => setPanel(m.id)}><m.icon size={22}/><strong>{m.name}</strong>{playing && !busy && tapModule === m.id && <NurtureTap key={`${save.rounds[0]?.id}:${save.rounds[0]?.cursor}`}/>}</button>)}</nav>
    {panel && <div className="nurture-game-panel" role="dialog" aria-modal="true" aria-label={panelTitle}><header><div><small>POCKET OF YOU</small><h2>{panelTitle}</h2></div><button disabled={locked} onClick={() => setPanel('')} aria-label="关闭功能页面"><X size={20}/></button></header><div className="nurture-panel-content">{viewOnly ? <NurtureGamePages key={panel} panel={panel} save={save} userName={userName} onNavigate={setPanel}/> : !locked ? <NurtureModuleEditor key={panel} module={panel} save={save} userName={userName} onSave={(plan, design) => { onConfigure?.(plan, design); setPanel(''); }}/> : <>{!['draw', 'recharge', 'gift', 'stats'].includes(panel) && <div className="nurture-role-operation"><h3>{step?.action}</h3><blockquote>{step?.thought}</blockquote>{step?.receipt && <p>{step.receipt}</p>}{step?.speech && <p>{step.speech}</p>}</div>}
      {panel === 'stats' && <><section className="nurture-stats" aria-label="被养成对象当前状态">{(Object.keys(STAT_LABELS) as (keyof typeof save.stats)[]).map(k => <div key={k}><span>{STAT_LABELS[k]} <b>{save.stats[k]}</b></span><meter min={0} max={100} value={save.stats[k]}/></div>)}</section><NurtureStatusNote text={step?.statusNote ?? design.statusNote}/><blockquote className="nurture-status-thought">{step?.thought}</blockquote></>}
      {panel === 'gift' && step && <NurtureGiftPlayback step={step} actorName={actorName}/>}
      {panel === 'recharge' && step && <NurtureRecharge key={`${save.rounds[0]?.id}:${save.rounds[0]?.cursor}`} step={step} actorName={actorName} paused={paused} gems={design.rechargeGems} orderId={`${save.rounds[0]?.id.slice(0, 8) ?? 'game'}-${save.rounds[0]?.cursor ?? 0}`}/>}
      {panel === 'draw' && step && <NurtureGacha key={`${save.rounds[0]?.id}:${save.rounds[0]?.cursor}`} step={step} actorName={actorName}/>}
      {panel === 'shop' && <><div className="nurture-recharge"><Gem/><div><h3>星钻补给</h3><p>角色可模拟充值，每次获得 {design.rechargeGems} 星钻。</p><small>游戏内虚拟记录 · 无真实支付</small><p>累计补给 {wallet.recharged} 星钻</p></div></div><h3>衣橱与礼物</h3>{design.shop.map(item => <article className="nurture-offer" key={item.id}>{step?.itemId === item.id && <NurtureTap delayed/>}{item.image ? <img src={item.image} alt={item.name}/> : <span className="nurture-offer-icon">{item.type === '服装' ? <Shirt/> : <Gift/>}</span>}<div><small>{item.type} · {item.price} {item.currency === 'gems' ? '星钻' : '金币'}</small><h3>{item.name}</h3><p>{item.description}</p><small>已拥有 {(save.inventory ?? []).filter(id => id === item.id).length} 件</small></div></article>)}<p className="nurture-hint">服装作为衣橱收藏保存，展示立绘由你在策划后台上传更换。</p></>}
      {panel === 'schedule' && <><div className="nurture-banner"><CalendarDays size={32}/><h3>今天，也要好好长大</h3></div>{design.schedules.map(item => <article className="nurture-offer" key={item.id}><div><h3>{item.name}</h3><p>{item.description}</p><StatBenefits delta={item.delta}/></div></article>)}<h3>最近的安排</h3>{save.rounds.flatMap(r => r.steps.slice(0, r.cursor)).filter(s => s.kind === 'schedule').slice(-8).reverse().map((s, i) => <p key={i} className="nurture-hint">{s.receipt} · {s.action}</p>)}</>}
      {panel === 'date' && <><div className="nurture-banner"><Heart size={32}/><h3>把时间留给彼此</h3></div>{design.dates.map(item => <article className="nurture-offer" key={item.id}><div><small>{item.price} 金币</small><h3>{item.name}</h3><p>{item.description}</p><StatBenefits delta={item.delta}/></div></article>)}</>}
      {panel === 'event' && <div className="nurture-banner nurture-event-playing"><NurtureTap delayed/><Star size={32}/><h3>{activeEvent ? save.event.title : '下一场心动，正在准备'}</h3><p>{activeEvent ? save.event.description : '活动开放后，角色会在下一轮中决定是否参加。'}</p>{activeEvent && <small>截止 {new Date(save.event.endsAt).toLocaleString('zh-CN')}</small>}</div>}
    </>}</div></div>}
  </section>;
}
function StatBenefits({ delta }: { delta: import('../utils/nurture').Stats }) { return <div className="nurture-deltas">{(Object.keys(STAT_LABELS) as (keyof typeof delta)[]).map(k => delta[k] !== 0 && <span key={k}>{STAT_LABELS[k]} {delta[k] > 0 ? '+' : ''}{delta[k]}</span>)}</div>; }
