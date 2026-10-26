import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, ChevronRight, Compass, Heart, Image, MessageSquare, MoreHorizontal, Pause, Play, Plus, RefreshCw, Send, Smartphone, Smile, User, Users } from 'lucide-react';
import { activeMemoryArchive } from '../utils/memoryArchives';
import { applyInspectionAction, finishPhoneInspection, inspectionActionLabel, inspectionChatChoices, readInspectionActions, readInspectionContacts, readInspectionOptions, readInspectionPage, reactToInspection, saveInspectionOptions, type InspectionAction, type InspectionActionReceipt, type InspectionOptions, type InspectionPage, type InspectionSession, type InspectionStep } from '../utils/phoneInspection';

type Tab = 'home' | 'contacts' | 'discover' | 'me';
const tabs = [{ id: 'home', label: '消息', Icon: MessageSquare }, { id: 'contacts', label: '通讯录', Icon: Users }, { id: 'discover', label: '发现', Icon: Compass }, { id: 'me', label: '我', Icon: User }] as const;
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
function Avatar({ name, src, large = false }: { name: string; src?: string; large?: boolean }) {
  return <span className={`inspection-avatar${large ? ' is-large' : ''}`}>{src ? <img src={src} alt="" /> : name.slice(0, 1)}</span>;
}
const dateLabel = (value?: string) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '';

type PhoneInspectionProps = { charId: string; chatId: string; actorName: string; avatarUrl?: string; userName: string; userAvatarUrl?: string; onClose: () => void; onChanged: () => void; onFinished: (text: string, archiveKey: string, sessionId: string) => void };
export function PhoneInspection(props: PhoneInspectionProps) {
  const [draft, setDraft] = useState(() => readInspectionOptions(props.charId));
  const [options, setOptions] = useState<InspectionOptions | null>(null);
  if (options) return <InspectionViewer {...props} options={options} />;
  return <section className="phone-inspection inspection-setup" role="dialog" aria-modal="true" aria-label="查手机前设置">
    <header className="inspection-header"><button type="button" aria-label="取消查看" onClick={props.onClose}><ArrowLeft size={19} /></button><div><h2>反查手机</h2></div></header>
    <div className="inspection-setup-body"><div className="inspection-handover"><Avatar name={props.actorName} src={props.avatarUrl} large /><h3>把手机交给{props.actorName}</h3><p>可以改自己的备注，也可以替你发朋友圈</p></div>
      <label className="inspection-permission"><div><strong>允许代发消息</strong><p>可以使用你的账号给其他聊天发消息</p></div><input type="checkbox" checked={draft.allowMessages} onChange={e => setDraft({ ...draft, allowMessages: e.target.checked })} /></label>
      <fieldset className="inspection-hidden-chats"><legend>隐藏对话</legend><p>选中的对话不会出现在本次查看中</p>{inspectionChatChoices().map(chat => <label key={chat.id}><Avatar name={chat.title} src={chat.avatar} /><span>{chat.title}</span><input type="checkbox" checked={draft.hiddenChatIds.includes(chat.id)} onChange={e => setDraft(current => ({ ...current, hiddenChatIds: e.target.checked ? [...current.hiddenChatIds, chat.id] : current.hiddenChatIds.filter(id => id !== chat.id) }))} /></label>)}{!inspectionChatChoices().length && <p>暂无对话</p>}</fieldset>
    </div><footer className="inspection-setup-footer"><button type="button" onClick={() => { saveInspectionOptions(props.charId, draft); setOptions({ ...draft, hiddenChatIds: [...draft.hiddenChatIds] }); }}>交给{props.actorName}</button></footer>
  </section>;
}

