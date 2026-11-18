import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Step } from '../utils/nurture';
import { cardsForDraw } from '../utils/nurtureGacha';
import { NurtureCardArt } from './NurtureCardArt';
import { NurtureTap } from './NurtureTouchEffects';

export function NurtureGacha({ step, actorName }: { step: Step; actorName: string }) {
  const cards = cardsForDraw(step);
  const [revealed, setRevealed] = useState(0), [after, setAfter] = useState(false);
  useEffect(() => {
    setRevealed(0); setAfter(false);
    const timers = cards.map((_, i) => window.setTimeout(() => setRevealed(i + 1), 1100 + i * 420));
    timers.push(window.setTimeout(() => setAfter(true), 2200 + Math.max(0, cards.length - 1) * 420));
    return () => timers.forEach(window.clearTimeout);
  }, [step]);
  if (!cards.length) return <section className="nurture-role-operation"><h3>召唤未进行</h3><p>{step.receipt}</p><blockquote>{step.thought}</blockquote></section>;
  return <section className={`nurture-gacha${cards.length === 10 ? ' is-ten' : ''}`} aria-label={cards.length === 10 ? '十连抽卡动画' : '单抽动画'}>
    <div className="nurture-gacha-stars" aria-hidden="true">✧ · ✦ · ✧</div><NurtureTap/><header><Sparkles size={24}/><h3>{cards.length === 10 ? '十份星愿，正在抵达' : '一份星愿，正在回应'}</h3><small>{step.receipt}</small></header>
    <div className="nurture-gacha-cards">{cards.map((card, i) => <div key={i} className={`nurture-flip${i < revealed ? ' is-revealed' : ''}${['SSR', 'UR', 'SP'].includes(card.rarity.toUpperCase()) ? ' is-rare' : ''}`}><div className="nurture-flip-inner"><div className="nurture-flip-back" aria-hidden="true"><Sparkles/><span>POCKET OF YOU</span><small>{i + 1}</small></div><div className="nurture-flip-front">{i < revealed && <><NurtureCardArt card={card}/><strong>{card.rarity} · {card.name}</strong></>}</div></div></div>)}</div>
    <div className="nurture-gacha-thought" aria-live="polite"><small>{actorName} · {after ? '揭晓后的心声' : '等待时的心声'}</small><blockquote>{after ? step.resultThought || step.thought : step.thought}</blockquote>{after && step.pityAfter !== undefined && <small>保底进度 {step.pityAfter}/60 · 最多再抽 {60 - step.pityAfter} 次必出保底稀有</small>}</div>
  </section>;
}
