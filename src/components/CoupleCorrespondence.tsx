import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gift, Heart, LoaderCircle, Mail, Send, X } from 'lucide-react';
import { COUPLE_REWARDS_EVENT, findCouponUse, fulfillCoupleLetter } from '../utils/coupleRewards';
import { generateCoupleLetter } from '../utils/coupleLetters';
import { readStoredValue } from '../utils/localStorage';

interface Message { id: string; senderId: string; kind?: string; title?: string; content?: string; createdAt: string; couponUseId?: string; couponProductId?: string; letterFromName?: string; letterToName?: string }
export function CoupleCorrespondence({ charId, message, onGift }: { charId: string; message: Message; onGift: (charId: string, useId: string) => void }) {
  const useId = message.couponUseId || (message.id.startsWith('coupon:') ? message.id.slice(7) : '');
  const [, setRevision] = useState(0), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [body, setBody] = useState(''), [title, setTitle] = useState('');
  const working = useRef(false), dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const use = useId ? findCouponUse(charId, useId) : undefined;
  const isEnvelope = message.kind === 'couple-letter';
  const isLetter = isEnvelope || use?.productId === 'letter';
  const completed = !!use?.fulfilledAt;
  let letter: Message | undefined = isEnvelope ? message : undefined;
  if (!letter && use?.fulfillmentMessageId && isLetter) {
    const chats = readStoredValue('yyphone:wechat-chats', [], (v): v is Array<{ id: string; messages: Message[] }> => Array.isArray(v));
    letter = chats.find(c => c.id === use.chatId)?.messages.find(m => m.id === use.fulfillmentMessageId);
  }
  const compose = isLetter && !letter && use?.owner === 'char' && !completed;
  useEffect(() => { const refresh = () => setRevision(n => n + 1); window.addEventListener(COUPLE_REWARDS_EVENT, refresh); return () => window.removeEventListener(COUPLE_REWARDS_EVENT, refresh); }, []);
  useEffect(() => { if (open) { const previous = document.activeElement as HTMLElement; close.current?.focus(); return () => { if (previous?.isConnected) previous.focus(); }; } }, [open]);
  const run = async (task: () => Promise<unknown>) => {
    if (working.current) return; working.current = true; setBusy(true); setError('');
    try { await task(); setRevision(n => n + 1); }
    catch(e) { setError(e instanceof Error ? e.message : '暂时未能寄达，请重试。'); }
    finally { working.current = false; setBusy(false); }
  };
  const click = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (use?.productId === 'gift' && !isEnvelope) { if (!completed) onGift(charId, use.id); return; }
    setOpen(true);
  };
  return <>
    {isLetter ? <button type="button" className={`couple-letter-envelope ${!letter ? 'is-pending' : ''}`} onClick={click} aria-label={letter ? '打开情书' : compose ? '为对方写情书' : '收取情书'}>
      <span className="couple-envelope-stamp"><Mail size={14} strokeWidth={1} /></span><span className="couple-envelope-fold" /><span className="couple-envelope-seal"><Heart size={15} fill="currentColor" /></span>
      <span className="couple-envelope-caption">{letter ? '有一封信，只写给你' : compose ? '等一封你亲手写的信' : '等一封写给你的信'}</span><small>{letter ? '轻启信封' : compose ? '写封情书' : '收取情书'}</small>
    </button> : <button type="button" className="yy-couple-coupon-card" onClick={click} disabled={completed || !use} aria-label={completed ? '礼物券已完成' : '去淘宝兑现礼物券'}><span><Gift size={19} strokeWidth={1.4} />礼物券</span><p>{completed ? '礼物已送达，心意已收下' : use?.owner === 'user' ? '去淘宝，挑一份对方送你的心意' : '去淘宝，为对方挑一份心意'}</p><small>{completed ? '礼物券 · 已完成' : '礼物券 · 待送达'}</small></button>}
    {open && createPortal(<div className="couple-letter-overlay" role="dialog" aria-modal="true" aria-label={letter ? '情书' : compose ? '写情书' : '收取情书'} ref={dialog} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()} onKeyDown={e => {
      e.stopPropagation(); if (e.key === 'Escape' && !busy) setOpen(false);
      if (e.key === 'Tab') { const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea'); const first = items?.[0], last = items?.[items.length-1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    }}><section className="couple-letter-paper"><button ref={close} type="button" className="couple-letter-close" onClick={() => setOpen(false)} aria-label="收起情书"><X size={18} /></button>
      <div className="couple-letter-mark"><Mail size={20} strokeWidth={1} /><span>ONLY FOR YOU</span></div>
      {letter ? <><h2>{letter.title}</h2><div className="couple-letter-reading"><p className="couple-letter-salutation">致 {letter.letterToName && !['我', 'user'].includes(letter.letterToName) ? letter.letterToName : '亲爱的你'}：</p>{letter.content?.split(/\n+/).filter(Boolean).map((p,i) => <p key={i}>{p}</p>)}<footer><span>{letter.letterFromName || '想念你的人'}</span><time>{new Date(letter.createdAt).toLocaleDateString('zh-CN')}</time></footer></div><div className="couple-letter-end">♡</div></> : compose ? <><h2>把心意写给 TA</h2><label className="couple-letter-title-input"><span>题笺</span><input aria-label="情书标题" maxLength={50} value={title} onChange={e => setTitle(e.target.value)} placeholder="给你的一封信" /></label><textarea aria-label="情书正文" value={body} onChange={e => setBody(e.target.value)} maxLength={2000} placeholder="有些话，想慢慢写给你……" /><small className="couple-letter-count">{Array.from(body).length} / 2000</small><button type="button" className="couple-letter-send" disabled={busy || !body.trim()} onClick={() => void run(() => fulfillCoupleLetter(charId, useId, 'user', {title,body}))}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}寄出情书</button></> : <><h2>{completed ? '这封信已经寄达' : '等一封，慢慢写的信'}</h2><p className="couple-letter-wait">{completed ? '可以从聊天中的信封重新打开。' : '那些没来得及说的话，会在这里落笔。'}</p>{!completed && <button type="button" className="couple-letter-send" disabled={busy} onClick={() => void run(() => generateCoupleLetter(charId, useId))}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Mail size={14} />}收取情书</button>}</>}
      {error && <p className="couple-letter-error" role="alert">{error}</p>}
    </section></div>, document.querySelector('.wechat-app') ?? document.body)}
  </>;
}
