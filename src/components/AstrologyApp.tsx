import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Heart, History, Loader2, MessageCircle, Moon, Orbit, Plus, Sparkles, Star, Sun, Trash2 } from 'lucide-react';
import {
  ASPECTS, HOUSE_THEMES, PLANETS, ZODIAC, birthInstant, createNatalRecord, loadAstrology, planetName,
  astrologyRecordTitle, astrologyWarnings, recoverNatalRecords, signIndex, subscribeAstrology, updateAstrology, updateAstrologyRecord,
  validateBirthProfile, zodiacPosition, type AstrologyRecord, type BirthProfile, type CharacterBirthInput, type NatalInterpretInput,
} from '../utils/astrology';
import { ASTROLOGY_CITIES } from '../utils/astrologyCities';
import type { DivinationReader } from '../utils/divination';
import NatalWheel from './NatalWheel';
import AstrologyPlaceFields from './AstrologyPlaceFields';
import CharacterBirthDraft from './CharacterBirthDraft';
import AstrologyReadingPanel from './AstrologyReadingPanel';
import { AstrologyStudyBuilder, AstrologyStudyResult, type AstrologyStudyMode } from './AstrologyStudies';
import './astrology.css';

type Props = {
  userName: string; people: { id: string; name: string }[]; onBack: () => void;
  onInterpret: (input: NatalInterpretInput | CharacterBirthInput) => Promise<string>;
  onShare: (record: AstrologyRecord, recipients: string[]) => void | Promise<void>;
};
type View = 'home' | 'edit' | 'result' | 'archive' | 'builder';
const messageOf = (caught: unknown) => caught instanceof Error ? caught.message : '操作未能完成，请重试。';
const stamp = (value: string) => new Date(value).toLocaleDateString('zh-CN');
const freshProfile = (name: string): BirthProfile => ({
  id: `birth-${crypto.randomUUID()}`, name, date: '', time: '12:00', timeKnown: true, fold: 'reject', place: { ...ASTROLOGY_CITIES[0] },
});
const noonWarning = '出生时间未知：按当地中午 12:00 绘制。上升、天顶与所有宫位仅供参考，不能当作真实出生盘；行星度数、逆行与相位也可能变化。';

