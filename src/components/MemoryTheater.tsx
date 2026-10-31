import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Film, Pause, Play, RotateCcw, X } from 'lucide-react';
import { generateTheaterFilm, readTheaterSnapshot, type TheaterFilm, type TheaterMood, type TheaterScene, type TheaterSource } from '../utils/memoryTheater';

interface Props { charId: string; charName: string; avatar?: string; onClose: () => void }
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

function TheaterScenery({ mood }: { mood: TheaterMood }) {
  return <div key={mood} className={`theater-scenery theater-scenery-${mood}`} aria-hidden="true">
    <div className="theater-halo"/><div className="theater-beam"/><div className="theater-glass-arch"/>
    <div className="theater-dust">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i, top: `${12 + (i * 31) % 76}%` } as React.CSSProperties}/>)}</div>
    {mood === 'rain' && <div className="theater-rain">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties}/>)}</div>}
    <svg className="theater-branches" viewBox="0 0 400 600" fill="none"><path d="M-12 520c76-98 2-167 116-253m-62 115c48-4 61-31 65-55-37 7-54 24-65 55Zm-9 50C1 403-5 372 2 355c28 22 32 42 31 77ZM418 577c-84-91-4-152-98-228m46 109c-42-7-55-29-54-50 31 7 49 25 54 50Z" stroke="currentColor" strokeWidth="1.2"/></svg>
  </div>;
}

