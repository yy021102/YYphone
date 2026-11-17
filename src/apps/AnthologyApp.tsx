import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Download, Feather, Leaf, Loader2, Menu, Pencil, RefreshCw, Search, Send, Trash2, Upload, X } from 'lucide-react';
import { ANTHOLOGY_DRAFT_KEY, ANTHOLOGY_GENRES, ANTHOLOGY_STYLES, anthologyExportText, anthologyGenre, anthologyStyle,
  createAnthologyManuscript, defaultAnthologyDraft, deleteAnthologyArticle, favoriteAnthologyArticle, isAnthologyDraft, isUserManuscript, readAnthologyArticles, readAnthologyAuthors,
  readAnthologyDraft, saveAnthologyArticle, saveGeneratedAnthologyArticle, type AnthologyArticle, type AnthologyDraft } from '../utils/anthology';
import { generateAnthologyArticle, shareAnthologyArticle } from '../utils/anthologyGeneration';
import { writeStoredValue } from '../utils/localStorage';
import { clearAnthologyData, createAnthologyArchive, importAnthologyArchive, parseAnthologyArchive } from '../utils/anthologyArchive';
import './anthology.css';
import { AnthologyDiscussion } from '../components/AnthologyDiscussion';

const message = (cause: unknown) => cause instanceof Error ? cause.message : '这次操作没有完成，请重试。';
const date = (value: string) => new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
function readLibrary() {
  try { return { articles: readAnthologyArticles(), error: '' }; }
  catch (cause) { return { articles: [] as AnthologyArticle[], error: message(cause) }; }
}
export function AnthologyApp({ onBack }: { onBack: () => void }) {
  const [library, setLibrary] = useState(readLibrary);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState('');
  const [draft, setDraft] = useState(readAnthologyDraft);
  const [writer, setWriter] = useState(false), [rewriting, setRewriting] = useState<AnthologyArticle | null>(null);
  const [editing, setEditing] = useState<AnthologyArticle | null>(null);
  const editingOriginal = useRef<AnthologyArticle | null>(null);
  const [share, setShare] = useState(false), [recipients, setRecipients] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [dataMenu, setDataMenu] = useState(false), [archiveBusy, setArchiveBusy] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const archiveLock = useRef(false), archiveFile = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null), alive = useRef(true);
  const scroll = useRef<HTMLDivElement>(null), libraryScroll = useRef(0);
  const desk = useRef<HTMLDivElement>(null);
  const authors = readAnthologyAuthors(), article = library.articles.find(a => a.id === selectedId);
  const manuscripts = library.articles.filter(isUserManuscript);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { scroll.current?.scrollTo({ top: selectedId ? 0 : libraryScroll.current }); }, [selectedId]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3000); return () => window.clearTimeout(timer); }, [notice]);
  const refresh = () => { const next = readLibrary(); setLibrary(next); return next; };
  const change = (patch: Partial<AnthologyDraft>) => {
    const next = { ...draft, ...patch }; setDraft(next);
    try { if (isAnthologyDraft(next)) writeStoredValue(ANTHOLOGY_DRAFT_KEY, next); }
    catch (cause) { setError(message(cause)); }
  };
  const openWriter = (original?: AnthologyArticle, source?: AnthologyArticle) => {
    setError(''); setRewriting(original ?? null);
    const next = original ? { ...original.draft } : source ? { ...defaultAnthologyDraft(), manuscriptId: source.id } : { ...draft };
    setDraft(next); setWriter(true);
  };
  const openManuscript = () => { editingOriginal.current = null; setEditing(createAnthologyManuscript()); setError(''); };
  const editArticle = (item: AnthologyArticle) => { editingOriginal.current = item; setEditing({ ...item }); setError(''); };
  const saveEdit = () => {
    if (!editing) return;
    try {
      const saved = saveAnthologyArticle({ ...editing, title: editing.title.trim(), body: editing.body.trim(), updatedAt: new Date().toISOString() }, editingOriginal.current ?? undefined);
      refresh(); setEditing(null); setSelectedId(saved.id); if (isUserManuscript(saved)) setFilter('mine'); setError('');
      setNotice(isUserManuscript(saved) ? '手稿已保存。' : '修改已保存。');
    } catch (cause) { setError(message(cause)); }
  };
  const generate = async () => {
    if (controller.current || library.error) return;
    const active = new AbortController(), original = rewriting;
    controller.current = active; setBusy(true); setError('');
    try {
      if (!isAnthologyDraft(draft)) throw new Error('聊天记录条数请填写 1～300 的整数，并选择作者。');
      writeStoredValue(ANTHOLOGY_DRAFT_KEY, draft);
      const result = await generateAnthologyArticle(draft, active.signal);
      active.signal.throwIfAborted(); if (!alive.current) return;
      const saved = await saveGeneratedAnthologyArticle(original ? { ...result, id: original.id, createdAt: original.createdAt } : result, original ?? undefined);
      if (!alive.current) return;
      refresh(); setDraft(defaultAnthologyDraft()); setSelectedId(saved.id); setWriter(false); setRewriting(null); setNotice(original ? '这一篇已重新写好。' : '新文章已收入文集。');
    } catch (cause) { if (alive.current) setError(active.signal.aborted ? '已停止，原稿和写作选项已保留。' : message(cause)); }
    finally { if (controller.current === active) { controller.current = null; if (alive.current) setBusy(false); } }
  };
  const favorite = (id: string) => { try { favoriteAnthologyArticle(id); refresh(); } catch (cause) { setError(message(cause)); } };
  const remove = (item: AnthologyArticle) => {
    if (!window.confirm(`删除《${item.title}》？已分享的聊天内容会保留。`)) return;
    try { deleteAnthologyArticle(item.id); refresh(); if (selectedId === item.id) setSelectedId(''); }
    catch (cause) { setError(message(cause)); }
  };
  const exportArticle = (item: AnthologyArticle) => {
    const url = URL.createObjectURL(new Blob([anthologyExportText(item)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${item.authorName}-${item.title}`.replace(/[\\/:*?"<>|]/g, '_') + '.txt';
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const exportData = () => {
    try {
      const archive = createAnthologyArchive(), url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `文集-${new Date().toLocaleDateString('sv-SE')}-${new Date().toTimeString().slice(0, 8).replaceAll(':', '')}.json`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setError(''); setNotice('文集数据已导出。');
    } catch (cause) { setError(message(cause)); }
  };
  const importData = async (file?: File) => {
    if (!file || archiveLock.current) return;
    archiveLock.current = true; setArchiveBusy(true); setError('');
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('文集备份请控制在 50 MB 以内。');
      const archive = parseAnthologyArchive(JSON.parse(await file.text()));
      if (!window.confirm(`导入 ${archive.articles.length} 篇文章？${importMode === 'replace' ? '这将替换当前全部文集文章。' : '相同编号的文章会保留本地版本。'}写作选项会恢复为备份中的设置。`)) return;
      const result = await importAnthologyArchive(archive, importMode);
      refresh(); setDraft(readAnthologyDraft()); setSelectedId(''); setFilter('all'); setQuery(''); setDataMenu(false);
      setNotice(`已导入 ${result.added} 篇${result.kept ? `，保留 ${result.kept} 篇本地版本` : ''}。`);
    } catch (cause) { setError(cause instanceof SyntaxError ? '备份文件不是有效的 JSON，现有数据未改动。' : message(cause)); }
    finally { archiveLock.current = false; if (alive.current) setArchiveBusy(false); if (archiveFile.current) archiveFile.current.value = ''; }
  };
  const clearData = async () => {
    if (archiveLock.current || !window.confirm('清空全部文集数据？文章、个人手稿、收藏和写作选项将被删除，无法撤销。已分享的聊天内容会保留。建议先导出文集备份。')) return;
    archiveLock.current = true; setArchiveBusy(true); setError('');
    try {
      await clearAnthologyData(); refresh(); setDraft(readAnthologyDraft()); setSelectedId(''); setFilter('all'); setQuery('');
      setDataMenu(false); setNotice('文集数据已清空。');
    } catch (cause) { setError(message(cause)); }
    finally { archiveLock.current = false; if (alive.current) setArchiveBusy(false); }
  };
  const shown = library.articles.filter(a => (filter === 'mine' ? isUserManuscript(a) : !isUserManuscript(a) && (filter === 'all' || filter === 'saved' ? filter !== 'saved' || a.favorite : a.authorId === filter)) &&
    (!query.trim() || `${a.title} ${a.authorName} ${a.body}`.toLowerCase().includes(query.trim().toLowerCase())));
  const authorFilters = [...new Map([...authors.map(a => [a.id, a.name] as const), ...library.articles.filter(a => !isUserManuscript(a)).map(a => [a.authorId, a.authorName] as const)]).entries()];
  const shelves = authorFilters.filter(([id]) => library.articles.some(a => a.authorId === id));
  const openAuthor = (id: string) => {
    setFilter(id); setQuery('');
    requestAnimationFrame(() => {
      const pane = scroll.current, target = desk.current;
      if (pane && target) pane.scrollTo({ top: pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top, behavior: 'smooth' });
    });
  };
  return <section className="anthology-app">
    <header className="anthology-header"><button type="button" aria-label={article ? '返回文集' : '返回主屏幕'} onClick={() => article ? setSelectedId('') : onBack()}><ArrowLeft size={20}/></button><span><Feather size={15}/>文集</span><button type="button" aria-label="文集数据菜单" onClick={() => { setDataMenu(true); setError(''); }}><Menu size={20}/></button></header>
    <div className="anthology-scroll" ref={scroll}>
      {(error || library.error) && !writer && !editing && !share && !dataMenu && <div className="anthology-error" role="alert">{error || library.error}{library.error && <button type="button" onClick={refresh}>重新读取</button>}</div>}
      {notice && <p className="anthology-notice" role="status">{notice}</p>}
      {!article ? <>
        <section className="anthology-library-intro"><div><small>THE COLLECTED PAGES</small><h1>{filter === 'mine' ? '我的手稿' : '案头书架'}</h1><p>{filter === 'mine' ? '写下你的观察，也留一点未说完的话。' : '一些观察，一些尚未说完的想法。'}</p></div><button type="button" className="anthology-primary" disabled={!!library.error} onClick={() => filter === 'mine' ? openManuscript() : openWriter()}><Feather size={14}/>{filter === 'mine' ? '写手稿' : '写一篇'}</button></section>
        <nav className="anthology-library-tabs" aria-label="文集栏目"><button type="button" aria-pressed={filter !== 'mine'} onClick={() => { setFilter('all'); setQuery(''); }}>作者书架</button><button type="button" aria-pressed={filter === 'mine'} onClick={() => { setFilter('mine'); setQuery(''); }}>我的手稿</button></nav>
        {filter !== 'mine' && <section className="anthology-bookshelf" aria-label="作者书架">{shelves.length ? shelves.map(([id, name], index) => {
          const count = library.articles.filter(a => a.authorId === id).length;
          return <div className="anthology-book-slot" key={id}><button type="button" className={`anthology-shelf-book tone-${index % 4}`} aria-label={`翻阅${name}的文集`} aria-pressed={filter === id} onClick={() => openAuthor(id)}><span className="anthology-book-series">随笔 · 文集</span><Leaf size={17} strokeWidth={1}/><strong>{name}</strong><i/><span className="anthology-book-edition">VOL. {String(index + 1).padStart(2, '0')}</span></button><span className="anthology-book-caption">{name}<small>{count} 篇</small></span></div>;
        }) : <div className="anthology-shelf-empty"><div className="anthology-empty-volumes" aria-hidden="true"><i/><i/><i/></div><span>一册空白，等一个作者。</span></div>}</section>}
        <section className="anthology-manuscript-desk"><div className="anthology-shelf-heading" ref={desk}><h2>{filter === 'mine' ? '写给这一页' : filter === 'saved' ? '珍藏手稿' : authorFilters.find(([id]) => id === filter) ? `${authorFilters.find(([id]) => id === filter)![1]}的手稿` : '案头手稿'}</h2><span>{shown.length} 篇</span></div>
        {filter !== 'mine' && <div className="anthology-filters"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部</button><button type="button" aria-pressed={filter === 'saved'} onClick={() => setFilter('saved')}><Bookmark size={11}/>收藏</button></div>}
        <label className="anthology-search"><Search size={14}/><input aria-label="搜索文集" placeholder="找一篇文章" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <div className="anthology-articles">{shown.map((item, index) => <article key={item.id} className="anthology-card"><button type="button" className="anthology-card-open" aria-label={`阅读${item.title}`} onClick={() => { libraryScroll.current = scroll.current?.scrollTop ?? 0; setSelectedId(item.id); setError(''); }}><span className="anthology-card-number">{String(index + 1).padStart(2, '0')}</span><div><small>{isUserManuscript(item) ? '我的手稿' : anthologyGenre(item.genre)}<i/> {isUserManuscript(item) ? '亲笔' : anthologyStyle(item.style)}</small><h3>{item.title}</h3><p>{item.body.replace(/\s+/g, ' ').slice(0, 100)}</p><footer>{item.authorAvatar && <img src={item.authorAvatar} alt=""/>}<span>{item.authorName}</span><time>{date(item.createdAt)}</time></footer></div></button><button type="button" className="anthology-card-bookmark" aria-label={item.favorite ? `取消收藏${item.title}` : `收藏${item.title}`} aria-pressed={item.favorite} onClick={() => favorite(item.id)}><Bookmark size={15} fill={item.favorite ? 'currentColor' : 'none'}/></button></article>)}</div>
        {!shown.length && !library.error && <div className="anthology-empty"><Feather size={32} strokeWidth={1}/><p>{filter === 'mine' ? '这一页，留给你自己落笔。' : library.articles.length ? '这一页，暂时没有找到文章。' : '第一篇文章，还等着落笔。'}</p></div>}
        </section>
      </> : <article className={`anthology-reading${article.genre === 'poetry' ? ' is-poetry' : ''}`}>
        <div className="anthology-reading-kicker">{isUserManuscript(article) ? '我的手稿' : anthologyGenre(article.genre)}<span>·</span>{isUserManuscript(article) ? '亲笔' : anthologyStyle(article.style)}</div><h1>{article.title}</h1><div className="anthology-byline">{article.authorAvatar && <img src={article.authorAvatar} alt={`${article.authorName}头像`}/>}<strong>{article.authorName}</strong><time>{date(article.createdAt)}</time></div>
        {article.sourceManuscript && <p className="anthology-response-source">回应《{article.sourceManuscript.title}》</p>}
        <div className="anthology-body">{article.body}</div><div className="anthology-end-mark">· · ·</div>
        <div className="anthology-reading-actions"><button type="button" aria-pressed={article.favorite} onClick={() => favorite(article.id)}><Bookmark size={15} fill={article.favorite ? 'currentColor' : 'none'}/>{article.favorite ? '已收藏' : '收藏'}</button><button type="button" onClick={() => { setRecipients(authors.some(a => a.id === article.authorId) ? [article.authorId] : []); setShare(true); setError(''); }}><Send size={15}/>分享</button><button type="button" onClick={() => exportArticle(article)}><Download size={15}/>导出</button><button type="button" onClick={() => editArticle(article)}><Pencil size={15}/>修改</button>{isUserManuscript(article) ? <button type="button" onClick={() => openWriter(undefined, article)}><Feather size={15}/>请角色回应</button> : <button type="button" onClick={() => openWriter(article)}><RefreshCw size={15}/>重写</button>}<button type="button" onClick={() => remove(article)}><Trash2 size={15}/>删除</button></div>
        {!isUserManuscript(article) && <AnthologyDiscussion key={article.id} article={article} onUpdate={refresh}/>}
      </article>}
    </div>
    {dataMenu && <div className="anthology-overlay"><section className="anthology-dialog" role="dialog" aria-modal="true" aria-label="文集数据"><header><h2><Menu size={17}/>文集数据</h2><button type="button" aria-label="关闭文集数据" disabled={archiveBusy} onClick={() => { setDataMenu(false); setError(''); }}><X size={18}/></button></header><div className="anthology-dialog-scroll">
      <p className="anthology-hint">备份包含全部文章、个人手稿、文章回复、收藏状态和写作选项。</p>
      <button type="button" className="anthology-primary" disabled={archiveBusy} onClick={exportData}><Download size={15}/>导出文集数据</button>
      <label>导入方式<select aria-label="文集数据导入方式" value={importMode} disabled={archiveBusy} onChange={e => setImportMode(e.target.value as 'merge' | 'replace')}><option value="merge">合并导入，相同编号保留本地</option><option value="replace">替换当前全部文集</option></select></label>
      <button type="button" className="anthology-primary" disabled={archiveBusy} onClick={() => archiveFile.current?.click()}><Upload size={15}/>{archiveBusy ? '正在处理…' : '导入文集数据'}</button>
      <button type="button" className="anthology-data-danger" disabled={archiveBusy} onClick={() => void clearData()}><Trash2 size={15}/>清空文集数据</button>
      <p className="anthology-hint">清空只删除文集里的内容，已分享的聊天消息会保留。</p>
      {error && <p role="alert" className="anthology-error">{error}</p>}
    </div></section></div>}
    <input type="file" accept=".json,application/json" aria-label="导入文集备份文件" ref={archiveFile} className="hidden" disabled={archiveBusy} onChange={e => void importData(e.target.files?.[0])}/>
    {writer && <div className="anthology-overlay"><section className="anthology-dialog" role="dialog" aria-modal="true" aria-label={rewriting ? '重写文章' : '写一篇'}><header><h2><Feather size={17}/>{rewriting ? '重新落笔' : '写一篇'}</h2><button type="button" aria-label="关闭写作" disabled={busy} onClick={() => { setWriter(false); setRewriting(null); setError(''); }}><X size={18}/></button></header><div className="anthology-dialog-scroll">
      {!authors.length && <p className="anthology-error">先在微信添加角色，再邀请他为文集落笔。</p>}
      <label>作者<select aria-label="文集作者" value={draft.authorId} disabled={busy} onChange={e => change({ authorId: e.target.value })}><option value="">选择作者</option>{authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      {(manuscripts.length > 0 || draft.manuscriptId) && <><label>回应我的手稿<select aria-label="回应我的手稿" disabled={busy} value={draft.manuscriptId ?? ''} onChange={e => change({ manuscriptId: e.target.value || undefined })}><option value="">不选手稿，自由选题</option>{manuscripts.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><p className="anthology-hint">作者会读完整手稿，从自己的立场展开，不只附和、反驳或扩写。</p></>}
      <label>文体<select aria-label="文章文体" value={draft.genre} disabled={busy} onChange={e => change({ genre: e.target.value })}>{ANTHOLOGY_GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
      <fieldset disabled={busy}><legend>笔触</legend><div className="anthology-style-options">{ANTHOLOGY_STYLES.map(s => <button type="button" key={s.id} aria-pressed={draft.style === s.id} onClick={() => change({ style: s.id })}>{s.label}</button>)}</div><p className="anthology-hint">{ANTHOLOGY_STYLES.find(s => s.id === draft.style)?.hint}</p></fieldset>
      <label>{draft.style === 'custom' ? '自定义风格' : '补充笔触（选填）'}<textarea aria-label="自定义写作风格" rows={2} disabled={busy} value={draft.customStyle} maxLength={8000} onChange={e => change({ customStyle: e.target.value })} placeholder="描述你希望的语言、节奏、叙述方式……"/></label>
      <label>内容方向<textarea aria-label="文章内容方向" rows={3} disabled={busy} value={draft.direction} maxLength={8000} onChange={e => change({ direction: e.target.value })} placeholder="一个问题、一种现象，或留空让作者自由选题。"/></label>
      <details><summary>参考材料与经历</summary><div className="anthology-details-body"><label>新闻或其他材料<textarea aria-label="文章参考材料" rows={5} disabled={busy} value={draft.material} maxLength={30000} onChange={e => change({ material: e.target.value })} placeholder="粘贴想讨论的新闻、见闻或摘录。"/></label><p className="anthology-hint">依据所贴材料写作，不自动联网核实。</p><label className="anthology-toggle"><input type="checkbox" disabled={busy} checked={draft.attachChats} onChange={e => change({ attachChats: e.target.checked })}/>参考近期聊天</label>{draft.attachChats && <label>最近多少条<input aria-label="文集参考聊天条数" type="number" min={1} max={300} disabled={busy} value={draft.chatCount || ''} onChange={e => change({ chatCount: Number(e.target.value) })}/></label>}<label className="anthology-toggle"><input type="checkbox" disabled={busy} checked={draft.attachMemories} onChange={e => change({ attachMemories: e.target.checked })}/>参考关联记忆与流水账</label><p className="anthology-hint">这些经历只作心境的背景，作者不必在文章中引用。</p></div></details>
      <label>篇幅<select aria-label="文章篇幅" disabled={busy} value={draft.length} onChange={e => change({ length: e.target.value as AnthologyDraft['length'] })}><option value="short">短篇</option><option value="medium">中篇</option><option value="long">长篇</option></select></label>
      {error && <p role="alert" className="anthology-error">{error}</p>}
      <p className="anthology-hint">会参考你当前的人设；文章仅收入文集，分享后才会出现在角色聊天中。{rewriting ? '重写成功后替换本篇，停止或失败会保留原稿。' : ''}</p>
    </div><footer>{busy ? <><span role="status"><Loader2 size={15} className="animate-spin"/>正在落笔…</span><button type="button" onClick={() => controller.current?.abort()}>停止生成</button></> : <button type="button" className="anthology-primary" disabled={!draft.authorId || !authors.some(a => a.id === draft.authorId)} onClick={() => void generate()}><Feather size={15}/>{rewriting ? '重写这一篇' : '开始写作'}</button>}</footer></section></div>}
    {editing && <div className="anthology-overlay"><section className="anthology-dialog" role="dialog" aria-modal="true" aria-label={isUserManuscript(editing) ? '我的手稿编辑' : '修改文章'}><header><h2>{isUserManuscript(editing) ? '我的手稿' : '修改文章'}</h2><button type="button" aria-label="取消修改" onClick={() => setEditing(null)}><X size={18}/></button></header><div className="anthology-dialog-scroll"><label>标题<input aria-label="编辑文章标题" value={editing.title} maxLength={200} onChange={e => setEditing({ ...editing, title: e.target.value })}/></label><label>正文<textarea aria-label="编辑文章正文" rows={16} maxLength={100000} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })}/></label>{isUserManuscript(editing) && <p className="anthology-hint">保存只收入你的文集，不调用 AI；分享或邀请角色回应由你决定。</p>}{error && <p role="alert" className="anthology-error">{error}</p>}</div><footer><button type="button" className="anthology-primary" onClick={saveEdit}>{isUserManuscript(editing) ? '保存手稿' : '保存修改'}</button></footer></section></div>}
    {share && article && <div className="anthology-overlay"><section className="anthology-dialog" role="dialog" aria-modal="true" aria-label="分享文章"><header><h2>分享给角色</h2><button type="button" aria-label="取消分享" onClick={() => setShare(false)}><X size={18}/></button></header><div className="anthology-dialog-scroll"><p>《{article.title}》 · {article.authorName}</p>{authors.map(a => <label key={a.id} className="anthology-toggle"><input type="checkbox" checked={recipients.includes(a.id)} onChange={e => setRecipients(current => e.target.checked ? [...current, a.id] : current.filter(id => id !== a.id))}/>{a.name}</label>)}{!authors.length && <p>通讯录里还没有可分享的角色。</p>}{error && <p role="alert" className="anthology-error">{error}</p>}</div><footer><button type="button" className="anthology-primary" disabled={!recipients.length} onClick={() => { try { shareAnthologyArticle(article, recipients); setShare(false); setNotice('已分享完整文章。'); } catch (cause) { setError(message(cause)); } }}><Send size={15}/>分享全文</button></footer></section></div>}
  </section>;
}