export default function AstrologyApp({ userName, people, onBack, onInterpret, onShare }: Props) {
  const [store, setStore] = useState(loadAstrology);
  const [view, setView] = useState<View>('home');
  const [draft, setDraft] = useState(() => freshProfile(userName));
  const [question, setQuestion] = useState('');
  const [recordId, setRecordId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [reading, setReading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [studyMode, setStudyMode] = useState<AstrologyStudyMode>('synastry');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'profile' | 'record'; id: string } | null>(null);
  const mounted = useRef(true), operation = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const request = useRef<{ controller: AbortController; recordId: string; attemptId: string } | null>(null);
  const report = (caught: unknown) => {
    if (mounted.current) setError(messageOf(caught));
    else console.error('Astrology operation failed after leaving the view:', caught);
  };
  const cancel = () => {
    const active = request.current;
    if (!active) return;
    request.current = null; active.controller.abort();
    if (mounted.current) setReading(false);
    void updateAstrologyRecord(active.recordId, record => ({ ...record, interpretations: record.interpretations.map(attempt =>
      attempt.id === active.attemptId && attempt.status === 'pending' ? { ...attempt, status: 'error', error: '解读已取消，不会自动重试。' } : attempt) })).catch(report);
  };
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeAstrology(() => setStore(loadAstrology()));
    const stored = loadAstrology();
    if ([...stored.records, ...stored.studies].some(record => record.interpretations.some(attempt => attempt.status === 'pending'))) {
      void updateAstrology(current => ({ ...current, records: recoverNatalRecords(current.records), studies: recoverNatalRecords(current.studies) })).catch(report);
    }
    return () => { mounted.current = false; unsubscribe(); cancel(); };
  }, []);
  useEffect(() => {
    let element = rootRef.current?.parentElement ?? null;
    while (element && !/(auto|scroll)/.test(getComputedStyle(element).overflowY)) element = element.parentElement;
    element?.scrollTo({ top: 0 });
  }, [view, recordId]);
  useEffect(() => {
    if (error || notice) rootRef.current?.querySelector('[role="alert"], [role="status"]')?.scrollIntoView({ block: 'center' });
  }, [error, notice]);
  const go = (next: View) => {
    cancel(); setError(''); setNotice(''); setDeleteTarget(null); setView(next);
  };
  const edit = (profile?: BirthProfile) => {
    setDraft(profile ? { ...profile, place: { ...profile.place } } : freshProfile(userName));
    setQuestion(''); go('edit');
  };
  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setWorking(true); setError(''); setNotice('');
    try { await action(); } catch (caught) { report(caught); }
    finally { operation.current = false; if (mounted.current) setWorking(false); }
  };
  const save = (calculate: boolean) => void run(async () => {
    const profile = { ...draft, name: draft.name.trim(), time: draft.timeKnown ? draft.time : '12:00', place: { ...draft.place, name: draft.place.name.trim(), timeZone: draft.place.timeZone.trim() } };
    validateBirthProfile(profile);
    if (!calculate) birthInstant(profile);
    const record = calculate ? createNatalRecord(profile, question) : undefined;
    await updateAstrology(current => ({ ...current, profiles: [profile, ...current.profiles.filter(item => item.id !== profile.id)],
      records: record ? [record, ...current.records] : current.records }));
    if (mounted.current) {
      if (record) { setRecordId(record.id); go('result'); }
      else { go('archive'); setNotice('出生档案已保存，已有星盘手记不会改变。'); }
    }
  });
  const interpret = async (record: AstrologyRecord, reader: DivinationReader) => {
    if (request.current || operation.current) return;
    const active = { controller: new AbortController(), recordId: record.id, attemptId: `reading-${crypto.randomUUID()}` };
    request.current = active; setReading(true); setError(''); setNotice('');
    try {
      await updateAstrologyRecord(record.id, current => ({ ...current, interpretations: [...current.interpretations,
        { id: active.attemptId, reader, status: 'pending', text: '', createdAt: new Date().toISOString() }] }));
      active.controller.signal.throwIfAborted();
      const text = (await onInterpret({ record, reader, signal: active.controller.signal })).trim();
      active.controller.signal.throwIfAborted();
      if (!text || text.length > 12000) throw new Error('AI 解读为空或过长，请手动重新请求。');
      await updateAstrologyRecord(record.id, current => ({ ...current, interpretations: current.interpretations.map(attempt =>
        attempt.id === active.attemptId && !active.controller.signal.aborted ? { ...attempt, status: 'done', text } : attempt) }));
    } catch (caught) {
      if (!active.controller.signal.aborted) {
        const errorMessage = messageOf(caught).slice(0, 1000);
        report(caught);
        try {
          await updateAstrologyRecord(record.id, current => ({ ...current, interpretations: current.interpretations.map(attempt =>
            attempt.id === active.attemptId ? { ...attempt, status: 'error', error: errorMessage } : attempt) }));
        } catch (persistenceError) { report(persistenceError); }
      }
    } finally { if (request.current === active) { request.current = null; if (mounted.current) setReading(false); } }
  };
  const remove = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    void run(async () => {
      await updateAstrology(current => target.kind === 'profile'
        ? { ...current, profiles: current.profiles.filter(profile => profile.id !== target.id) }
        : { ...current, records: current.records.filter(record => record.id !== target.id), studies: current.studies.filter(record => record.id !== target.id) });
      setDeleteTarget(null); setNotice(target.kind === 'profile' ? '档案已删除，星盘手记仍保留原始快照。' : '星盘手记已删除。');
    });
  };
  const selected = store.records.find(item => item.id === recordId) ?? store.studies.find(item => item.id === recordId);
  const record = selected && 'chart' in selected ? selected : undefined;
  const build = (mode: AstrologyStudyMode) => { setStudyMode(mode); go('builder'); };
  const open = (id: string) => { setRecordId(id); go('result'); };
  const back = () => {
    if (working) return;
    if (view === 'home') { cancel(); onBack(); } else go('home');
  };
  return <div className="astrology-app" ref={rootRef}>
    <nav className="stellar-nav"><button type="button" onClick={back} disabled={working} aria-label="返回"><ArrowLeft size={18} /></button>
      <span>STELLAR NOTES</span><button type="button" onClick={() => go('archive')} disabled={working} aria-label="查看星盘档案与手记"><History size={17} /></button></nav>
    <div className="stellar-content">
      {error && <p className="stellar-alert" role="alert">{error}</p>}
      {notice && <p className="stellar-notice" role="status">{notice}</p>}
      {view === 'home' && <>
        <header className="stellar-hero">
          <div className="stellar-orbit-art" aria-hidden="true"><div /><div /><div /><Star size={30} strokeWidth={.8} /><i /><i /><i /></div>
          <span className="stellar-kicker">A LETTER FROM YOUR SKY</span><h2>在星辰之间，<br />遇见<span>自己。</span></h2>
          <p>你不只是一枚太阳星座。<br />让出生那刻的天空，成为认识自己的另一种语言。</p>
        </header>
        <button type="button" className="stellar-start" onClick={() => edit()}><span><small>YOUR OWN CONSTELLATION</small><strong>绘制我的出生星盘</strong><em>十星体 · 上升 · 宫位 · 相位</em></span><ArrowRight size={22} /></button>
        <div className="stellar-playways">
          {[{ mode: 'synastry' as const, title: '双人比较盘', english: 'TWO SKIES', hint: '你与 TA，或两位角色', icon: Heart },
            { mode: 'daily' as const, title: '每日星空', english: 'DAILY SKY', hint: '真实行运，温柔的今日提醒', icon: Sun },
            { mode: 'question' as const, title: '星空问答', english: 'ASK THE STARS', hint: '带着问题，读一封星空来信', icon: MessageCircle }].map(item =>
              <button type="button" key={item.mode} onClick={() => build(item.mode)}><item.icon size={20} strokeWidth={1.2} /><span><small>{item.english}</small><strong>{item.title}</strong><em>{item.hint}</em></span><ChevronRight size={15} /></button>)}
        </div>
        {store.profiles.length > 0 && <section><div className="stellar-section-heading"><h3>熟悉的名字</h3><button type="button" onClick={() => go('archive')}>全部档案<ChevronRight size={14} /></button></div>
          <div className="stellar-profile-chips">{store.profiles.map(profile => <button type="button" key={profile.id} onClick={() => edit(profile)}><Orbit size={14} />{profile.name}</button>)}</div></section>}
        <section className="stellar-paper"><span className="stellar-kicker">A SMALL GUIDE</span><h3>星盘不是命运的判词</h3><p>太阳谈表达，月亮谈需要，上升谈你与世界相遇的方式。它们是供你思考的象征，不是给人格贴上的标签。</p><p>采用热带黄道与整宫制。本地计算免费、不调用 AI；出生信息仅保存在当前设备。只有主动请求解读或转发时，才会分享相关资料。</p></section>
        <button type="button" className="stellar-archive-link" onClick={() => go('archive')}><BookOpen size={17} /><span>我的星空档案<small>{store.profiles.length} 份出生档案 · {store.records.length + store.studies.length} 则星空手记</small></span><ChevronRight size={16} /></button>
      </>}
      {view === 'builder' && <AstrologyStudyBuilder key={studyMode} mode={studyMode} profiles={store.profiles} onCreate={async next => {
        if (operation.current) throw new Error('另一个保存操作尚未完成，请稍后重试。');
        operation.current = true; setWorking(true);
        try {
          await updateAstrology(current => 'chart' in next ? { ...current, records: [next, ...current.records] } : { ...current, studies: [next, ...current.studies] });
          if (mounted.current) { setRecordId(next.id); go('result'); }
        } finally { operation.current = false; if (mounted.current) setWorking(false); }
      }} />}
      {view === 'edit' && <>
        <header className="stellar-heading"><span className="stellar-kicker">THE MOMENT YOU ARRIVED</span><h2>写下，天空的坐标</h2><p>公历日期与出生地当地时间。城市坐标为近似中心，可以手动修正。</p></header>
        <CharacterBirthDraft profileId={draft.id} initialActorId={draft.actorId} people={people} disabled={working} onBusyChange={setGenerating} onRequest={onInterpret} onDraft={next => { setDraft(next); setNotice('角色草稿已填写到下方，尚未保存。请核对、修改后确认。'); }} />
        <form className="stellar-form" onSubmit={event => { event.preventDefault(); save(true); }}>
          <fieldset disabled={working || generating}>
            <label>档案名称<input required maxLength={60} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>档案归属<select value={draft.actorId ?? ''} onChange={event => setDraft({ ...draft, actorId: event.target.value || undefined })}><option value="">自己 / 其他手动档案</option>
              {draft.actorId && !people.some(person => person.id === draft.actorId) && <option value={draft.actorId}>原角色已移除（保留快照）</option>}
              {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            {draft.creative && <section className="stellar-warning"><strong>角色创作设定 · 不是出生时间鉴定</strong><p>{draft.creative.reason}</p><p>以下字段由创作补全，仍可修改：{draft.creative.assumedFields.map(field => ({ date: '生日（含年份）', time: '时间', place: '地点' })[field]).join('、') || '用户已确认具体设定'}。{draft.creative.targetAscendant !== undefined && `最初目标上升：${ZODIAC[draft.creative.targetAscendant][0]}，修改日期或地点后可能改变。`}</p>
              <label className="stellar-checkbox"><input type="checkbox" checked={draft.creative.assumedFields.length === 0} onChange={event => setDraft({ ...draft, creative: draft.creative && { ...draft.creative, assumedFields: event.target.checked ? [] : ['date', 'time', 'place'] } })} /><span>我已核对并采用这些具体设定（仍保留创作来源）</span></label></section>}
            <label>公历出生日期<input type="date" required min="1900-01-01" max="2100-12-31" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
            <label className="stellar-checkbox"><input type="checkbox" checked={!draft.timeKnown} onChange={event => setDraft({ ...draft, timeKnown: !event.target.checked })} /><span>不确定出生时间，使用当地中午 12:00 参考盘</span></label>
            {draft.timeKnown ? <label>当地出生时间<input type="time" required value={draft.time} onChange={event => setDraft({ ...draft, time: event.target.value })} /></label>
              : <p className="stellar-warning">{noonWarning} 不会隐藏这些位置，但会明确标记。</p>}
            <AstrologyPlaceFields key={`${draft.id}-${draft.creative?.generatedAt ?? ''}`} place={draft.place} onChange={place => setDraft({ ...draft, place })} />
            <p className="stellar-help">使用时区历史规则自动处理夏令时；乌鲁木齐等城市默认采用法定北京时间。若出生记录采用其他地方时间，请自行核对并修改时区。支持纬度 −89°～89°。</p>
            <label>遇到时钟回拨的重复时间<select value={draft.fold} onChange={event => {
              const fold = event.target.value; if (fold === 'reject' || fold === 'earlier' || fold === 'later') setDraft({ ...draft, fold });
            }}><option value="reject">先提醒我，不自动选择</option><option value="earlier">第一次（较早的 UTC 时刻）</option><option value="later">第二次（较晚的 UTC 时刻）</option></select></label>
            <label>想从星盘聊聊什么？<span className="stellar-optional">选填</span><textarea rows={3} maxLength={300} value={question} onChange={event => setQuestion(event.target.value)} placeholder="例如：怎样表达爱，也照顾好自己的需要？" /></label>
            <p className="stellar-help">编辑档案不会覆盖旧星盘；每次绘制都会保存一份独立手记。地点与出生信息不会因绘制而上传。</p>
            <button type="submit" className="stellar-primary">{working ? <Loader2 className="stellar-spin" size={16} /> : <Sparkles size={16} />}绘制并保存星盘</button>
            <button type="button" className="stellar-secondary" onClick={() => save(false)}>仅保存出生档案</button>
          </fieldset>
        </form>
      </>}
      {view === 'archive' && <>
        <header className="stellar-heading"><span className="stellar-kicker">COLLECTED STARLIGHT</span><h2>把星光，好好收着</h2><p>出生档案可以改写，过去的天空仍留在手记里。</p></header>
        <div className="stellar-section-heading"><h3>出生档案</h3><button type="button" onClick={() => edit()} disabled={working}><Plus size={14} />新建</button></div>
        {!store.profiles.length && <p className="stellar-empty">还没有出生档案。写下第一份天空坐标吧。</p>}
        {store.profiles.map(profile => <article key={profile.id} className="stellar-archive-card"><button type="button" className="stellar-record-open" disabled={working} onClick={() => edit(profile)}><Orbit size={20} /><span><strong>{profile.name}</strong><small>{profile.date} · {profile.place.name}{!profile.timeKnown && ' · 午间参考'}{profile.creative && ' · 创作设定'}</small><small>编辑档案 / 绘制新盘</small></span><ChevronRight size={16} /></button>
          <button type="button" className="stellar-delete" disabled={working} aria-label={`删除出生档案 ${profile.name}`} onClick={() => setDeleteTarget({ kind: 'profile', id: profile.id })}><Trash2 size={15} /></button></article>)}
        <div className="stellar-section-heading"><h3>星空手记</h3><span>{store.records.length + store.studies.length} 则</span></div>
        {!store.records.length && !store.studies.length && <p className="stellar-empty">尚未绘制星盘。本地基础解读不需要 API。</p>}
        {[...store.records, ...store.studies].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(item => <article key={item.id} className="stellar-archive-card"><button type="button" className="stellar-record-open" disabled={working} onClick={() => open(item.id)}>{'chart' in item ? <Moon size={20} /> : item.kind === 'daily' ? <Sun size={20} /> : <Heart size={20} />}<span><strong>{astrologyRecordTitle(item)}</strong><small>{stamp(item.createdAt)}{'chart' in item && ` · 太阳${ZODIAC[signIndex(item.chart.planets[0].longitude)][0]}`}</small><small>{item.question}</small>{!!astrologyWarnings(item).length && <small>含创作或时间参考限制</small>}</span><ChevronRight size={16} /></button><button type="button" className="stellar-delete" disabled={working} aria-label={`删除星空手记 ${astrologyRecordTitle(item)}`} onClick={() => setDeleteTarget({ kind: 'record', id: item.id })}><Trash2 size={15} /></button></article>)}
        {deleteTarget && <section className="stellar-warning" role="alert"><p>{deleteTarget.kind === 'profile' ? '删除这份出生档案？已有手记与出生信息快照仍会保留。' : '删除这份星盘手记及其 AI 解读？此操作不能撤销，已转发的聊天卡片不会同步删除。'}</p><div className="stellar-actions"><button type="button" disabled={working} onClick={remove}>确认删除</button><button type="button" disabled={working} onClick={() => setDeleteTarget(null)}>保留</button></div></section>}
      </>}
      {view === 'result' && (record ? <>
        <header className="stellar-heading stellar-result-heading"><span className="stellar-kicker">{record.readingMode === 'question' ? 'ASK THE STARS' : 'A PORTRAIT OF YOUR SKY'}</span><h2>{record.profile.name}的<br /><em>{record.readingMode === 'question' ? '星空问答' : '星空来信'}</em></h2><p>{record.profile.date} · {record.profile.time}{record.chart.noonReference ? ' 当地午间参考' : ' 当地时间'}<br />{record.profile.place.name} · {record.profile.place.timeZone}</p><span className="stellar-method-badge">热带黄道 · 整宫制</span></header>
        {record.profile.creative && <p className="stellar-warning" role="note">角色创作设定，不是真实出生时间鉴定。{record.profile.creative.reason} 性格联想不能反推真实时间；后续比较盘和每日解读也沿用这套设定。</p>}
        {record.chart.noonReference && <p className="stellar-warning" role="note">{noonWarning}</p>}
        <NatalWheel chart={record.chart} />
        <div className="stellar-big-three">
          {[{ title: '太阳', icon: Sun, value: record.chart.planets[0].longitude, hint: '自我与表达' },
            { title: '月亮', icon: Moon, value: record.chart.planets[1].longitude, hint: '情绪与需要' },
            { title: '上升', icon: Star, value: record.chart.ascendant, hint: record.chart.noonReference ? '午间参考 · 不可靠' : '与世界相遇' }].map(item => <div key={item.title}><item.icon size={17} strokeWidth={1.3} /><small>{item.title}{record.chart.noonReference && ' · 参考'}</small><strong>{ZODIAC[signIndex(item.value)][0]}</strong><span>{item.hint}</span></div>)}
        </div>
        <section className="stellar-paper"><span className="stellar-kicker">A GENTLE START</span><h3>先从这三个角度认识自己</h3>
          {record.chart.planets.slice(0, 2).map((planet, index) => <p key={planet.id}><strong>{PLANETS[index].name} · {ZODIAC[signIndex(planet.longitude)][0]}</strong><br />{PLANETS[index].theme}，可以借「{ZODIAC[signIndex(planet.longitude)][3]}」这些关键词来思考。{planet.possibleSigns.length > 1 && `当天可能跨越${planet.possibleSigns.map(sign => ZODIAC[sign][0]).join(' / ')}，不要只认定午间星座。`}</p>)}
          <p><strong>上升 · {ZODIAC[signIndex(record.chart.ascendant)][0]}</strong><br />{record.chart.noonReference ? '这是午间的地平线位置，不能用来认定你的真实上升或性格。' : `可以从「${ZODIAC[signIndex(record.chart.ascendant)][3]}」的意象，观察自己如何开启一段关系或进入新环境。`}</p>
          <p className="stellar-help">这些是固定的象征性关键词，不是对你的科学测评。符合你的感受才值得留下，不符合也无需勉强。</p>
        </section>
        <section><div className="stellar-section-heading"><h3>十星体的位置</h3><span>{record.chart.noonReference ? '全部为午间参考' : '地心黄经'}</span></div>
          <div className="stellar-placements">{record.chart.planets.map((planet, index) => <article key={planet.id}><span className="stellar-planet-glyph">{PLANETS[index].glyph}</span><div><strong>{PLANETS[index].name}<small>{planet.retrograde && ' ℞'}</small></strong><p>{zodiacPosition(planet.longitude)} · 第 {planet.house} 宫{record.chart.noonReference && '（参考）'}</p><small>{PLANETS[index].theme}{record.chart.noonReference && ` · 当天采样星座：${planet.possibleSigns.map(sign => ZODIAC[sign][0]).join(' / ')}`}</small></div></article>)}</div>
        </section>
        <details className="stellar-details"><summary>宫位与天顶{record.chart.noonReference && ' · 仅参考'}</summary><p>上升 ASC：{zodiacPosition(record.chart.ascendant)}<br />天顶 MC：{zodiacPosition(record.chart.midheaven)}</p><p className="stellar-help">整宫制以「上升所在星座的 0°」作为第一宫起点。天顶单独标注，不强行等同第十宫宫头。{record.chart.noonReference && '这里的全部轴点与宫位都依赖未知的出生时间，不能作个人判断。'}</p>
          {record.chart.cusps.map((cusp, index) => <p key={index}>第 {index + 1} 宫 · {zodiacPosition(cusp)}<br /><small>{HOUSE_THEMES[index]}</small></p>)}</details>
        <details className="stellar-details"><summary>主要相位 · {record.chart.aspects.length} 组{record.chart.noonReference && '午间参考'}</summary>
          {record.chart.noonReference && <p className="stellar-warning">这里只列午间成立的相位。当天其他时刻可能新增或不再成立；采样角距不是精确上下界。</p>}
          {!record.chart.aspects.length && <p>此时刻没有落入以下容许度的主要相位，不代表这些星体没有联系。</p>}
          {record.chart.aspects.map(aspect => <article key={`${aspect.a}-${aspect.b}`}><strong>{planetName(aspect.a)} · {planetName(aspect.b)}　{ASPECTS.find(candidate => candidate.id === aspect.kind)?.name}</strong><p>容许度 {aspect.orb.toFixed(2)}°{aspect.dayRange && ` · 当天采样角距 ${aspect.dayRange.map(n => n.toFixed(2)).join('～')}°`}</p><small>{ASPECTS.find(candidate => candidate.id === aspect.kind)?.description}</small></article>)}
        </details>
        <details className="stellar-details"><summary>计算方式与参考资料</summary><p>Astronomy Engine 2.1.19（MIT）。采用日期真黄道的地心视位置、热带黄道与整宫制；不是恒星黄道或 Placidus。逆行由前后各 30 分钟黄经变化判断，驻留附近及未知出生时间时仅作参考。</p><p>经度东正西负。日期支持 1900～2100，时区依赖设备 Intl 历史数据。城市中心坐标是近似值。高纬地区上升变化快，极端退化位置会明确报错，不伪造结果。</p>
          <p>固定主要相位：{ASPECTS.map(aspect => `${aspect.name} ${aspect.angle}° ±${aspect.orb}°`).join('；')}。不计算星体纬度间相位。本页为出生盘；双人比较、每日行运和提问请从星空首页进入，不做命运预测。</p>
          {record.chart.noonReference && <p>当天范围：按当地日期每 30 分钟与 23:59 采样，包含重复时间的两次、不包含不存在的时钟时间；候选星座额外加 0.03° 边界缓冲。这不是精确极值，也不保证当天星座或相位不变。</p>}
          <p>计算时刻 UTC：{record.chart.utc}；当地 UTC 偏移 {record.chart.offsetMinutes} 分钟。</p><p>回归测试对照 NASA/JPL Horizons 在 2000-01-01 12:00 UTC 的太阳、月亮地心黄经（误差阈值 0.03°），并检验上升位于东方地平线。它验证的是天文计算，不验证占星解释。</p>
          <p><a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">Astronomy Engine</a> · <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">NASA/JPL Horizons</a> · <a href={`${import.meta.env.BASE_URL}astronomy-engine-license.txt`} target="_blank" rel="noreferrer">第三方许可</a></p></details>
        <button type="button" className="stellar-secondary" disabled={working || reading} onClick={() => edit(record.profile)}><Plus size={15} />沿用这份资料，另绘一张</button>
      </> : !selected && <p role="alert" className="stellar-alert">这份手记已被删除，请返回星空档案重新选择。</p>)}
      {view === 'result' && selected && 'kind' in selected && <AstrologyStudyResult study={selected} />}
      {view === 'result' && selected && <AstrologyReadingPanel key={selected.id} record={selected} people={people} reading={reading} working={working} onInterpret={interpret} onCancel={cancel} onShare={onShare} />}
      <footer className="stellar-footer"><Check size={12} />本地计算 · 主动解读或转发才分享资料<span>占星仅供娱乐与自我探索，不是科学预测，<br />不替代现实沟通、医疗或其他专业建议。</span></footer>
    </div>
  </div>;
}
