import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Ghost, RotateCcw } from 'lucide-react';
import { HalloweenReward } from './HalloweenReward';
import { HalloweenCandy, HalloweenPumpkin, HalloweenTown } from './HalloweenArt';
import { HALLOWEEN_QUIPS, HALLOWEEN_TITLES, completeHalloweenGame, makeHalloweenRound, readHalloweenBest, readHalloweenReward, swapPumpkins, type PumpkinOrder } from '../utils/halloween';
import './halloween.css';

type Phase = 'idle' | 'reveal' | 'shuffle' | 'choose' | 'result' | 'paused';
const positions = ['左边', '中间', '右边'];

export function HalloweenScene({ onClose, onOpenBeauty }: { onClose: () => void; onOpenBeauty?: () => void }) {
  const [stage, setStage] = useState<'arrival' | 'game' | 'ending'>('arrival');
  const [lit, setLit] = useState(true), [moon, setMoon] = useState(false);
  const [round, setRound] = useState(0), [phase, setPhaseState] = useState<Phase>('idle');
  const [order, setOrder] = useState<PumpkinOrder>([0, 1, 2]), [target, setTarget] = useState(0);
  const [choice, setChoice] = useState<number | null>(null), [treats, setTreats] = useState<boolean[]>([]);
  const [best, setBest] = useState(readHalloweenBest), [notice, setNotice] = useState('');
  const root = useRef<HTMLElement>(null), timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const phaseRef = useRef<Phase>('idle'), closeRef = useRef(onClose); closeRef.current = onClose;
  const reducedMotion = useRef(false);
  const gameId = useRef(''), saving = useRef(false);
  const [settling, setSettling] = useState(false), [saveFailed, setSaveFailed] = useState(false);
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current.clear(); };
  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'); reducedMotion.current = media.matches;
    const updateMotion = () => { reducedMotion.current = media.matches; };
    const pause = () => {
      if (document.visibilityState === 'hidden' && ['reveal', 'shuffle'].includes(phaseRef.current)) {
        clearTimers(); setPhase('paused');
      }
    };
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', pause);
    root.current?.focus();
    return () => { clearTimers(); media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', pause); previous?.focus(); };
  }, []);
  useEffect(() => { root.current?.focus(); root.current?.querySelector('.hw-scroll')?.scrollTo({ top: 0 }); }, [stage, round]);
  useEffect(() => { if (phase === 'choose') root.current?.querySelector<HTMLButtonElement>('.hw-pumpkin-cup')?.focus({ preventScroll: true }); }, [phase]);

  const beginRound = (index: number) => {
    clearTimers();
    const plan = makeHalloweenRound(index);
    setRound(index); setOrder([0, 1, 2]); setTarget(plan.target); setChoice(null); setNotice('');
    setPhase('reveal'); setStage('game');
    later(() => {
      if (reducedMotion.current) { setPhase('choose'); return; }
      setPhase('shuffle');
      plan.swaps.forEach((swap, step) => later(() => setOrder(current => swapPumpkins(current, swap)), 350 + step * 600));
      later(() => setPhase('choose'), 350 + plan.swaps.length * 600);
    }, 1600);
  };
  const start = () => { gameId.current = crypto.randomUUID(); setTreats([]); setSaveFailed(false); beginRound(0); };
  const choose = (pumpkin: number) => {
    if (phaseRef.current !== 'choose') return;
    setPhase('result'); setChoice(pumpkin); setTreats(current => [...current, pumpkin === target]);
  };
  const settle = async () => {
    if (saving.current) return;
    saving.current = true; setSettling(true); setSaveFailed(false); setNotice('');
    try { const result = await completeHalloweenGame(treats.filter(Boolean).length, gameId.current); setBest(result.best); }
    catch { setSaveFailed(true); setNotice('糖果暂时没能保存，请重试。'); }
    finally { saving.current = false; setSettling(false); }
  };
  const next = () => {
    if (phaseRef.current !== 'result') return;
    if (round < 2) { beginRound(round + 1); return; }
    setPhase('idle'); setStage('ending');
    void settle();
  };
  const score = treats.filter(Boolean).length;
  const heading = phase === 'reveal' ? '看好，这颗糖。' : phase === 'shuffle' ? '南瓜开始捣蛋了。' : phase === 'choose' ? '藏到哪一只了？'
    : phase === 'paused' ? '刚才有只幽灵路过。' : choice === target ? '抓到啦，这颗归你！' : '哎呀，摸到一只幽灵。';

  return <section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="万圣节糖果屋" className={`halloween-scene hw-stage-${stage} ${lit ? 'hw-lights-on' : ''}`} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
    if (event.key === 'Tab') {
      const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(button => button.getClientRects().length);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="hw-sky" aria-hidden="true">{Array.from({ length: 17 }, (_, i) => <i key={i} style={{ '--i': i, left: `${(i * 47 + 11) % 100}%`, top: `${(i * 23 + 9) % 91}%` } as CSSProperties}>✦</i>)}<div className="hw-haze"/><div className="hw-haze hw-haze-two"/></div>
    <header className="hw-header"><span><Ghost size={17} strokeWidth={1.5}/><span>HALLOWEEN<small>南瓜街 · 夜间营业</small></span></span><button type="button" onClick={onClose} aria-label="关闭万圣节开屏">回到手机 <ArrowRight size={13}/></button></header>
    <div className="hw-scroll">
      {stage === 'arrival' ? <div className="hw-arrival">
        <div className="hw-eyebrow"><span/> OCTOBER 31 <span/></div>
        <h1>今夜，<br/><em>准许捣蛋。</em></h1>
        <p className="hw-intro">南瓜街最后一家糖果屋，<br/>还没打烊。</p>
        <div className="hw-town-wrap">
          <div className="hw-town-illustration">
          <button type="button" className="hw-town" aria-label={lit ? '熄灭南瓜屋的灯' : '点亮南瓜屋的灯'} aria-pressed={lit} onClick={() => setLit(value => !value)}><HalloweenTown lit={lit}/></button>
          <button type="button" className={`hw-moon-secret ${moon ? 'is-awake' : ''}`} aria-label="戳戳月亮" aria-pressed={moon} onClick={() => setMoon(value => !value)}><span aria-hidden="true">☾</span></button>
          {moon && <p className="hw-moon-quip">月亮：我是路灯，不发糖。</p>}
          </div>
          <span className="hw-shop-tag" aria-hidden="true">{lit ? '叮，欢迎讨糖。' : '熄灯也逃不过讨糖鬼。'}</span>
        </div>
        <div className="hw-arrival-bottom"><button type="button" className="hw-primary" onClick={start}>来讨颗糖 <ArrowRight size={16}/></button><p>{readHalloweenReward().unlocked ? '记住藏糖的南瓜，别被它们骗过去。' : '记住藏糖的南瓜，攒三颗兑换「南瓜夜宴」。'}</p></div>
      </div> : stage === 'game' ? <div className="hw-game">
        <div className="hw-round-label">TRICK OR TREAT <span>0{round + 1} / 03</span></div>
        <div className="hw-game-heading" aria-live="polite" aria-atomic="true"><h2>{heading}</h2><p>{phase === 'reveal' ? `糖果在${positions[target]}，记住它。` : phase === 'shuffle' ? '嘘……盯紧它。' : phase === 'choose' ? '敲敲南瓜，把糖找出来。' : phase === 'paused' ? '这一轮不算，重新看一次。' : choice === target ? '南瓜店长：有点本事。' : '别急，下一轮扳回来。'}</p></div>
        <div className={`hw-game-board hw-phase-${phase}`} aria-busy={phase === 'shuffle'}>
          <div className="hw-board-orbit" aria-hidden="true"/><span className="hw-board-star hw-board-star-one" aria-hidden="true">✧</span><span className="hw-board-star hw-board-star-two" aria-hidden="true">✦</span>
          {[0, 1, 2].map(pumpkin => {
            const slot = order.indexOf(pumpkin), candy = pumpkin === target && (phase === 'reveal' || phase === 'result');
            return <button type="button" className={`hw-pumpkin-cup ${phase === 'result' && pumpkin === choice ? 'is-picked' : ''}`} key={pumpkin} style={{ '--slot': slot } as CSSProperties}
              disabled={phase !== 'choose'} aria-label={`选择${positions[slot]}的南瓜`} onClick={() => choose(pumpkin)}>
              <span className={`hw-hidden-treat ${candy || phase === 'result' && pumpkin === choice ? 'is-revealed' : ''}`}>{candy ? <HalloweenCandy kind={round}/> : phase === 'result' && pumpkin === choice ? <Ghost size={43} strokeWidth={1.4}/> : null}</span>
              <HalloweenPumpkin open={phase === 'result' && pumpkin === target}/><span className="hw-cup-label">{positions[slot]}</span>
            </button>;
          })}
        </div>
        <div className="hw-sweet-counter" aria-label={`已完成${treats.length}轮，拿到${score}颗糖`}>{[0, 1, 2].map(index => <span key={index} className={index < treats.length ? 'is-filled' : ''}>{treats[index] ? <HalloweenCandy kind={index}/> : index < treats.length ? <Ghost size={20}/> : <span>✧</span>}</span>)}</div>
        <div className="hw-game-actions">{phase === 'result' ? <button type="button" className="hw-primary" onClick={next}>{round === 2 ? '看看今晚的糖袋' : '再讨一颗'} <ArrowRight size={16}/></button> : phase === 'paused' ? <button type="button" className="hw-primary" onClick={() => beginRound(round)}><RotateCcw size={15}/>重新看这一轮</button> : <p className="hw-game-footnote">{phase === 'choose' ? '选错也没关系，幽灵只负责捣蛋。' : '南瓜正在准备，糖果马上就好。'}</p>}</div>
      </div> : <div className="hw-ending">
        <div className="hw-eyebrow"><span/> TONIGHT’S LITTLE TROUBLE <span/></div>
        <div className="hw-candy-bag" aria-hidden="true"><div className="hw-bag-handle"/><div className="hw-bag-body"><Ghost size={50} strokeWidth={1.2}/><span>BOO!</span></div>{[0, 1, 2].map(index => <span key={index} className={`hw-bag-candy hw-bag-candy-${index}`}><HalloweenCandy kind={index}/></span>)}<i>✦</i><i>✧</i></div>
        <p className="hw-earned">今晚带走 <strong>{score}</strong> 颗糖</p><h2>{HALLOWEEN_TITLES[score]}</h2><p className="hw-ending-quip">{HALLOWEEN_QUIPS[score]}</p>
        <HalloweenReward settling={settling || saveFailed} onOpenBeauty={onOpenBeauty}/>
        {best !== undefined && <p className="hw-best">本季最高纪录 · {best} / 3</p>}
        <div className="hw-ending-actions"><button type="button" className="hw-primary" onClick={onClose}>带糖回去 <ArrowRight size={16}/></button><button type="button" className="hw-secondary" disabled={settling || saveFailed} onClick={start}><RotateCcw size={14}/>再捣蛋一次</button>{saveFailed && <button type="button" className="hw-secondary" onClick={() => void settle()}>重新保存糖果</button>}</div>
        {notice && <p role="status" className="hw-game-footnote">{notice}</p>}
      </div>}
    </div>
    <footer className="hw-footer" aria-hidden="true"><span>NO TRICKS, JUST A LITTLE MAGIC</span><span>✦</span></footer>
  </section>;
}
