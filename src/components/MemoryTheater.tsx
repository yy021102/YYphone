import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Film, Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import { generateTheaterFilm, readTheaterSnapshot, type TheaterFilm, type TheaterMood } from '../utils/memoryTheater';

interface Props { charId: string; charName: string; avatar?: string; onClose: () => void }
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

function TheaterScenery({ mood }: { mood: TheaterMood }) {
  return <div className={`theater-scenery theater-scenery-${mood}`} aria-hidden="true">
    <div className="theater-halo" /><div className="theater-beam" />
    <svg className="theater-botany" viewBox="0 0 400 480" fill="none">
      <path d="M-30 450C100 380 25 220 150 155M28 368Q112 353 166 273M42 310Q-5 258 2 207M86 232Q142 229 186 195M420 458Q299 341 357 209M346 353Q296 337 272 280" stroke="currentColor" strokeWidth="1" />
      {[[107,191,-20],[158,277,40],[3,217,-30],[173,199,45],[276,291,-38],[355,224,15]].map(([x,y,r], i) =>
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse cx="-9" cy="-7" rx="13" ry="7" fill="currentColor" opacity=".25" />
          <ellipse cx="8" cy="-9" rx="11" ry="7" fill="currentColor" opacity=".35" />
          <ellipse cx="0" cy="0" rx="12" ry="8" fill="currentColor" opacity=".2" />
        </g>)}
    </svg>
    <div className="theater-dust">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i, top: `${15 + (i * 37) % 80}%` } as React.CSSProperties} />)}</div>
    {mood === 'rain' && <div className="theater-rain">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>}
  </div>;
}

