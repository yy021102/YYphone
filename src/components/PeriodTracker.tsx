import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Plus, Trash2 } from 'lucide-react';
import type { CalendarData } from '../utils/calendarData';
import { blankPeriodLog, daysBetween, defaultPeriodTracking, PERIOD_FLOWS, PERIOD_SYMPTOMS, periodLogs, periodOverview, savePeriodLogs, shiftDay, validPeriodDate, type PeriodLog } from '../utils/periodTracking';

const shortDate = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
export function PeriodTracker({ data, today, selected, onSelect, onChange }: { data: CalendarData; today: string; selected: string; onSelect: (date: string) => void; onChange: (data: CalendarData) => void }) {
  const [month, setMonth] = useState(() => selected.slice(0, 7));
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [error, setError] = useState('');
  const selectedRef = useRef<HTMLButtonElement>(null);
  const logs = periodLogs(data), log = logs.find(item => item.date === selected) ?? blankPeriodLog(selected);
  const options = data.periodTracking ?? defaultPeriodTracking(), overview = periodOverview(data, today);
  const spans = overview.spans;
  useEffect(() => {
    const button = selectedRef.current, strip = button?.parentElement;
    if (button && strip) strip.scrollTo({ left: strip.scrollLeft + button.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - button.clientWidth) / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [selected, month]);
  const commit = (next: PeriodLog[], config = options) => {
    try { onChange(savePeriodLogs(data, next, config)); setError(''); } catch { setError('保存失败，请检查存储空间后重试。'); }
  };
  const patchLog = (patch: Partial<PeriodLog>) => commit([...logs.filter(item => item.date !== selected), { ...log, ...patch }]);
  const select = (date: string) => { onSelect(date); setMonth(date.slice(0, 7)); setError(''); };
  const moveMonth = (delta: number) => { const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + delta); setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`); };
  const monthCount = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const recordedToday = logs.some(item => item.date === today && item.flow);
  const current = spans.find(span => span.start <= today && span.end >= today);
  const nextIn = overview.predictedStart ? daysBetween(today, overview.predictedStart) : undefined;
  const future = selected > today;
  return <section className="period-tracker" aria-label="经期追踪">
    <div className="period-hero">
      <div className="period-hero-heading"><span><Droplets size={15}/> 经期追踪</span><button type="button" onClick={() => select(today)}>今天</button></div>
      <h3>{recordedToday && current ? <>经期第 <strong>{daysBetween(current.start, today) + 1}</strong> 天</> : overview.last ? <>照顾自己的每一天</> : <>从今天，记下自己</>}</h3>
      <p>{overview.predictedStart ? nextIn! > 0 ? `下次预计 ${shortDate(overview.predictedStart)} · 还有 ${nextIn} 天` : nextIn === 0 ? '今天是预计开始日，以实际记录为准' : `上次预计 ${shortDate(overview.predictedStart)}，等待新的记录` : '经量、感受和那些细微的变化'}</p>
      <div className="period-hero-stats"><div><small>{options.useHistory && overview.intervalCount ? '平均周期' : '设定周期'}</small><b>{overview.cycleLength}<span> 天</span></b></div><div><small>{options.useHistory && spans.some(span => span.end < today) ? '平均经期' : '设定经期'}</small><b>{overview.periodLength}<span> 天</span></b></div><div><small>已记录</small><b>{spans.length}<span> 次</span></b></div></div>
    </div>

    <section className="period-card period-date-card">
      <header><button type="button" aria-label="经期上个月" onClick={() => moveMonth(-1)}><ChevronLeft size={18}/></button><label>{Number(month.slice(0, 4))} 年 {Number(month.slice(5))} 月<input aria-label="选择经期月份" type="month" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }}/></label><button type="button" aria-label="经期下个月" onClick={() => moveMonth(1)}><ChevronRight size={18}/></button></header>
      <div className="period-date-strip" aria-label="经期日期">
        {Array.from({ length: monthCount }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, '0')}`, item = logs.find(l => l.date === key);
          const predicted = key > today && overview.predictedStart && key >= overview.predictedStart && key <= overview.predictedEnd! && !item?.flow;
          return <button type="button" ref={key === selected ? selectedRef : undefined} key={key} aria-label={`记录${key}`} aria-pressed={key === selected} className={`${item?.flow ? 'is-period' : ''} ${predicted ? 'is-predicted' : ''} ${key === today ? 'is-today' : ''}`} onClick={() => select(key)}><small>{['日', '一', '二', '三', '四', '五', '六'][new Date(`${key}T12:00:00`).getDay()]}</small><span>{i + 1}</span><i className={item?.spotting || item?.symptoms.length || item?.note ? 'has-detail' : ''}/></button>;
        })}
      </div>
      <div className="period-legend"><span><i/>已记录</span><span><i/>预计</span><span><i/>有其他记录</span></div>
    </section>

    <section className="period-card period-editor">
      <header><div><small>{selected.slice(0, 4)} 年</small><h4>{shortDate(selected)}{selected === today && <em>今天</em>}</h4></div><button type="button" className="period-text-button" onClick={() => setRange({ start: future ? today : selected, end: future ? today : selected })}><Plus size={14}/>补记一段</button></header>
      {future ? <p className="period-muted">这一天还没到，可以查看预计日期，实际记录到当天再填写。</p> : <>
        <fieldset><legend>经量</legend><div className="period-flow-options">{([{ value: undefined, label: '无经期' }, ...Object.entries(PERIOD_FLOWS).map(([value, label]) => ({ value: value as PeriodLog['flow'], label }))]).map(item => <button type="button" key={item.label} aria-pressed={log.flow === item.value} onClick={() => patchLog({ flow: item.value })}>{item.value && <Droplets size={16}/>}<span>{item.label}</span></button>)}</div></fieldset>
        <label className="period-spotting">点滴出血<input type="checkbox" checked={log.spotting} onChange={e => patchLog({ spotting: e.target.checked })}/></label>
        <fieldset><legend>今天的感受</legend><div className="period-symptoms">{PERIOD_SYMPTOMS.map(symptom => <button type="button" aria-pressed={log.symptoms.includes(symptom)} key={symptom} onClick={() => patchLog({ symptoms: log.symptoms.includes(symptom) ? log.symptoms.filter(s => s !== symptom) : [...log.symptoms, symptom] })}>{symptom}</button>)}</div></fieldset>
        <label className="period-note">备注<textarea aria-label="经期备注" placeholder="记下今天的感受…" maxLength={4000} rows={2} value={log.note} onChange={e => patchLog({ note: e.target.value })}/></label>
        <footer><span>更改自动保存</span>{logs.some(item => item.date === selected) && <button type="button" onClick={() => { if (window.confirm(`删除 ${shortDate(selected)} 的经期、症状和备注？`)) commit(logs.filter(item => item.date !== selected)); }}><Trash2 size={12}/>删除当天记录</button>}</footer>
      </>}
    </section>

    <details className="period-card period-history"><summary>经期历史 <span>{spans.length} 次</span></summary>{!spans.length ? <p className="period-muted">还没有经期记录</p> : [...spans].reverse().map((span, i, reversed) => <div className="period-history-row" key={span.start}><button type="button" onClick={() => select(span.start)}><small>{span.start.slice(0, 4)} 年</small><b>{shortDate(span.start)} — {shortDate(span.end)}</b><span>{span.days} 天{reversed[i + 1] ? ` · 与上次相隔 ${daysBetween(reversed[i + 1].start, span.start)} 天` : ''}</span></button><div className="period-history-bar" aria-hidden="true">{Array.from({ length: Math.min(span.days, 10) }, (_, index) => <i key={index}/>)}</div><button type="button" aria-label={`删除${span.start}这次经期`} onClick={() => { if (window.confirm('删除这次经期？当日症状和备注会保留。')) commit(logs.map(item => item.date >= span.start && item.date <= span.end ? { ...item, flow: undefined } : item)); }}><Trash2 size={14}/></button></div>)}</details>

    <details className="period-card period-options"><summary>周期设置</summary><label>显示经期预测<input type="checkbox" checked={options.predictions} onChange={e => commit(logs, { ...options, predictions: e.target.checked })}/></label><label>根据历史记录估算<input type="checkbox" checked={options.useHistory} onChange={e => commit(logs, { ...options, useHistory: e.target.checked })}/></label><label>通常的周期长度<select aria-label="通常的周期长度" value={options.cycleLength} onChange={e => commit(logs, { ...options, cycleLength: Number(e.target.value) })}>{Array.from({ length: 76 }, (_, i) => i + 15).map(n => <option key={n} value={n}>{n} 天</option>)}</select></label><label>通常的经期长度<select aria-label="通常的经期长度" value={options.periodLength} onChange={e => commit(logs, { ...options, periodLength: Number(e.target.value) })}>{Array.from({ length: 30 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} 天</option>)}</select></label><p>历史不足时使用设定天数；有记录后参考最近的周期。预测仅供记录参考，不用于避孕或诊断。</p></details>
    {error && <p className="period-error" role="alert">{error}</p>}
    {range && <div className="period-range-backdrop" onClick={e => { if (e.target === e.currentTarget) setRange(null); }}><form role="dialog" aria-modal="true" aria-label="补记经期" className="period-range-sheet" onSubmit={e => {
      e.preventDefault();
      if (!validPeriodDate(range.start) || !validPeriodDate(range.end) || range.end < range.start || range.end > today || daysBetween(range.start, range.end) > 60) { setError('请选择有效的起止日期，最多补记 61 天，不能记录未来。'); return; }
      const next = new Map(logs.map(item => [item.date, item]));
      for (let date = range.start; date <= range.end; date = shiftDay(date, 1)) next.set(date, { ...(next.get(date) ?? blankPeriodLog(date)), flow: next.get(date)?.flow ?? 'unspecified' });
      try { onChange(savePeriodLogs(data, [...next.values()])); setRange(null); select(range.start); } catch { setError('保存失败，请重试。'); }
    }}><h4>补记经期</h4><p>将这段日期标记为已来经，保留原有经量和感受。</p><label>开始日期<input aria-label="经期开始日期" required type="date" max={today} value={range.start} onChange={e => setRange({ ...range, start: e.target.value })}/></label><label>结束日期<input aria-label="经期结束日期" required type="date" min={range.start} max={today} value={range.end} onChange={e => setRange({ ...range, end: e.target.value })}/></label>{error && <p role="alert" className="period-error">{error}</p>}<div><button type="button" onClick={() => { setRange(null); setError(''); }}>取消</button><button type="submit">保存记录</button></div></form></div>}
  </section>;
}
