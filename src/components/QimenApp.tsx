import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, History, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import {
  QIMEN_DIRECTIONS, QIMEN_DOOR_NOTES, QIMEN_LAYOUT, QIMEN_LIMIT, QIMEN_METHOD, QIMEN_PALACES,
  createQimenRecord, loadQimen, patchQimen, qimenNow, recoverQimen, subscribeQimen, updateQimen, validateQimenInput,
  type QimenInterpretInput, type QimenPalace, type QimenRecord,
} from '../utils/qimen';
import { initializeQimen } from '../utils/qimenEngine';
import type { DivinationReader } from '../utils/divination';
import './qimen.css';

type Props = {
  people: { id: string; name: string }[]; onBack: () => void;
  onInterpret: (input: QimenInterpretInput) => Promise<string>;
  onShare: (record: QimenRecord, recipients: string[]) => void | Promise<void>;
};
const stamp = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
const errorText = (error: unknown) => error instanceof Error ? error.message : '未能完成这次操作，请手动重试。';

function Methods() {
  return <details className="qimen-paper qimen-methods"><summary><BookOpen size={15} />本卷的排盘约定</summary>
    <p>{QIMEN_METHOD}</p><p>采用 qimen-rs 0.2.1 / tyme4rs 历法引擎。节气按真实交节时刻划分，年柱以立春、月柱以节令划分；三元按最近甲己符头确定，不是简单把交节后的日期平均分三段。交节显示到秒不等于所有年代都有一秒的天文精度。本版支持 1900～2100 年公历。</p>
    <p>盘面南上北下、东左西右。中五保留地盘干，天禽与中五天盘干随天芮同转；值使先按原宫飞数，落中五后再寄坤二。九星、八门保持外环次序，八神阳顺阴逆。</p>
    <p>这是固定东八区时间，不读取设备时区，不自动修正海外时差、历史夏令时或真太阳时。请先自行换算。本版不含飞盘、置闰、茅山法、终身盘、批量择日，也不计算暗干、旺衰、刑墓或门迫等扩展注记。</p>
    <p><a href="https://qimen-rs.vercel.app/guide/conventions" target="_blank" rel="noreferrer">引擎规则说明</a><span> · </span><a href={`${import.meta.env.BASE_URL}qimen-engine-license.txt`} target="_blank" rel="noreferrer">开源许可</a></p>
  </details>;
}
function PalaceDetail({ palace, record }: { palace: QimenPalace; record: QimenRecord }) {
  const c = record.chart;
  return <section className="qimen-paper qimen-palace-detail" aria-live="polite">
    <span className="qimen-eyebrow">PALACE NOTES · 宫中小记</span>
    <h3>{QIMEN_PALACES[palace.number - 1]}宫 <small>{QIMEN_DIRECTIONS[palace.number - 1]} · 五行{palace.element}</small></h3>
    {palace.number === 5 ? <p>中宫保留地盘{palace.earth}。这里没有独立八门、八神；天禽与中五天盘寄干随天芮转动，不能把它们再算一遍。</p> : <>
      <dl className="qimen-pairs"><div><dt>九星</dt><dd>{palace.stars.join(' · ')}</dd></div><div><dt>八门</dt><dd>{palace.door}</dd></div><div><dt>八神</dt><dd>{palace.deity}</dd></div></dl>
      <p>{palace.door && QIMEN_DOOR_NOTES[palace.door]}这是现代反思提示，不是格局吉凶判断；本版未计算的格局不能据此认定。</p>
    </>}
    <dl className="qimen-stem-notes"><div><dt>天盘</dt><dd>{palace.heaven.length ? palace.heaven.map(h => <span key={h.source}>{h.stem} · 来自{QIMEN_PALACES[h.source - 1]}{h.hosted ? '（中五寄干）' : ''}<br /></span>) : '无独立天盘；天禽随芮'}</dd></div>
      <div><dt>地盘</dt><dd>{palace.earth}{palace.hostedEarth && `；另寄中五${palace.hostedEarth}`}</dd></div></dl>
    {palace.number === c.starPalace && <p className="qimen-small-note">值符{c.leaderStar}落此宫。它是本时盘的主星标记，不表示必定有贵人或好运。</p>}
    {palace.number === c.doorPalace && <p className="qimen-small-note">值使{c.leaderDoor}落此宫{c.doorRawPalace === 5 && '（原落中五，寄坤二）'}。</p>}
    {!!palace.voids.length && <p className="qimen-small-note">时旬空亡：{palace.voids.join('、')}。这是传统注记，不代表事情必定落空。</p>}
    {palace.horse && <p className="qimen-small-note">时马：{c.horseBranch}。这是传统流动意象，不预言出行。</p>}
  </section>;
}
export default function QimenApp({ people, onBack, onInterpret, onShare }: Props) {
  const [records, setRecords] = useState(loadQimen), [view, setView] = useState<'home' | 'result' | 'history'>('home');
  const [input, setInput] = useState(qimenNow), [question, setQuestion] = useState('');
  const [recordId, setRecordId] = useState(''), [palaceId, setPalaceId] = useState(1);
  const [readerId, setReaderId] = useState('oracle'), [recipients, setRecipients] = useState<string[]>([]), [consent, setConsent] = useState(false);
  const [working, setWorking] = useState(false), [reading, setReading] = useState(false), [deleteId, setDeleteId] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null), mounted = useRef(true), operation = useRef(false);
  const request = useRef<{ controller: AbortController; recordId: string; attemptId: string } | null>(null);
  const report = (caught: unknown) => { if (mounted.current) setError(errorText(caught)); else console.error('Qimen operation failed after unmount:', caught); };
  const cancel = () => {
    const active = request.current;
    if (!active) return;
    request.current = null; active.controller.abort();
    if (mounted.current) setReading(false);
    void patchQimen(active.recordId, r => ({ ...r, interpretations: r.interpretations.map(a =>
      a.id === active.attemptId && a.status === 'pending' ? { ...a, status: 'error', error: '解读已取消，不会自动重试。' } : a) })).catch(report);
  };
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeQimen(() => setRecords(loadQimen()));
    if (loadQimen().some(r => r.interpretations.some(a => a.status === 'pending'))) void updateQimen(recoverQimen).catch(report);
    return () => { mounted.current = false; unsubscribe(); cancel(); };
  }, []);
  useEffect(() => {
    let node = root.current?.parentElement ?? null;
    while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node = node.parentElement;
    node?.scrollTo({ top: 0 });
  }, [view, recordId]);
  useEffect(() => { if (error || notice) root.current?.querySelector('[role="alert"], [role="status"]')?.scrollIntoView({ block: 'center' }); }, [error, notice]);
  const go = (next: typeof view) => { cancel(); setError(''); setNotice(''); setDeleteId(''); setConsent(false); setRecipients([]); setView(next); };
  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setWorking(true); setError(''); setNotice('');
    try { await action(); } catch (caught) { report(caught); }
    finally { operation.current = false; if (mounted.current) setWorking(false); }
  };
  const open = (record: QimenRecord) => { setRecordId(record.id); setPalaceId(record.chart.starPalace); go('result'); };
  const begin = () => void run(async () => {
    validateQimenInput(input.date, input.time, question);
    await initializeQimen();
    if (!mounted.current) return;
    const record = createQimenRecord(input.date, input.time, question);
    await updateQimen(current => [record, ...current]);
    if (mounted.current) open(record);
  });
  const interpret = async (record: QimenRecord, reader: DivinationReader) => {
    if (request.current || operation.current) return;
    const active = { controller: new AbortController(), recordId: record.id, attemptId: `reading-${crypto.randomUUID()}` };
    request.current = active; setReading(true); setError(''); setNotice('');
    try {
      await patchQimen(record.id, r => ({ ...r, interpretations: [...r.interpretations,
        { id: active.attemptId, reader, status: 'pending', text: '', createdAt: new Date().toISOString() }] }));
      active.controller.signal.throwIfAborted();
      const text = (await onInterpret({ record, reader, signal: active.controller.signal })).trim();
      active.controller.signal.throwIfAborted();
      if (!text || text.length > 12000) throw new Error('AI 解读为空或过长，请手动重试。');
      await patchQimen(record.id, r => ({ ...r, interpretations: r.interpretations.map(a =>
        a.id === active.attemptId && !active.controller.signal.aborted ? { ...a, status: 'done', text } : a) }));
    } catch (caught) {
      if (!active.controller.signal.aborted) {
        report(caught);
        try { await patchQimen(record.id, r => ({ ...r, interpretations: r.interpretations.map(a =>
          a.id === active.attemptId ? { ...a, status: 'error', error: errorText(caught).slice(0, 1000) } : a) })); }
        catch (persistenceError) { report(persistenceError); }
      }
    } finally { if (request.current === active) { request.current = null; if (mounted.current) setReading(false); } }
  };
  const record = records.find(r => r.id === recordId), c = record?.chart;
  const disabled = working || reading;
  const back = () => { if (working) return; if (view === 'home') { cancel(); onBack(); } else go('home'); };
  return <div className="qimen-app" ref={root}>
    <nav className="qimen-nav"><button type="button" aria-label="返回占卜首页或奇门首页" disabled={working} onClick={back}><ArrowLeft size={18} /></button><span>山 河 秘 仪</span><button type="button" aria-label="查看奇门手记" disabled={working} onClick={() => go('history')}><History size={17} /></button></nav>
    <div className="qimen-content">
      {error && <p className="qimen-alert" role="alert">{error}</p>}{notice && <p className="qimen-notice" role="status">{notice}</p>}
      {view === 'home' && <>
        <header className="qimen-hero"><span className="qimen-eyebrow">THE ART OF TIMING</span><span className="qimen-seal" aria-hidden="true">问<br />时</span><h2>借一局清风，<br /><em>安放此刻的心事。</em></h2><p>不必先懂九宫八门。<br />写下眼前的事，从一个新的角度出发。</p><div className="qimen-mountain" aria-hidden="true" /></header>
        <form className="qimen-paper qimen-form" onSubmit={event => { event.preventDefault(); begin(); }}>
          <span className="qimen-eyebrow">先问当下 · 不问宿命</span><h3>此刻，想问什么？</h3>
          <label>想问的事 <small>选填 · 300 字以内</small><textarea maxLength={300} rows={3} value={question} disabled={working} onChange={event => setQuestion(event.target.value)} placeholder="例如：怎样把这次沟通说得更坦诚，也照顾彼此的感受？" /></label>
          <div className="qimen-form-grid"><label>公历日期<input type="date" min="1900-01-01" max="2100-12-31" required value={input.date} disabled={working} onChange={event => setInput({ ...input, date: event.target.value })} /></label>
            <label>北京时间<input type="time" step="1" required value={input.time} disabled={working} onChange={event => setInput({ ...input, time: event.target.value })} /></label></div>
          <button type="button" className="qimen-now" disabled={working} onClick={() => setInput(qimenNow())}>采用此刻 · 固定东八区</button>
          <p className="qimen-help">固定 UTC+08:00，23:00 换日；不自动处理历史夏令时或真太阳时。只在本地排盘、保存，不会自动请求 AI。</p>
          <button type="submit" className="qimen-primary" disabled={working}>{working ? <Loader2 className="qimen-spin" size={16} /> : <Compass size={17} />}{working ? '正在展开九宫…' : '起局 · 保存这一个此刻'}<ArrowRight size={15} /></button>
        </form>
        <Methods />
        <button type="button" className="qimen-history-link" disabled={working} onClick={() => go('history')}><History size={18} /><span>旧事有回声<small>已收存 {records.length} 则奇门手记</small></span><ArrowRight size={15} /></button>
      </>}
      {view === 'result' && record && c && <>
        <header className="qimen-heading"><span className="qimen-eyebrow">A MOMENT, HELD IN NINE PALACES</span><h2>一局山河，<em>照见当下。</em></h2><p>{record.date} {record.time} · UTC+08:00<br />{c.lunar}</p><span className="qimen-method-badge">{c.term} · {c.dun}{c.ju}局 · {c.yuan}</span></header>
        <blockquote className="qimen-question">{record.question}</blockquote>
        <div className="qimen-pillars">{c.pillars.map((pillar, i) => <div key={i}><small>{['年柱', '月柱', '日柱', '时柱'][i]}</small><strong>{pillar}</strong></div>)}</div>
        <div className="qimen-board-wrap"><div className="qimen-board-caption"><span>南 · 上</span><span>点选一宫，展开小记</span></div>
          <section className="qimen-board" aria-label="奇门九宫盘，南上北下，东左西右">{QIMEN_LAYOUT.map(id => {
            const p = c.palaces[id - 1];
            return <button type="button" key={id} className="qimen-cell" data-center={id === 5} aria-pressed={palaceId === id} aria-label={`查看${QIMEN_PALACES[id - 1]}宫详情`} onClick={() => setPalaceId(id)}>
              <span className="qimen-cell-heading"><span>{QIMEN_PALACES[id - 1]}</span><small>{QIMEN_DIRECTIONS[id - 1]}</small></span>
              {id === 5 ? <><span className="qimen-center-mark" aria-hidden="true">遁甲</span><small className="qimen-center-note">天禽随芮<br />中五寄坤</small></> : <>
                <span className="qimen-cell-deity">{p.deity}</span><strong className="qimen-cell-door">{p.door}</strong><span className="qimen-cell-stars">{p.stars.map(star => <span key={star}>{star}</span>)}</span>
                <span className="qimen-cell-stems">天 {p.heaven.map(h => <span key={h.source}>{h.stem}{h.hosted && <sup>寄</sup>}</span>)}</span>
              </>}
              <span className="qimen-cell-earth">地 {p.earth}{p.hostedEarth && <span> · 寄{p.hostedEarth}</span>}</span>
              <span className="qimen-cell-tags">{id === c.starPalace && <i>符</i>}{id === c.doorPalace && <i>使</i>}{!!p.voids.length && <i>空</i>}{p.horse && <i>马</i>}</span>
            </button>;
          })}</section><p className="qimen-help">南上北下 · 东左西右；符 / 使为值符、值使，空 / 马为时旬空亡、时马。仅是传统标记，不是吉凶结论。</p></div>
        <PalaceDetail palace={c.palaces[palaceId - 1]} record={record} />
        <details className="qimen-paper"><summary>这一局如何起成</summary><dl className="qimen-stem-notes">
          <div><dt>交节</dt><dd>{c.term} {c.termStart}<br />下一节气 {c.nextTerm} {c.nextTermStart}</dd></div>
          <div><dt>三元</dt><dd>符头 {c.yuanHead} · {c.yuan}</dd></div><div><dt>旬首</dt><dd>{c.xunHead} · 遁{c.hidden}</dd></div>
          <div><dt>值符</dt><dd>{c.leaderStar} · 原宫{c.leaderOrigin} → {QIMEN_PALACES[c.starPalace - 1]}宫</dd></div>
          <div><dt>值使</dt><dd>{c.leaderDoor} · 飞数至{c.doorRawPalace}宫{c.doorRawPalace === 5 ? '，寄坤二' : ''}</dd></div>
          <div><dt>时空</dt><dd>{c.voids.join('、')}；时马 {c.horseBranch}，{QIMEN_PALACES[c.horsePalace - 1]}宫</dd></div>
        </dl><p className="qimen-help">23:00 后日柱按次日，节气仍以实际交节时刻为准。此盘只计算基础层，不推断未计算的扩展格局。</p></details>
        <section className="qimen-paper"><span className="qimen-eyebrow">A GENTLE READING</span><h3>请一位解读者，陪你看这一局</h3>
          <p className="qimen-help">主动请求才调用 1 次 AI，会将问题、起局时间、完整九宫数据与规则发送到你配置的 API。角色模式还使用其人设、聊天与本地记忆；只读文字，不执行聊天动作。</p>
          <label>由谁解读<select value={readerId} disabled={disabled} onChange={event => setReaderId(event.target.value)}><option value="oracle">AI 术数解读者</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <button type="button" className="qimen-primary" disabled={disabled} onClick={() => {
            const actor = people.find(p => p.id === readerId);
            if (readerId !== 'oracle' && !actor) { setError('请重新选择仍在通讯录中的解读角色。'); return; }
            void interpret(record, actor ? { mode: 'character', actorId: actor.id, actorName: actor.name } : { mode: 'oracle' });
          }}>{reading ? <Loader2 size={16} className="qimen-spin" /> : <Sparkles size={16} />}{reading ? '正在写下解读…' : '邀请解读 · 1 次 AI'}</button>
          {reading && <button type="button" className="qimen-secondary" onClick={cancel}>取消本次解读</button>}
          {record.interpretations.map(a => <article className="qimen-reading" key={a.id}><div><strong>{a.reader.mode === 'oracle' ? 'AI 术数解读者' : a.reader.actorName}</strong><small>{stamp(a.createdAt)}</small></div>
            {a.status === 'done' ? <p>{a.text}</p> : a.status === 'pending' ? <p role="status">正在解读，离开本页会取消请求。</p> : <p className="qimen-reading-error">{a.error}</p>}</article>)}
        </section>
        <section className="qimen-paper"><span className="qimen-eyebrow">SEND A LITTLE REFLECTION</span><h3>把这一局，寄给 TA</h3><p className="qimen-help">转发完整问题、起局时间、九宫与已完成解读。再次转发会更新同一张卡片；删除手记不会撤回已发卡片。</p>
          {!people.length && <p className="qimen-help">通讯录里还没有可转发的角色。</p>}
          <div className="qimen-share-people">{people.map(p => <label className="qimen-checkbox" key={p.id}><input type="checkbox" disabled={disabled} checked={recipients.includes(p.id)} onChange={event => setRecipients(current => event.target.checked ? [...current, p.id] : current.filter(id => id !== p.id))} /><span>{p.name}</span></label>)}</div>
          <label className="qimen-checkbox"><input type="checkbox" disabled={disabled} checked={consent} onChange={event => setConsent(event.target.checked)} /><span>我同意把完整问题、时间与盘面转发给所选角色</span></label>
          <button type="button" className="qimen-secondary" disabled={disabled || !consent || !recipients.length} onClick={() => void run(async () => {
            await onShare(record, recipients); if (mounted.current) setNotice('奇门手记已转发，可在聊天中打开完整内容。');
          })}><Send size={15} />转发奇门手记</button>
        </section><Methods />
      </>}
      {view === 'history' && <>
        <header className="qimen-heading"><span className="qimen-eyebrow">MOMENTS WORTH KEEPING</span><h2>旧事有回声，<em>此卷可重读。</em></h2><p>每一次起局独立收存，保留当时的问题、盘面和解读。</p></header>
        {!records.length && <p className="qimen-empty">还没有奇门手记。起一局，留住这一个此刻。</p>}
        {records.map(r => <article className="qimen-archive" key={r.id}><button type="button" className="qimen-record-open" disabled={working} onClick={() => open(r)}><Compass size={21} /><span><strong>{r.question}</strong><small>{r.date} {r.time} · {r.chart.term} · {r.chart.dun}{r.chart.ju}局</small></span><ArrowRight size={15} /></button><button type="button" className="qimen-delete" disabled={disabled} aria-label={`删除奇门手记 ${r.question}`} onClick={() => setDeleteId(r.id)}><Trash2 size={16} /></button></article>)}
        {deleteId && <section className="qimen-paper" role="alert"><p>删除这份奇门手记及其解读？无法撤销；已转发的聊天卡片不会同步删除。</p><div className="qimen-actions"><button type="button" className="qimen-secondary" disabled={working} onClick={() => void run(async () => {
          await updateQimen(current => current.filter(r => r.id !== deleteId));
          if (mounted.current) { setDeleteId(''); setNotice('奇门手记已删除。'); }
        })}><Trash2 size={14} />确认删除</button><button type="button" className="qimen-secondary" disabled={working} onClick={() => setDeleteId('')}><Check size={14} />保留</button></div></section>}
      </>}
      <footer className="qimen-footer">{QIMEN_LIMIT}</footer>
    </div>
  </div>;
}
