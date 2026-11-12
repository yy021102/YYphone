import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronDown, Heart, Search, SlidersHorizontal, Square, X } from 'lucide-react';
import {
  AO3_CATEGORIES, AO3_RATINGS, ao3ChapterComments, ao3DraftFromWork, ao3WordCount, emptyAo3Filters, filterAo3Works,
  newAo3Draft, publishAo3Draft, readAo3Draft, readAo3State, updateAo3, writeAo3Draft, writeAo3State,
  type Ao3Action, type Ao3Draft, type Ao3Filters, type Ao3State, type Ao3Work,
} from '../utils/ao3Data';
import { generateAo3Chapter, readAo3Characters } from '../utils/ao3Generation';
import { generateAo3ChapterUpdate } from '../utils/ao3Comments';
import { Ao3Discovery } from '../components/Ao3Discovery';
import { Ao3Settings } from '../components/Ao3Settings';
import { Ao3Comments } from '../components/Ao3Comments';
import { shareAo3Work } from '../utils/ao3Share';

type Page = 'browse' | 'fandoms' | 'library' | 'reader' | 'editor' | 'generate' | 'settings';
type Shelf = 'bookmarks' | 'later' | 'history' | 'works';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const ratingCode = (rating: string) => rating === 'General Audiences' ? 'G' : rating === 'Teen And Up Audiences' ? 'T' : rating === 'Mature' ? 'M' : rating === 'Explicit' ? 'E' : '?';

function ArchiveLogo() {
  return <img className="ao3-logo" src={`${import.meta.env?.BASE_URL ?? '/'}ao3-logo.png`} alt="" aria-hidden="true"/>;
}
function Symbols({ work }: { work: Ao3Work }) {
  return <div className="ao3-symbols" aria-label={`${work.rating}；${work.category}；${work.warning}；${work.complete ? '已完结' : '连载中'}`}>
    <span className={`ao3-rating ao3-rating-${ratingCode(work.rating).toLowerCase()}`} title={work.rating}>{ratingCode(work.rating)}</span>
    <span className="ao3-category" title={work.category}>{work.category === 'Gen' ? '●' : work.category === 'Other' ? '◇' : work.category === 'Multi' ? '✦' : work.category}</span>
    <span className={work.warning === 'No Archive Warnings Apply' ? 'ao3-no-warning' : 'ao3-warning'} title={work.warning}>{work.warning === 'No Archive Warnings Apply' ? '—' : '!'}</span>
    <span className={work.complete ? 'ao3-complete' : 'ao3-ongoing'} title={work.complete ? '已完结' : '连载中'}>{work.complete ? '✓' : '…'}</span>
  </div>;
}
function WorkStats({ work }: { work: Ao3Work }) {
  return <dl className="ao3-stats"><div><dt>语言:</dt><dd>{work.language}</dd></div><div><dt>字数:</dt><dd>{ao3WordCount(work.chapters).toLocaleString()}</dd></div>
    <div><dt>章节:</dt><dd>{work.chapters.length}/{work.complete ? work.chapters.length : '?'}</dd></div><div><dt>评论:</dt><dd>{work.comments.length}</dd></div><div><dt>Kudos:</dt><dd>{work.kudos}</dd></div><div><dt>点击:</dt><dd>{work.hits}</dd></div></dl>;
}
function WorkCard({ work, onRead, onTag, bookmarked, chapter }: { work: Ao3Work; onRead: () => void; onTag: (tag: string) => void; bookmarked: boolean; chapter?: number }) {
  return <article className="ao3-blurb">
    <header className="ao3-blurb-header"><Symbols work={work}/><div><h3><button className="ao3-link" onClick={onRead}>{work.title}</button> <small>by <button className="ao3-link" onClick={() => onTag(work.author)}>{work.author}</button></small></h3>
      <button className="ao3-link ao3-fandom-link" onClick={() => onTag(work.fandom)}>{work.fandom}</button></div></header>
    <div className="ao3-blurb-date">{day(work.updatedAt)}{bookmarked && <span> · 已加入书签</span>}</div>
    {work.generation?.authorType === 'character' && <p className="ao3-author-hint">{work.generation.authorCharName} 的匿名作品</p>}
    <ul className="ao3-tags"><li className="ao3-warning-tag">{work.warning}</li>
      {[work.relationship, ...work.characters, ...work.tags].filter(Boolean).map((tag, i) => <li key={`${tag}-${i}`}><button className={`ao3-link${i === 0 && work.relationship ? ' ao3-relationship' : ''}`} onClick={() => onTag(tag)}>{tag}</button></li>)}</ul>
    {work.summary && <p className="ao3-summary">{work.summary}</p>}
    {chapter !== undefined && <button className="ao3-link ao3-resume" onClick={onRead}>继续阅读 · Chapter {chapter + 1}</button>}
    <WorkStats work={work}/>
  </article>;
}

