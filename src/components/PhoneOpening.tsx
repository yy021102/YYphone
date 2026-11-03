import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { OpeningStyle } from '../utils/phoneOpening';
import { RainOpeningScene } from './RainOpeningScene';
import { CreamOpeningScene } from './CreamOpeningScene';

export const OPENING_TIMING = { intro: 2450, rainIntro: 4000, acrossIntro: 4500, creamIntro: 4700, staticIntro: 900, reducedIntro: 550, exit: 600, shortExit: 160 } as const;

export function YYphoneMark() {
  const id = useId();
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-left`} x1="30" y1="40" x2="123" y2="161" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" /><stop offset=".32" stopColor="#e9ebf7" />
          <stop offset=".58" stopColor="#c0cede" /><stop offset=".8" stopColor="#fdf8fb" /><stop offset="1" stopColor="#b5c8dc" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="93" y1="34" x2="158" y2="171" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" /><stop offset=".38" stopColor="#e9d8e9" />
          <stop offset=".63" stopColor="#c9dbe7" /><stop offset=".84" stopColor="#fffaf7" /><stop offset="1" stopColor="#cebdce" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="35" y1="40" x2="168" y2="158" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" /><stop offset=".48" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#91a5bd" stopOpacity=".55" />
        </linearGradient>
      </defs>
      <g strokeLinejoin="round">
        <path d="M29 43H53L78 83L103 43H127L90 105V159H66V105Z" fill={`url(#${id}-left)`} stroke={`url(#${id}-edge)`} strokeWidth="1.5" />
        <path d="M77 43H101L126 83L151 43H175L138 105V159H114V105Z" fill={`url(#${id}-right)`} fillOpacity=".87" stroke={`url(#${id}-edge)`} strokeWidth="1.5" />
        <path d="M34 46H51L78 90L105 46H121M82 106V154M82 48H98L126 90L153 46H169M130 106V154" stroke="#fff" strokeOpacity=".8" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M67 107V157H88M115 107V157H136" stroke="#8ca0ba" strokeOpacity=".24" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

export function PhoneOpening({ ready, onComplete, openingStyle = 'pearl' }: { ready: boolean; onComplete: () => void; openingStyle?: OpeningStyle }) {
  const titleId = useId();
  const hintId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [introDone, setIntroDone] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<'loading' | 'playing' | 'static'>(openingStyle === 'rain' ? 'loading' : 'static');
  const sceneReady = openingStyle !== 'rain' || sceneStatus !== 'loading';
  const [exit, setExit] = useState<'automatic' | 'skip' | null>(null);
  const leaving = exit !== null || introDone && ready;
  const shortExit = reducedMotion || exit === 'skip';
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    overlayRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!sceneReady) return;
    const duration = reducedMotion ? OPENING_TIMING.reducedIntro : openingStyle === 'pearl' ? OPENING_TIMING.intro :
      openingStyle === 'across' ? OPENING_TIMING.acrossIntro :
      openingStyle === 'cream' ? OPENING_TIMING.creamIntro :
      sceneStatus === 'playing' ? OPENING_TIMING.rainIntro : OPENING_TIMING.staticIntro;
    const timer = window.setTimeout(() => setIntroDone(true), duration);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, openingStyle, sceneStatus, sceneReady]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => completeRef.current(), shortExit ? OPENING_TIMING.shortExit : OPENING_TIMING.exit);
    return () => window.clearTimeout(timer);
  }, [leaving, shortExit]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      tabIndex={-1}
      className="yy-phone-opening"
      data-style={openingStyle}
      data-scene-mode={sceneStatus}
      data-intro-ready={sceneReady || undefined}
      data-leaving={leaving || undefined}
      data-reduced-motion={reducedMotion || undefined}
      data-waiting={introDone && !ready || undefined}
      style={{ '--opening-exit': `${shortExit ? OPENING_TIMING.shortExit : OPENING_TIMING.exit}ms` } as CSSProperties}
      onKeyDown={event => {
        if (['Escape', 'Enter', ' '].includes(event.key) && ready) { event.preventDefault(); setExit('skip'); }
        if (event.key === 'Tab') {
          event.preventDefault();
          (ready ? enterRef.current : overlayRef.current)?.focus({ preventScroll: true });
        }
      }}
    >
      <p id={hintId} className="sr-only">轻点画面或按回车键进入，开场也会自动结束。</p>
      {openingStyle === 'rain' ? <>
        <RainOpeningScene reducedMotion={reducedMotion} leaving={leaving} onReady={setSceneStatus} onEnded={() => setIntroDone(true)} />
        <div className="yy-rain-copy">
          <h1 id={titleId} aria-label="Rain outside. You are here.">
            <span className="yy-rain-line">
              <span className="yy-rain-word" style={{ '--word-delay': '550ms' } as CSSProperties}>Rain</span>{' '}
              <span className="yy-rain-word" style={{ '--word-delay': '800ms' } as CSSProperties}>outside.</span>
            </span>
            <span className="yy-rain-line">
              <span className="yy-rain-word" style={{ '--word-delay': '1250ms' } as CSSProperties}>You</span>{' '}
              <span className="yy-rain-word" style={{ '--word-delay': '1450ms' } as CSSProperties}>are</span>{' '}
              <span className="yy-rain-word" style={{ '--word-delay': '1650ms' } as CSSProperties}>here.</span>
            </span>
          </h1>
        </div>
        <div className="yy-rain-brand" aria-hidden="true"><span>YYphone</span><span>歪歪机</span></div>
      </> : openingStyle === 'across' ? <>
        <div className="yy-across-atmosphere" aria-hidden="true" />
        <div className="yy-across-scene" aria-hidden="true">
          <div className="yy-across-horizon" />
          <div className="yy-across-orb yy-across-orb-far" />
          <div className="yy-across-glass"><span /><span /></div>
          <div className="yy-across-orb yy-across-orb-near" />
          <div className="yy-across-contact" />
          <div className="yy-across-ripple" />
          <div className="yy-across-ripple yy-across-ripple-late" />
          <div className="yy-across-dust"><i /><i /><i /><i /><i /></div>
        </div>
        <div className="yy-across-copy">
          <h1 id={titleId} aria-label="A screen between us. Still, I reach for you.">
            <span>A screen between us.</span>
            <span>Still, I reach for you.</span>
          </h1>
        </div>
        <div className="yy-across-brand" aria-hidden="true"><span>YYphone</span><span>歪歪机</span></div>
      </> : openingStyle === 'cream' ? <CreamOpeningScene titleId={titleId} /> : <>
      <div className="yy-opening-aurora yy-opening-aurora-blue" aria-hidden="true" />
      <div className="yy-opening-aurora yy-opening-aurora-rose" aria-hidden="true" />
      <div className="yy-opening-grid" aria-hidden="true" />
      <div className="yy-opening-beam" aria-hidden="true" />
      <div className="yy-opening-composition">
        <div className="yy-opening-sculpture" aria-hidden="true">
          <div className="yy-opening-orbit yy-opening-orbit-outer" />
          <div className="yy-opening-orbit yy-opening-orbit-inner" />
          <div className="yy-opening-glass">
            <div className="yy-opening-glass-edge" />
            <div className="yy-opening-monogram"><YYphoneMark /></div>
            <div className="yy-opening-reflection" />
          </div>
          <div className="yy-opening-ground" />
        </div>
        <div className="yy-opening-brand">
          <h1 id={titleId} aria-label="YYphone 开机动画"><span>YY</span>phone</h1>
          <p className="yy-opening-chinese">歪歪机</p>
        </div>
      </div>
      <div className="yy-opening-signature" aria-hidden="true">
        <span className="yy-opening-signature-line" />
        <p>A WORLD OF YOUR OWN</p>
      </div>
      </>}
      <button ref={enterRef} type="button" className="yy-opening-enter" disabled={!ready || leaving} onClick={() => setExit('skip')} aria-label="进入YYphone" />
    </div>
  );
}
