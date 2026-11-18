import { NurtureThought, usePlaybackBarrier, thoughtPlaybackMs } from './NurturePlaybackText';
import { Sparkles } from 'lucide-react';
import type { Step } from '../utils/nurture';
import { cardsForDraw } from '../utils/nurtureGacha';
import { NurtureCardArt } from './NurtureCardArt';
import { NurtureTap } from './NurtureTouchEffects';
import { useNurturePlaybackClock } from '../utils/useNurturePlaybackClock';

export function NurtureGacha({ step, actorName, paused = false }: { step: Step; actorName: string; paused?: boolean }) {
  const cards = cardsForDraw(step);
  const elapsed = useNurturePlaybackClock(paused);
  const revealed = Math.max(0, Math.min(cards.length, Math.floor((elapsed - 850) / 200) + 1));
  const afterAt = Math.max(1500 + Math.max(0, cards.length - 1) * 180, thoughtPlaybackMs(step.thought));
  const after = elapsed >= afterAt;
  usePlaybackBarrier(cards.length > 0 && elapsed < afterAt + 200);
  if (!cards.length) return <section className="nurture-role-operation"><h3>召唤未进行</h3><p>{step.receipt}</p><blockquote><NurtureThought text={step.thought}/></blockquote></section>;
  return <section className={`nurture-gacha${cards.length === 10 ? ' is-ten' : ''}`} aria-label={cards.length === 10 ? '十连抽卡动画' : '单抽动画'}>
    <div className="nurture-gacha-stars" aria-hidden="true">✧ · ✦ · ✧</div><NurtureTap/><header><Sparkles size={24}/><h3>{cards.length === 10 ? '十份星愿，正在抵达' : '一份星愿，正在回应'}</h3><small>{step.receipt}</small></header>
    <div className="nurture-gacha-cards">{cards.map((card, i) => <div key={i} className={`nurture-flip${i < revealed ? ' is-revealed' : ''}${['SSR', 'UR', 'SP'].includes(card.rarity.toUpperCase()) ? ' is-rare' : ''}`}><div className="nurture-flip-inner"><div className="nurture-flip-back" aria-hidden="true"><Sparkles/><span>POCKET OF YOU</span><small>{i + 1}</small></div><div className="nurture-flip-front">{i < revealed && <><NurtureCardArt card={card}/><strong>{card.rarity} · {card.name}</strong></>}</div></div></div>)}</div>
    <div className="nurture-gacha-thought" aria-live="polite"><small>{actorName} · {after ? '揭晓后的心声' : '等待时的心声'}</small><blockquote><NurtureThought key={after ? 'after' : 'before'} text={after ? step.resultThought || step.thought : step.thought}/></blockquote>{after && step.pityAfter !== undefined && <small>保底进度 {step.pityAfter}/60 · 最多再抽 {60 - step.pityAfter} 次必出保底稀有</small>}</div>
  </section>;
}
