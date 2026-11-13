import { useEffect, useRef, useState, type ReactNode } from 'react';
import { desktopPageAfterSwipe, type DesktopPage } from '../utils/desktopNavigation';

export function DesktopPageNavigation({ page, onChange }: { page: DesktopPage; onChange: (page: DesktopPage) => void }) {
  return <nav className="desktop-page-navigation" aria-label="桌面分页">
    {([0, 1] as const).map(index => <button key={index} type="button"
      aria-label={`第${index + 1}页`} aria-current={page === index ? 'page' : undefined}
      onClick={() => onChange(index)}><i /></button>)}
  </nav>;
}

export function DesktopPager({ page, onChange, pages, disabled = false }: {
  page: DesktopPage; onChange: (page: DesktopPage) => void; pages: [ReactNode, ReactNode]; disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number; y: number; time: number; locked: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState(false);
  useEffect(() => { setPrepared(true); }, []);
  const suppressClickUntil = useRef(0);
  const reset = () => {
    const origin = start.current;
    start.current = null;
    if (origin?.locked) suppressClickUntil.current = Date.now() + 400;
    if (origin && root.current?.hasPointerCapture(origin.id)) root.current.releasePointerCapture(origin.id);
    root.current?.style.setProperty('--desktop-drag', '0px');
    setDragging(false);
  };
  useEffect(() => {
    reset();
    window.addEventListener('resize', reset);
    window.addEventListener('blur', reset);
    return () => { window.removeEventListener('resize', reset); window.removeEventListener('blur', reset); };
  }, [page, disabled]);
  return <div ref={root} className={`desktop-pager${dragging ? ' is-dragging' : ''}`} onDragStart={event => event.preventDefault()} onPointerDown={event => {
    if (disabled || !event.isPrimary || event.button !== 0 || event.target instanceof Element &&
      event.target.closest('input,textarea,select,summary,[contenteditable="true"],[role="dialog"],[data-no-desktop-swipe],.desktop-page-navigation,[data-desktop-action]')) return;
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, locked: false };
  }} onPointerMove={event => {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
    if (!origin.locked) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { start.current = null; return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      origin.locked = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    const width = event.currentTarget.clientWidth;
    const offset = page === 0 && dx > 0 || page === 1 && dx < 0 ? dx * .18 : dx;
    event.currentTarget.style.setProperty('--desktop-drag', `${Math.max(-width, Math.min(width, offset))}px`);
  }} onPointerCancel={reset} onLostPointerCapture={event => { if (event.target === event.currentTarget && start.current) reset(); }} onPointerUp={event => {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
    const next = origin.locked ? desktopPageAfterSwipe(page, dx, dy,
      event.currentTarget.clientWidth, event.timeStamp - origin.time) : page;
    reset();
    if (next !== page) onChange(next);
  }} onClickCapture={event => {
    if (event.detail !== 0 && Date.now() < suppressClickUntil.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }}><div className="desktop-page-track" style={{ transform: `translate3d(calc(${-page * 100}% + var(--desktop-drag, 0px)),0,0)` }}>
    {pages.map((content, index) => <div key={index} className="desktop-page-pane" inert={page !== index} aria-hidden={page !== index}>{prepared || page === index ? content : null}</div>)}
  </div></div>;
}
