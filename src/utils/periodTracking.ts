import type { CalendarData, CalendarEntry } from './calendarData';

export const PERIOD_FLOWS = { unspecified: '已来经', light: '少', medium: '中', heavy: '多' } as const;
export const PERIOD_SYMPTOMS = ['腹痛', '腰酸', '头痛', '乳房胀痛', '疲倦', '腹胀', '情绪波动', '痘痘'] as const;
export type PeriodFlow = keyof typeof PERIOD_FLOWS;
export interface PeriodLog { date: string; flow?: PeriodFlow; spotting: boolean; symptoms: string[]; note: string }
export interface PeriodTracking { logs: PeriodLog[]; cycleLength: number; periodLength: number; predictions: boolean; useHistory: boolean }
export const defaultPeriodTracking = (): PeriodTracking => ({ logs: [], cycleLength: 28, periodLength: 5, predictions: true, useHistory: true });
export const blankPeriodLog = (date: string): PeriodLog => ({ date, spotting: false, symptoms: [], note: '' });
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const shiftDay = (key: string, days: number) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + days); return dayKey(d); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
export const validPeriodDate = (key: unknown): key is string => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(Date.parse(`${key}T12:00:00Z`)) && new Date(`${key}T12:00:00Z`).toISOString().slice(0, 10) === key;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const isPeriodTracking = (v: unknown): v is PeriodTracking => record(v) &&
  Number.isInteger(v.cycleLength) && Number(v.cycleLength) >= 15 && Number(v.cycleLength) <= 90 &&
  Number.isInteger(v.periodLength) && Number(v.periodLength) >= 1 && Number(v.periodLength) <= 30 &&
  typeof v.predictions === 'boolean' && typeof v.useHistory === 'boolean' && Array.isArray(v.logs) &&
  v.logs.every(log => record(log) && validPeriodDate(log.date) && (log.flow === undefined || Object.hasOwn(PERIOD_FLOWS, String(log.flow))) && typeof log.spotting === 'boolean' &&
    Array.isArray(log.symptoms) && log.symptoms.every(s => typeof s === 'string' && s.length <= 100) && typeof log.note === 'string' && log.note.length <= 4000) &&
  new Set(v.logs.map(log => log.date)).size === v.logs.length;

/** Old calendar spans remain readable; new daily detail takes priority. No write on opening. */
export function periodLogs(data: CalendarData): PeriodLog[] {
  const byDate = new Map<string, PeriodLog>();
  for (const entry of data.entries.filter(e => e.kind === 'period')) {
    if (!validPeriodDate(entry.date)) continue;
    const end = validPeriodDate(entry.endDate) && entry.endDate >= entry.date ? entry.endDate : entry.date;
    if (daysBetween(entry.date, end) > 36600) continue;
    for (let key = entry.date; key <= end; key = shiftDay(key, 1)) byDate.set(key, { ...blankPeriodLog(key), flow: 'unspecified', note: entry.title === '经期' ? '' : entry.title });
  }
  for (const log of data.periodTracking?.logs ?? []) byDate.set(log.date, log);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function periodSpans(logs: PeriodLog[]) {
  const spans: Array<{ start: string; end: string; days: number }> = [];
  for (const log of [...logs].filter(log => log.flow).sort((a, b) => a.date.localeCompare(b.date))) {
    const last = spans.at(-1);
    if (last && shiftDay(last.end, 1) === log.date) { last.end = log.date; last.days++; }
    else spans.push({ start: log.date, end: log.date, days: 1 });
  }
  return spans;
}
/** Sync only actual bleeding to the existing calendar/chat context. Predictions and symptoms stay separate. */
export function savePeriodLogs(data: CalendarData, logs: PeriodLog[], options = data.periodTracking ?? defaultPeriodTracking()): CalendarData {
  const unique = new Map(logs.map(log => [log.date, log]));
  const saved = [...unique.values()].filter(log => log.flow || log.spotting || log.symptoms.length || log.note.trim()).sort((a, b) => a.date.localeCompare(b.date));
  const periods: CalendarEntry[] = periodSpans(saved).map(span => ({ id: `period-${span.start}`, kind: 'period', date: span.start, endDate: span.end, title: '经期' }));
  return { ...data, entries: [...data.entries.filter(e => e.kind !== 'period'), ...periods], periodTracking: { ...options, logs: saved } };
}
export function periodOverview(data: CalendarData, today: string) {
  const options = data.periodTracking ?? defaultPeriodTracking();
  const spans = periodSpans(periodLogs(data).filter(log => log.date <= today));
  const intervals = spans.slice(-7).slice(1).map((span, i) => daysBetween(spans.slice(-7)[i].start, span.start)).filter(n => n >= 15 && n <= 90);
  const average = (values: number[], fallback: number) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : fallback;
  const completed = spans.filter(span => span.end < today).slice(-6);
  const cycleLength = options.useHistory ? average(intervals, options.cycleLength) : options.cycleLength;
  const periodLength = options.useHistory ? average(completed.map(span => span.days), options.periodLength) : options.periodLength;
  const last = spans.at(-1);
  const predictedStart = last && options.predictions ? shiftDay(last.start, cycleLength) : undefined;
  return { spans, cycleLength, periodLength, last, predictedStart, predictedEnd: predictedStart ? shiftDay(predictedStart, periodLength - 1) : undefined, intervalCount: intervals.length };
}