function WindowArt({ mood = 'dawn', cover = false }: { mood?: TheaterMood; cover?: boolean }) {
  const clip = `theater-window-${useId().replace(/:/g, '')}`;
  const night = mood === 'night';
  return <div className={`theater-window-art${cover ? ' is-cover' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 320 290" fill="none">
      <defs><clipPath id={clip}><path d="M63 127a97 97 0 0 1 194 0v124H63V127Z"/></clipPath></defs>
      <ellipse cx="160" cy="274" rx="111" ry="9" fill="#b1a3b9" opacity=".11"/>
      <path d="M51 127a109 109 0 0 1 218 0v133H51V127Z" fill="#fffaf5" stroke="#fff" strokeWidth="2"/>
      <g clipPath={`url(#${clip})`}>
        <path d="M63 24h194v227H63Z" fill={night ? '#bec8e0' : mood === 'blossom' ? '#eed7e0' : '#d6e3eb'}/>
        <circle className="theater-window-orb" cx="211" cy="91" r="24" fill={night ? '#faf6f1' : '#f5e9d8'}/>
        {night && <circle cx="222" cy="83" r="22" fill="#bec8e0"/>}
        <path d="M63 188c53-30 74 14 118-15 37-24 54-6 76-15v93H63Z" fill={night ? '#afbcd3' : '#c3d3d3'}/>
        <path d="M63 225c57-29 125 12 194-13v39H63Z" fill={night ? '#9eadc7' : '#b1c4c9'}/>
        <path d="M160 30v221M63 151h194" stroke="#fff9f4" strokeWidth="4"/>
        <path d="M70 41 200 251M111 30l145 203" stroke="#fff" strokeWidth="17" opacity=".08"/>
      </g>
      <path d="M43 261h234" stroke="#dfd2cd" strokeWidth="4" strokeLinecap="round"/>
      <path d="M68 259c12-29 10-60-3-82m9 34c14-3 21-12 21-20-13 3-20 11-21 20Zm-1 20c-14-5-21-13-20-23 13 4 20 12 20 23Z" stroke="#aabcb1" strokeWidth="1.5"/>
      <g fill="#dec2d1"><ellipse cx="65" cy="176" rx="5" ry="10" transform="rotate(-24 65 176)"/><ellipse cx="74" cy="182" rx="5" ry="10" transform="rotate(49 74 182)"/></g>
      <path d="M231 247h28v11h-28Zm-7-7h28v7h-28Z" fill="#c9b9d1"/><path d="M229 241h20m-15 9h22" stroke="#f8f1f5" strokeWidth="2"/>
    </svg>
  </div>;
}

function OriginalQuote({ source, className = '' }: { source: TheaterSource; className?: string }) {
  return <figure className={`theater-original ${source.text.length > 65 ? 'is-long' : ''} ${className}`}>
    <blockquote>{source.text}{source.excerpt && '…'}</blockquote>
    <figcaption><span>{source.speaker}</span>{source.date && <time>{formatDate(source.date)}</time>}</figcaption>
  </figure>;
}

function SceneFrame({ scene }: { scene: TheaterScene }) {
  if (scene.shot === 'letter') return null;
  if (scene.shot === 'echo') return <div className="theater-shot-frame theater-echo">
    <span className="theater-frame-word" aria-hidden="true">AN ECHO</span>
    {scene.fragments.slice(0, 2).map((source, i) => <React.Fragment key={source.id}>{i > 0 && <div className="theater-echo-thread" aria-hidden="true"><i/><span>·</span><i/></div>}<OriginalQuote source={source}/></React.Fragment>)}
  </div>;
  if (scene.shot === 'montage' && scene.fragments.length) return <div className="theater-shot-frame theater-montage">
    <span className="theater-frame-word" aria-hidden="true">LITTLE MOMENTS</span>
    {scene.fragments.map((source, i) => <OriginalQuote key={source.id} source={source} className={`theater-fragment theater-fragment-${i}`}/>)}
  </div>;
  return <div className={`theater-shot-frame theater-closeup${scene.quote ? ' has-quote' : ''}`}>
    <WindowArt mood={scene.mood}/>{scene.quote && <OriginalQuote source={scene.quote}/>}
  </div>;
}

function Narration({ text }: { text: string }) {
  return <div className="theater-narration">{text.split(/\n+/).filter(Boolean).map((p, i) => <p key={i} style={{ animationDelay: `${i * .14}s` }}>{p}</p>)}</div>;
}

function SourceNotes({ scene, open, onToggle }: { scene: TheaterScene; open?: boolean; onToggle?: (open: boolean) => void }) {
  return <details className="theater-sources" open={open} onToggle={event => { if (event.currentTarget.isConnected) onToggle?.(event.currentTarget.open); }}>
    <summary>回忆的来处<ChevronDown size={13}/></summary>
    {scene.sources.map(source => <div key={source.id}><span>{source.speaker}{source.date && ` · ${formatDate(source.date)}`}</span><p>{source.text}{source.excerpt && '…'}</p></div>)}
  </details>;
}

export function MemoryTheater({ charId, charName, avatar, onClose }: Props) {
  const [film, setFilm] = useState<TheaterFilm | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [reading, setReading] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [asideOpen, setAsideOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hidden, setHidden] = useState(document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const scene = film?.scenes[index];
  const visibleQuotes = scene?.shot === 'echo' || scene?.shot === 'montage' ? scene.fragments : scene?.quote ? [scene.quote] : [];
  const duration = scene ? Math.max(14000, (Array.from(scene.narration).length + visibleQuotes.reduce((n, q) => n + Array.from(q.text).length, 0)) * 160 + 4500) : 14000;
  const ended = !!film && index === film.scenes.length;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { setReducedMotion(preference.matches); if (preference.matches) setPlaying(false); };
    document.addEventListener('visibilitychange', visibility); preference.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setFilm(null); setIndex(-1); setPlaying(false); setReading(false);
    // Strict Mode's discarded effect must not make a paid generation request.
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      try {
        const result = await generateTheaterFilm(readTheaterSnapshot(charId), controller.signal);
        if (!controller.signal.aborted) setFilm(result);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '显影暂时中断了，请重试。'); }
    });
    return () => controller.abort();
  }, [charId, attempt]);
  useEffect(() => {
    setElapsed(0); setSourcesOpen(false); setAsideOpen(false); body.current?.scrollTo(0, 0);
    if (dialog.current && !dialog.current.contains(document.activeElement)) dialog.current.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => { body.current?.scrollTo(0, 0); }, [reading]);
  useEffect(() => {
    if (!playing || !scene || reading || sourcesOpen || asideOpen || hidden) return;
    const timer = window.setInterval(() => setElapsed(n => n + 200), 200);
    return () => window.clearInterval(timer);
  }, [playing, scene, reading, sourcesOpen, asideOpen, hidden]);
  useEffect(() => {
    if (!playing || !scene || reading || sourcesOpen || asideOpen || hidden || elapsed < duration) return;
    setIndex(i => i + 1); setElapsed(0);
  }, [playing, scene, reading, sourcesOpen, asideOpen, hidden, elapsed, duration]);
  useEffect(() => {
    if (!playing || !scene || reading || sourcesOpen || asideOpen || hidden || reducedMotion || !body.current) return;
    const overflow = body.current.scrollHeight - body.current.clientHeight;
    // A long shot moves slowly through the page; any touch or scroll hands control back to the reader.
    if (overflow > 0) body.current.scrollTop = overflow * Math.max(0, Math.min(1, (elapsed / duration - .3) / .6));
  }, [playing, scene, reading, sourcesOpen, asideOpen, hidden, reducedMotion, elapsed, duration]);

  const turn = (next: number) => {
    if (!film) return;
    setSourcesOpen(false); setAsideOpen(false); setElapsed(0);
    setIndex(Math.max(-1, Math.min(film.scenes.length, next)));
    if (next < 0 || next >= film.scenes.length) setPlaying(false);
  };
  const start = () => { turn(0); setPlaying(!reducedMotion); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [href], [tabindex="0"]') ?? []).filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
    }
    if (reading || event.target instanceof HTMLElement && ['BUTTON', 'SUMMARY'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); turn(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); turn(index - 1); }
  };

  return <div ref={dialog} role="dialog" tabIndex={-1} aria-modal="true" aria-label="记忆放映室" onKeyDown={onKeyDown} className={`memory-theater${reading ? ' is-reading' : ''}`}>
    <TheaterScenery mood={reading ? 'dawn' : scene?.mood ?? (ended ? 'blossom' : 'night')}/>
    <header className="theater-toolbar"><span><Film size={15}/><span>记忆放映室<small>PRIVATE CINEMA</small></span></span><div>
      {film && <button type="button" className="theater-reading-toggle" onClick={() => { setPlaying(false); setReading(!reading); }} aria-label={reading ? '返回放映' : '完整阅读'}>{reading ? <Film size={15}/> : <BookOpen size={15}/>}<span>{reading ? '返回放映' : '完整阅读'}</span></button>}
      <button ref={closeButton} type="button" aria-label="离开放映室" onClick={onClose}><X size={19}/></button>
    </div></header>
    <div ref={body} className="theater-body" onWheel={() => setPlaying(false)} onTouchStart={() => setPlaying(false)} onPointerDown={() => setPlaying(false)}>
      {!film ? <div className="theater-wait" role="status" aria-live="polite">
        <div className={`theater-projector ${error ? 'is-still' : ''}`} aria-hidden="true"><span/><span/><div>{avatar ? <img src={avatar} alt=""/> : <Film size={27}/>}</div><i/></div>
        <p className="theater-kicker">BEHIND THE LITTLE MOMENTS</p><h2>{error ? '胶片暂未显影' : '有些片刻，值得再看一遍'}</h2>
        <p className="theater-wait-copy">{error || `正在拾起${charName}眼里的那些日常`}</p>
        {error ? <button className="theater-primary" type="button" onClick={() => setAttempt(n => n + 1)}><RotateCcw size={14}/>重新显影</button> : <div className="theater-loading" aria-hidden="true"><i/><i/><i/></div>}
        <small>离开后，这场放映便散场</small>
      </div> : reading ? <div className="theater-readlist theater-enter">
        <div className="theater-read-heading"><p className="theater-kicker">THROUGH MY EYES</p><h1>{film.title}</h1><span>{charName}的视角 · 回忆演绎</span>{film.dedication && <p>{film.dedication}</p>}</div>
        {film.openingQuote && <OriginalQuote source={film.openingQuote} className="theater-read-opening"/>}
        {film.scenes.map((s, i) => <section key={i} className="theater-read-scene"><span className="theater-read-number">{roman[i]}</span><h2>{s.title}</h2>
          {s.shot === 'echo' || s.shot === 'montage' ? s.fragments.map(source => <OriginalQuote key={source.id} source={source}/>) : s.quote && <OriginalQuote source={s.quote}/>}
          <Narration text={s.narration}/>{s.aside && <details className="theater-read-aside"><summary>镜头之外<ChevronDown size={13}/></summary><Narration text={s.aside}/></details>}<SourceNotes scene={s}/>
        </section>)}
        <div className="theater-read-ending"><p className="theater-kicker">THE LAST FRAME</p><Narration text={film.closing}/><button type="button" className="theater-primary" onClick={() => { setReading(false); turn(0); }}>回到放映<ArrowRight size={14}/></button></div>
      </div> : index < 0 ? <div className="theater-cover theater-enter" key="cover">
        <div className="theater-cover-poster"><WindowArt cover mood="night"/>{film.openingQuote ? <OriginalQuote source={film.openingQuote} className="theater-opening-line"/> : <span className="theater-poster-mark">THROUGH MY EYES</span>}</div>
        <p className="theater-kicker">A FILM ABOUT OUR LITTLE DAYS</p><h1>{film.title}</h1>
        {film.dedication && <p className="theater-dedication">{film.dedication}</p>}
        <div className="theater-cast">{avatar && <img src={avatar} alt=""/>}<span>{charName}的视角<i/>回忆演绎</span></div>
        <button type="button" className="theater-primary" onClick={start}><Play size={13} fill="currentColor"/>开始放映</button>
      </div> : ended ? <div className="theater-credits theater-enter" key="credits">
        <div className="theater-ending-orbit" aria-hidden="true"><span/><i/><span/></div><p className="theater-kicker">BACK TO THAT LITTLE MOMENT</p>
        {film.openingQuote && <OriginalQuote source={film.openingQuote} className="theater-reprise"/>}
        <Narration text={film.closing}/><div className="theater-hairline"/><small>{charName}的视角 · 仅此一场</small>
        <div className="theater-credits-actions"><button type="button" onClick={start}><RotateCcw size={14}/>再看一遍</button><button type="button" onClick={onClose}>散场<ArrowRight size={14}/></button></div>
      </div> : scene && <article key={index} className={`theater-scene theater-scene-${scene.shot} theater-enter`}>
        <div className="theater-scene-heading"><span className="theater-roman">{roman[index]}</span><div><span>{avatar && <img src={avatar} alt=""/>}{charName}的视角</span><h2>{scene.title}</h2></div></div>
        <SceneFrame scene={scene}/><div className={scene.shot === 'letter' ? 'theater-letter-paper' : 'theater-voice'}>{scene.shot === 'letter' && <span className="theater-letter-mark" aria-hidden="true">a page from me</span>}<Narration text={scene.narration}/></div>
        {scene.aside && <div className={`theater-folded-note${asideOpen ? ' is-open' : ''}`}><button type="button" aria-expanded={asideOpen} onClick={() => { setPlaying(false); setAsideOpen(!asideOpen); }}><span><BookOpen size={15}/>镜头之外</span><span>{asideOpen ? '合上' : '翻开这一页'}<ChevronDown size={13}/></span></button>{asideOpen && <Narration text={scene.aside}/>}</div>}
        <SourceNotes scene={scene} open={sourcesOpen} onToggle={open => { setSourcesOpen(open); if (open) setPlaying(false); }}/>
      </article>}
    </div>
    {film && index >= 0 && !ended && !reading && <footer className="theater-controls">
      <div className="theater-segments">{film.scenes.map((s, i) => <button type="button" key={i} aria-label={`第${i + 1}幕：${s.title}`} aria-current={i === index ? 'step' : undefined} onClick={() => turn(i)}><i style={{ width: i < index ? '100%' : i === index ? `${Math.min(100, elapsed / duration * 100)}%` : '0%' }}/></button>)}</div>
      <div className="theater-navigation"><button type="button" onClick={() => turn(index - 1)} aria-label="上一幕"><ArrowLeft size={18}/></button><span>{String(index + 1).padStart(2, '0')}<i/>{String(film.scenes.length).padStart(2, '0')}</span><button type="button" onClick={() => { setSourcesOpen(false); setAsideOpen(false); setPlaying(!playing); }} aria-label={playing ? '暂停放映' : '继续放映'}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button><button type="button" onClick={() => turn(index + 1)} aria-label="下一幕"><ArrowRight size={18}/></button></div>
    </footer>}
  </div>;
}
