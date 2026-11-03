import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

export const OPENING_TIMING = { intro: 2450, reducedIntro: 550, exit: 600, shortExit: 160 } as const;

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

export function PhoneOpening({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [introDone, setIntroDone] = useState(false);
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
    const timer = window.setTimeout(() => setIntroDone(true), reducedMotion ? OPENING_TIMING.reducedIntro : OPENING_TIMING.intro);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

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
      tabIndex={-1}
      className="yy-phone-opening"
      data-leaving={leaving || undefined}
      data-reduced-motion={reducedMotion || undefined}
      data-waiting={introDone && !ready || undefined}
      style={{ '--opening-exit': `${shortExit ? OPENING_TIMING.shortExit : OPENING_TIMING.exit}ms` } as CSSProperties}
      onKeyDown={event => {
        if (event.key === 'Escape' && ready) { event.preventDefault(); setExit('skip'); }
        if (event.key === 'Tab') {
          event.preventDefault();
          (ready ? skipRef.current : overlayRef.current)?.focus({ preventScroll: true });
        }
      }}
    >
      <div className="yy-opening-aurora yy-opening-aurora-blue" aria-hidden="true" />
      <div className="yy-opening-aurora yy-opening-aurora-rose" aria-hidden="true" />
      <div className="yy-opening-grid" aria-hidden="true" />
      <div className="yy-opening-beam" aria-hidden="true" />
      <button ref={skipRef} type="button" className="yy-opening-skip" disabled={!ready || leaving} onClick={() => setExit('skip')} aria-label="跳过开机动画">
        跳过 <span aria-hidden="true">↗</span>
      </button>
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
    </div>
  );
}
