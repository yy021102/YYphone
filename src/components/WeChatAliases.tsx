import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, EyeOff, Heart, MoreHorizontal, Plus, Send, ShieldCheck, Smile, UserRound, X } from 'lucide-react';
import { ALIAS_EVENT, aliasCharacter, aliasPeer, aliasSelf, currentAliasUser, deleteUserAlias, readAliasState, respondAliasRequest, revealUserAlias, saveUserAlias, sendAliasMessage, setAliasSwitcherHidden, updateAliasThread, visibleAliasThreads, writeAliasState, type AliasProfile, type AliasState, type AliasThread } from '../utils/aliasAccounts';
import { applyWithAlias, generateAliasReply, generateCharacterAliasRequest } from '../utils/aliasAi';
import { compressImageFile } from '../utils/imageFile';
import './wechatAliases.css';

export function useAliasAccounts() {
  const [state, setState] = useState(readAliasState);
  useEffect(() => { const refresh = () => setState(readAliasState()); window.addEventListener(ALIAS_EVENT, refresh); return () => window.removeEventListener(ALIAS_EVENT, refresh); }, []);
  return state;
}
function Avatar({ name, url, className = '' }: { name: string; url?: string; className?: string }) {
  return <span className={`alias-avatar ${className}`}>{url ? <img src={url} alt="" /> : name.trim().slice(0, 1) || <UserRound size={20} />}</span>;
}
const errorText = (e: unknown) => e instanceof Error ? e.message : '操作失败，请重试。';
const ownProfiles = (state: AliasState) => state.profiles.filter(p => p.owner === 'user' && p.userProfileId === currentAliasUser().id);

