import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, Check, ChevronDown, Eye, LoaderCircle, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { assertPerspectiveCurrent, generateCharacterPerspective, injectCharacterPerspective, PERSPECTIVE_HISTORY_LIMIT, readPerspectiveSnapshot, type CharacterPerspective as Report, type PerspectiveIdentity } from '../utils/characterPerspective';
import { perspectiveAlreadyInjected, readSavedPerspectives, removeSavedPerspective, reopenPerspective, savePerspective, type SavedPerspective } from '../utils/perspectiveShelf';
import './characterPerspective.css';

interface Props {
  contacts: Array<{ id: string; name: string; avatarUrl?: string }>;
  userName: string;
  userAvatar?: string;
  onInjected: () => void;
}
type Reading = { snapshot: PerspectiveIdentity; report: Report; injected: boolean };

export function CharacterPerspective({ contacts, userName, userAvatar, onInjected }: Props) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id ?? '');
  const [reading, setReading] = useState<Reading | null>(null);
  const [busy, setBusy] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(() => readSavedPerspectives(contacts[0]?.id ?? ''));
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const actor = contacts.find(c => c.id === selectedId);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);

  const changeCharacter = (id: string) => {
    request.current?.abort(); request.current = null;
    setSelectedId(id); setReading(null); setError(''); setBusy(false); setExpanded(false); setSaved(readSavedPerspectives(id));
  };
  const generate = async () => {
    if (!actor || busy || injecting || saving) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError('');
    try {
      const snapshot = readPerspectiveSnapshot(actor.id);
      const report = await generateCharacterPerspective(snapshot, controller.signal);
      if (!alive.current || controller.signal.aborted || request.current !== controller) return;
      setReading({ snapshot, report, injected: false });
      setExpanded(false);
      window.setTimeout(() => {
        if (alive.current && request.current === null && !controller.signal.aborted && resultRef.current) {
          scrollRef.current?.scrollTo({ top: resultRef.current.offsetTop - 16, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
      }, 60);
    } catch (cause) {
      if (alive.current && !controller.signal.aborted && request.current === controller) setError(cause instanceof Error ? cause.message : '暂时没有写好，请稍后重试。');
    } finally { if (alive.current && request.current === controller) { setBusy(false); request.current = null; } }
  };
  const inject = async () => {
    if (!reading || reading.injected || injecting || busy || saving) return;
    setInjecting(true); setError('');
    try {
      assertPerspectiveCurrent(reading.snapshot);
      await injectCharacterPerspective(reading.snapshot, reading.report);
      if (alive.current) { setReading(current => current?.report.id === reading.report.id ? { ...current, injected: true } : current); onInjected(); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '写入失败，请重试。'); }
    finally { if (alive.current) setInjecting(false); }
  };
  const preserve = async () => {
    if (!reading || saving || busy || injecting) return;
    setSaving(true); setError('');
    try { await savePerspective(reading.snapshot, reading.report); if (alive.current) setSaved(readSavedPerspectives(selectedId)); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '侧写未能保留，请重试。'); }
    finally { if (alive.current) setSaving(false); }
  };
  const discardSaved = async (id: string) => {
    if (saving || injecting || busy) return;
    setSaving(true); setError('');
    try { await removeSavedPerspective(id); if (alive.current) setSaved(readSavedPerspectives(selectedId)); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '删除失败，请重试。'); }
    finally { if (alive.current) setSaving(false); }
  };
  const openSaved = (entry: SavedPerspective) => {
    if (busy || saving || injecting) return;
    try {
      const snapshot = reopenPerspective(entry, readPerspectiveSnapshot(selectedId));
      setReading({ snapshot, report: entry.report, injected: perspectiveAlreadyInjected(snapshot, entry.report.id) }); setExpanded(false); setError('');
      window.setTimeout(() => { if (alive.current && resultRef.current) scrollRef.current?.scrollTo({ top: resultRef.current.offsetTop - 16, behavior: 'smooth' }); }, 60);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '这篇侧写暂时无法打开。'); }
  };
  const preserved = !!reading && saved.some(entry => entry.report.id === reading.report.id);
  const foldable = !!reading && reading.report.body.length > 480;
  const avatar = (url: string | undefined, name: string, className = '') => <span className={`perspective-avatar ${className}`}>
    {url ? <img src={url} alt={name} /> : <span>{name.slice(0, 1)}</span>}
  </span>;

  return <div className="character-perspective" ref={scrollRef}>
    <div className="perspective-intro">
      <div className="perspective-mirror" aria-hidden="true">
        <span className="perspective-mirror-halo" />
        {avatar(userAvatar, userName, 'perspective-self')}
        <span className="perspective-mirror-line" />
        {avatar(actor?.avatarUrl, actor?.name ?? 'TA', 'perspective-observer')}
        <Sparkles className="perspective-spark" size={19} />
      </div>
      <p className="perspective-eyebrow">换一个视角，看见自己</p>
      <h2>侧写</h2>
      <p className="perspective-subtitle">听听那个与你相处的人，怎么说。</p>
    </div>

    {!contacts.length ? <div className="perspective-empty">先去通讯录添加一位角色吧。</div> : <>
      <div className="perspective-controls">
        <label className="perspective-choose">
          {avatar(actor?.avatarUrl, actor?.name ?? 'TA')}
          <span className="perspective-select-wrap">
            <span>从谁的眼里看</span>
            <select aria-label="选择观察你的角色" value={selectedId} disabled={injecting || saving} onChange={e => changeCharacter(e.target.value)}>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
        <button type="button" className="perspective-generate" onClick={() => void generate()} disabled={busy || injecting || saving || !actor}>
          {busy ? <LoaderCircle className="perspective-spin" size={16} /> : reading ? <RefreshCw size={16} /> : <Eye size={16} />}
          {busy ? '正在写…' : reading ? '重新生成' : '生成'}
        </button>
      </div>
      <div className="perspective-privacy"><span>{reading?.injected ? '已注入当前聊天' : '仅自己可见 · 默认不注入聊天'}</span>
        {busy && <button type="button" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}><X size={13} />取消</button>}
      </div>
      {error && <p className="perspective-error" role="alert">{error}</p>}
      {busy && <div className="perspective-loading" role="status" aria-live="polite">
        <span className="perspective-loading-orbit"><Eye size={23} /></span>
        <p>{actor?.name}正在回看你们的相处</p>
        <div className="perspective-loading-lines"><i /><i /><i /></div>
      </div>}

      {reading && <article className={`perspective-reading ${busy ? 'perspective-reading-muted' : ''}`} ref={resultRef}>
        <header className="perspective-report-header">
          <span className="perspective-report-mark">TO {reading.snapshot.userName}</span>
          <h3>{reading.report.title}</h3>
        </header>
        <div id="perspective-article-body" className={`perspective-prose ${foldable && !expanded ? 'is-collapsed' : ''}`}>{reading.report.body.split(/\n\s*\n|\n/).filter(p => p.trim()).map((p, i) => <p key={i}>{p}</p>)}</div>
        {foldable && <button type="button" className="perspective-expand" aria-expanded={expanded} aria-controls="perspective-article-body" onClick={() => { if (expanded && resultRef.current) scrollRef.current?.scrollTo({ top: resultRef.current.offsetTop - 16 }); setExpanded(!expanded); }}><ChevronDown size={14} style={expanded ? { transform: 'rotate(180deg)' } : undefined} />{expanded ? '收起全文' : '展开全文'}</button>}
        <footer className="perspective-signoff">
          <span>—— {reading.snapshot.charName}</span>
          <time dateTime={reading.report.createdAt}>{new Date(reading.report.createdAt).toLocaleDateString('zh-CN')}</time>
        </footer>
        <div className="perspective-inject">
          <button type="button" className="perspective-preserve" onClick={() => void preserve()} disabled={busy || injecting || saving || preserved}>{preserved ? <Check size={17} /> : saving ? <LoaderCircle size={17} className="perspective-spin" /> : <Bookmark size={17} />}{preserved ? '已保留' : '保留这篇'}</button>
          <button type="button" onClick={() => void inject()} disabled={busy || injecting || saving || reading.injected}>
            {reading.injected ? <Check size={17} /> : injecting ? <LoaderCircle className="perspective-spin" size={17} /> : <ArrowUpRight size={17} />}
            {reading.injected ? '已注入当前聊天' : injecting ? '正在注入…' : '注入当前聊天'}
          </button>
          <p>注入后随聊天记录提供给角色，不自动存入长期记忆。</p>
        </div>
      </article>}
      {!!saved.length && <section className="perspective-shelf" aria-label="已保留的侧写"><h3>已保留</h3><div className="perspective-shelf-list">{saved.map(entry => <div className="perspective-shelf-card" key={entry.report.id}>
        <button type="button" className="perspective-shelf-open" disabled={busy || saving || injecting} onClick={() => openSaved(entry)}><strong>{entry.report.title}</strong><span>{entry.report.body}</span><time dateTime={entry.report.createdAt}>{entry.identity.charName} · {new Date(entry.report.createdAt).toLocaleDateString('zh-CN')}</time></button>
        <button type="button" className="perspective-shelf-delete" aria-label={`删除侧写：${entry.report.title}`} disabled={busy || saving || injecting} onClick={() => void discardSaved(entry.report.id)}><Trash2 size={14} /></button>
      </div>)}</div></section>}
      <details className="perspective-scope"><summary>参考范围<ChevronDown size={13} /></summary>
        <p>结合当前存档不同时期的记忆、相处回顾与最近 {PERSPECTIVE_HISTORY_LIMIT} 条互动，以及角色人设和绑定的世界书，理解你们的相处。不会读取其他人的对话或小号聊天。</p>
        <p>未保留的侧写离开后不保存。保留文章不会自动注入聊天。</p>
      </details>
    </>}
  </div>;
}
