import type { Round } from '../utils/nurture';
import { STAT_LABELS } from '../utils/nurture';
import { cardsForDraw } from '../utils/nurtureGacha';
import { playbackReviewStep } from '../utils/nurturePlaybackReview';
import { NurtureCardArt } from './NurtureCardArt';
import { NurtureStatusNote } from './NurtureStatusNote';

export function NurturePlaybackReview({ round, index, onNavigate, onClose }: { round: Round; index: number; onNavigate: (index: number) => void; onClose: () => void }) {
  const step = playbackReviewStep(round, index);
  if (!step) return null;
  return <div className="nurture-playback-review" role="dialog" aria-modal="true" aria-label="回看本轮操作"><header><h3>回看 · {index < 0 ? '打开游戏' : `行动 ${index + 1} / ${round.cursor}`}</h3><button type="button" onClick={onClose}>返回当前</button></header>
    <div key={index} className="nurture-review-content"><h3>{step.action}</h3><blockquote>{step.thought}</blockquote>{step.paymentThought && <><small>支付时的心声</small><blockquote>{step.paymentThought}</blockquote></>}{step.resultThought && <><small>结果心声</small><blockquote>{step.resultThought}</blockquote></>}{step.speech && <p className="nurture-speech">{step.speech}</p>}<NurtureStatusNote text={step.statusNote}/>{step.receipt && <p>{step.receipt}</p>}
      {cardsForDraw(step).length > 0 && <div className="nurture-card-grid">{cardsForDraw(step).map((c, i) => <article key={i} className="nurture-card"><NurtureCardArt card={c}/><strong>{c.rarity} · {c.name}</strong></article>)}</div>}
      <div className="nurture-deltas">{(Object.keys(STAT_LABELS) as (keyof typeof step.delta)[]).filter(k => step.delta[k] !== 0).map(k => <span key={k}>{STAT_LABELS[k]} {step.delta[k] > 0 ? '+' : ''}{step.delta[k]}</span>)}</div>
    </div><footer><button type="button" disabled={index <= -1} onClick={() => onNavigate(index - 1)}>上一条</button><span>回看期间暂停推进</span><button type="button" disabled={index >= round.cursor - 1} onClick={() => onNavigate(index + 1)}>下一条</button></footer>
  </div>;
}
