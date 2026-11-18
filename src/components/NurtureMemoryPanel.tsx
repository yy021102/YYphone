import { useState } from 'react';
import { memoryFor, relationshipStage } from '../utils/nurtureMemory';
import { STAT_LABELS, type Round, type Save, type Stats } from '../utils/nurture';

export function NurtureMemoryPanel({ save, actorName }: { save: Save; actorName: string }) {
  const [all, setAll] = useState(false);
  const memory = memoryFor(save), open = memory.threads.filter(t => t.status === 'open');
  const events = [...memory.events].reverse();
  return <section className="nurture-memory"><header><small>OUR CONTINUING STORY</small><h3>留在游戏里的时光</h3><p>已完成 {memory.completedRounds} 轮 · {relationshipStage(memory.completedRounds, save.stats).label}</p></header>
    {(memory.mood || memory.thoughts) && <div className="nurture-memory-note"><h4>{actorName}上次留下的心情</h4>{memory.mood && <span>{memory.mood}</span>}{memory.thoughts && <blockquote>{memory.thoughts}</blockquote>}</div>}
    <details className="nurture-memory-section" open={open.length > 0}><summary>还惦记着的事 · {open.length}</summary>{open.length ? open.map(t => <article key={t.id}><small>从第 {t.startedRound} 轮开始 · 第 {t.updatedRound} 轮更新</small><p>{t.text}</p></article>) : <p className="nurture-hint">暂时没有未完结事项。</p>}</details>
    <details className="nurture-memory-section" open><summary>特别的记忆 · {events.length}</summary>{events.length ? events.slice(0, all ? events.length : 12).map(e => <article key={e.id}><small>第 {e.round} 轮 · {new Date(e.createdAt).toLocaleDateString('zh-CN')}</small><h4>{e.title}</h4><p>{e.detail}</p></article>) : <p className="nurture-hint">完成第一轮后，故事会开始留下痕迹。</p>}{events.length > 12 && <button type="button" onClick={() => setAll(!all)}>{all ? '收起较早的记忆' : `查看全部 ${events.length} 条记忆`}</button>}</details>
  </section>;
}
export function NurtureRoundRecap({ round }: { round: Round }) {
  if (round.cursor < round.steps.length) return <p className="nurture-hint">本轮仍在进行，播放完成后归档。</p>;
  return <section className="nurture-round-recap"><h4>本轮回顾</h4>{round.openingThought && <><small>打开游戏时的心声</small><blockquote>{round.openingThought}</blockquote></>}{round.recap && <><p>{round.recap.summary}</p>{round.recap.mood && <small>角色心情 · {round.recap.mood}</small>}{round.recap.thoughts && <blockquote>{round.recap.thoughts}</blockquote>}</>}<div className="nurture-deltas">{(Object.keys(STAT_LABELS) as (keyof Stats)[]).map(k => <span key={k}>{STAT_LABELS[k]} {round.before[k]} → {round.after[k]}</span>)}</div></section>;
}