function WorkEditor({ initial, author, onDraft, onPost, onCancel }: { initial: Ao3Draft; author: string; onDraft: (draft: Ao3Draft | null) => void; onPost: (draft: Ao3Draft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial), [chapter, setChapter] = useState(0);
  const [idea, setIdea] = useState(''), [cast, setCast] = useState<string[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [characters] = useState(readAo3Characters);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const change = (patch: Partial<Ao3Draft>) => { const next = { ...draft, ...patch }; setDraft(next); onDraft(next); setError(''); };
  const editChapter = (patch: Partial<Ao3Draft['chapters'][number]>) => change({ chapters: draft.chapters.map((c, i) => i === chapter ? { ...c, ...patch } : c) });
  const generate = async () => {
    if (request.current) return;
    if (draft.chapters[chapter].body.trim() && !window.confirm('生成将替换当前章的正文，继续吗？')) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const result = await generateAo3Chapter(draft, chapter, cast, idea, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      change({ title: draft.title.trim() || result.title, summary: draft.summary.trim() || result.summary,
        characters: draft.characters.trim() || characters.filter(c => cast.includes(c.id)).map(c => c.name).join(', '),
        chapters: draft.chapters.map((c, i) => i === chapter ? { title: c.title.trim() || result.chapterTitle, body: result.body } : c) });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '暂时没写好，请稍后重试。');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  return <section className="ao3-editor"><h2>{draft.workId ? '编辑作品' : '发布新作品'} <small>Post New Work</small></h2>
    <form onSubmit={e => { e.preventDefault(); onPost(draft); }}>
      <fieldset disabled={busy}><legend>作品信息</legend>
        <label>标题 *<input required maxLength={200} value={draft.title} onChange={e => change({ title: e.target.value })}/></label>
        <label>作者 *<input required maxLength={200} value={draft.author} placeholder={author} onChange={e => change({ author: e.target.value })}/></label>
        <label>所属作品 / Fandom *<input required maxLength={200} value={draft.fandom} onChange={e => change({ fandom: e.target.value })}/></label>
        <div className="ao3-form-row"><label>分级<select value={draft.rating} onChange={e => change({ rating: e.target.value as Ao3Draft['rating'] })}>{AO3_RATINGS.map(r => <option key={r}>{r}</option>)}</select></label>
          <label>类别<select value={draft.category} onChange={e => change({ category: e.target.value as Ao3Draft['category'] })}>{AO3_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
        <label>内容预警<select value={draft.warning} onChange={e => change({ warning: e.target.value })}>{['No Archive Warnings Apply', 'Creator Chose Not To Use Archive Warnings', 'Graphic Depictions Of Violence', 'Major Character Death', 'Rape/Non-Con', 'Underage'].map(w => <option key={w}>{w}</option>)}{draft.warning && !['No Archive Warnings Apply', 'Creator Chose Not To Use Archive Warnings', 'Graphic Depictions Of Violence', 'Major Character Death', 'Rape/Non-Con', 'Underage'].includes(draft.warning) && <option>{draft.warning}</option>}</select></label>
        <label>关系 / Relationships<input maxLength={200} value={draft.relationship} placeholder="角色 / 角色，或角色 & 角色" onChange={e => change({ relationship: e.target.value })}/></label>
        <label>角色 / Characters<input maxLength={6000} value={draft.characters} placeholder="多个角色用逗号分隔" onChange={e => change({ characters: e.target.value })}/></label>
        <label>附加标签 / Additional Tags<input maxLength={6000} value={draft.tags} placeholder="Slow Burn, 日常, 重逢…" onChange={e => change({ tags: e.target.value })}/></label>
        <label>简介 / Summary<textarea aria-label="简介" rows={3} maxLength={10000} value={draft.summary} onChange={e => change({ summary: e.target.value })}/></label>
        <label>作者的话 / Notes<textarea aria-label="作者的话" rows={2} maxLength={10000} value={draft.notes} onChange={e => change({ notes: e.target.value })}/></label>
      </fieldset>
      <fieldset disabled={busy}><legend>正文 / Work Text</legend>
        <div className="ao3-chapter-editor"><label>章节<select value={chapter} onChange={e => setChapter(Number(e.target.value))}>{draft.chapters.map((c, i) => <option key={i} value={i}>Chapter {i + 1}{c.title ? ` · ${c.title}` : ''}</option>)}</select></label>
          <button type="button" className="ao3-button" disabled={draft.chapters.length >= 100} onClick={() => { change({ chapters: [...draft.chapters, { title: '', body: '' }] }); setChapter(draft.chapters.length); }}>添加章节</button>
          {draft.chapters.length > 1 && <button type="button" className="ao3-button" onClick={() => { if (!window.confirm('删除当前章节？')) return; change({ chapters: draft.chapters.filter((_, i) => i !== chapter) }); setChapter(Math.max(0, chapter - 1)); }}>删除本章</button>}</div>
        <label>本章标题<input maxLength={200} value={draft.chapters[chapter].title} onChange={e => editChapter({ title: e.target.value })}/></label>
        <label>正文 *<textarea aria-label="正文" className="ao3-body-editor" required rows={15} maxLength={200000} value={draft.chapters[chapter].body} onChange={e => editChapter({ body: e.target.value })}/></label>
        <label className="ao3-checkbox"><input type="checkbox" checked={draft.complete} onChange={e => change({ complete: e.target.checked })}/>作品已完结</label>
      </fieldset>
      <details className="ao3-writing-tools"><summary>让故事开始 <ChevronDown size={14}/></summary>
        <fieldset disabled={busy}><legend className="ao3-sr-only">生成设定</legend>
          {characters.length > 0 && <div>出场角色（最多两位）<div className="ao3-cast">{characters.map(c => <label className="ao3-checkbox" key={c.id}><input type="checkbox" checked={cast.includes(c.id)} disabled={!cast.includes(c.id) && cast.length >= 2} onChange={() => setCast(cast.includes(c.id) ? cast.filter(id => id !== c.id) : [...cast, c.id])}/>{c.name}</label>)}</div></div>}
          <label>这一章想写什么<textarea aria-label="这一章想写什么" rows={3} maxLength={8000} value={idea} placeholder="场景、关系、想看到的情节或文风…" onChange={e => setIdea(e.target.value)}/></label>
          <p className="ao3-help">使用当前 API 写入本章草稿，选中的角色会参考人设与世界书。</p>
        </fieldset>
        <button type="button" className="ao3-button" onClick={() => { if (busy) { request.current?.abort(); request.current = null; setBusy(false); } else void generate(); }}>{busy ? <><Square size={12}/> 停止生成</> : '生成本章'}</button>
      </details>
      {error && <p className="ao3-notice ao3-error" role="alert">{error}</p>}
      <div className="ao3-actions"><span className="ao3-help">草稿自动保留 · {ao3WordCount(draft.chapters).toLocaleString()} 字</span>
        <button type="button" className="ao3-button" disabled={busy} onClick={onCancel}>稍后再写</button><button type="submit" className="ao3-button ao3-primary" disabled={busy}>{draft.workId ? '保存修改' : '发布作品'}</button></div>
    </form>
  </section>;
}

export function Ao3App({ onBack, userName = 'user' }: { onBack: () => void; userName?: string }) {
  const [state, setState] = useState<Ao3State>(readAo3State), [page, setPage] = useState<Page>('browse');
  const [filters, setFilters] = useState(emptyAo3Filters), [query, setQuery] = useState(''), [shelf, setShelf] = useState<Shelf>('bookmarks');
  const [workId, setWorkId] = useState(''), [chapter, setChapter] = useState(0), [entire, setEntire] = useState(false);
  const [draft, setDraft] = useState<Ao3Draft | null>(readAo3Draft);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [deleteId, setDeleteId] = useState('');
  const [sharing, setSharing] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [continuationOpen, setContinuationOpen] = useState(false), [continuationDirection, setContinuationDirection] = useState('');
  const continuationRequest = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null), comments = useRef<HTMLElement>(null);
  const listing = useRef<{ page: Page; scroll: number }>({ page: 'browse', scroll: 0 });
  const restore = useRef(false);
  const work = state.works.find(w => w.id === workId);
  useEffect(() => {
    setContinuing(false);
    setContinuationOpen(false); setContinuationDirection('');
    return () => { continuationRequest.current?.abort(); continuationRequest.current = null; };
  }, [page, workId]);
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = restore.current ? listing.current.scroll : 0;
    restore.current = false;
  }, [page, workId, chapter, entire]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3000); return () => window.clearTimeout(timer); }, [notice]);
  const commit = (action: Ao3Action) => {
    try { const next = updateAo3(readAo3State(), action); writeAo3State(next); setState(next); setError(''); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请稍后再试。'); return false; }
  };
  const saveDraft = (next: Ao3Draft | null) => {
    try { writeAo3Draft(next); setDraft(next); }
    catch { setError('草稿未能保存，请先复制正文。'); }
  };
  const navigate = (next: Page) => { setPage(next); setError(''); setNotice(''); };
  const rememberList = () => { if (page === 'browse' || page === 'library' || page === 'fandoms') listing.current = { page, scroll: scroller.current?.scrollTop ?? 0 }; };
  const returnToList = () => { restore.current = true; navigate(listing.current.page); };
  const tagSearch = (tag: string) => { setFilters({ ...emptyAo3Filters(), query: tag }); setQuery(tag); navigate('browse'); scroller.current?.scrollTo({ top: 0 }); };
  const openWork = (next: Ao3Work, resume = false) => {
    rememberList(); const saved = resume ? state.history.find(h => h.workId === next.id)?.chapter ?? 0 : 0;
    if (!commit({ type: 'read', id: next.id, chapter: saved, now: new Date().toISOString(), countHit: true })) return;
    setWorkId(next.id); setChapter(saved); setEntire(false); navigate('reader');
  };
  const selectChapter = (index: number) => {
    if (!work || !commit({ type: 'read', id: work.id, chapter: index, now: new Date().toISOString() })) return;
    setChapter(index); setEntire(false);
  };
  const startEditor = (edit?: Ao3Work) => {
    if (edit && draft && !window.confirm('已有一份草稿，改为编辑这篇作品？原草稿会被替换。')) return;
    rememberList(); const next = edit ? ao3DraftFromWork(edit) : draft ?? newAo3Draft(userName);
    saveDraft(next); navigate('editor');
  };
  const publish = (next: Ao3Draft) => {
    try {
      const published = publishAo3Draft(next, state.works.find(w => w.id === next.workId));
      if (!commit({ type: 'publish', work: published })) return;
      saveDraft(null); setWorkId(published.id); setChapter(0); setEntire(false); navigate('reader'); setNotice('作品已发布');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '请检查作品内容。'); }
  };
  const continueWork = async (direction = '') => {
    if (!work || continuationRequest.current) return;
    setContinuationOpen(false);
    const controller = new AbortController();
    continuationRequest.current = controller; setContinuing(true); setError(''); setNotice('');
    try {
      const next = await generateAo3ChapterUpdate(work, controller.signal, direction);
      if (controller.signal.aborted || continuationRequest.current !== controller) return;
      if (!commit({ type: 'continue', work, ...next, now: new Date().toISOString() })) return;
      setContinuationDirection('');
      selectChapter(work.chapters.length); setNotice(`第 ${work.chapters.length + 1} 章已更新`);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '追更失败，原文已保留，请重试。');
    } finally {
      if (continuationRequest.current === controller) { continuationRequest.current = null; setContinuing(false); }
    }
  };
  const continuationButton = work && (continuing ?
    <button className="ao3-button" onClick={() => { continuationRequest.current?.abort(); continuationRequest.current = null; setContinuing(false); setNotice('已停止追更，原文未改动'); }}><Square size={12}/>停止追更</button> :
    <button className="ao3-button ao3-primary" disabled={work.chapters.length >= 100} onClick={() => setContinuationOpen(true)}>追更</button>);
  const libraryWorks = shelf === 'works' ? state.works.filter(w => w.owned) : shelf === 'history' ? state.history.flatMap(h => state.works.find(w => w.id === h.workId) ?? []) :
    state[shelf === 'bookmarks' ? 'bookmarks' : 'later'].slice().reverse().flatMap(id => state.works.find(w => w.id === id) ?? []);
  const visible = page === 'library' ? libraryWorks : filterAo3Works(state.works, filters);
  const fandoms = [...new Set(state.works.map(w => w.fandom))];
  const filterCount = [filters.fandom, filters.rating, filters.category, filters.exclude, filters.complete !== 'all' ? filters.complete : ''].filter(Boolean).length;
  const chapterControls = work && <div className="ao3-chapter-controls"><button className="ao3-button" disabled={chapter === 0 || entire} onClick={() => selectChapter(chapter - 1)}>上一章</button>
    <label className="ao3-chapter-select"><span className="ao3-sr-only">选择章节</span><select aria-label="选择章节" value={chapter} disabled={entire} onChange={e => selectChapter(Number(e.target.value))}>{work.chapters.map((c, i) => <option key={i} value={i}>{i + 1}. {c.title}</option>)}</select></label>
    <button className="ao3-button" disabled={entire || chapter === work.chapters.length - 1} onClick={() => selectChapter(chapter + 1)}>下一章</button></div>;
  return <main className="ao3-app" aria-label="AO3">
    <div className="ao3-app-bar"><button aria-label={page === 'reader' || page === 'editor' || page === 'generate' ? '返回作品列表' : '返回桌面'} onClick={() => page === 'reader' || page === 'editor' || page === 'generate' ? returnToList() : onBack()}><ArrowLeft size={19}/></button>
      <span>AO3 <span className="ao3-bar-divider">/</span> Archive of Our Own</span><span className="ao3-private">私人文库</span></div>
    <div className="ao3-scroll" ref={scroller}>
      <header className="ao3-site-header"><button className="ao3-brand" onClick={() => { setFilters(emptyAo3Filters()); setQuery(''); navigate('browse'); }}><ArchiveLogo/><span>Archive of Our Own<sup>beta</sup></span></button>
        <button className="ao3-account ao3-link" onClick={() => navigate('settings')}>Hi, {userName}!</button>
        <nav aria-label="AO3 导航">{([['fandoms', '同人圈'], ['browse', '浏览作品'], ['library', '我的文库']] as const).map(([id, label]) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</button>)}
          <button aria-label="投稿" aria-current={page === 'editor' ? 'page' : undefined} onClick={() => startEditor()}>投稿{draft ? ' ·' : ''}</button></nav></header>
      <div className="ao3-content">
        {page === 'settings' && <Ao3Settings onChanged={() => { setState(readAo3State()); setDraft(readAo3Draft()); setWorkId(''); setFilters(emptyAo3Filters()); setQuery(''); }}/>}
        {error && <div className="ao3-notice ao3-error" role="alert">{error}<button aria-label="关闭错误提示" onClick={() => setError('')}><X size={14}/></button></div>}
        {notice && <p className="ao3-notice" role="status">{notice}</p>}
        {page === 'fandoms' && <section><h2>同人圈 <small>Fandoms</small></h2><p className="ao3-section-note">在喜欢的故事里，找到另一个故事。</p><ul className="ao3-fandom-list">{fandoms.map(f => <li key={f}><button className="ao3-link" onClick={() => { setFilters({ ...emptyAo3Filters(), fandom: f }); setQuery(''); navigate('browse'); }}>{f}</button><span>({state.works.filter(w => w.fandom === f).length})</span></li>)}</ul></section>}
        {(page === 'browse' || page === 'library') && <>
          {page === 'browse' && <div className="ao3-discover-bar"><span>Stories waiting to be found.</span><button className="ao3-button" onClick={() => { rememberList(); navigate('generate'); }}>生成作品</button></div>}
          {page === 'browse' ? <><form className="ao3-search" onSubmit={e => { e.preventDefault(); setFilters({ ...filters, query }); scroller.current?.scrollTo({ top: 0 }); }}><label><Search size={15}/><input aria-label="搜索作品" value={query} onChange={e => setQuery(e.target.value)} placeholder="标题、作者、CP、标签…"/></label><button className="ao3-button" type="submit">搜索</button></form>
            <details className="ao3-filters"><summary><SlidersHorizontal size={14}/> 排序与筛选{filterCount ? ` (${filterCount})` : ''}<ChevronDown size={14}/></summary><div className="ao3-filter-fields">
              <label>排序<select value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value as Ao3Filters['sort'] })}><option value="updated">最近更新</option><option value="kudos">Kudos 数量</option><option value="words">字数</option></select></label>
              <label>同人圈<select value={filters.fandom} onChange={e => setFilters({ ...filters, fandom: e.target.value })}><option value="">全部</option>{fandoms.map(f => <option key={f}>{f}</option>)}</select></label>
              <label>分级<select value={filters.rating} onChange={e => setFilters({ ...filters, rating: e.target.value })}><option value="">全部</option>{AO3_RATINGS.map(r => <option key={r}>{r}</option>)}</select></label>
              <label>类别<select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">全部</option>{AO3_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>完成状态<select value={filters.complete} onChange={e => setFilters({ ...filters, complete: e.target.value as Ao3Filters['complete'] })}><option value="all">全部</option><option value="complete">已完结</option><option value="ongoing">连载中</option></select></label>
              <label>排除标签<input value={filters.exclude} onChange={e => setFilters({ ...filters, exclude: e.target.value })} placeholder="用逗号分隔" maxLength={6000}/></label>
              <button className="ao3-button" onClick={() => { setFilters(emptyAo3Filters()); setQuery(''); }}>清除筛选</button></div></details>
            <h2 className="ao3-results-title">{visible.length} 篇作品 <small>{filters.query || filters.fandom || 'Works'}</small></h2></> : <><h2>{userName} 的文库</h2><nav className="ao3-shelf-tabs" aria-label="我的文库">{([['bookmarks', '书签'], ['later', '稍后阅读'], ['history', '阅读历史'], ['works', '我的作品']] as const).map(([id, label]) => <button className="ao3-button" key={id} aria-current={shelf === id ? 'page' : undefined} onClick={() => setShelf(id)}>{label}</button>)}</nav>
              {shelf === 'works' && draft && <div className="ao3-draft-row"><button className="ao3-link" onClick={() => startEditor()}>继续草稿：{draft.title || '未命名作品'}</button><button className="ao3-button" onClick={() => { if (window.confirm('删除这份未发布的草稿？')) saveDraft(null); }}>删除草稿</button></div>}</>}
          <div className="ao3-work-list">{visible.map(w => <WorkCard key={w.id} work={w} bookmarked={state.bookmarks.includes(w.id)} chapter={page === 'library' && shelf === 'history' ? state.history.find(h => h.workId === w.id)?.chapter : undefined} onRead={() => openWork(w, page === 'library' && shelf === 'history')} onTag={tagSearch}/>)}</div>
          {!visible.length && <div className="ao3-empty"><BookOpen size={27}/><p>{page === 'browse' ? '没有找到符合条件的作品。' : shelf === 'works' ? '还没有发布作品。' : shelf === 'history' ? '还没有阅读记录。' : '遇见喜欢的作品，再放到这里吧。'}</p><button className="ao3-button" onClick={() => { if (page === 'library' && shelf === 'works') startEditor(); else { setFilters(emptyAo3Filters()); setQuery(''); navigate('browse'); } }}>{page === 'library' && shelf === 'works' ? '发布作品' : '浏览作品'}</button></div>}
        </>}
        {page === 'editor' && draft && <WorkEditor initial={draft} author={userName} onDraft={saveDraft} onPost={publish} onCancel={returnToList}/>}
        {page === 'generate' && <Ao3Discovery userName={userName} onCancel={returnToList} onComplete={next => {
          if (!commit({ type: 'discover', work: next })) return;
          openWork(next); setNotice('新作品已收录');
        }}/>}
        {page === 'reader' && work && <article className="ao3-reader">
          <div className="ao3-actions ao3-reader-actions"><button className="ao3-button" onClick={returnToList}>作品列表</button><button className="ao3-button" aria-pressed={entire} onClick={() => setEntire(!entire)}>{entire ? '分章阅读' : '整篇阅读'}</button>
            <button className="ao3-button" aria-pressed={state.later.includes(work.id)} onClick={() => { if (commit({ type: 'later', id: work.id })) setNotice(state.later.includes(work.id) ? '已移出稍后阅读' : '已加入稍后阅读'); }}>{state.later.includes(work.id) ? '已标记待阅' : '稍后阅读'}</button>
            {continuationButton}
            {work.owned && <button className="ao3-button" disabled={continuing} onClick={() => startEditor(work)}>编辑</button>}{(work.owned || work.generation) && <button className="ao3-button" disabled={continuing} onClick={() => setDeleteId(work.id)}>删除</button>}</div>
          <p className="ao3-help">追更使用当前 API，追加下一章和该章五条新评论后一起保存，不覆盖原文或旧章评论。最多 100 章。旧版未标章节的评论保留在第一章。</p>
          {continuing && <p className="ao3-writing-status" role="status"><BookOpen size={24}/>正在生成第 {work.chapters.length + 1} 章及本章评论…</p>}
          <dl className="ao3-work-meta"><dt>Rating:</dt><dd>{work.rating}</dd><dt>Archive Warning:</dt><dd>{work.warning}</dd><dt>Category:</dt><dd>{work.category}</dd>
            <dt>Fandom:</dt><dd><button className="ao3-link" onClick={() => tagSearch(work.fandom)}>{work.fandom}</button></dd>{work.relationship && <><dt>Relationship:</dt><dd><button className="ao3-link" onClick={() => tagSearch(work.relationship)}>{work.relationship}</button></dd></>}
            {work.characters.length > 0 && <><dt>Characters:</dt><dd>{work.characters.join(', ')}</dd></>}{work.tags.length > 0 && <><dt>Additional Tags:</dt><dd>{work.tags.map((tag, i) => <span key={tag}>{i > 0 && ', '}<button className="ao3-link" onClick={() => tagSearch(tag)}>{tag}</button></span>)}</dd></>}
            <dt>Language:</dt><dd>{work.language}</dd><dt>Published:</dt><dd>{day(work.createdAt)}</dd><dt>Updated:</dt><dd>{day(work.updatedAt)}</dd><dt>Stats:</dt><dd><WorkStats work={work}/></dd></dl>
          <header className="ao3-work-preface"><h1>{work.title}</h1><p><button className="ao3-link" onClick={() => tagSearch(work.author)}>{work.author}</button>{work.generation?.authorType === 'character' && <small className="ao3-author-hint">{work.generation.authorCharName} 的匿名作品</small>}</p>
            {work.summary && <div><h3>Summary:</h3><p>{work.summary}</p></div>}{work.notes && <div><h3>Notes:</h3><p>{work.notes}</p></div>}</header>
          {!entire && chapterControls}
          {(entire ? work.chapters.map((c, i) => ({ ...c, index: i })) : [{ ...work.chapters[chapter], index: chapter }]).map(c => <section className="ao3-chapter" key={c.index}>
            <h2>Chapter {c.index + 1}{c.title ? `: ${c.title}` : ''}</h2><div className="ao3-prose">{c.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
            <section ref={c.index === chapter ? comments : undefined} className="ao3-comments" aria-label={`第 ${c.index + 1} 章评论`}>
              <Ao3Comments key={`${work.id}:${c.index}`} work={work} chapter={c.index} userName={userName} onAction={commit}/>
            </section></section>)}
          {!entire && chapterControls}
          <div className="ao3-actions ao3-reader-bottom"><button className="ao3-button" aria-pressed={state.kudosed.includes(work.id)} onClick={() => { if (commit({ type: 'kudos', id: work.id })) setNotice(state.kudosed.includes(work.id) ? '你已经为这篇作品留下过 Kudos 了。' : '感谢你留下 Kudos！'); }}><Heart size={13} fill={state.kudosed.includes(work.id) ? 'currentColor' : 'none'}/> Kudos ({work.kudos})</button>
            {continuationButton}
            <button className="ao3-button" aria-pressed={state.bookmarks.includes(work.id)} onClick={() => commit({ type: 'bookmark', id: work.id })}>{state.bookmarks.includes(work.id) ? '移除书签' : '加入书签'}</button><button className="ao3-button" onClick={() => comments.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>第 {chapter + 1} 章评论 ({ao3ChapterComments(work, chapter).length})</button><button className="ao3-button" onClick={() => setSharing(true)}>分享给角色</button></div>
          {state.kudosed.includes(work.id) && <p className="ao3-kudos-note">♥ {userName} 为这篇作品留下了 Kudos。</p>}
        </article>}
        <footer className="ao3-footer"><ArchiveLogo/><p>为喜欢的故事，留一个位置。</p></footer>
      </div>
    </div>
    {notice && <div className="ao3-toast" aria-hidden="true">{notice}</div>}
    {continuationOpen && work && <div className="ao3-dialog-shade" onClick={() => setContinuationOpen(false)}>
      <form className="ao3-dialog" role="dialog" aria-modal="true" aria-label="追更" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setContinuationOpen(false); } }} onSubmit={e => { e.preventDefault(); void continueWork(continuationDirection); }}>
        <h3>追更</h3>
        <label>希望的后续走向（可选）<textarea autoFocus aria-label="希望的后续走向" rows={5} maxLength={8000} value={continuationDirection} onChange={e => setContinuationDirection(e.target.value)} placeholder="想看的情节、人物互动或情绪走向……" /></label>
        <p className="ao3-help">留空则自然续写。</p>
        <div className="ao3-actions"><button type="button" className="ao3-button" onClick={() => setContinuationOpen(false)}>取消</button><button type="submit" className="ao3-button ao3-primary" disabled={continuing}>开始追更</button></div>
      </form>
    </div>}
    {sharing && work && <div className="ao3-dialog-shade" onClick={() => setSharing(false)}><section className="ao3-dialog" role="dialog" aria-modal="true" aria-label="分享给角色" onClick={e => e.stopPropagation()}><h3>分享给角色</h3><div className="ao3-share-recipients">{readAo3Characters().map(c => <button key={c.id} className="ao3-button" onClick={() => {
      try { shareAo3Work(work, c.id); setSharing(false); setNotice(`已分享给${c.name}`); }
      catch (cause) { setSharing(false); setError(cause instanceof Error ? cause.message : '分享失败，请重试。'); }
    }}>{c.name}</button>)}{!readAo3Characters().length && <p>通讯录中还没有角色。</p>}</div><div className="ao3-actions"><button className="ao3-button" autoFocus onClick={() => setSharing(false)}>取消</button></div></section></div>}
    {deleteId && <div className="ao3-dialog-shade" onClick={() => setDeleteId('')}><section className="ao3-dialog" role="dialog" aria-modal="true" aria-label="删除作品" onClick={e => e.stopPropagation()}><h3>删除作品？</h3><p>正文、书签和这篇作品的评论都会一起移除。</p><div className="ao3-actions"><button className="ao3-button" autoFocus onClick={() => setDeleteId('')}>取消</button><button className="ao3-button ao3-primary" onClick={() => { if (commit({ type: 'delete', id: deleteId })) { setDeleteId(''); returnToList(); } }}>删除</button></div></section></div>}
  </main>;
}
