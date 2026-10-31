import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, MoreHorizontal, Pencil, RotateCcw, Send, Square, Trash2 } from 'lucide-react';
import type { PlayerXianyuProfile, XianyuChatThread, XianyuProduct } from '../apps/TaobaoApp';

export function XianyuConversationPanel({ thread, listing, profile, busy, onBack, onDeleteThread, onDeleteMessage, onEditMessage, onGenerate, onStop, onPrice, onBuy, onShare, input, setInput }: {
  thread: XianyuChatThread; listing?: XianyuProduct; profile: PlayerXianyuProfile; busy: boolean;
  onBack: () => void; onDeleteThread: () => void; onDeleteMessage: (id: string) => void; onEditMessage: (id: string, text: string) => void;
  onGenerate: (mode: 'send' | 'continue' | 'reroll') => void; onStop: () => void; onPrice: (price: number) => Promise<void>; onBuy: () => void; onShare: () => void;
  input: string; setInput: (value: string) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null), [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [price, setPrice] = useState<string | null>(null), [priceBusy, setPriceBusy] = useState(false), [error, setError] = useState('');
  const rail = useRef<HTMLDivElement>(null), hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => () => cancelHold(), []);
  useEffect(() => { if (rail.current) rail.current.scrollTop = rail.current.scrollHeight; }, [thread.messages.length, thread.messages.at(-1)?.id, busy]);
  const sold = !!listing?.soldToThreadId, last = thread.messages.at(-1), amount = listing?.price ?? thread.itemPrice;
  return <section className="xy-conversation" aria-label="闲鱼对话">
    <header className="xy-conversation-header"><button type="button" aria-label="返回闲鱼消息" onClick={onBack}><ArrowLeft size={18}/></button><div><h3>{thread.peerName}</h3><small>{thread.isPlayerItem ? '买家' : '卖家'}{thread.linkedCharId && ' · 角色账号'}</small></div>{thread.linkedCharId && <button type="button" className="xy-memory-switch" aria-pressed={thread.shareWithChar !== false} disabled={busy} onClick={onShare}>{thread.shareWithChar === false ? '记忆关闭' : '记忆已连通'}</button>}<button type="button" aria-label="删除这段对话" disabled={busy} onClick={onDeleteThread}><Trash2 size={16}/></button></header>
    <div className="xy-listing-strip"><div className="xy-listing-picture">{listing?.imageUrl ? <img src={listing.imageUrl} alt=""/> : listing?.emoji || '📦'}</div><div><strong>{listing?.title ?? thread.itemTitle}</strong><small>{sold ? '已售出' : listing?.freeShipping ? '在售 · 包邮' : '在售 · 运费另议'}</small><b>¥{amount.toFixed(2)}</b></div><button type="button" disabled={sold || !listing || busy} onClick={() => { if (thread.isPlayerItem) { setPrice(String(amount)); setError(''); } else onBuy(); }}>{sold ? '已成交' : thread.isPlayerItem ? '修改价格' : '我想要'}</button></div>
    {sold && <p className="xy-sale-status" role="status"><Check size={13}/>{listing?.soldToThreadId === thread.id ? `已成交，¥${amount.toFixed(2)} 已入账` : '商品已售出'}</p>}
    <div className="xy-chat-messages" ref={rail} onClick={e => { if (e.target === e.currentTarget) setMenu(null); }}>
      {!thread.messages.length && <p className="xy-empty-chat">有喜欢的，聊聊再决定</p>}
      {thread.messages.map((m, i) => <div className={`xy-message ${m.sender === 'me' ? 'is-me' : ''}`} key={m.id}>
        {(i === 0 || thread.messages[i - 1].time !== m.time) && <time>{m.time}</time>}
        <div className="xy-message-row"><div className="xy-chat-avatar">{m.sender === 'me' && profile.avatarUrl ? <img src={profile.avatarUrl} alt=""/> : m.sender === 'me' ? (profile.nickname || '我').slice(0, 1) : thread.peerName.slice(0, 1)}</div><div className="xy-message-body">
          <div className="xy-bubble" onContextMenu={e => { e.preventDefault(); setMenu(m.id); }} onPointerDown={e => { if (e.button !== 0) return; cancelHold(); hold.current = setTimeout(() => setMenu(m.id), 500); }} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerMove={cancelHold}>{m.text}</div>
          {m.priceChange && <div className="xy-price-card"><small>卖家已修改价格</small><div><del>¥{m.priceChange.before.toFixed(2)}</del><strong>¥{m.priceChange.after.toFixed(2)}</strong></div><span>以商品卡片当前价格为准</span></div>}
          <button type="button" className="xy-message-more" aria-label={`消息操作${i + 1}`} onClick={() => setMenu(menu === m.id ? null : m.id)}><MoreHorizontal size={14}/></button>
          {menu === m.id && <div className="xy-message-actions"><button type="button" disabled={busy} onClick={() => { setEditing({ id: m.id, text: m.text }); setMenu(null); }}><Pencil size={12}/>编辑</button>{m.sender === 'peer' && m.id === last?.id && !sold && <button type="button" disabled={busy} onClick={() => { setMenu(null); onGenerate('reroll'); }}><RotateCcw size={12}/>重新生成</button>}<button type="button" disabled={busy} onClick={() => { if (!m.priceChange || window.confirm('仅删除消息，不会撤销已经生效的改价。')) { onDeleteMessage(m.id); setMenu(null); } }}><Trash2 size={12}/>删除</button></div>}
        </div></div>
      </div>)}
      {busy && <p className="xy-typing" role="status">对方正在输入…</p>}
    </div>
    <div className="xy-composer-tools">{busy ? <button type="button" onClick={onStop}><Square size={12}/>停止生成</button> : <button type="button" disabled={!listing || sold && last?.sender === 'peer'} onClick={() => onGenerate(last?.sender === 'peer' && !sold ? 'reroll' : 'continue')}><RotateCcw size={12}/>{last?.sender === 'peer' ? '重新生成' : last?.sender === 'me' ? '生成回复' : '让对方说话'}</button>}</div>
    <form className="xy-composer" onSubmit={e => { e.preventDefault(); onGenerate('send'); }}><textarea aria-label="闲鱼消息" placeholder="想问的，直接聊聊" maxLength={4000} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onGenerate('send'); } }}/><button type="submit" disabled={busy || !input.trim()} aria-label="发送闲鱼消息"><Send size={18}/></button></form>
    {editing && <div className="xy-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}><form role="dialog" aria-label="编辑闲鱼消息" aria-modal="true" className="xy-edit-sheet" onSubmit={e => { e.preventDefault(); onEditMessage(editing.id, editing.text); setEditing(null); }}><h4>编辑消息</h4><textarea aria-label="消息内容" maxLength={4000} rows={5} value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })}/><div><button type="button" onClick={() => setEditing(null)}>取消</button><button type="submit" disabled={busy || !editing.text.trim()}>保存</button></div></form></div>}
    {price !== null && <div className="xy-modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !priceBusy) setPrice(null); }}><form role="dialog" aria-label="修改闲鱼价格" aria-modal="true" className="xy-edit-sheet" onSubmit={async e => { e.preventDefault(); if (priceBusy) return; setPriceBusy(true); try { await onPrice(Number(price)); setPrice(null); } catch (e) { setError(e instanceof Error ? e.message : '改价失败'); } finally { setPriceBusy(false); } }}><h4>修改价格</h4><p>修改后，商品与付款金额会同步更新。</p><label>商品总价<input aria-label="闲鱼新价格" type="number" min="0" max="1000000" step="0.01" required value={price} onChange={e => setPrice(e.target.value)}/></label>{error && <p role="alert">{error}</p>}<div><button type="button" disabled={priceBusy} onClick={() => setPrice(null)}>取消</button><button type="submit" disabled={priceBusy || busy || !price.trim()}>确认改价</button></div></form></div>}
  </section>;
}
