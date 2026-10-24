import { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, BookOpen, Check, ChevronLeft, ChevronRight, Download, Feather, MessageCircle, Moon, Pause, Plus, Send, Sparkles, Sun, Trash2, Upload, X } from 'lucide-react';
import {
  deleteReadingText, normalizeReadingText, pageAtOffset, paginateReadingText, readReadingLibrary,
  readReadingText, readingChapter, readingPageContext, readingShareText, writeReadingLibrary,
  writeReadingText, type ReadingBook, type ReadingLine, type ReadingPage,
} from '../utils/wechatReading';

type Contact = { id: string; name: string };
export type ReadingReplyRequest = {
  characterId: string;
  userMessage: string;
  kind: 'auto' | 'chat' | 'nudge';
  title: string;
  pageNumber: number;
  pageContext: string;
  recap: string;
  dialogue: ReadingLine[];
};
export type ReadingSummaryRequest = { title: string; previousRecap: string; newText: string; throughPage: number };
type Props = {
  contacts: Contact[];
  userName: string;
  onRespond: (request: ReadingReplyRequest) => Promise<string>;
  onSummarize: (request: ReadingSummaryRequest) => Promise<string>;
  onShare: (id: string, title: string, detail: string, recipients: string[]) => void;
};

const palette = [
  'from-[#34536b] via-[#627b83] to-[#c5a894]',
  'from-[#634d58] via-[#a37976] to-[#d6b797]',
  'from-[#305d55] via-[#608579] to-[#cbbf9e]',
  'from-[#665834] via-[#a88a5c] to-[#d5c3a0]',
];
const pageTargets = { small: 470, normal: 370, large: 290 } as const;
const pageFonts = { small: 'text-[14px] leading-[1.95]', normal: 'text-[16px] leading-[2.05]', large: 'text-[18px] leading-[2.15]' } as const;
const bookColor = (id: string) => palette[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
const timeLabel = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
const cleanTitle = (filename: string) => filename.replace(/\.txt$/i, '').replace(/[_-]+/g, ' ').trim() || '未命名的书';

async function decodeTxt(file: File, encoding: 'auto' | 'utf-8' | 'gb18030'): Promise<string> {
  const bytes = await file.arrayBuffer();
  if (encoding === 'auto') {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return new TextDecoder('gb18030').decode(bytes); }
  }
  return new TextDecoder(encoding).decode(bytes);
}

