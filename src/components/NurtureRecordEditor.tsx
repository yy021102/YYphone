import { useState } from 'react';
import type { Round } from '../utils/nurture';
import { draftRoundRecord } from '../utils/nurtureRecords';

export function RecordEditor({ values, labels, limits, onSave, onDelete }: { values: string[]; labels: string[]; limits?: number[]; onSave: (values: string[]) => void; onDelete?: () => void }) {
  const [editing, setEditing] = useState(false), [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(values);
  return <div className="nurture-record-controls">{editing ? <><div>{labels.map((label, i) => <label key={i}>{label}<textarea maxLength={limits?.[i] ?? 1500} value={draft[i]} onChange={e => setDraft(v => v.map((s, j) => j === i ? e.target.value : s))}/></label>)}</div><button type="button" onClick={() => { onSave(draft); setEditing(false); }}>保存修改</button><button type="button" onClick={() => setEditing(false)}>取消</button></> : <button type="button" onClick={() => { setDraft(values); setEditing(true); setConfirming(false); }}>编辑记录</button>}
    {onDelete && (confirming ? <><span>确认删除这条记录？</span><button type="button" onClick={onDelete}>确认删除</button><button type="button" onClick={() => setConfirming(false)}>取消</button></> : <button type="button" onClick={() => setConfirming(true)}>删除记录</button>)}
  </div>;
}
export function RoundRecordEditor({ round, onSave, onDelete }: { round: Round; onSave: (round: Round) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(() => draftRoundRecord(round));
  const [editing, setEditing] = useState(false), [confirming, setConfirming] = useState(false);
  return <div className="nurture-record-controls">{editing ? <>
    <p className="nurture-hint">修改供后续生成读取的记录文字，不重新结算数值、货币和物品。</p>
    <label>打开游戏时的心声<textarea maxLength={1500} value={draft.openingThought ?? ''} onChange={e => setDraft(d => ({ ...d, openingThought: e.target.value }))}/></label>
    {(['summary', 'mood', 'thoughts'] as const).map((key, i) => <label key={key}>{['本轮行动摘要', '本轮心情', '留存的想法'][i]}<textarea maxLength={key === 'summary' ? 12000 : key === 'mood' ? 200 : 1500} value={draft.recap![key]} onChange={e => setDraft(d => ({ ...d, recap: { ...d.recap!, [key]: e.target.value } }))}/></label>)}
    {draft.steps.map((step, index) => <details key={index}><summary>步骤 {index + 1} · {step.action}</summary>{(['action', 'thought', 'speech', 'resultThought', 'paymentThought', 'statusNote'] as const).filter(k => ['action', 'thought', 'speech'].includes(k) || step[k] !== undefined).map((key) => <label key={key}>{{ action: '操作', thought: '心理活动', speech: '我的发言', resultThought: '结果心声', paymentThought: '支付心声', statusNote: '状态留言' }[key]}<textarea maxLength={key === 'statusNote' ? 3000 : 1500} value={step[key] ?? ''} onChange={e => setDraft(d => ({ ...d, steps: d.steps.map((s, i) => i === index ? { ...s, [key]: e.target.value } : s) }))}/></label>)}</details>)}
    <button type="button" onClick={() => { onSave(draft); setEditing(false); }}>保存日志修改</button><button type="button" onClick={() => setEditing(false)}>取消</button>
  </> : <button type="button" onClick={() => { setDraft(draftRoundRecord(round)); setEditing(true); setConfirming(false); }}>编辑本轮日志</button>}
    {confirming ? <><p>删除本轮日志及关联的记忆和事项？已结算的物品、数值和总游玩轮数会保留。</p><button type="button" onClick={onDelete}>确认删除本轮</button><button type="button" onClick={() => setConfirming(false)}>取消</button></> : <button type="button" onClick={() => setConfirming(true)}>删除本轮日志</button>}
  </div>;
}