export function AliasAccountSwitcher({ state, selected, onChange }: { state: AliasState; selected: string; onChange: (id: string) => void }) {
  if (!ownProfiles(state).length || state.switcherHidden) return null;
  const unread = (account: string) => visibleAliasThreads(state).filter(t => t.userAccountId === account && t.status === 'accepted').reduce((n,t) => n+t.unread, 0);
  return <div className="alias-account-switcher" aria-label="切换聊天账号"><div className="alias-account-options">{[{ id: 'main', name: '主号' }, ...ownProfiles(state)].map(p => <button type="button" key={p.id} aria-pressed={(selected || 'main') === p.id} onClick={() => onChange(p.id === 'main' ? '' : p.id)}>{p.name}{unread(p.id) > 0 && <i />}</button>)}</div><button type="button" className="alias-hide-switcher" aria-label="隐藏账号切换条" onClick={() => { onChange(''); setAliasSwitcherHidden(true); }}><EyeOff size={13} />隐藏</button></div>;
}
export function AliasConversationList({ state, accountId, search, onOpen }: { state: AliasState; accountId: string; search: string; onOpen: (id: string) => void }) {
  return <>{visibleAliasThreads(state).filter(t => t.userAccountId === (accountId || 'main') && (t.status === 'accepted' || t.requester === 'user') && `${aliasPeer(t,state)?.name} ${t.messages.at(-1)?.text || t.requestText}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(t => {
    const peer = aliasPeer(t,state); if (!peer) return null;
    return <button type="button" key={t.id} className="alias-conversation" onClick={() => onOpen(t.id)}><span className="alias-avatar-wrap"><Avatar name={peer.name} url={peer.avatarUrl} />{t.unread > 0 && <i className="alias-unread">{t.unread > 99 ? '99+' : t.unread}</i>}</span><span className="alias-conversation-copy"><strong>{peer.name}</strong><small>{t.blocked ? '已拉黑' : t.status === 'pending' ? '好友验证中' : t.status === 'rejected' ? t.requestReply || '对方未通过申请' : t.messages.at(-1)?.text || t.requestReply || '已通过好友验证'}</small></span><time>{new Date(t.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</time></button>;
  })}</>;
}
export function AliasFriendRequests({ state, onOpen }: { state: AliasState; onOpen: (id: string) => void }) {
  const [error, setError] = useState('');
  return <>{visibleAliasThreads(state).filter(t => t.requester === 'character' && t.status === 'pending').map(t => {
    const peer = aliasPeer(t,state); if (!peer) return null;
    return <div className="alias-request" key={t.id}><div className="alias-request-top"><Avatar name={peer.name} url={peer.avatarUrl} /><span><strong>{peer.name}</strong><small>{peer.handle}</small></span></div><p>{t.requestText}</p><div className="alias-actions"><button type="button" onClick={() => { try { respondAliasRequest(t.id,false); } catch(e) { setError(errorText(e)); } }}>拒绝</button><button type="button" className="is-primary" onClick={() => { try { respondAliasRequest(t.id,true); onOpen(t.id); } catch(e) { setError(errorText(e)); } }}>接受</button></div></div>;
  })}{error && <p role="alert" className="alias-error">{error}</p>}</>;
}

export function AliasManager({ state, contacts, onOpen, onSelect }: { state: AliasState; contacts: Array<{ id: string; name: string }>; onOpen: (id: string) => void; onSelect: (id: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', handle: '', avatarUrl: '', bio: '' });
  const [applyAccount, setApplyAccount] = useState(ownProfiles(state)[0]?.id || '');
  const [charId, setCharId] = useState(contacts[0]?.id || '');
  const [note, setNote] = useState('你好 可以认识一下吗');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!ownProfiles(state).some(p => p.id === applyAccount)) setApplyAccount(ownProfiles(state)[0]?.id || ''); }, [state.profiles, applyAccount]);
  useEffect(() => { if (!contacts.some(c => c.id === charId)) setCharId(contacts[0]?.id || ''); }, [contacts, charId]);
  const edit = (profile?: AliasProfile) => { setEditing(profile?.id || ''); setDraft(profile ? { name: profile.name, handle: profile.handle, avatarUrl: profile.avatarUrl, bio: profile.bio } : { name: '', handle: '', avatarUrl: '', bio: '' }); setError(''); };
  const act = async (task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); setStatus(''); try { await task(); } catch(e) { setError(errorText(e)); } finally { setBusy(false); } };
  return <div className="alias-manager">
    <section className="alias-card"><label className="alias-toggle">显示账号切换条<input aria-label="显示账号切换条" type="checkbox" checked={!state.switcherHidden} onChange={e => setAliasSwitcherHidden(!e.target.checked)} /></label></section>
    <div className="alias-section-heading"><h2>我的小号</h2><button type="button" aria-label="新建小号" onClick={() => edit()}><Plus size={18} /></button></div>
    {editing !== null && <section className="alias-card alias-editor"><div className="alias-section-heading"><strong>{editing ? '编辑资料' : '新建小号'}</strong><button type="button" aria-label="关闭小号编辑" onClick={() => setEditing(null)}><X size={17} /></button></div>
      <button type="button" aria-label="上传小号头像" className="alias-upload" disabled={busy} onClick={() => file.current?.click()}><Avatar name={draft.name} url={draft.avatarUrl} /><small>更换头像</small></button>
      <input ref={file} type="file" accept="image/*" hidden onChange={e => { const selected = e.target.files?.[0]; e.target.value = ''; if (selected) void act(async () => { const avatarUrl = await compressImageFile(selected); setDraft(d => ({ ...d, avatarUrl })); }); }} />
      <label>昵称<input aria-label="小号昵称" value={draft.name} maxLength={30} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>微信号<input aria-label="小号微信号" value={draft.handle} maxLength={40} placeholder="字母、数字、下划线" onChange={e => setDraft({ ...draft, handle: e.target.value })} /></label>
      <label>公开介绍<textarea aria-label="小号公开介绍" rows={3} value={draft.bio} maxLength={1000} onChange={e => setDraft({ ...draft, bio: e.target.value })} /></label>
      <button type="button" className="alias-primary" disabled={busy} onClick={() => { try { const p = saveUserAlias(draft, editing || undefined); setApplyAccount(p.id); setEditing(null); setError(''); } catch(e) { setError(errorText(e)); } }}>保存小号</button>
    </section>}
    {ownProfiles(state).map(p => <section className="alias-card" key={p.id}><div className="alias-profile-line"><Avatar name={p.name} url={p.avatarUrl} /><span><strong>{p.name}</strong><small>{p.handle}</small></span></div>{p.bio && <p className="alias-bio">{p.bio}</p>}<div className="alias-actions"><button type="button" onClick={() => edit(p)}>编辑</button><button type="button" className="is-primary" onClick={() => onSelect(p.id)}>进入消息</button><button type="button" className="is-danger" onClick={() => { if (!window.confirm('删除这个小号和它的全部对话？')) return; try { deleteUserAlias(p.id); } catch(e) { setError(errorText(e)); } }}>删除</button></div></section>)}
    {!ownProfiles(state).length && editing === null && <button type="button" className="alias-create-empty" onClick={() => edit()}><Plus size={24} /><span>创建一个新身份</span></button>}
    {ownProfiles(state).length > 0 && <section className="alias-card"><h3>添加朋友</h3><label>使用账号<select aria-label="申请使用的小号" value={applyAccount || ownProfiles(state)[0]?.id || ''} onChange={e => setApplyAccount(e.target.value)}>{ownProfiles(state).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>添加角色<select aria-label="小号添加角色" value={charId} onChange={e => setCharId(e.target.value)}><option value="">请选择</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>申请附言<textarea aria-label="小号好友申请附言" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label><button type="button" className="alias-primary" disabled={busy || !charId} onClick={() => void act(async () => { const id = await applyWithAlias(applyAccount || ownProfiles(state)[0]?.id || '', charId, note); onOpen(id); })}>{busy ? '申请中…' : '发送好友申请'}</button></section>}
    <section className="alias-card"><h3>新的朋友</h3><label className="alias-toggle">允许角色主动用小号联系我<input aria-label="允许角色主动用小号联系我" type="checkbox" checked={state.autoEnabled} onChange={e => writeAliasState({ ...readAliasState(), autoEnabled: e.target.checked })} /></label><div className="alias-inline"><select aria-label="生成小号申请的角色" value={charId} onChange={e => setCharId(e.target.value)}><option value="">请选择角色</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" disabled={busy || !charId} onClick={() => void act(async () => { const id = await generateCharacterAliasRequest(charId); setStatus(id ? '收到新的好友申请' : '暂时没有新的好友申请'); })}>{busy ? '生成中…' : '生成申请'}</button></div><AliasFriendRequests state={state} onOpen={onOpen} /></section>
    {status && <p className="alias-status" role="status">{status}</p>}{(error || state.autoEnabled && state.lastError) && <p className="alias-error" role="alert">{error || state.lastError}</p>}
  </div>;
}

export function AliasChat({ thread, state, onBack, wallpaper, userColor, characterColor }: { thread: AliasThread; state: AliasState; onBack: () => void; wallpaper?: string; userColor: string; characterColor: string }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [menu, setMenu] = useState(false), [extras, setExtras] = useState<'more' | 'emoji' | ''>('');
  const bottom = useRef<HTMLDivElement>(null), alive = useRef(true);
  const peer = aliasPeer(thread,state), self = aliasSelf(thread,state);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); if (thread.unread) { const next = readAliasState(); writeAliasState({ ...next, threads: next.threads.map(t => t.id === thread.id ? { ...t, unread: 0 } : t) }); } }, [thread.id, thread.messages.length, thread.unread]);
  const act = async (task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await task(); } catch(e) { if (alive.current) setError(errorText(e)); } finally { if (alive.current) setBusy(false); } };
  const send = () => { try { sendAliasMessage(thread.id,text); setText(''); setExtras(''); setError(''); } catch(e) { setError(errorText(e)); } };
  if (!peer || !self) return null;
  return <section className="alias-chat yy-chat-surface" style={{ '--yy-user-bubble-color': userColor, '--yy-character-bubble-color': characterColor } as React.CSSProperties}>
    <header className="alias-chat-header yy-wechat-header"><button type="button" aria-label="返回消息列表" onClick={onBack}><ArrowLeft size={23} /></button><div><strong>{busy ? '对方正在输入…' : peer.name}</strong><small>{thread.userAccountId !== 'main' ? `以 ${self.name} 聊天` : peer.handle}</small></div><button type="button" aria-label="小号对话设置" onClick={() => setMenu(v => !v)}><MoreHorizontal size={24} /></button></header>
    {menu && <div className="alias-chat-menu"><div className="alias-profile-line"><Avatar name={peer.name} url={peer.avatarUrl} /><span><strong>{peer.name}</strong><small>{peer.handle}</small></span></div>{peer.bio && <p>{peer.bio}</p>}{thread.identity === 'revealed' && <p className="alias-confirmed"><ShieldCheck size={14} />身份已公开{thread.characterAccountId !== 'main' ? ` · ${aliasCharacter(thread.charId)?.name}` : ''}</p>}<div className="alias-actions"><button type="button" onClick={() => { try { updateAliasThread(thread.id,t => ({ ...t, blocked: !t.blocked })); setMenu(false); } catch(e) { setError(errorText(e)); } }}>{thread.blocked ? '解除拉黑' : '拉黑此账号'}</button><button type="button" className="is-danger" onClick={() => { if (!window.confirm('删除这个小号对话？')) return; const current = readAliasState(); writeAliasState({ ...current, threads: current.threads.filter(t => t.id !== thread.id) }); onBack(); }}>删除对话</button></div></div>}
    <div className="yy-chat-history alias-chat-history" style={wallpaper ? { backgroundImage: `url("${wallpaper.replaceAll('"','%22')}")` } : undefined}>
      <p className="alias-chat-notice">{thread.requestText}</p>
      {thread.requestReply && <p className="alias-chat-notice">{thread.requestReply}</p>}
      {thread.messages.map(m => m.from === 'system' ? <p key={m.id} className="alias-chat-notice">{m.text}</p> : <div key={m.id} className={`yy-chat-message-row alias-message ${m.from === 'user' ? 'is-user' : 'is-character'}`}><Avatar name={m.from === 'user' ? self.name : peer.name} url={m.from === 'user' ? self.avatarUrl : peer.avatarUrl} className="yy-chat-avatar" /><div className="yy-chat-message-content"><div className={`yy-chat-message-bubble is-plain ${m.from === 'user' ? 'is-user' : 'is-character'}`}>{m.text}</div></div></div>)}
      <div ref={bottom} />
    </div>
    {error && <p role="alert" className="alias-error">{error}</p>}
    {thread.status !== 'accepted' || thread.blocked ? <div className="alias-chat-locked">{thread.blocked ? '此账号已被拉黑' : thread.status === 'pending' ? '好友验证中' : '对方未通过好友申请'}{thread.requester === 'user' && !thread.blocked && <button type="button" disabled={busy} className="ml-3 text-teal-600" onClick={() => void act(async () => { await applyWithAlias(thread.userAccountId,thread.charId,thread.requestText); })}>{busy ? '申请中…' : '重新申请'}</button>}</div> : <>
      {extras === 'more' && <div className="alias-chat-extras"><button type="button" onClick={() => { setMenu(true); setExtras(''); }}>账号资料<ChevronRight size={15} /></button>{thread.userAccountId !== 'main' && thread.identity !== 'revealed' && <button type="button" disabled={busy} onClick={() => { try { revealUserAlias(thread.id); setExtras(''); } catch(e) { setError(errorText(e)); } }}>坦白身份<ShieldCheck size={15} /></button>}</div>}
      {extras === 'emoji' && <div className="alias-emoji-grid">{['😀','😂','🥰','🥺','🤔','😡','😭','😎','❤️','💕','👍','🌹'].map(emoji => <button type="button" key={emoji} onClick={() => setText(t => t+emoji)}>{emoji}</button>)}</div>}
      <form className="yy-chat-composer alias-composer" onSubmit={e => { e.preventDefault(); if (!busy) send(); }}>
        <button type="button" className="yy-chat-attachments" aria-label="小号更多功能" onClick={() => setExtras(extras === 'more' ? '' : 'more')}><Plus size={26} /></button>
        <textarea className="yy-chat-input" aria-label="小号消息输入框" rows={1} maxLength={4000} value={text} disabled={busy} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy && text.trim()) send(); } }} />
        <button type="button" className="yy-chat-emoji" aria-label="小号表情" onClick={() => setExtras(extras === 'emoji' ? '' : 'emoji')}><Smile size={25} /></button>
        {text.trim() ? <button type="submit" className="yy-chat-send" aria-label="发送小号消息" disabled={busy}><Send size={23} /></button> : <button type="button" className="yy-chat-generate" aria-label="生成小号回复" disabled={busy} onClick={() => void act(() => generateAliasReply(thread.id))}><Heart size={24} /></button>}
      </form>
    </>}
  </section>;
}
