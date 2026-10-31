import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { requestConfiguredAiText } from '../utils/aiApi';
import {
  addDays,
  CALENDAR_EXPORT_FORMAT,
  CalendarData,
  CalendarEntry,
  CalendarEntryKind,
  entriesOnDate,
  isCalendarData,
  KIND_LABELS,
  parseDateKey,
  readCalendarData,
  sortEntries,
  toDateKey,
  weekdayLabel,
  writeCalendarData,
} from '../utils/calendarData';
import { readStoredValue } from '../utils/localStorage';
import { useWidgetAppearance } from '../utils/widgetAppearance';
import { CALENDAR_APPEARANCE_KEY } from '../utils/homeAppearance';
import { WidgetImagePicker } from './WidgetImagePicker';
import { CalendarWeather } from './CalendarWeather';
import { PeriodTracker } from './PeriodTracker';
import { periodLogs, savePeriodLogs } from '../utils/periodTracking';

interface CalendarContact {
  id: string;
  name: string;
  persona: string;
}

interface EntryForm {
  id: string;
  kind: CalendarEntryKind;
  title: string;
  date: string;
  endDate: string;
  time: string;
}

type PanelTab = 'calendar' | 'period' | 'characters' | 'appearance' | 'data';

const CONTACTS_STORAGE_KEY = 'pocketos:wechat-contacts';
const WEEKDAY_INITIALS = ['日', '一', '二', '三', '四', '五', '六'];
const KINDS: CalendarEntryKind[] = ['schedule', 'todo', 'birthday', 'period'];
const KIND_DOT_COLORS: Record<CalendarEntryKind, string> = {
  schedule: 'bg-sky-300',
  todo: 'bg-emerald-300',
  birthday: 'bg-amber-300',
  period: 'bg-pink-300',
};
const KIND_BADGE_COLORS: Record<CalendarEntryKind, string> = {
  schedule: 'bg-sky-50 text-sky-500 border-sky-100',
  todo: 'bg-emerald-50 text-emerald-500 border-emerald-100',
  birthday: 'bg-amber-50 text-amber-500 border-amber-100',
  period: 'bg-pink-50 text-pink-500 border-pink-100',
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const readContacts = (): CalendarContact[] =>
  readStoredValue(CONTACTS_STORAGE_KEY, [] as CalendarContact[], (value): value is CalendarContact[] =>
    Array.isArray(value)
  ).flatMap((contact) =>
    contact && typeof contact.id === 'string' && typeof contact.name === 'string'
      ? [{
          id: contact.id,
          name: contact.name,
          persona: typeof contact.persona === 'string' ? contact.persona : '',
        }]
      : []
  );

const buildMonthCells = (year: number, month: number) => {
  const offset = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const dateKeyOf = (year: number, month: number, day: number) =>
  toDateKey(new Date(year, month, day));

const emptyForm = (date: string): EntryForm => ({
  id: '',
  kind: 'schedule',
  title: '',
  date,
  endDate: '',
  time: '',
});

export const CalendarWidget: React.FC<{ fullScreen?: boolean; onOpen?: () => void; onClose?: () => void }> = ({ fullScreen = false, onOpen, onClose }) => {
  const [data, setData] = useState<CalendarData>(readCalendarData);
  const dataRef = useRef(data);
  const { appearance, patch: patchAppearance } = useWidgetAppearance(CALENDAR_APPEARANCE_KEY);
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  const [panelOpen, setPanelOpen] = useState(fullScreen);
  const [tab, setTab] = useState<PanelTab>('calendar');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [viewMonth, setViewMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [form, setForm] = useState<EntryForm | null>(null);
  const [contacts, setContacts] = useState<CalendarContact[]>([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTodayKey(toDateKey(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (panelOpen) setContacts(readContacts());
  }, [panelOpen]);

  const update = (next: CalendarData) => {
    writeCalendarData(next);
    dataRef.current = next;
    setData(next);
  };

  const today = parseDateKey(todayKey);

  const markersByDate = (dateKey: string) => {
    const kinds = new Set(entriesOnDate(data.entries, dateKey).map((entry) => entry.kind));
    return KINDS.filter((kind) => kinds.has(kind));
  };

  const openPanel = () => {
    if (onOpen) { onOpen(); return; }
    setTab('calendar');
    setSelectedDate(todayKey);
    setViewMonth({ year: today.getFullYear(), month: today.getMonth() });
    setForm(null);
    setMessage('');
    setError('');
    setPanelOpen(true);
  };

  const shiftMonth = (delta: number) => {
    setViewMonth(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectDate = (key: string) => {
    setSelectedDate(key);
    setForm(null);
    setError('');
  };

  const handleSaveEntry = () => {
    if (!form) return;
    const title = form.title.trim() || (form.kind === 'birthday' || form.kind === 'period' ? KIND_LABELS[form.kind] : '');
    if (!title) {
      setError('请填写内容。');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setError('请选择日期。');
      return;
    }
    if (form.kind === 'period' && form.endDate && form.endDate < form.date) {
      setError('经期结束日不能早于开始日。');
      return;
    }
    const previous = data.entries.find((entry) => entry.id === form.id);
    const entry: CalendarEntry = {
      id: form.id || newId(),
      kind: form.kind,
      date: form.date,
      title,
      ...(form.kind === 'period' && form.endDate ? { endDate: form.endDate } : {}),
      ...((form.kind === 'schedule' || form.kind === 'todo') && form.time ? { time: form.time } : {}),
      ...(form.kind === 'todo' ? { done: previous?.done ?? false } : {}),
    };
    update({
      ...data,
      entries: previous
        ? data.entries.map((item) => (item.id === entry.id ? entry : item))
        : [...data.entries, entry],
    });
    setSelectedDate(entry.date);
    const saved = parseDateKey(entry.date);
    setViewMonth({ year: saved.getFullYear(), month: saved.getMonth() });
    setForm(null);
    setError('');
    setMessage(previous ? '已更新。' : '已添加。');
  };

  const handleDeleteEntry = (entry: CalendarEntry) => {
    if (!window.confirm(`删除「${entry.title}」？`)) return;
    update(entry.kind === 'period' ? savePeriodLogs(data, periodLogs(data).map(log => log.date >= entry.date && log.date <= (entry.endDate ?? entry.date) ? { ...log, flow: undefined } : log)) : { ...data, entries: data.entries.filter((item) => item.id !== entry.id) });
    setMessage('已删除。');
  };

  const handleToggleDone = (entry: CalendarEntry) => {
    update({
      ...data,
      entries: data.entries.map((item) => (item.id === entry.id ? { ...item, done: !item.done } : item)),
    });
  };

  const toggleCharacterList = (key: 'visibleCharacterIds' | 'scheduleCharacterIds', id: string) => {
    const list = data[key];
    update({ ...data, [key]: list.includes(id) ? list.filter((item) => item !== id) : [...list, id] });
  };

  const handleGenerate = async () => {
    const targets = contacts.filter((contact) => data.scheduleCharacterIds.includes(contact.id));
    if (targets.length === 0) {
      setError('请先勾选要生成今日行程的角色。');
      return;
    }
    setGenerating(true);
    setError('');
    setMessage('');
    const failures: string[] = [];
    const generationDate = todayKey;
    for (const target of targets) {
      try {
        const text = await requestConfiguredAiText(
          '你是角色日程生成器。请根据角色设定，为该角色生成今天一天合理的行程安排，共 5 到 8 条，每行一条，格式为“HH:MM 事项”，内容贴合角色的身份与性格。只输出行程列表，不要任何额外说明。',
          `角色：${target.name}\n设定：${target.persona || '暂无设定'}\n日期：${generationDate} ${weekdayLabel(generationDate)}`
        );
        const current = dataRef.current;
        update({
          ...current,
          schedules: [
            ...current.schedules.filter(
              (schedule) => schedule.date >= generationDate && !(schedule.charId === target.id && schedule.date === generationDate)
            ),
            { id: newId(), charId: target.id, date: generationDate, text },
          ],
        });
      } catch (generationError) {
        console.error('Could not generate character schedule.', generationError);
        failures.push(`${target.name}：${generationError instanceof Error ? generationError.message : '生成失败'}`);
      }
    }
    setGenerating(false);
    if (failures.length > 0) setError(failures.join('\n'));
    else setMessage('今日行程已生成，今天的聊天会带上这些行程。');
  };

  const handleExport = () => {
    const content = JSON.stringify(
      { format: CALENDAR_EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), data },
      null,
      2
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'yyphone-calendar.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setError('');
    setMessage('日历数据已导出。');
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const root = parsed as { format?: unknown; version?: unknown; data?: unknown };
      if (!root || root.format !== CALENDAR_EXPORT_FORMAT || root.version !== 1 || !isCalendarData(root.data)) {
        throw new Error('文件格式不正确，请选择从日历导出的 JSON。');
      }
      if (!window.confirm('导入将替换当前全部日历数据（日程、待办、特殊日期与角色设置），确定继续吗？')) return;
      update(root.data);
      setForm(null);
      setError('');
      setMessage('日历数据已导入。');
    } catch (importError) {
      console.error('Could not import calendar data.', importError);
      setMessage('');
      setError(importError instanceof Error ? importError.message : '无法导入该文件。');
    }
  };

  const viewCells = buildMonthCells(viewMonth.year, viewMonth.month);
  const selectedEntries = sortEntries(entriesOnDate(data.entries, selectedDate));
  const upcoming = Array.from({ length: 7 }, (_, index) => {
    const key = toDateKey(addDays(today, index));
    return { key, entries: sortEntries(entriesOnDate(data.entries, key)) };
  }).filter((day) => day.entries.length > 0);
  const todaySchedules = data.schedules.filter((schedule) => schedule.date === todayKey);
  const pendingCount =
    entriesOnDate(data.entries, todayKey).filter((entry) => (entry.kind === 'todo' || entry.kind === 'schedule') && !entry.done).length;

  const inputClass =
    'w-full rounded-xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400';

  return (
    <>
      {!fullScreen && <div
        role="button"
        tabIndex={0}
        onClick={openPanel}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openPanel(); }}
        aria-label="打开日历"
        style={
          appearance.background
            ? { backgroundImage: `url("${appearance.background}")` }
            : { backgroundImage: 'linear-gradient(135deg, rgba(186,230,253,0.75), rgba(255,255,255,0.55) 50%, rgba(251,207,232,0.75))' }
        }
        className={`rounded-[clamp(20px,4.8vw,28px)] aspect-square p-3 overflow-hidden relative shadow-sm cursor-pointer active:scale-[0.98] transition-all bg-cover bg-center ${
          appearance.background ? 'border border-white/70' : 'glass-card'
        }`}
      >
        <div className="absolute inset-x-[9%] top-[10%] text-[#587589]/60">
          <p className="whitespace-nowrap text-[clamp(15px,4.2vw,18px)] font-light italic leading-none tracking-tight tabular-nums">
            {today.getFullYear()}/{String(today.getMonth() + 1).padStart(2, '0')}/{String(today.getDate()).padStart(2, '0')}
          </p>
          <p className="mt-2 whitespace-nowrap text-[clamp(11px,3vw,13px)] font-normal italic leading-none text-[#587589]/60">
            {weekdayLabel(todayKey)}·{pendingCount > 0 ? `待办${pendingCount}项` : '今日无事'}
          </p>
        </div>
        {appearance.note.trim() && (
          <p className="absolute inset-x-[11%] bottom-[8%] line-clamp-2 break-words text-left text-[clamp(12px,3.2vw,14px)] font-normal italic leading-snug text-[#587589]/60 [text-shadow:0_1px_6px_rgba(255,255,255,0.8)]">
            {appearance.note}
          </p>
        )}
      </div>}

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          void handleImport(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {panelOpen && (
        <div
          className="calendar-app absolute inset-0 z-50 flex flex-col"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPanelOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="日历" className="calendar-shell">
            <div className="calendar-app-header">
              <div><p>{today.getFullYear()} · 生活手记</p><h2>日历</h2></div>
              <button
                aria-label="关闭日历"
                onClick={() => { if (onClose) onClose(); else setPanelOpen(false); }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="calendar-app-tabs grid grid-cols-5 gap-1 rounded-2xl bg-slate-100/80 p-1">
              {([['calendar', '日程'], ['period', '经期'], ['characters', '角色'], ['appearance', '编辑'], ['data', '数据']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setTab(id); setError(''); setMessage(''); }}
                  className={`rounded-xl py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                    tab === id ? 'bg-white text-[#2C4A5C] shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="calendar-app-scroll">
            {tab === 'period' && <PeriodTracker data={data} today={todayKey} selected={selectedDate} onSelect={setSelectedDate} onChange={update}/>}
            {tab === 'calendar' && (
              <div className="space-y-3">
                <CalendarWeather />
                <section className="calendar-month-card">
                <div className="calendar-month-heading flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="上个月"
                    onClick={() => shiftMonth(-1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMonth({ year: today.getFullYear(), month: today.getMonth() });
                      selectDate(todayKey);
                    }}
                    className="text-xs font-extrabold text-[#2C4A5C] cursor-pointer"
                  >
                    {viewMonth.year} 年 {viewMonth.month + 1} 月
                  </button>
                  <button
                    type="button"
                    aria-label="下个月"
                    onClick={() => shiftMonth(1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="calendar-month-grid grid grid-cols-7 gap-y-1 text-center">
                  {WEEKDAY_INITIALS.map((label) => (
                    <span key={label} className="text-[10px] font-semibold text-slate-400">{label}</span>
                  ))}
                  {viewCells.map((day, index) => {
                    if (day === null) return <span key={`blank-${index}`} />;
                    const key = dateKeyOf(viewMonth.year, viewMonth.month, day);
                    const markers = markersByDate(key);
                    const isSelected = key === selectedDate;
                    const isToday = key === todayKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectDate(key)}
                        aria-label={`${viewMonth.month + 1}月${day}日`}
                        aria-pressed={isSelected}
                        className="flex flex-col items-center gap-0.5 py-0.5 cursor-pointer"
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                            isSelected
                              ? 'bg-gradient-to-br from-sky-300 to-pink-300 font-bold text-white'
                              : isToday
                                ? 'bg-pink-100 font-bold text-[#587589]'
                                : 'text-[#587589]'
                          }`}
                        >
                          {day}
                        </span>
                        <span className="flex h-1 gap-0.5">
                          {markers.map((kind) => (
                            <span key={kind} className={`h-1 w-1 rounded-full ${KIND_DOT_COLORS[kind]}`} />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
                </section>
                <div className="calendar-agenda-heading flex items-center justify-between">
                  <p className="text-xs font-extrabold text-[#2C4A5C]">
                    {selectedDate.slice(5).replace('-', '月')}日 {weekdayLabel(selectedDate)}
                    {selectedDate === todayKey && <span className="ml-1.5 text-[10px] text-pink-400">今天</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setForm(emptyForm(selectedDate)); setError(''); setMessage(''); }}
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-300 to-pink-300 px-3 py-1 text-[11px] font-bold text-white cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />添加
                  </button>
                </div>

                {form && (
                  <div className="space-y-2 rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
                    <div className="grid grid-cols-4 gap-1">
                      {KINDS.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => { if (kind === 'period') { setSelectedDate(form.date); setForm(null); setTab('period'); } else setForm({ ...form, kind }); }}
                          className={`rounded-lg border py-1 text-[11px] font-bold cursor-pointer ${
                            form.kind === kind ? KIND_BADGE_COLORS[kind] : 'border-slate-200 bg-white text-slate-400'
                          }`}
                        >
                          {KIND_LABELS[kind]}
                        </button>
                      ))}
                    </div>
                    <input
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                      maxLength={80}
                      placeholder={
                        form.kind === 'birthday' ? '谁的生日（如：我的生日）' : form.kind === 'period' ? '备注（可留空）' : '内容'
                      }
                      aria-label="内容"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-semibold text-slate-500">
                        {form.kind === 'period' ? '开始日' : '日期'}
                        <input
                          type="date"
                          value={form.date}
                          onChange={(event) => setForm({ ...form, date: event.target.value })}
                          className={`${inputClass} mt-0.5`}
                        />
                      </label>
                      {form.kind === 'period' && (
                        <label className="text-[10px] font-semibold text-slate-500">
                          结束日（可选）
                          <input
                            type="date"
                            value={form.endDate}
                            min={form.date}
                            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                            className={`${inputClass} mt-0.5`}
                          />
                        </label>
                      )}
                      {(form.kind === 'schedule' || form.kind === 'todo') && (
                        <label className="text-[10px] font-semibold text-slate-500">
                          时间（可选）
                          <input
                            type="time"
                            value={form.time}
                            onChange={(event) => setForm({ ...form, time: event.target.value })}
                            className={`${inputClass} mt-0.5`}
                          />
                        </label>
                      )}
                    </div>
                    {form.kind === 'birthday' && (
                      <p className="text-[10px] text-slate-400">生日会在每年的这一天自动出现。</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setForm(null); setError(''); }}
                        className="flex-1 rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-500 cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEntry}
                        className="flex-1 rounded-xl bg-gradient-to-r from-sky-300 to-pink-300 py-2 text-xs font-bold text-white cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                )}

                <div className="calendar-agenda space-y-1.5">
                  {selectedEntries.length === 0 && (
                    <p className="rounded-xl bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-400">这一天还没有安排</p>
                  )}
                  {selectedEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white/70 px-3 py-2">
                      {entry.kind === 'todo' ? (
                        <input
                          type="checkbox"
                          checked={!!entry.done}
                          onChange={() => handleToggleDone(entry)}
                          aria-label={`完成 ${entry.title}`}
                        />
                      ) : (
                        <span className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-bold ${KIND_BADGE_COLORS[entry.kind]}`}>
                          {KIND_LABELS[entry.kind]}
                        </span>
                      )}
                      <span className={`min-w-0 flex-1 truncate text-xs font-semibold text-[#2C4A5C] ${entry.done ? 'line-through opacity-50' : ''}`}>
                        {entry.time && <span className="mr-1 font-mono text-slate-400">{entry.time}</span>}
                        {entry.title}
                        {entry.kind === 'period' && entry.endDate && entry.endDate !== entry.date && (
                          <span className="ml-1 text-[10px] text-slate-400">至 {entry.endDate.slice(5)}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={`编辑 ${entry.title}`}
                        onClick={() => {
                          if (entry.kind === 'period') { setTab('period'); setForm(null); return; }
                          setForm({
                            id: entry.id,
                            kind: entry.kind,
                            title: entry.title,
                            date: entry.date,
                            endDate: entry.endDate ?? '',
                            time: entry.time ?? '',
                          });
                          setError('');
                        }}
                        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`删除 ${entry.title}`}
                        onClick={() => handleDeleteEntry(entry)}
                        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-[#2C4A5C]">近 7 天提醒</p>
                  {upcoming.length === 0 ? (
                    <p className="text-[11px] text-slate-400">近 7 天没有安排。</p>
                  ) : (
                    upcoming.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          const target = parseDateKey(day.key);
                          setViewMonth({ year: target.getFullYear(), month: target.getMonth() });
                          selectDate(day.key);
                        }}
                        className="block w-full rounded-xl bg-sky-50/60 px-3 py-1.5 text-left cursor-pointer"
                      >
                        <span className="text-[10px] font-bold text-sky-500">
                          {day.key === todayKey ? '今天' : `${day.key.slice(5)} ${weekdayLabel(day.key)}`}
                        </span>
                        <span className="block truncate text-[11px] text-slate-600">
                          {day.entries.map((entry) => `${KIND_LABELS[entry.kind]}·${entry.title}`).join('；')}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'characters' && (
              <div className="space-y-3">
                <p className="text-[10px] leading-snug text-slate-500">
                  「可见」的角色在聊天时会收到你今天的日程、未来 7 天的待办，以及生日、经期等特殊日期；过去的日期不会再发送。「生成行程」用于让 AI 生成该角色的今日行程，并只在今天的聊天中带上。
                </p>
                {contacts.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">微信中还没有角色</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-end gap-6 pr-1 text-[10px] font-bold text-slate-400">
                      <span>可见</span>
                      <span>生成行程</span>
                    </div>
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#2C4A5C]">{contact.name}</span>
                        <div className="flex items-center gap-9 pr-3">
                          <input
                            type="checkbox"
                            checked={data.visibleCharacterIds.includes(contact.id)}
                            onChange={() => toggleCharacterList('visibleCharacterIds', contact.id)}
                            aria-label={`${contact.name} 可见日程`}
                          />
                          <input
                            type="checkbox"
                            checked={data.scheduleCharacterIds.includes(contact.id)}
                            onChange={() => toggleCharacterList('scheduleCharacterIds', contact.id)}
                            aria-label={`生成 ${contact.name} 的今日行程`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating || data.scheduleCharacterIds.length === 0}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-300 to-pink-300 py-2.5 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />{generating ? '正在生成…' : '生成今日行程'}
                </button>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#2C4A5C]">今日行程（{todayKey}）</p>
                  {todaySchedules.length === 0 && (
                    <p className="text-[11px] text-slate-400">还没有生成今日行程。</p>
                  )}
                  {todaySchedules.map((schedule) => {
                    const owner = contacts.find((contact) => contact.id === schedule.charId);
                    return (
                      <div key={schedule.id} className="space-y-1 rounded-2xl border border-slate-100 bg-white/70 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#2C4A5C]">{owner?.name ?? '未知角色'}</span>
                          <button
                            type="button"
                            aria-label={`删除 ${owner?.name ?? ''} 的今日行程`}
                            onClick={() =>
                              update({ ...data, schedules: data.schedules.filter((item) => item.id !== schedule.id) })
                            }
                            className="w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <textarea
                          value={schedule.text}
                          onChange={(event) =>
                            update({
                              ...data,
                              schedules: data.schedules.map((item) =>
                                item.id === schedule.id ? { ...item, text: event.target.value } : item
                              ),
                            })
                          }
                          rows={5}
                          aria-label={`${owner?.name ?? ''} 的今日行程`}
                          className={`${inputClass} resize-y leading-relaxed`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="space-y-3">
                <section className="space-y-2 rounded-2xl bg-sky-50/60 border border-white/80 p-3">
                  <span className="text-xs font-bold text-[#2C4A5C]">日历下方文字</span>
                  <textarea
                    value={appearance.note}
                    onChange={(event) => patchAppearance({ note: event.target.value })}
                    maxLength={60}
                    rows={2}
                    placeholder="写点什么吧…"
                    aria-label="日历下方文字"
                    className={`${inputClass} resize-none`}
                  />
                </section>
                <WidgetImagePicker
                  label="日历背景"
                  value={appearance.background}
                  maxSize={900}
                  onChange={(value) => patchAppearance({ background: value })}
                />
              </div>
            )}

            {tab === 'data' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-sky-200 py-2.5 text-xs font-bold text-sky-600 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />导出日历数据
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-pink-200 py-2.5 text-xs font-bold text-pink-500 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />导入日历数据
                </button>
                <p className="text-[10px] leading-snug text-slate-400">
                  导出内容包含全部日程、待办、生日、经期，以及角色可见与行程设置；导入会替换当前数据。
                </p>
              </div>
            )}

            {message && <p className="text-center text-[11px] font-bold text-emerald-600">{message}</p>}
            {error && <p role="alert" className="whitespace-pre-line text-[11px] font-bold text-rose-500">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
