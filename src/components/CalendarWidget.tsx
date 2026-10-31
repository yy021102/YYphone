import React, { lazy, Suspense, useEffect, useState } from 'react';
import { CALENDAR_APPEARANCE_KEY } from '../utils/homeAppearance';
import { entriesOnDate, parseDateKey, readCalendarData, toDateKey, weekdayLabel } from '../utils/calendarData';
import { useWidgetAppearance } from '../utils/widgetAppearance';
import { AppLoading } from './EveryAppLoading';

const CalendarPanel = lazy(() => import('./CalendarPanel').then(module => ({ default: module.CalendarPanel })));

/** The desktop tile stays small; the full calendar loads only when it is opened. */
export const CalendarWidget: React.FC<{ fullScreen?: boolean; onOpen?: () => void; onClose?: () => void }> = ({ fullScreen = false, onOpen, onClose }) => {
  const { appearance } = useWidgetAppearance(CALENDAR_APPEARANCE_KEY);
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  const [panelOpen, setPanelOpen] = useState(fullScreen);
  const [data, setData] = useState(readCalendarData);
  useEffect(() => { if (!panelOpen) setData(readCalendarData()); }, [panelOpen]);
  useEffect(() => {
    const timer = window.setInterval(() => setTodayKey(toDateKey(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = parseDateKey(todayKey);
  const pendingCount = entriesOnDate(data.entries, todayKey).filter(entry => (entry.kind === 'todo' || entry.kind === 'schedule') && !entry.done).length;
  const open = () => { if (onOpen) onOpen(); else setPanelOpen(true); };
  const close = () => { if (onClose) onClose(); else setPanelOpen(false); };
  return <>
    {!fullScreen && <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}
      aria-label="打开日历"
      style={appearance.background
        ? { backgroundImage: `url("${appearance.background}")` }
        : { backgroundImage: 'linear-gradient(135deg, rgba(186,230,253,0.75), rgba(255,255,255,0.55) 50%, rgba(251,207,232,0.75))' }}
      className={`rounded-[clamp(20px,4.8vw,28px)] aspect-square p-3 overflow-hidden relative shadow-sm cursor-pointer active:scale-[0.98] transition-all bg-cover bg-center ${appearance.background ? 'border border-white/70' : 'glass-card'}`}
    >
      <div className="absolute inset-x-[9%] top-[10%] text-[#587589]/60">
        <p className="whitespace-nowrap text-[clamp(15px,4.2vw,18px)] font-light italic leading-none tracking-tight tabular-nums">{today.getFullYear()}/{String(today.getMonth() + 1).padStart(2, '0')}/{String(today.getDate()).padStart(2, '0')}</p>
        <p className="mt-2 whitespace-nowrap text-[clamp(11px,3vw,13px)] font-normal italic leading-none text-[#587589]/60">{weekdayLabel(todayKey)}·{pendingCount > 0 ? `待办${pendingCount}项` : '今日无事'}</p>
      </div>
      {appearance.note.trim() && <p className="absolute inset-x-[11%] bottom-[8%] line-clamp-2 break-words text-left text-[clamp(12px,3.2vw,14px)] font-normal italic leading-snug text-[#587589]/60 [text-shadow:0_1px_6px_rgba(255,255,255,0.8)]">{appearance.note}</p>}
    </div>}
    {panelOpen && <Suspense fallback={<div className="absolute inset-0 z-50 flex flex-col"><AppLoading app="calendar" onBack={close}/></div>}><CalendarPanel onClose={close}/></Suspense>}
  </>;
};