function InspectionViewer({ charId, chatId, actorName, avatarUrl, userName, userAvatarUrl, onClose, onChanged, onFinished, options }: PhoneInspectionProps & { options: InspectionOptions }) {
  const readPage = (id: string) => readInspectionPage(id, charId, userName, options);
  const [session, setSession] = useState<InspectionSession>(() => ({ id: crypto.randomUUID(), charId, chatId, archiveKey: activeMemoryArchive(charId), createdAt: new Date().toISOString(), steps: [], options }));
  const state = useRef(session); state.current = session;
  const [page, setPage] = useState<InspectionPage>(() => readPage('home'));
  const [route, setRoute] = useState<{ tab: Tab; detail: string | null }>({ tab: 'home', detail: null });
  const routeRef = useRef(route);
  const screen = useRef<HTMLDivElement>(null); const scroll = useRef<HTMLDivElement>(null);
  const [touch, setTouch] = useState<{ x: number; y: number; id: number; swipe: boolean } | null>(null); const touchId = useRef(0);
  const [comments, setComments] = useState<string[]>([]); const [nextId, setNextId] = useState('');
  const [automatic, setAutomatic] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [saving, setSaving] = useState(false); const [finished, setFinished] = useState(false);
  const [operation, setOperation] = useState<InspectionAction | null>(null); const [operationText, setOperationText] = useState('');
  const [actions, setActions] = useState<InspectionActionReceipt[]>([]); const mutation = useRef<Promise<unknown> | null>(null);
  const request = useRef<AbortController | null>(null); const alive = useRef(true); const started = useRef(false); const ending = useRef(false); const receipt = useRef(false);
  const contacts = readInspectionContacts(charId, options);
  const home = readPage('home');
  const show = (tab: Tab, detail: string | null = null) => { const value = { tab, detail }; routeRef.current = value; setRoute(value); };
  const pulse = (x: number, y: number, swipe = false) => setTouch({ x, y, id: ++touchId.current, swipe });
  const tap = async (target: string, signal: AbortSignal) => {
    await wait(90, signal);
    const element = Array.from(screen.current?.querySelectorAll<HTMLElement>('[data-inspection-target]') ?? []).find(el => el.dataset.inspectionTarget === target);
    if (!element || !screen.current) throw new Error('页面已变化，请重试。');
    // Keep scrolling inside the phone, without moving its surrounding controls.
    if (scroll.current?.contains(element)) {
      const container = scroll.current; const rect = element.getBoundingClientRect(); const bounds = container.getBoundingClientRect();
      if (rect.top < bounds.top || rect.bottom > bounds.bottom) { container.scrollTo({ top: Math.max(0, container.scrollTop + rect.top - bounds.top - bounds.height / 2 + rect.height / 2), behavior: 'smooth' }); await wait(450, signal); }
    }
    const rect = element.getBoundingClientRect(), bounds = screen.current.getBoundingClientRect();
    pulse(rect.left + rect.width / 2 - bounds.left, rect.top + rect.height / 2 - bounds.top);
    await wait(400, signal);
  };
  const navigate = async (id: string, signal: AbortSignal) => {
    const tab: Tab = id === 'remark' || id.startsWith('contact:') ? 'contacts' : id === 'moments' ? 'discover' : 'home';
    if (routeRef.current.detail) { await tap('back', signal); show(routeRef.current.tab); await wait(260, signal); }
    if (routeRef.current.tab !== tab || id === 'home') { await tap(`tab:${tab}`, signal); show(tab); if (id === 'home') remember(readPage(id)); await wait(300, signal); }
    if (id !== 'home') { await tap(id, signal); const opened = readPage(id); setPage(opened); show(tab, id); remember(opened); await wait(330, signal); }
    // Swipe toward recent messages instead of jumping straight to the bottom.
    if (id.startsWith('chat:') && scroll.current) {
      scroll.current.scrollTop = 0;
      const container = scroll.current;
      if (container.scrollHeight > container.clientHeight + 8) {
        const bounds = container.getBoundingClientRect(), frame = screen.current!.getBoundingClientRect();
        pulse(bounds.left + bounds.width * .7 - frame.left, bounds.top + bounds.height * .72 - frame.top, true);
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }); await wait(650, signal);
      }
    }
  };
  const commit = (steps: InspectionStep[]) => { const next = { ...state.current, steps }; state.current = next; setSession(next); };
  const remember = (opened: InspectionPage) => commit([...state.current.steps.filter(s => s.page.id !== opened.id), { page: opened, comments: [] }]);
  const perform = async (action: InspectionAction, opened: InspectionPage, signal: AbortSignal) => {
    await tap(action.type === 'rename-self' ? 'edit-remark' : action.type === 'post-moment' ? 'compose-moment' : 'composer-input', signal);
    setOperation(action); setOperationText('');
    try {
      const characters = Array.from(action.text), chunk = Math.max(1, Math.ceil(characters.length / 22));
      for (let i = chunk; i < characters.length + chunk; i += chunk) { await wait(35, signal); setOperationText(characters.slice(0, i).join('')); }
      await tap('action:confirm', signal);
      if (signal.aborted) return;
      const pending = applyInspectionAction(state.current, opened, action, { userName, userAvatarUrl, signal }); mutation.current = pending;
      await pending; onChanged();
      if (alive.current) { setActions(readInspectionActions(state.current.id)); setPage(readPage(opened.id)); }
    } finally { mutation.current = null; if (alive.current) { setOperation(null); setOperationText(''); } }
  };
  const finish = async () => {
    if (ending.current || finished) return; ending.current = true; request.current?.abort(); setAutomatic(false); setBusy(false); setSaving(true); setError('');
    try { await mutation.current?.catch(() => {}); const text = await finishPhoneInspection(state.current, actorName, userName); if (!alive.current) return; if (!receipt.current) { onFinished(text, state.current.archiveKey, state.current.id); receipt.current = true; } setActions(readInspectionActions(state.current.id)); setFinished(true); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '保存失败，请重试'); }
    finally { ending.current = false; if (alive.current) setSaving(false); }
  };
  const visit = async (id: string) => {
    if (ending.current || finished) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setComments([]); setNextId('');
    try {
      await navigate(id, controller.signal);
      const nextPage = readPage(id); setPage(nextPage);
      const steps = state.current.steps.filter(s => s.page.id !== id); commit([...steps, { page: nextPage, comments: [] }]);
      const result = await reactToInspection(state.current, nextPage, userName, controller.signal);
      if (!alive.current || controller.signal.aborted || ending.current) return;
      if (result.action) await perform(result.action, nextPage, controller.signal);
      if (!alive.current || controller.signal.aborted || ending.current) return;
      setComments(result.comments); commit(state.current.steps.map(s => s.page.id === id ? { ...s, comments: result.comments } : s));
      if (result.end || state.current.steps.length >= 8) { setBusy(false); await finish(); }
      else setNextId(result.nextId);
    } catch (e) { if (alive.current && !controller.signal.aborted) { setAutomatic(false); setError(e instanceof Error ? e.message : '查看失败，请重试'); } }
    finally { if (alive.current && request.current === controller) setBusy(false); }
  };
  const manualTab = (tab: Tab) => { if (saving || finished || operation) return; request.current?.abort(); setBusy(false); setAutomatic(false); setError(''); show(tab); };
  const manualOpen = (id: string) => { if (saving || finished || operation) return; setAutomatic(false); void visit(id); };
  useEffect(() => { alive.current = true; const timer = window.setTimeout(() => { if (!started.current) { started.current = true; void visit('home'); } }, 0); return () => { window.clearTimeout(timer); alive.current = false; request.current?.abort(); }; }, []);
  useEffect(() => { if (!automatic || busy || saving || finished || !nextId || error) return; const timer = window.setTimeout(() => void visit(nextId), 3000); return () => window.clearTimeout(timer); }, [automatic, busy, saving, finished, nextId, error]);
  useEffect(() => { if (!touch) return; const timer = window.setTimeout(() => setTouch(null), 900); return () => window.clearTimeout(timer); }, [touch]);
  const detail = route.detail !== null;
  const title = detail ? (page.kind === 'remark' || page.kind === 'contact' ? '详细资料' : page.title) : tabs.find(t => t.id === route.tab)!.label;
  return <section className="phone-inspection" role="dialog" aria-modal="true" aria-label="反查手机">
    <header className="inspection-header"><Smartphone size={17} /><div><h2>反查手机</h2><p>{actorName}{finished ? '归还了手机' : '正在翻看'}</p></div><button type="button" disabled={saving} onClick={() => finished ? onClose() : void finish()}>{saving ? '保存中…' : finished ? '返回聊天' : '结束查看'}</button></header>
    <div className="inspection-screen" ref={screen} onPointerDownCapture={event => { const bounds = screen.current!.getBoundingClientRect(); pulse(event.clientX - bounds.left, event.clientY - bounds.top); }}>
      <div className="inspection-phone-nav"><button type="button" data-inspection-target="back" aria-label="返回微信列表" disabled={!detail || saving || finished || !!operation} onClick={() => manualTab(route.tab)}>{detail && <ArrowLeft size={23} />}</button><h3>{title === '消息' ? '微信' : title}</h3><span data-inspection-target={detail && page.kind === 'moments' ? 'compose-moment' : undefined}>{detail ? page.kind === 'moments' ? <Camera size={22} /> : <MoreHorizontal size={22} /> : <Plus size={22} />}</span></div>
      <div ref={scroll} className={`inspection-page ${detail ? `is-${page.kind}` : `is-root-${route.tab}`}`} key={route.detail ?? route.tab}>
        {!detail && route.tab === 'home' && <>{!home.lines.length && <p className="inspection-empty">暂无聊天</p>}{home.lines.map((line, i) => <button type="button" className="inspection-list-row" key={line.targetId ?? i} data-inspection-target={line.targetId} disabled={saving || finished} onClick={() => manualOpen(line.targetId!)}><Avatar name={line.from} src={line.avatar} /><div><strong>{line.from}</strong><p>{line.text}</p></div><time>{dateLabel(line.time)}</time></button>)}</>}
        {!detail && route.tab === 'contacts' && <><div className="inspection-list-label">全部联系人</div>{contacts.map(contact => <button type="button" className="inspection-list-row is-contact" key={contact.id} data-inspection-target={contact.targetId} disabled={saving || finished} onClick={() => manualOpen(contact.targetId)}><Avatar name={contact.remark} src={contact.avatar} /><strong>{contact.remark}</strong></button>)}{!contacts.length && <p className="inspection-empty">暂无联系人</p>}</>}
        {!detail && route.tab === 'discover' && <button type="button" className="inspection-menu-row" data-inspection-target="moments" disabled={saving || finished} onClick={() => manualOpen('moments')}><span className="inspection-menu-icon"><Image size={23} /></span><strong>朋友圈</strong><ChevronRight size={17} /></button>}
        {!detail && route.tab === 'me' && <><div className="inspection-profile"><Avatar name={userName} src={userAvatarUrl} large /><div><strong>{userName}</strong><p>我的微信</p></div></div><button type="button" className="inspection-menu-row" data-inspection-target="moments" disabled={saving || finished} onClick={() => manualOpen('moments')}><Image size={22} /><strong>朋友圈</strong><ChevronRight size={17} /></button><div className="inspection-profile-footer"><Heart size={17} /><span>{userName}的手机</span></div></>}
        {detail && page.kind === 'chat' && <>{!page.lines.length && <p className="inspection-empty">暂无消息</p>}{page.lines.map((line, i) => <article key={i} className={`inspection-chat-line ${line.own ? 'is-own' : ''}`}><time>{line.time && new Date(line.time).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><div className="inspection-chat-row"><Avatar name={line.from} src={line.avatar || (line.own ? userAvatarUrl : undefined)} /><div className="inspection-chat-body"><small>{line.from}</small><div className="inspection-bubble">{line.image && <img src={line.image} alt={line.text || '聊天图片'} />}<p>{line.text}</p></div></div></div></article>)}</>}
        {detail && (page.kind === 'remark' || page.kind === 'contact') && <><div className="inspection-profile"><Avatar name={page.lines[0]?.text || page.title} src={page.lines[0]?.avatar} large /><div><strong>{page.lines[1]?.text === '未设置备注' ? page.lines[0]?.text : page.lines[1]?.text}</strong><p>昵称：{page.lines[0]?.text}</p></div></div><div className="inspection-info-row" data-inspection-target="edit-remark"><span>备注</span>{operation?.type === 'rename-self' ? <><input aria-label="角色正在设置备注" readOnly value={operationText} /><button type="button" data-inspection-target="action:confirm">完成</button></> : <p>{page.lines[1]?.text}</p>}</div>{contacts.find(c => c.targetId === page.id)?.chatId && <button type="button" className="inspection-contact-chat" disabled={saving || finished || !!operation} onClick={() => manualOpen(contacts.find(c => c.targetId === page.id)!.chatId!)}><MessageSquare size={18} />发消息</button>}</>}
        {detail && page.kind === 'moments' && <><div className="inspection-moments-cover"><span>朋友圈</span><div><strong>{userName}</strong><Avatar name={userName} src={userAvatarUrl} large /></div></div>{!page.lines.length && <p className="inspection-empty">暂无动态</p>}{page.lines.map((line, i) => <article className="inspection-moment" key={i}><Avatar name={line.from} src={line.avatar || (line.own ? userAvatarUrl : undefined)} /><div><strong>{line.from}</strong><p>{line.text}</p>{line.image && <img className="inspection-moment-image" src={line.image} alt="朋友圈配图" />}<time>{dateLabel(line.time)}</time></div></article>)}</>}
      </div>
      {detail && page.kind === 'chat' && <div className="inspection-composer"><Plus size={23} /><div data-inspection-target="composer-input">{operation?.type === 'send-message' ? operationText : ''}</div><Smile size={23} />{operation?.type === 'send-message' ? <button type="button" aria-label="角色发送消息" data-inspection-target="action:confirm"><Send size={20} /></button> : <Heart size={22} />}</div>}
      <nav className="inspection-tab-bar" aria-label="被查看手机的微信导航">{tabs.map(({ id, label, Icon }) => <button type="button" key={id} data-inspection-target={`tab:${id}`} aria-current={route.tab === id ? 'page' : undefined} disabled={saving || finished || !!operation} onClick={() => manualTab(id)}><Icon size={23} strokeWidth={route.tab === id ? 2.2 : 1.7} /><span>{label}</span></button>)}</nav>
      {operation?.type === 'post-moment' && <div className="inspection-post-editor"><div><strong>发表朋友圈</strong><button type="button" data-inspection-target="action:confirm">发表</button></div><textarea readOnly aria-label="角色正在写朋友圈" value={operationText} /></div>}
      {touch && <span key={touch.id} className={`inspection-touch${touch.swipe ? ' is-swipe' : ''}`} style={{ left: touch.x, top: touch.y }} aria-hidden="true" />}
    </div>
    <aside className="inspection-reaction"><div className="inspection-actor"><Avatar name={actorName} src={avatarUrl} /><strong>{actorName}</strong>{busy && <small>正在看…</small>}</div>
      <div className="inspection-comments" aria-live="polite">{comments.map((comment, i) => <p key={i}>{comment}</p>)}{finished && <small>这次查看已记住</small>}{error && <p role="alert">{error}</p>}</div>
      {!!actions.length && <div className="inspection-action-receipts" aria-live="polite">{actions.map(action => <p key={action.id}><Check size={12} /><span>{inspectionActionLabel(action)}</span></p>)}</div>}
      {!finished && <div className="inspection-controls"><button type="button" disabled={saving} onClick={() => { setAutomatic(!automatic); if (!automatic && !busy && !nextId && !error) void visit(page.id); }}>{automatic ? <Pause size={13} /> : <Play size={13} />}{automatic ? '暂停' : '自动翻看'}</button>{error ? <button type="button" disabled={busy || saving} onClick={() => void visit(page.id)}><RefreshCw size={13} />重试</button> : <button type="button" disabled={busy || saving || !nextId} onClick={() => void visit(nextId)}>继续翻看<ChevronRight size={13} /></button>}</div>}
      {error && <button type="button" className="inspection-exit" onClick={onClose}>返回聊天</button>}
    </aside>
  </section>;
}
