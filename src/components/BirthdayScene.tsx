import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Check, Mail, Music2, VolumeX, X } from 'lucide-react';
import { keepBirthdayLetter, shareBirthdayLetter, type BirthdayLetter } from '../utils/birthday';

export function BirthdayCake({ lit = false, miniature = false }: { lit?: boolean; miniature?: boolean }) {
  return <div className={`birthday-cake ${lit ? 'is-lit' : ''} ${miniature ? 'is-miniature' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 360 320" fill="none">
      <defs>
        <linearGradient id="bd-cake-body" x1="90" y1="155" x2="263" y2="257" gradientUnits="userSpaceOnUse"><stop stopColor="#fffef9"/><stop offset=".55" stopColor="#f7e6df"/><stop offset="1" stopColor="#debfc6"/></linearGradient>
        <linearGradient id="bd-plate" x1="50" y1="245" x2="309" y2="285" gradientUnits="userSpaceOnUse"><stop stopColor="#f9fbff"/><stop offset=".5" stopColor="#d4e4ec"/><stop offset="1" stopColor="#fffaf6"/></linearGradient>
        <linearGradient id="bd-ribbon" x1="90" y1="200" x2="269" y2="230" gradientUnits="userSpaceOnUse"><stop stopColor="#e5bbc5"/><stop offset=".5" stopColor="#f6dce0"/><stop offset="1" stopColor="#c993a9"/></linearGradient>
        <linearGradient id="bd-flame" x1="179" y1="48" x2="180" y2="83" gradientUnits="userSpaceOnUse"><stop stopColor="#e9b87b"/><stop offset=".5" stopColor="#ffdda8"/><stop offset="1" stopColor="#fff8d9"/></linearGradient>
        <radialGradient id="bd-top"><stop stopColor="#fffdf6"/><stop offset="1" stopColor="#f3dedc"/></radialGradient>
        <filter id="bd-shadow" x="0" y="0" width="360" height="320" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="10"/></filter>
      </defs>
      <ellipse cx="181" cy="274" rx="117" ry="15" fill="#967990" opacity=".16" filter="url(#bd-shadow)"/>
      <ellipse cx="180" cy="258" rx="140" ry="37" fill="url(#bd-plate)" stroke="white" strokeWidth="1.5"/>
      <ellipse cx="180" cy="253" rx="123" ry="27" fill="#fcfbfa" stroke="#e4dfe4"/>
      <path d="M88 157H272V232C272 265 88 265 88 232V157Z" fill="url(#bd-cake-body)"/>
      <path d="M88 211C125 236 234 236 272 211V224C234 251 125 251 88 224V211Z" fill="url(#bd-ribbon)"/>
      <ellipse cx="180" cy="157" rx="92" ry="29" fill="url(#bd-top)" stroke="#fffdf9" strokeWidth="2"/>
      <path d="M89 160C93 168 99 167 101 178C103 188 113 188 116 179C119 171 131 180 136 181C144 183 142 194 151 194C161 194 158 181 168 182C179 185 184 187 192 182C200 179 205 181 208 191C210 198 220 196 221 188C223 174 235 180 241 177C249 174 251 174 254 179C260 185 265 178 269 164" stroke="#fffdf7" strokeWidth="7" strokeLinecap="round"/>
      {[105, 133, 165, 197, 229, 254].map((x, i) => <g key={x} transform={`translate(${x} ${145 + Math.sin(i * .8) * 11})`}><ellipse rx="8" ry="5" fill="#fffefa"/><path d="M-5 0Q-3-9 0-6Q3-10 5 0" fill="#fffaf3" stroke="#f3e6e0" strokeWidth=".6"/></g>)}
      <g transform="translate(132 147)"><path d="M-15 2Q-22-17-6-19Q8-22 11-8Q11 10-3 9Z" fill="#b7cabb"/><path d="M-9-2Q-12-16-1-13Q8-14 5-4Q1 6-9-2Z" fill="#efd5dc" stroke="#d6aebc"/><path d="M-4-5Q-2-11 2-6L-1-2Z" fill="#e3b6c6"/></g>
      <g transform="translate(224 150) rotate(25)"><path d="M-11 3Q-20-14-4-17Q12-17 11-4Q7 9-11 3Z" fill="#b9cbbe"/><path d="M-8 0Q-12-12-2-12Q9-12 5-2Q0 8-8 0Z" fill="#e4dbe9" stroke="#c4b5cf"/><path d="M-3-3Q-1-8 3-4L0 0Z" fill="#c6b5d4"/></g>
      <path d="M174 90Q180 87 186 90V147Q180 152 174 147Z" fill="#f8fcfc" stroke="#d4dfe3"/>
      <path d="M174 100L186 96M174 113L186 109M174 126L186 122M174 139L186 135" stroke="#d2b9c9" strokeWidth="3"/>
      <path d="M180 90V82" stroke="#7f7474" strokeWidth="1.6" strokeLinecap="round"/>
      {lit && <g className="birthday-flame"><path d="M180 47C180 60 166 65 172 77C177 88 191 80 189 71C188 63 183 58 180 47Z" fill="url(#bd-flame)"/><path d="M180 65Q170 81 180 82Q187 79 180 65Z" fill="#fffdf1"/></g>}
      <g transform="translate(180 233)"><path d="M0 0C-24-28-41-12-28-3Q-16 8 0 0C24-28 41-12 28-3Q16 8 0 0Z" fill="#f8e8eb" stroke="#d1a4b4" strokeWidth="1.3"/><path d="M-2 1L-17 22L-18 10M2 1L20 20L18 9" stroke="#e4becb" strokeWidth="6"/><ellipse rx="5" ry="5" fill="#d9b0c0"/></g>
      {[[109, 200], [148, 211], [210, 212], [251, 199]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.5" fill="#e0c79d"/>)}
    </svg>
  </div>;
}

function useBirthdayMusic(initial: boolean) {
  const [enabled, setEnabled] = useState(initial);
  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const context = audio.current; audio.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  };
  const play = () => {
    if (audio.current) return;
    try {
      const context = new AudioContext(); audio.current = context;
      void context.resume().catch(stop);
      // A quiet, original pentatonic music-box phrase. Started only by a touch.
      const phrase = () => [0, 4, 7, 12, 9, 7, 4, 2].forEach((note, i) => {
        if (context.state === 'closed') return;
        const oscillator = context.createOscillator(), gain = context.createGain();
        const at = context.currentTime + i * .55;
        oscillator.type = 'sine'; oscillator.frequency.value = 523.25 * 2 ** (note / 12);
        gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.035, at + .015);
        gain.gain.exponentialRampToValueAtTime(.0001, at + 1.8);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(at); oscillator.stop(at + 2);
      });
      phrase(); timer.current = setInterval(phrase, 6500);
    } catch { stop(); setEnabled(false); }
  };
  useEffect(() => stop, []);
  return { enabled, start: () => { if (enabled) play(); }, toggle: () => { if (enabled) stop(); else play(); setEnabled(!enabled); } };
}

interface Props {
  date: string; userName: string; letters: BirthdayLetter[]; music: boolean;
  preview?: boolean; preparing?: boolean; error?: string; onPrepare?: () => void;
  onClose: () => void; onOpenChat?: (chatId: string) => void;
}
export function BirthdayScene({ date, userName, letters, music, preview, preparing, error, onPrepare, onClose, onOpenChat }: Props) {
  const [stage, setStage] = useState<'arrival' | 'wish' | 'mail'>('arrival');
  const [blowing, setBlowing] = useState(false);
  const [wish, setWish] = useState('');
  const [opened, setOpened] = useState<BirthdayLetter | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const root = useRef<HTMLElement>(null), transition = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true), musicBox = useBirthdayMusic(music);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    return () => { alive.current = false; if (transition.current) clearTimeout(transition.current); previous?.focus(); };
  }, []);
  useEffect(() => {
    root.current?.focus();
  }, [stage, opened]);
  const extinguish = () => {
    if (blowing) return;
    setBlowing(true);
    transition.current = setTimeout(() => { setStage('mail'); setBlowing(false); }, 1100);
  };
  const action = async (kind: 'keep' | 'share') => {
    if (!opened || busy) return;
    if (preview) { setNotice('预览中的来信不会写入收藏或聊天。'); return; }
    setBusy(true); setNotice('');
    try {
      if (kind === 'keep') {
        await keepBirthdayLetter(opened);
        if (alive.current) { setSavedIds(ids => [...ids, opened.id]); setNotice('这封信，已经替你好好收起来了。'); }
      } else {
        const chatId = await shareBirthdayLetter(opened);
        if (alive.current) { onClose(); onOpenChat?.(chatId); }
      }
    } catch (err) { if (alive.current) setNotice(err instanceof Error ? err.message : '暂时没有保存成功，请重试。'); }
    finally { if (alive.current) setBusy(false); }
  };
  const dateParts = date.split('-');
  return <section ref={root} tabIndex={-1} className={`birthday-scene birthday-stage-${stage} ${blowing ? 'is-blowing' : ''} ${opened ? 'is-reading' : ''}`}
    role="dialog" aria-modal="true" aria-label={preview ? '生日开屏预览' : '生日开屏'}
    onPointerDown={e => e.stopPropagation()}
    onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); if (opened) { setOpened(null); setNotice(''); } else closeRef.current(); }
      if (e.key === 'Tab') {
        const focusables = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, [href]')].filter(el => el.getClientRects().length > 0);
        const first = focusables[0], last = focusables.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { e.preventDefault(); first?.focus(); }
      }
    }}>
    <div className="birthday-atmosphere" aria-hidden="true"><i/><i/><i/>
      {Array.from({ length: 18 }, (_, i) => <span key={i} style={{ '--i': i, left: `${(i * 37 + 11) % 100}%`, top: `${(i * 23 + 7) % 100}%` } as React.CSSProperties}>✧</span>)}
    </div>
    <header className="birthday-toolbar">
      {opened ? <button type="button" aria-label="返回生日信笺" onClick={() => { setOpened(null); setNotice(''); }}><ArrowLeft size={19}/></button>
        : <span className="birthday-edition">{preview ? '生日预览' : '只属于今天'}<span> · {dateParts[0]}</span></span>}
      <div><button type="button" onClick={musicBox.toggle} aria-label={musicBox.enabled ? '关闭生日音乐' : '开启生日音乐'} aria-pressed={musicBox.enabled}>{musicBox.enabled ? <Music2 size={17}/> : <VolumeX size={17}/>}</button>
        <button type="button" onClick={onClose} aria-label="关闭生日开屏"><X size={19}/></button></div>
    </header>
    {opened ? <div className="birthday-letter-scroll" key={opened.id}>
      <article className="birthday-letter-paper">
        <div className="birthday-letter-rule"><span>留给你的这一页</span><span>{dateParts[1]} / {dateParts[2]}</span></div>
        <span className="birthday-paper-star" aria-hidden="true">✧</span>
        <h1>{opened.title}</h1>
        <p className="birthday-salutation">致 {opened.userName}：</p>
        <div className="birthday-letter-body">{opened.body.split(/\n\s*\n|\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
        <div className="birthday-signature">{opened.avatarUrl && <img src={opened.avatarUrl} alt=""/>}<span>{opened.characterName}<small>写于 {new Date(opened.writtenAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></span></div>
        <div className="birthday-letter-end" aria-hidden="true">✦</div>
      </article>
      <div className="birthday-letter-actions"><button type="button" disabled={busy || savedIds.includes(opened.id)} onClick={() => void action('keep')}>{savedIds.includes(opened.id) ? <Check size={16}/> : <Bookmark size={16}/>} {savedIds.includes(opened.id) ? '已珍藏' : '珍藏来信'}</button><button type="button" disabled={busy} onClick={() => void action('share')}>带回聊天 <ArrowRight size={16}/></button></div>
      {notice && <p className="birthday-notice" role="status">{notice}</p>}
      <button type="button" className="birthday-text-button birthday-read-done" onClick={() => { setOpened(null); setNotice(''); }}>把信轻轻收好</button>
    </div> : stage !== 'mail' ? <div className="birthday-ceremony">
      <div className="birthday-date"><span>{dateParts[1]}</span><i/><span>{dateParts[2]}</span></div>
      <div className="birthday-heading" key={stage}><p>{userName}，生日快乐</p><h1>{stage === 'arrival' ? <>今天，<br/>有人在等你。</> : <>许个愿吧。<br/><em>慢慢来，也没关系。</em></>}</h1><span>{stage === 'arrival' ? '把世界的喧闹，暂时留在门外。' : '有些愿望，不说出来也会发光。'}</span></div>
      <div className="birthday-cake-stage">
        <div className="birthday-halo"/>
        <button type="button" className="birthday-cake-touch" aria-label={stage === 'arrival' ? '点亮蛋糕上的蜡烛' : '吹灭蛋糕上的蜡烛'} disabled={blowing}
          onClick={() => { musicBox.start(); if (stage === 'arrival') setStage('wish'); else extinguish(); }}><BirthdayCake lit={stage === 'wish' && !blowing}/></button>
        {blowing && <div className="birthday-wish-stars" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <span key={i} style={{ '--i': i, '--angle': `${i * 18}deg` } as React.CSSProperties}>✦</span>)}</div>}
        <p className="birthday-cake-caption">一盏小小的光 · 一年新的愿望</p>
      </div>
      {stage === 'wish' && <textarea className="birthday-wish-input" aria-label="生日愿望" placeholder="把愿望藏在这里，或留在心里" value={wish} onChange={e => setWish(e.target.value)} maxLength={600} rows={2}/>}
      <div className="birthday-ceremony-bottom"><button type="button" className="birthday-primary" disabled={blowing} onClick={() => { musicBox.start(); if (stage === 'arrival') setStage('wish'); else extinguish(); }}>{blowing ? '愿你所愿，慢慢成真' : stage === 'arrival' ? '点亮生日蜡烛' : '吹灭蜡烛，收下祝福'}<span aria-hidden="true">✧</span></button>
        <button type="button" className="birthday-text-button" onClick={() => { musicBox.start(); setStage('mail'); }}>直接拆信 <ArrowRight size={13}/></button></div>
    </div> : <div className="birthday-mailroom">
      <div className="birthday-heading"><p>烛光熄灭，心意还亮着</p><h1>这些话，<br/>想留给今天的你。</h1></div>
      <div className="birthday-mail-list">{letters.map((letter, i) => <button type="button" className={`birthday-envelope ${readIds.includes(letter.id) ? 'is-read' : ''}`} key={letter.id} style={{ '--order': i } as React.CSSProperties}
        onClick={() => { setOpened(letter); setReadIds(ids => [...new Set([...ids, letter.id])]); setNotice(''); }} aria-label={`拆开${letter.characterName}的生日来信`}>
        <span className="birthday-envelope-top"/><span className="birthday-envelope-stamp">{letter.avatarUrl ? <img src={letter.avatarUrl} alt=""/> : <Mail size={21}/>}</span>
        <span className="birthday-envelope-name">给 {letter.userName}<small>{letter.characterName} 亲笔</small></span>
        <span className="birthday-envelope-seal">{readIds.includes(letter.id) ? <Check size={17}/> : '✧'}</span>
        <span className="birthday-envelope-bottom"><span>{readIds.includes(letter.id) ? '再读一遍' : '拆开这封信'}</span><ArrowRight size={14}/></span>
      </button>)}</div>
      {!letters.length && <article className="birthday-quiet-wish"><span aria-hidden="true">✧</span><h2>今天，先好好爱自己。</h2><p>愿新的一岁，有让你期待的明天，<br/>也有可以安心停下来的今天。</p><p>不必赶路，不必急着成为谁。<br/>你来到这个世界，本身就值得庆祝。</p><small>小手机，留给今天的你</small></article>}
      {onPrepare && <button type="button" className="birthday-text-button" disabled={preparing} onClick={onPrepare}>{preparing ? '信纸上，心意正在慢慢落笔…' : letters.length ? '收取其余来信' : '收取角色来信'}</button>}
      {error && <p className="birthday-notice" role="status">{error}</p>}
      <button type="button" className="birthday-primary birthday-return" onClick={onClose}>带着祝福，开始今天 <ArrowRight size={16}/></button>
    </div>}
  </section>;
}
