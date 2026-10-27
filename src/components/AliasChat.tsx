import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Copy, Heart, Image, MoreHorizontal, Pencil, Plus, Send, ShieldCheck, Smile, Trash2, UserRound, X } from 'lucide-react';
import { aliasCharacter, aliasMessageContext, aliasPeer, aliasRoundThought, aliasSelf, deleteAliasMessage, editAliasMessage, readAliasState, revealUserAlias, sendAliasMessage, updateAliasThread, writeAliasState, type AliasMessage, type AliasState, type AliasThread } from '../utils/aliasAccounts';
import { applyWithAlias, generateAliasReply } from '../utils/aliasAi';
import './wechatAliases.css';

function Avatar({ name, url }: { name: string; url?: string }) {
  return <span className="alias-avatar yy-chat-avatar">{url ? <img src={url} alt="" /> : name.trim().slice(0, 1) || <UserRound size={20} />}</span>;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试。';

export function AliasChat({ thread, state, onBack, wallpaper, userColor, characterColor }: { thread: AliasThread; state: AliasState; onBack: () => void; wallpaper?: string; userColor: string; characterColor: string }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [menu, setMenu] = useState(false), [extras, setExtras] = useState<'more' | 'emoji' | ''>('');
  const [messageMenu, setMessageMenu] = useState(''), [thought, setThought] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [imageDraft, setImageDraft] = useState<string | null>(null), [imagePreview, setImagePreview] = useState<AliasMessage | null>(null);
  const bottom = useRef<HTMLDivElement>(null), alive = useRef(true);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null), pressed = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });
  const peer = aliasPeer(thread, state), self = aliasSelf(thread, state);
  const locked = thread.status !== 'accepted' || thread.blocked || !!thread.removedByCharacterAt;
  const stopPress = () => { if (press.current) clearTimeout(press.current); press.current = null; };
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopPress(); }; }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
    if (thread.unread) { const next = readAliasState(); writeAliasState({ ...next, threads: next.threads.map(t => t.id === thread.id ? { ...t, unread: 0 } : t) }); }
  }, [thread.id, thread.messages.length, thread.unread]);
  const act = async (task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await task(); } catch (e) { if (alive.current) setError(errorText(e)); } finally { if (alive.current) setBusy(false); } };
  const send = (value = text, kind: 'text' | 'image' = 'text') => {
    try { sendAliasMessage(thread.id, value, kind); if (kind === 'text') setText(''); else setImageDraft(null); setExtras(''); setError(''); } catch (e) { setError(errorText(e)); }
  };
  if (!peer || !self) return null;
  const backdrop = (close: () => void) => ({ onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget) close(); } });
  return <section className="alias-chat yy-chat-surface" style={{ '--yy-user-bubble-color': userColor, '--yy-character-bubble-color': characterColor } as React.CSSProperties} onKeyDown={event => { if (event.key === 'Escape') { setThought(null); setEditing(null); setImageDraft(null); setImagePreview(null); setMessageMenu(''); setExtras(''); setMenu(false); } }}>
    <header className="alias-chat-header yy-wechat-header"><button type="button" aria-label="返回消息列表" onClick={onBack}><ArrowLeft size={23} /></button><div><strong>{busy ? '对方正在输入…' : peer.name}</strong><small>{thread.userAccountId !== 'main' ? `以 ${self.name} 聊天` : peer.handle}</small></div><button type="button" aria-label="小号对话设置" onClick={() => setMenu(v => !v)}><MoreHorizontal size={24} /></button></header>
    {menu && <div className="alias-chat-menu"><div className="alias-profile-line"><Avatar name={peer.name} url={peer.avatarUrl} /><span><strong>{peer.name}</strong><small>{peer.handle}</small></span></div>{peer.bio && <p>{peer.bio}</p>}{thread.identity === 'revealed' && <p className="alias-confirmed"><ShieldCheck size={14} />身份已公开{thread.characterAccountId !== 'main' ? ` · ${aliasCharacter(thread.charId)?.name}` : ''}</p>}<div className="alias-actions"><button type="button" onClick={() => { try { updateAliasThread(thread.id, t => ({ ...t, blocked: !t.blocked })); setMenu(false); } catch (e) { setError(errorText(e)); } }}>{thread.blocked ? '解除拉黑' : '拉黑此账号'}</button><button type="button" className="is-danger" onClick={() => { if (!window.confirm('删除这个小号对话？')) return; const current = readAliasState(); writeAliasState({ ...current, threads: current.threads.filter(t => t.id !== thread.id) }); onBack(); }}>删除对话</button></div></div>}
    <div className="yy-chat-history alias-chat-history" style={wallpaper ? { backgroundImage: `url("${wallpaper.replaceAll('"', '%22')}")` } : undefined} onClick={event => {
      if ((event.target as HTMLElement).closest('button')) return;
      setExtras(''); setMenu(false); setMessageMenu('');
    }}>
      <p className="alias-chat-notice">{thread.requestText}</p>
      {thread.requestReply && <p className="alias-chat-notice">{thread.requestReply}</p>}
      {thread.messages.map(m => m.from === 'system' ? <p key={m.id} className="alias-chat-notice">{m.text}{m.thought && <button type="button" className="alias-system-thought" onClick={() => setThought(m.thought!)}>心声</button>}</p> : <div key={m.id} data-message-id={m.id} className={`yy-chat-message-row alias-message ${m.from === 'user' ? 'is-user' : 'is-character'}`}>
        {m.from === 'character' ? <button type="button" className="alias-avatar-button" aria-label={`查看${peer.name}的心声`} onClick={() => { setExtras(''); setMessageMenu(''); setThought(aliasRoundThought(m, thread.messages) || '这轮消息没有记录角色心声。'); }}><Avatar name={peer.name} url={peer.avatarUrl} /></button> : <Avatar name={self.name} url={self.avatarUrl} />}
        <div className="yy-chat-message-content">
          <button type="button" aria-label={m.kind === 'image' ? '查看文字图' : `${m.from === 'user' ? '我' : peer.name}的消息：${m.text.slice(0, 30)}`} className={`yy-chat-message-bubble ${m.kind === 'image' ? 'alias-message-image' : 'is-plain'} ${m.from === 'user' ? 'is-user' : 'is-character'}`}
            onPointerDown={event => { if (event.button !== 0) return; stopPress(); pressed.current = false; pressStart.current = { x: event.clientX, y: event.clientY }; press.current = setTimeout(() => { pressed.current = true; setExtras(''); setMessageMenu(m.id); }, 500); }} onPointerUp={stopPress} onPointerCancel={stopPress} onPointerLeave={stopPress} onPointerMove={event => { if (Math.hypot(event.clientX - pressStart.current.x, event.clientY - pressStart.current.y) > 8) stopPress(); }}
            onContextMenu={event => { event.preventDefault(); stopPress(); setExtras(''); setMessageMenu(m.id); }}
            onClick={() => { if (pressed.current) { pressed.current = false; return; } if (m.kind === 'image') setImagePreview(m); else setMessageMenu(messageMenu === m.id ? '' : m.id); }}>
            {m.kind === 'image' ? <><span className="alias-image-heading"><Image size={22} strokeWidth={1.5} />图片</span><span className="alias-image-description">{m.text}</span></> : m.text}
          </button>
          {messageMenu === m.id && <div className="alias-message-actions" role="group" aria-label="小号消息操作">
            <button type="button" onClick={() => { setEditing({ id: m.id, text: m.text }); setMessageMenu(''); }}><Pencil size={13} />编辑</button>
            <button type="button" onClick={() => { try { deleteAliasMessage(thread.id, m.id); setMessageMenu(''); } catch (e) { setError(errorText(e)); } }}><Trash2 size={13} />删除</button>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(aliasMessageContext(m)); setMessageMenu(''); } catch { setError('复制失败，请稍后重试。'); } }}><Copy size={13} />复制</button>
          </div>}
        </div>
      </div>)}
      <div ref={bottom} />
    </div>
    {error && <p role="alert" className="alias-error">{error}</p>}
    {locked ? <div className="alias-chat-locked">{thread.removedByCharacterAt ? '对方已将你移出通讯录' : thread.blocked ? '此账号已被拉黑' : thread.status === 'pending' ? '好友验证中' : '对方未通过好友申请'}{thread.requester === 'user' && !thread.blocked && <button type="button" disabled={busy} className="ml-3 text-teal-600" onClick={() => void act(async () => { await applyWithAlias(thread.userAccountId, thread.charId, thread.requestText); })}>{busy ? '申请中…' : '重新申请'}</button>}</div> : <>
      {extras === 'more' && <div className="alias-chat-extras"><button type="button" onClick={() => { setImageDraft(''); setExtras(''); }}><Image size={19} />文字图</button><button type="button" onClick={() => { setMenu(true); setExtras(''); }}>账号资料<ChevronRight size={15} /></button>{thread.userAccountId !== 'main' && thread.identity !== 'revealed' && <button type="button" disabled={busy} onClick={() => { try { revealUserAlias(thread.id); setExtras(''); } catch (e) { setError(errorText(e)); } }}>坦白身份<ShieldCheck size={15} /></button>}</div>}
      {extras === 'emoji' && <div className="alias-emoji-grid">{['😀', '😂', '🥰', '🥺', '🤔', '😡', '😭', '😎', '❤️', '💕', '👍', '🌹'].map(emoji => <button type="button" key={emoji} onClick={() => setText(t => t + emoji)}>{emoji}</button>)}</div>}
      <form className="yy-chat-composer alias-composer" onSubmit={event => { event.preventDefault(); if (!busy) send(); }}>
        <button type="button" className="yy-chat-attachments" aria-label="小号更多功能" onClick={() => setExtras(extras === 'more' ? '' : 'more')}><Plus size={26} /></button>
        <textarea className="yy-chat-input" aria-label="小号消息输入框" rows={1} maxLength={4000} value={text} disabled={busy} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy && text.trim()) send(); } }} />
        <button type="button" className="yy-chat-emoji" aria-label="小号表情" onClick={() => setExtras(extras === 'emoji' ? '' : 'emoji')}><Smile size={25} /></button>
        {text.trim() ? <button type="submit" className="yy-chat-send" aria-label="发送小号消息" disabled={busy}><Send size={23} /></button> : <button type="button" className="yy-chat-generate" aria-label="生成小号回复" disabled={busy} onClick={() => void act(() => generateAliasReply(thread.id))}><Heart size={24} /></button>}
      </form>
    </>}
    {thought !== null && <div className="alias-dialog-backdrop" {...backdrop(() => setThought(null))}><section role="dialog" aria-modal="true" aria-label={`${peer.name}的心声`} className="alias-dialog"><header><h2>{peer.name}的心声</h2><button type="button" aria-label="关闭小号心声" onClick={() => setThought(null)}><X size={19} /></button></header><p className="alias-thought-content">{thought}</p></section></div>}
    {editing && <div className="alias-dialog-backdrop" {...backdrop(() => setEditing(null))}><form role="dialog" aria-modal="true" aria-label="编辑小号消息" className="alias-dialog" onSubmit={event => { event.preventDefault(); try { editAliasMessage(thread.id, editing.id, editing.text); setEditing(null); setError(''); } catch (e) { setError(errorText(e)); } }}><header><h2>编辑消息</h2><button type="button" aria-label="取消编辑小号消息" onClick={() => setEditing(null)}><X size={19} /></button></header><textarea autoFocus aria-label="编辑小号消息内容" rows={6} maxLength={4000} value={editing.text} onChange={event => setEditing({ ...editing, text: event.target.value })} /><button className="alias-primary" type="submit" disabled={!editing.text.trim()}>保存</button></form></div>}
    {imageDraft !== null && <div className="alias-dialog-backdrop" {...backdrop(() => setImageDraft(null))}><form role="dialog" aria-modal="true" aria-label="发送小号文字图" className="alias-dialog" onSubmit={event => { event.preventDefault(); if (!busy && !locked) send(imageDraft, 'image'); }}><header><h2>文字图</h2><button type="button" aria-label="关闭小号文字图" onClick={() => setImageDraft(null)}><X size={19} /></button></header><textarea autoFocus aria-label="小号图片描述" placeholder="描述图片里的画面" rows={6} maxLength={4000} value={imageDraft} onChange={event => setImageDraft(event.target.value)} /><button className="alias-primary" type="submit" disabled={busy || locked || !imageDraft.trim()}>发送图片</button></form></div>}
    {imagePreview && <div className="alias-dialog-backdrop" {...backdrop(() => setImagePreview(null))}><section role="dialog" aria-modal="true" aria-label="文字图详情" className="alias-dialog"><header><h2>图片</h2><button type="button" aria-label="关闭文字图详情" onClick={() => setImagePreview(null)}><X size={19} /></button></header><p className="alias-thought-content">{imagePreview.text}</p></section></div>}
  </section>;
}
