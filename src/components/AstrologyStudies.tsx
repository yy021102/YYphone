import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  ASPECTS, PLANETS, astrologyRecordTitle, astrologyWarnings, createDaily, createNatalRecord, createSynastry,
  localCalendarDate, normalizeAngle, planetName, zodiacPosition,
  type AstrologyRecord, type AstrologyStudy, type BirthProfile,
} from '../utils/astrology';
import NatalWheel from './NatalWheel';

export type AstrologyStudyMode = 'synastry' | 'daily' | 'question';
export function AstrologyStudyBuilder({ mode, profiles, onCreate }: {
  mode: AstrologyStudyMode; profiles: BirthProfile[]; onCreate: (record: AstrologyRecord) => Promise<void>;
}) {
  const [firstId, setFirstId] = useState(profiles[0]?.id ?? '');
  const [secondId, setSecondId] = useState(profiles[1]?.id ?? '');
  const [target, setTarget] = useState<'natal' | 'synastry'>('natal');
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai');
  const [day, setDay] = useState(() => localCalendarDate(new Date(), timeZone));
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const first = profiles.find(profile => profile.id === firstId);
  const second = profiles.find(profile => profile.id === secondId);
  const comparison = mode === 'synastry' || mode === 'question' && target === 'synastry';
  return <>
    <header className="stellar-heading"><span className="stellar-kicker">{mode === 'daily' ? 'A SKY FOR TODAY' : mode === 'question' ? 'ASK THE STARS, KEEP YOUR CHOICE' : 'TWO SKIES, ONE CONVERSATION'}</span>
      <h2>{mode === 'daily' ? '今天，想怎样照顾自己？' : mode === 'question' ? '给心事一个新的角度' : '让两片星空，相遇'}</h2>
      <p>{mode === 'daily' ? '以所选日期、时区的中午行运，和出生盘作比较；不是全天吉凶预测。' : mode === 'question' ? '选择一份出生盘或两人的比较盘，问一个开放的问题。' : '支持你与角色，也支持两位角色。比较盘讨论互动，不给关系打命定分数。'}</p></header>
    {!profiles.length && <p className="stellar-warning">请先返回，保存至少一份出生档案。双人比较需要两份不同档案。</p>}
    <form className="stellar-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setError('');
      if (!first) { setError('请选择一份仍存在的出生档案。'); return; }
      if (comparison && !second) { setError('请选择第二份出生档案。'); return; }
      if (mode === 'question' && !question.trim()) { setError('请先写下想聊的问题。'); return; }
      setBusy(true);
      try {
        const record = comparison && second ? createSynastry(first, second, question) :
          mode === 'daily' ? createDaily(first, day, timeZone.trim(), question) : createNatalRecord(first, question);
        if (mode === 'question') record.readingMode = 'question';
        await onCreate(record);
      } catch (caught) { setError(caught instanceof Error ? caught.message : '计算或保存失败，请重试。'); }
      finally { setBusy(false); }
    }}><fieldset disabled={busy}>
      {mode === 'question' && <label>提问对象<select value={target} onChange={event => setTarget(event.target.value === 'synastry' ? 'synastry' : 'natal')}><option value="natal">一人的出生星盘</option><option value="synastry">两人的比较盘</option></select></label>}
      <label>{comparison ? 'A 的出生档案' : '出生档案'}<select required value={firstId} onChange={event => setFirstId(event.target.value)}><option value="">请选择</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}{profile.actorId ? ' · 角色' : ''}{profile.creative ? ' · 创作设定' : !profile.timeKnown ? ' · 午间参考' : ''}</option>)}</select></label>
      {comparison && <label>B 的出生档案<select required value={secondId} onChange={event => setSecondId(event.target.value)}><option value="">请选择</option>{profiles.map(profile => <option key={profile.id} value={profile.id} disabled={profile.id === firstId}>{profile.name}{profile.actorId ? ' · 角色' : ''}{profile.creative ? ' · 创作设定' : !profile.timeKnown ? ' · 午间参考' : ''}</option>)}</select></label>}
      {mode === 'daily' && <>
        <label>行运日期<input type="date" min="1900-01-01" max="2100-12-31" required value={day} onChange={event => setDay(event.target.value)} /></label>
        <label>当天采用的 IANA 时区<input required maxLength={100} value={timeZone} onChange={event => setTimeZone(event.target.value)} /></label>
        <p className="stellar-help">默认日期与时区来自设备；若改了时区，请核对日期。取当地 12:00 的真实天文位置作为单时刻参考，不宣称覆盖整天。</p>
      </>}
      <label>想聊的问题{mode !== 'question' && '（选填）'}<textarea rows={3} maxLength={300} required={mode === 'question'} value={question} onChange={event => setQuestion(event.target.value)}
        placeholder={comparison ? '例如：我们怎样表达需要、减少误会？' : mode === 'daily' ? '例如：今天如何温柔地安排节奏？' : '例如：怎样更自在地表达喜欢？'} /></label>
      {error && <p className="stellar-alert" role="alert">{error}</p>}
      <p className="stellar-help">这一步仅在本地计算、保存，不请求 AI。结果页可手动邀请 AI 占星师或角色解读，也能转发完整手记。出生时间与创作补全的限制会一并保留。</p>
      <button type="submit" className="stellar-primary" disabled={!profiles.length}>{busy ? <Loader2 className="stellar-spin" size={16} /> : <ArrowRight size={16} />}计算并保存{mode === 'daily' ? '每日星空' : mode === 'question' ? '提问手记' : '双人比较盘'}</button>
    </fieldset></form>
  </>;
}
export function AstrologyStudyResult({ study }: { study: AstrologyStudy }) {
  const first = study.first, second = study.kind === 'synastry' ? study.second : undefined;
  const names = [first.profile.name, second?.profile.name ?? '行运'];
  return <>
    <header className="stellar-heading stellar-result-heading"><span className="stellar-kicker">{study.kind === 'daily' ? 'DAILY SKY LETTER' : 'WHEN TWO SKIES MEET'}</span>
      <h2>{astrologyRecordTitle(study)}</h2><p>{study.kind === 'daily' ? `${study.day} · ${study.timeZone} 12:00 行运快照` : '双人比较盘 · 热带黄道 · 整宫制'}</p></header>
    {astrologyWarnings(study).map((warning, index) => <p role="note" key={index} className="stellar-warning">{warning}</p>)}
    {second ? <>
      <NatalWheel chart={first.chart} comparison={{ chart: second.chart, aspects: study.aspects }} />
      <p className="stellar-help">内圈 A：{names[0]}；外圈 B：{names[1]}。以 A 的上升与宫位为基准，外圈是 B 的星体黄经，不是 B 的宫头。轮盘只画容许度最小的 12 组跨盘相位，下方列全。</p>
      <section className="stellar-paper"><h3>不是「合不合」，而是如何相处</h3><p>先观察双方太阳、月亮、金星与水星的需求，再把跨盘相位当作讨论题。紧张相位不等于坏关系，和谐相位也不等于不需要沟通。</p></section>
      <details className="stellar-details"><summary>两人的星体与双向落宫</summary>
        {[first, second].map((record, person) => <article key={person}><strong>{person ? 'B' : 'A'} · {record.profile.name}</strong>
          {record.chart.planets.map(planet => <p key={planet.id}>{planetName(planet.id)} · {zodiacPosition(planet.longitude)} · 落{person ? 'A' : 'B'}第 {Math.floor(normalizeAngle(planet.longitude - (person ? first : second).chart.cusps[0]) / 30) + 1} 宫</p>)}</article>)}
        <p>双方出生资料：A {first.profile.date} {first.profile.time}，{first.profile.place.name}，{first.profile.place.timeZone}；B {second.profile.date} {second.profile.time}，{second.profile.place.name}，{second.profile.place.timeZone}。未知时间的落宫均仅参考。</p>
      </details>
    </> : study.kind === 'daily' && <>
      <section className="stellar-paper"><span className="stellar-kicker">TODAY, GENTLY</span><h3>把今天，过成自己的节奏</h3><p>以下是当天中午真实行运与本命星体的角度联系。它们不预言发生什么；可邀请解读者写下情绪照顾、沟通与小行动建议。</p><p className="stellar-help">UTC {study.utc} · 未做全天采样。每日运势是象征性解读，不是事件预测。</p></section>
      <details className="stellar-details"><summary>当天十星体的位置</summary>{study.transits.map((planet, index) => <p key={planet.id}>{PLANETS[index].glyph} {PLANETS[index].name} · {zodiacPosition(planet.longitude)}{planet.retrograde && ' ℞'}</p>)}</details>
    </>}
    <details className="stellar-details"><summary>{study.kind === 'daily' ? '本命 × 行运' : 'A × B 跨盘'}主要相位 · {study.aspects.length} 组</summary>
      {!study.aspects.length && <p>该时刻没有落入既定容许度的主要跨盘相位，不代表没有联系。</p>}
      {study.aspects.map(aspect => <article key={`${aspect.a}-${aspect.b}`}><strong>{names[0]}的{planetName(aspect.a)} · {names[1]}的{planetName(aspect.b)} {ASPECTS.find(candidate => candidate.id === aspect.kind)?.name}</strong><p>角距 {aspect.separation.toFixed(2)}° · 容许度 {aspect.orb.toFixed(2)}°</p><small>{ASPECTS.find(candidate => candidate.id === aspect.kind)?.description}</small></article>)}
    </details>
    <details className="stellar-details"><summary>算法与资料说明</summary><p>地心日期真黄道、热带黄道；出生盘使用整宫制。跨盘相位为两组十星体的全部 100 对组合（包含同名星体），不是只比较同名星体或各自本命相位。</p><p>{ASPECTS.map(aspect => `${aspect.name}${aspect.angle}° ±${aspect.orb}°`).join('；')}。不做配对评分、组合中点盘或命运判断。</p><p>所用出生资料是生成此手记时的独立快照，之后修改或删除档案不会改写这里。</p></details>
  </>;
}