export function MemoryTheater({ charId, charName, avatar, onClose }: Props) {
  const [film, setFilm] = useState<TheaterFilm | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  // -1: opening titles; scenes.length: closing credits.
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const scene = film?.scenes[index];
  const duration = scene ? Math.max(14000, Array.from(scene.narration).length * 180 + (scene.quote ? 5000 : 0)) : 14000;
  const ended = !!film && index === film.scenes.length;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    // Defer until after effect setup so Strict Mode's discarded mount never starts an API request.
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      try {
        const snapshot = readTheaterSnapshot(charId);
        const result = await generateTheaterFilm(snapshot, controller.signal);
        if (!controller.signal.aborted) setFilm(result);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '显影暂时中断了，请重试。');
      }
    });
    return () => controller.abort();
  }, [charId, attempt]);

  useEffect(() => { setElapsed(0); setSourcesOpen(false); body.current?.scrollTo(0, 0); }, [index]);
  useEffect(() => {
    if (!playing || !scene || sourcesOpen) return;
    const timer = window.setInterval(() => setElapsed(n => n + 200), 200);
    return () => window.clearInterval(timer);
  }, [playing, scene, sourcesOpen]);
  useEffect(() => {
    if (!playing || !scene || elapsed < duration) return;
    setSourcesOpen(false);
    setIndex(i => i + 1);
    setElapsed(0);
  }, [playing, scene, elapsed, duration]);

  const turn = (next: number) => {
    if (!film) return;
    setSourcesOpen(false);
    setIndex(Math.max(-1, Math.min(film.scenes.length, next)));
    setElapsed(0);
    if (next < 0 || next >= film.scenes.length) setPlaying(false);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [href], [tabindex="0"]');
      const first = nodes?.[0], last = nodes?.[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.target instanceof HTMLElement && ['BUTTON', 'SUMMARY'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); turn(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); turn(index - 1); }
  };

  return <div ref={dialog} role="dialog" aria-modal="true" aria-label="记忆放映室" onKeyDown={onKeyDown} className="memory-theater">
    <TheaterScenery mood={scene?.mood ?? (ended ? 'blossom' : 'night')} />
    <header className="theater-toolbar"><span><Film size={14} />记忆放映室</span><button ref={closeButton} type="button" aria-label="离开放映室" onClick={onClose}><X size={19} /></button></header>
    <div ref={body} className="theater-body" onWheel={() => setPlaying(false)} onTouchStart={() => setPlaying(false)}>
      {!film ? <div className="theater-wait" role="status" aria-live="polite">
        <div className={`theater-projector ${error ? 'is-still' : ''}`}><span /><span /><div>{avatar ? <img src={avatar} alt="" /> : <Film size={27} />}</div><i /></div>
        <p className="theater-kicker">PRIVATE CINEMA</p>
        <h2>{error ? '胶片暂未显影' : '让时光，慢一点'}</h2>
        <p className="theater-wait-copy">{error || `正在拾起你与${charName}的片刻`}</p>
        {error ? <button className="theater-primary" type="button" onClick={() => setAttempt(n => n + 1)}><RotateCcw size={14} />重新显影</button> : <div className="theater-loading"><i /><i /><i /></div>}
        <small>此刻的放映，离开便散场</small>
      </div> : index < 0 ? <div className="theater-cover theater-enter" key="cover">
        <div className="theater-cover-seal"><Film size={23} strokeWidth={1} /><span>一场私人的放映</span></div>
        <p className="theater-kicker">FOR YOU, FROM THOSE DAYS</p>
        <h1>{film.title}</h1>
        <div className="theater-hairline" />
        <p className="theater-dedication">{film.dedication || `关于你，关于${charName}，关于没有被快进的时光。`}</p>
        <div className="theater-cast">{avatar && <img src={avatar} alt="" />}<span>你与{charName}</span></div>
        <button type="button" className="theater-primary" onClick={() => { turn(0); setPlaying(true); }}><Play size={13} fill="currentColor" />开始放映</button>
        <p className="theater-cover-foot">仅此一场 · 不留副本</p>
      </div> : ended ? <div className="theater-credits theater-enter" key="credits">
        <Sparkles size={26} strokeWidth={1} />
        <p className="theater-kicker">THE STORY CONTINUES</p>
        <h2>而此刻，仍在发生</h2>
        <p>{film.closing}</p>
        <div className="theater-hairline" /><small>出演 · 你与{charName}</small>
        <div className="theater-credits-actions"><button type="button" onClick={() => { turn(0); setPlaying(true); }}><RotateCcw size={14} />再看一遍</button><button type="button" onClick={onClose}>带着余温离开<ArrowRight size={14} /></button></div>
      </div> : scene && <article key={index} className="theater-scene theater-enter">
        <div className="theater-scene-heading"><span className="theater-roman">{roman[index]}</span><p>RECOLLECTION<small>那些被记得的瞬间</small></p></div>
        <h2>{scene.title}</h2>
        <div className="theater-narration">{scene.narration.split(/\n+/).filter(Boolean).map((p, i) => <p key={i} style={{ animationDelay: `${i * .3}s` }}>{p}</p>)}</div>
        {scene.quote && <figure className="theater-quote"><span aria-hidden="true">“</span><blockquote>{scene.quote.text}{scene.quote.excerpt && '…'}</blockquote><figcaption>{scene.quote.speaker}{scene.quote.date && <time>{formatDate(scene.quote.date)}</time>}</figcaption></figure>}
        <details className="theater-sources" open={sourcesOpen} onToggle={event => { if (!event.currentTarget.isConnected) return; const open = event.currentTarget.open; setSourcesOpen(open); if (open) setPlaying(false); }}>
          <summary>这一幕的来处<span>{sourcesOpen ? '收起' : '展开'}</span></summary>
          {scene.sources.map(source => <div key={source.id}><span>{source.speaker}{source.date && ` · ${formatDate(source.date)}`}</span><p>{source.text}{source.excerpt && '…'}</p></div>)}
        </details>
      </article>}
    </div>
    {film && index >= 0 && !ended && <footer className="theater-controls">
      <div className="theater-segments">{film.scenes.map((s, i) => <button type="button" key={i} aria-label={`第${i + 1}幕：${s.title}`} aria-current={i === index ? 'step' : undefined} onClick={() => turn(i)}><i style={{ width: i < index ? '100%' : i === index ? `${Math.min(100, elapsed / duration * 100)}%` : '0%' }} /></button>)}</div>
      <div className="theater-navigation"><button type="button" onClick={() => turn(index - 1)} aria-label="上一幕"><ArrowLeft size={18} /></button><span>{String(index + 1).padStart(2, '0')}<i />{String(film.scenes.length).padStart(2, '0')}</span><button type="button" onClick={() => { setSourcesOpen(false); setPlaying(!playing); }} aria-label={playing ? '暂停放映' : '继续放映'}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><button type="button" onClick={() => turn(index + 1)} aria-label="下一幕"><ArrowRight size={18} /></button></div>
    </footer>}
  </div>;
}
