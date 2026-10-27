import { useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowUpRight, Sparkles, Trash2 } from 'lucide-react';
import type { PhoneIcityDiary } from '../apps/PhoneExplorerApp';

export function PastDiaryHall({ name, diaries, onDelete }: { name: string; diaries: PhoneIcityDiary[]; onDelete: (id: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const drag = useRef<{ y: number; top: number } | null>(null);
  const [openedId, setOpenedId] = useState('');
  const [scroll, setScroll] = useState({ ratio: 1, progress: 0 });
  const opened = diaries.find(diary => diary.id === openedId);
  const measure = () => {
    const element = scrollRef.current;
    if (element) setScroll({ ratio: Math.min(1, element.clientHeight / (element.scrollHeight || 1)), progress: element.scrollTop / (element.scrollHeight - element.clientHeight || 1) });
  };
  const close = () => { setOpenedId(''); openerRef.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (scrollRef.current) observer.observe(scrollRef.current);
    const books = scrollRef.current?.querySelector('.past-hall-books');
    if (books) observer.observe(books);
    measure();
    return () => observer.disconnect();
  }, [diaries.length]);
  useEffect(() => { if (openedId) readerRef.current?.focus(); }, [openedId]);

  return <section className="past-diary-hall">
    <div ref={scrollRef} id="past-diary-list" className="past-hall-scroll" onScroll={measure}>
      <div className="past-hall-architecture" aria-hidden="true"><span /><span /><span /></div>
      <header className="past-hall-heading"><Sparkles size={18} strokeWidth={1} /><small>THE ARCHIVE OF TIME</small><h2>过往</h2><p>{name}的心事，珍藏于此</p><div /></header>
      <div className="past-hall-books">
        {!diaries.length && <div className="past-hall-empty"><Archive size={31} strokeWidth={1} /><p>尚无落下的篇章</p></div>}
        {diaries.map((diary, index) => <article key={diary.id} className="past-hall-book">
          <div className="past-book-spine" aria-hidden="true" />
          <header><span className="past-book-number">{String(index + 1).padStart(2, '0')}</span><div><time>{diary.dateStr} · {diary.timeStr}</time><small>{diary.weather} · {diary.mood}</small></div><button type="button" aria-label={`删除${diary.dateStr}的日记`} onClick={() => onDelete(diary.id)}><Trash2 size={14} strokeWidth={1.5} /></button></header>
          <button type="button" className="past-book-preview" aria-label={`阅读${diary.dateStr}的日记`} onClick={event => { openerRef.current = event.currentTarget; setOpenedId(diary.id); }}>
            <div className="past-book-rule" aria-hidden="true"><span>✧</span></div><p>{diary.content.slice(0, 200)}</p><footer>翻阅这一页 <ArrowUpRight size={13} /></footer>
          </button>
        </article>)}
      </div>
    </div>
    {scroll.ratio < 1 && !opened && <div ref={trackRef} className="past-scroll-track" onPointerDown={event => {
      const element = scrollRef.current, track = trackRef.current;
      if (!element || !track) return;
      const height = track.clientHeight, thumb = Math.max(36, scroll.ratio * height);
      const clickedThumb = (event.target as HTMLElement).closest('.past-scroll-thumb');
      if (!clickedThumb) element.scrollTop = Math.max(0, Math.min(1, (event.clientY - track.getBoundingClientRect().top - thumb / 2) / Math.max(1, height - thumb))) * (element.scrollHeight - element.clientHeight);
      drag.current = { y: event.clientY, top: element.scrollTop };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }} onPointerMove={event => {
      const element = scrollRef.current, track = trackRef.current;
      if (!drag.current || !element || !track) return;
      const travel = track.clientHeight - Math.max(36, scroll.ratio * track.clientHeight);
      element.scrollTop = drag.current.top + (event.clientY - drag.current.y) / Math.max(1, travel) * (element.scrollHeight - element.clientHeight);
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="past-scroll-thumb" role="scrollbar" tabIndex={0} aria-label="滚动过往日记" aria-controls="past-diary-list" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(scroll.progress * 100)} style={{ height: `max(36px, ${scroll.ratio * 100}%)`, top: `${scroll.progress * 100}%`, transform: `translateY(-${scroll.progress * 100}%)` }} onKeyDown={event => {
        const element = scrollRef.current;
        if (!element) return;
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          element.scrollTop = event.key === 'Home' ? 0 : event.key === 'End' ? element.scrollHeight : element.scrollTop + (event.key.endsWith('Down') ? 1 : -1) * (event.key.startsWith('Page') ? element.clientHeight : 60);
        }
      }} />
    </div>}
    {opened && <div className="past-reader-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div ref={readerRef} role="dialog" aria-modal="true" aria-label={`${opened.dateStr}的日记`} tabIndex={-1} className="past-reader">
        <header><button type="button" onClick={close} aria-label="返回日记列表"><ArrowLeft size={18} /></button><div><time>{opened.dateStr} · {opened.timeStr}</time><small>{opened.weather} · {opened.mood}</small></div><Sparkles size={16} strokeWidth={1} /></header>
        <div className="past-reader-content"><div className="past-book-rule" aria-hidden="true">✧</div><p>{opened.content}</p><footer>✦</footer></div>
      </div>
    </div>}
  </section>;
}