export function WeChatReadingApp({ contacts, userName, onRespond, onSummarize, onShare }: Props) {
  const [books, setBooks] = useState<ReadingBook[]>(readReadingLibrary);
  const booksRef = useRef(books);
  const [activeId, setActiveId] = useState('');
  const [activeText, setActiveText] = useState('');
  const [encoding, setEncoding] = useState<'auto' | 'utf-8' | 'gb18030'>('auto');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [summarizing, setSummarizing] = useState(false);
  const summaryRef = useRef(false);
  const summaryAttempts = useRef(new Map<string, number>());
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareWith, setShareWith] = useState<string[]>([]);
  const [shareNote, setShareNote] = useState('');
  const [shared, setShared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const book = books.find(item => item.id === activeId);
  const companion = contacts.find(item => item.id === book?.companionId);
  const pages = useMemo(() => paginateReadingText(activeText, pageTargets[book?.font ?? 'normal']), [activeText, book?.font]);
  const pageIndex = book ? pageAtOffset(pages, book.position) : 0;
  const page = pages[pageIndex];
  const progress = book && activeText ? Math.round(book.maxReadOffset / activeText.length * 100) : 0;

  const saveBooks = (next: ReadingBook[]) => { booksRef.current = next; setBooks(next); writeReadingLibrary(next); };
  const updateBook = (id: string, change: (current: ReadingBook) => ReadingBook): ReadingBook | null => {
    let updated: ReadingBook | null = null;
    const next = booksRef.current.map(item => {
      if (item.id !== id) return item;
      updated = { ...change(item), updatedAt: new Date().toISOString() };
      return updated;
    });
    if (updated) saveBooks(next);
    return updated;
  };
  const openBook = (selected: ReadingBook) => {
    const text = readReadingText(selected.id);
    if (!text) { setError('这本书的正文未找到，请重新导入 TXT。'); return; }
    setActiveText(text); setActiveId(selected.id); setError(''); setDraft(''); setShared(false);
    updateBook(selected.id, current => ({ ...current, status: 'reading' }));
  };
  const importBook = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!/\.txt$/i.test(file.name)) { setError('请选择 .txt 文件。'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('单本 TXT 请控制在 8 MB 以内，方便手机流畅翻页。'); return; }
    try {
      const content = normalizeReadingText(await decodeTxt(file, encoding));
      if (!content) throw new Error('文件里没有可阅读的文字。');
      const now = new Date().toISOString();
      const imported: ReadingBook = {
        id: crypto.randomUUID(), title: cleanTitle(file.name), fileName: file.name, textLength: content.length,
        createdAt: now, updatedAt: now, status: 'reading', position: 0, maxReadOffset: 0,
        font: 'normal', theme: 'paper', companionId: contacts[0]?.id ?? '', coRead: false,
        autoComment: true, lastAutoOffset: -1, dialogue: [], recap: '', recapOffset: 0,
      };
      writeReadingText(imported.id, content);
      saveBooks([imported, ...booksRef.current]);
      openBook(imported);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败，请检查 TXT 编码。'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const exportBook = (selected: ReadingBook) => {
    const text = readReadingText(selected.id);
    if (!text) { setError('正文未找到，无法导出。'); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${selected.title.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const deleteBook = (selected: ReadingBook) => {
    if (!window.confirm(`删除《${selected.title}》和这本书的全部共读记录？`)) return;
    saveBooks(booksRef.current.filter(item => item.id !== selected.id));
    deleteReadingText(selected.id);
    if (activeId === selected.id) { setActiveId(''); setActiveText(''); }
  };
  const goPage = (index: number) => {
    if (!book || index < 0 || index >= pages.length) return;
    const next = pages[index];
    updateBook(book.id, current => ({ ...current, position: next.start, maxReadOffset: Math.max(current.maxReadOffset, next.end), status: 'reading' }));
    setError('');
  };

  useEffect(() => {
    if (book && page && book.maxReadOffset < page.end) updateBook(book.id, current => ({ ...current, maxReadOffset: page.end }));
  }, [book?.id, book?.font, pageIndex, page?.end]);

  const respond = async (kind: ReadingReplyRequest['kind'], message = '') => {
    const current = booksRef.current.find(item => item.id === activeId);
    if (!current || !page || !current.companionId || busyRef.current) return;
    const actor = contacts.find(item => item.id === current.companionId);
    if (!actor) { setError('先选择一位通讯录角色共读。'); return; }
    let dialogue = current.dialogue;
    if (kind === 'chat') {
      const text = message.trim().slice(0, 500);
      if (!text) return;
      const line: ReadingLine = { id: crypto.randomUUID(), senderId: 'user', name: userName || '我', text,
        pageStart: page.start, createdAt: new Date().toISOString() };
      dialogue = [...dialogue, line];
      updateBook(current.id, item => ({ ...item, dialogue }));
      setDraft('');
    }
    if (kind === 'auto') updateBook(current.id, item => ({ ...item, lastAutoOffset: page.start }));
    busyRef.current = true; setBusy(true); setError('');
    try {
      const reply = (await onRespond({ characterId: actor.id, userMessage: kind === 'chat' ? message.trim() : '',
        kind, title: current.title, pageNumber: pageIndex + 1,
        pageContext: readingPageContext(pages, pageIndex), recap: current.recap, dialogue: dialogue.slice(-24) })).trim();
      if (!reply) throw new Error('角色没有返回有效发言，请重试。');
      updateBook(current.id, item => ({ ...item, dialogue: [...item.dialogue, {
        id: crypto.randomUUID(), senderId: actor.id, name: actor.name, text: reply.slice(0, 500),
        pageStart: page.start, createdAt: new Date().toISOString(),
      }] }));
    } catch (cause) {
      if (kind !== 'auto') setError(cause instanceof Error ? cause.message : '角色暂时没有回应。');
    } finally { busyRef.current = false; setBusy(false); }
  };

  useEffect(() => {
    if (!book?.coRead || !book.autoComment || !book.companionId || !page || busyRef.current) return;
    const previous = book.lastAutoOffset < 0 ? -100 : pageAtOffset(pages, book.lastAutoOffset);
    if (page.start <= book.lastAutoOffset || pageIndex - previous < 3) return;
    const timer = window.setTimeout(() => { if (!busyRef.current) void respond('auto'); }, 1300);
    return () => window.clearTimeout(timer);
  }, [activeId, pageIndex, book?.coRead, book?.autoComment, book?.companionId, book?.lastAutoOffset]);

  const summarizeNext = async (force = false) => {
    const current = booksRef.current.find(item => item.id === activeId);
    if (!current || !activeText || summaryRef.current) return;
    const start = pages.findIndex(item => item.end > current.recapOffset);
    if (start < 0) return;
    const furthest = pageAtOffset(pages, Math.max(0, current.maxReadOffset - 1));
    if (start > furthest || (!force && furthest - start + 1 < 8)) return;
    const end = Math.min(furthest, start + 7);
    const newText = activeText.slice(current.recapOffset, pages[end].end);
    if (!newText.trim()) return;
    summaryRef.current = true; setSummarizing(true);
    try {
      const recap = (await onSummarize({ title: current.title, previousRecap: current.recap,
        newText, throughPage: end + 1 })).trim();
      if (!recap) throw new Error('梗概生成失败');
      updateBook(current.id, item => ({ ...item, recap: recap.slice(0, 1200), recapOffset: Math.max(item.recapOffset, pages[end].end) }));
      summaryAttempts.current.delete(current.id);
    } catch {
      summaryAttempts.current.set(current.id, current.maxReadOffset);
      if (force) setError('这次未能生成梗概，阅读记录已保存，可以稍后重试。');
    } finally { summaryRef.current = false; setSummarizing(false); }
  };
  useEffect(() => {
    if (!book || (summaryAttempts.current.has(book.id) &&
      book.maxReadOffset - summaryAttempts.current.get(book.id)! < pageTargets[book.font] * 8)) return;
    void summarizeNext();
  }, [book?.id, book?.maxReadOffset, book?.recapOffset, book?.font]);

  const pause = (complete = false) => {
    if (!book) return;
    const paused = updateBook(book.id, current => ({ ...current, status: complete ? 'finished' : 'paused',
      position: page?.start ?? current.position,
      maxReadOffset: complete ? activeText.length : Math.max(current.maxReadOffset, page?.end ?? 0) }));
    setShareWith(book.companionId ? [book.companionId] : []); setShareNote(''); setShared(false); setShareOpen(true);
    if (paused && paused.maxReadOffset > paused.recapOffset) void summarizeNext(true);
  };
  const share = () => {
    const current = booksRef.current.find(item => item.id === activeId);
    if (!current || !shareWith.length) return;
    const detail = readingShareText(current, activeText, pageAtOffset(pages, current.position), pages.length,
      contacts.find(item => item.id === current.companionId)?.name ?? '角色');
    onShare(`${current.id}-${current.position}-${current.status}`, `微信读书 · ${current.title}`, `${detail}${shareNote.trim() ? `\n附言：${shareNote.trim()}` : ''}`, shareWith);
    setShared(true);
  };

  if (!book) return <section className="min-h-full bg-[#f0eee8] pb-10 text-[#263d38]">
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_80%_0%,#496d5f_0%,#233e37_50%,#162b28_100%)] px-5 pb-8 pt-7 text-[#f4ecdb]">
      <div className="pointer-events-none absolute -right-10 top-3 h-48 w-48 rounded-full border border-[#e6d9b4]/15"/><div className="pointer-events-none absolute right-1 top-8 h-36 w-36 rounded-full border border-[#e6d9b4]/15"/>
      <p className="text-[10px] font-bold tracking-[.3em] text-[#d7c49b]">WECHAT READING</p><h2 className="mt-3 font-serif text-[31px] font-bold tracking-[.08em]">书页之间</h2>
      <p className="mt-2 max-w-[260px] text-xs leading-6 text-[#e2e5d6]/75">把故事留在书里，也把一起读过的时刻留下。</p>
      <div className="mt-6 flex gap-3"><button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-full bg-[#ead9ad] px-4 py-2.5 text-xs font-bold text-[#2d443b]"><Plus size={15}/>导入 TXT</button><span className="self-center text-[11px] text-[#d7ddcc]/65">{books.length} 本书 · 本地书架</span></div>
    </div>
    <div className="mx-auto max-w-[460px] px-4 pt-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.2em] text-[#82938c]">YOUR LIBRARY</p><h3 className="mt-1 text-[17px] font-black">我的书架</h3></div><BookMarked size={20} className="text-[#7b9989]"/></div>
      {books.length ? <div className="space-y-3">{books.map(item => <div key={item.id} className="flex gap-3 rounded-[22px] border border-white/80 bg-white/80 p-3 shadow-[0_8px_24px_rgba(53,71,60,.07)]"><button type="button" onClick={() => openBook(item)} className={`relative flex h-28 w-20 shrink-0 flex-col justify-between overflow-hidden rounded-r-xl rounded-l-sm bg-gradient-to-br ${bookColor(item.id)} p-2.5 text-left text-white shadow-[4px_7px_12px_rgba(29,54,45,.17)]`}><span className="text-[10px] opacity-80">✦ READ</span><span className="line-clamp-3 font-serif text-sm font-bold leading-5">{item.title}</span><span className="text-[9px] opacity-75">{item.status === 'finished' ? 'FINISHED' : `${Math.round(item.maxReadOffset / item.textLength * 100)}% READ`}</span></button><div className="min-w-0 flex flex-1 flex-col"><button type="button" onClick={() => openBook(item)} className="truncate text-left text-sm font-bold">{item.title}</button><p className="mt-1 text-[10px] text-slate-500">{item.status === 'finished' ? '已读完' : item.status === 'paused' ? '暂时合上' : '阅读中'} · {timeLabel(item.updatedAt)}</p><p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-4 text-[#6e8078]">{item.recap || (item.dialogue.length ? `${item.dialogue.at(-1)?.name}：${item.dialogue.at(-1)?.text}` : '翻开书页，故事从这里开始。')}</p><div className="mt-auto flex items-center justify-between"><button type="button" onClick={() => openBook(item)} className="flex items-center gap-1 text-[11px] font-bold text-[#49715f]">继续阅读 <ChevronRight size={13}/></button><div className="flex gap-1"><button type="button" aria-label={`导出${item.title}`} title="导出 TXT" onClick={() => exportBook(item)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><Download size={15}/></button><button type="button" aria-label={`删除${item.title}`} title="删除" onClick={() => deleteBook(item)} className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15}/></button></div></div></div></div>)}</div> : <div className="relative overflow-hidden rounded-[26px] border border-dashed border-[#b7c4b8] bg-white/70 p-7 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e9f0e9] text-[#62816d]"><BookOpen size={29}/></div><h4 className="mt-4 font-serif text-lg font-bold">还没有一本书</h4><p className="mx-auto mt-2 max-w-[240px] text-xs leading-6 text-slate-500">导入自己的 TXT，安静地读，或邀请角色一起翻页。</p><button type="button" onClick={() => fileRef.current?.click()} className="mt-4 rounded-full bg-[#315e4e] px-5 py-2.5 text-xs font-bold text-white"><Upload size={14} className="mr-1 inline"/>挑一本书</button></div>}
      <div className="mt-5 rounded-2xl border border-[#d9e1d6] bg-[#e8eee7] p-3"><p className="text-xs font-bold text-[#416554]">导入设置</p><div className="mt-2 flex items-center gap-2 text-[11px] text-[#718479]"><span>TXT 编码</span><select aria-label="TXT 编码" value={encoding} onChange={event => setEncoding(event.target.value as typeof encoding)} className="rounded-lg bg-white px-2 py-1.5 text-[#335447]"><option value="auto">自动识别</option><option value="utf-8">UTF-8</option><option value="gb18030">GB18030 / GBK</option></select><span>单本最多 8 MB</span></div></div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
    </div><input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={event => void importBook(event.target.files?.[0])}/>
  </section>;

  return <section className={`min-h-full pb-10 ${book.theme === 'night' ? 'bg-[#162522] text-[#ebeadc]' : 'bg-[#e9e7dd] text-[#2f4039]'}`}><div className="mx-auto max-w-[460px] px-3 pt-3">
    <div className="mb-3 flex items-center justify-between gap-2"><button type="button" onClick={() => { setActiveId(''); setActiveText(''); setShareOpen(false); }} className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs ${book.theme === 'night' ? 'bg-white/10' : 'bg-white/75'}`}><ChevronLeft size={15}/>书架</button><div className="min-w-0 text-center"><p className="truncate font-serif text-sm font-bold">{book.title}</p><p className="text-[10px] opacity-60">{readingChapter(activeText, page?.start ?? 0)}</p></div><button type="button" aria-label="切换阅读主题" title="切换阅读主题" onClick={() => updateBook(book.id, current => ({ ...current, theme: current.theme === 'paper' ? 'night' : 'paper' }))} className={`rounded-full p-2 ${book.theme === 'night' ? 'bg-white/10' : 'bg-white/75'}`}>{book.theme === 'night' ? <Sun size={16}/> : <Moon size={16}/>}</button></div>
    <div className={`relative overflow-hidden rounded-[26px] border px-5 pb-5 pt-5 shadow-[0_15px_35px_rgba(35,49,37,.13)] ${book.theme === 'night' ? 'border-[#4d6558]/50 bg-[#22372f]' : 'border-[#f7f4e8] bg-[#fbf8ee]'}`}>
      <div className="pointer-events-none absolute inset-0 opacity-[.08]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent 0px,transparent 22px,#876f43 23px)' }}/>
      <div className="relative flex items-center justify-between border-b border-current/10 pb-2 text-[10px] tracking-[.15em] opacity-55"><span>WECHAT READING</span><span>{String(pageIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span></div>
      <article key={`${book.id}-${pageIndex}-${book.font}`} className={`relative min-h-[370px] whitespace-pre-wrap break-words py-6 font-serif tracking-[.035em] ${pageFonts[book.font]}`} aria-label="当前阅读页">{page?.text || '这一页暂时没有文字。'}</article>
      <div className="relative flex items-center justify-between border-t border-current/10 pt-2 text-[10px] opacity-55"><span>{readingChapter(activeText, page?.start ?? 0)}</span><span>{progress}% 已读</span></div>
    </div>
    <div className="mt-3 flex items-center gap-2"><button type="button" disabled={pageIndex === 0} onClick={() => goPage(pageIndex - 1)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold disabled:opacity-35 ${book.theme === 'night' ? 'bg-white/10' : 'bg-white/80'}`}><ChevronLeft size={15}/>上一页</button><button type="button" onClick={() => pause(pageIndex === pages.length - 1)} className={`rounded-xl px-3 py-2.5 text-xs font-bold ${book.theme === 'night' ? 'bg-[#d5c397] text-[#21392f]' : 'bg-[#315f4c] text-white'}`}>{pageIndex === pages.length - 1 ? '读完了' : '暂时结束'}</button><button type="button" disabled={pageIndex >= pages.length - 1} onClick={() => goPage(pageIndex + 1)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold disabled:opacity-35 ${book.theme === 'night' ? 'bg-white/10' : 'bg-white/80'}`}>下一页<ChevronRight size={15}/></button></div>
    <div className="mt-2 flex items-center justify-between px-1 text-[11px] opacity-70"><span>字号</span><div className="flex gap-1">{(['small', 'normal', 'large'] as const).map((font, index) => <button key={font} type="button" onClick={() => updateBook(book.id, current => ({ ...current, font }))} aria-label={`${['小', '中', '大'][index]}字号`} className={`rounded-lg px-2 py-1 ${book.font === font ? book.theme === 'night' ? 'bg-white/20' : 'bg-white' : ''}`}>A<span className="text-[8px]">{index + 1}</span></button>)}</div></div>
    <div className={`mt-4 rounded-[23px] border p-4 ${book.theme === 'night' ? 'border-white/10 bg-[#263c34]' : 'border-white/80 bg-white/75'}`}><div className="flex items-center gap-2"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${book.theme === 'night' ? 'bg-white/10' : 'bg-[#e6eee4]'}`}><Feather size={18}/></div><div className="flex-1"><p className="text-sm font-bold">一起读这本书</p><p className="text-[10px] opacity-55">TA 读眼前这页，也记得你们之前聊过的内容</p></div><label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={book.coRead} onChange={event => updateBook(book.id, current => ({ ...current, coRead: event.target.checked }))} className="accent-[#497961]"/>共读</label></div>
      {book.coRead && <><div className="mt-3 flex items-center gap-2"><select aria-label="共读角色" value={book.companionId} onChange={event => updateBook(book.id, current => ({ ...current, companionId: event.target.value, lastAutoOffset: -1 }))} className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-xs ${book.theme === 'night' ? 'bg-white/10 text-white' : 'bg-[#f2f5ee]'}`}><option value="">选择角色</option>{contacts.map(item => <option key={item.id} value={item.id} className="text-slate-800">{item.name}</option>)}</select><label className="flex items-center gap-1 whitespace-nowrap text-[10px] opacity-75"><input type="checkbox" checked={book.autoComment} onChange={event => updateBook(book.id, current => ({ ...current, autoComment: event.target.checked }))} className="accent-[#497961]"/>主动评论</label></div>
        <div className="mt-3 flex items-center justify-between"><span className="text-[11px] opacity-60">{companion ? `与 ${companion.name} · 第 ${pageIndex + 1} 页` : '先选一位角色'}</span><button type="button" disabled={!companion || busy} onClick={() => void respond('nudge')} className="flex items-center gap-1 rounded-full border border-[#9ab5a3]/40 px-2.5 py-1 text-[10px] text-[#749c80] disabled:opacity-40"><Sparkles size={12}/>听听 TA 怎么说</button></div>
        <div className={`mt-3 max-h-56 min-h-24 space-y-2 overflow-y-auto rounded-2xl p-2.5 ${book.theme === 'night' ? 'bg-black/15' : 'bg-[#f1f3eb]'}`} aria-label="共读对话" aria-live="polite">{book.dialogue.length ? book.dialogue.map(line => <div key={line.id} className={`flex ${line.senderId === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 ${line.senderId === 'user' ? 'bg-[#47705b] text-white' : book.theme === 'night' ? 'bg-white/10' : 'bg-white'}`}><p className="text-[10px] font-bold opacity-65">{line.name} · {pageAtOffset(pages, line.pageStart) + 1} 页</p><p className="mt-0.5 whitespace-pre-wrap break-words">{line.text}</p></div></div>) : <div className="py-7 text-center text-xs opacity-55">翻开一页，等一句意外的感想。</div>}{busy && <p className="text-[11px] opacity-55">{companion?.name}正在读这一页…</p>}</div>
        <div className="mt-2 flex gap-2"><textarea aria-label="共读聊天" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void respond('chat', draft); } }} maxLength={500} rows={2} placeholder="读到这里，想对 TA 说…" className={`min-w-0 flex-1 resize-none rounded-xl px-3 py-2 text-xs outline-none ${book.theme === 'night' ? 'bg-white/10 text-white placeholder:text-[#aebcaf]' : 'bg-[#f2f5ee]'}`}/><button type="button" aria-label="发送共读消息" disabled={!companion || busy || !draft.trim()} onClick={() => void respond('chat', draft)} className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl bg-[#47705b] text-white disabled:opacity-40"><Send size={16}/></button></div>
      </>}
    </div>
    <div className={`mt-3 rounded-[23px] border p-4 ${book.theme === 'night' ? 'border-white/10 bg-[#263c34]' : 'border-white/80 bg-white/75'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><BookMarked size={16} className="text-[#7fa18a]"/><h3 className="text-xs font-bold">已读梗概</h3></div><button type="button" disabled={summarizing || book.maxReadOffset <= book.recapOffset} onClick={() => { summaryAttempts.current.delete(book.id); void summarizeNext(true); }} className="text-[10px] text-[#7fa18a] disabled:opacity-40">{summarizing ? '整理中…' : '更新梗概'}</button></div><p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 opacity-70">{book.recap || '读过几页后，会把已读内容整理成简短梗概。只记录已读，不剧透后文。'}</p></div>
    <div className="mt-3 flex gap-2"><button type="button" onClick={() => exportBook(book)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-xs ${book.theme === 'night' ? 'bg-white/10' : 'bg-white/80'}`}><Download size={14}/>导出 TXT</button><button type="button" onClick={() => pause(pageIndex === pages.length - 1)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-xs ${book.theme === 'night' ? 'bg-white/10' : 'bg-white/80'}`}><Pause size={14}/>保存共读记录</button></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-600">{error}</p>}
  </div>
    {shareOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3" onClick={event => { if (event.target === event.currentTarget) setShareOpen(false); }}><div role="dialog" aria-modal="true" aria-label="分享共读记录" className="w-full max-w-[460px] rounded-[26px] bg-[#fbf8ee] p-5 text-[#2f4039] shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.2em] text-[#78947e]">READING MEMORY</p><h3 className="mt-1 font-serif text-lg font-bold">这一段，读到这里</h3></div><button type="button" aria-label="关闭分享" onClick={() => setShareOpen(false)} className="rounded-full p-2"><X size={17}/></button></div><div className="mt-3 rounded-2xl bg-[#e9efe7] p-3 text-xs leading-5"><p className="font-bold">《{book.title}》</p><p className="mt-1 text-[#718074]">{book.status === 'finished' ? '已读完' : '暂时合上'} · 第 {pageIndex + 1}/{pages.length} 页 · {progress}% 已读</p><p className="mt-2 line-clamp-3 text-[#536b5a]">{summarizing ? '正在整理已读梗概…' : book.recap || '这段路上的文字与对话，已留在本地书架。'}</p></div><p className="mt-3 text-[11px] font-bold">分享给角色</p><div className="mt-2 max-h-28 overflow-y-auto">{contacts.map(item => <label key={item.id} className="mr-2 inline-flex items-center gap-1 rounded-full border border-[#c8d6c7] px-2.5 py-1.5 text-[11px]"><input type="checkbox" checked={shareWith.includes(item.id)} onChange={() => setShareWith(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}/>{item.name}</label>)}</div><textarea aria-label="分享附言" value={shareNote} onChange={event => setShareNote(event.target.value.slice(0, 300))} rows={2} placeholder="想附上一句话吗？（选填）" className="mt-3 w-full resize-none rounded-xl bg-white px-3 py-2 text-xs outline-none"/><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setShareOpen(false); setActiveId(''); setActiveText(''); }} className="flex-1 rounded-xl bg-[#e7e6dc] py-2.5 text-xs font-bold">返回书架</button><button type="button" disabled={!shareWith.length || summarizing} onClick={share} className="flex-1 rounded-xl bg-[#35634e] py-2.5 text-xs font-bold text-white disabled:opacity-40">{summarizing ? '整理梗概中…' : shared ? <><Check size={13} className="mr-1 inline"/>更新卡片</> : <><MessageCircle size={13} className="mr-1 inline"/>分享记录</>}</button></div></div></div>}
  </section>;
}
