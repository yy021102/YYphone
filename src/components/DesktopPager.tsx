import { useRef, type ReactNode } from 'react';
import { desktopPageAfterSwipe, type DesktopPage } from '../utils/desktopNavigation';

export function DesktopPageNavigation({ page, onChange }: { page: DesktopPage; onChange: (page: DesktopPage) => void }) {
  return <nav className="desktop-page-navigation" aria-label="桌面分页">
    {([0, 1] as const).map(index => <button key={index} type="button"
      aria-label={`第${index + 1}页`} aria-current={page === index ? 'page' : undefined}
      onClick={() => onChange(index)}><i /></button>)}
  </nav>;
}

export function DesktopPager({ page, onChange, children }: { page: DesktopPage; onChange: (page: DesktopPage) => void; children: ReactNode }) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  return <div className="desktop-pager" onPointerDown={event => {
    if (!event.isPrimary || event.button !== 0 || event.target instanceof Element &&
      event.target.closest('input,textarea,select,summary,[role="dialog"],[data-no-desktop-swipe]')) return;
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }} onPointerCancel={() => { start.current = null; }} onPointerUp={event => {
    const origin = start.current;
    start.current = null;
    if (!origin || origin.id !== event.pointerId) return;
    const next = desktopPageAfterSwipe(page, event.clientX - origin.x, event.clientY - origin.y);
    if (next !== page) {
      suppressClickUntil.current = Date.now() + 400;
      onChange(next);
    }
  }} onClickCapture={event => {
    if (event.detail !== 0 && Date.now() < suppressClickUntil.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }}>{children}</div>;
}
