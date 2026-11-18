import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Card } from '../utils/nurture';
import type { GameDesign } from '../utils/nurtureDesign';
import { generateCommonCards, mergeCommonCards } from '../utils/nurtureGacha';
import { NurtureCardArt } from './NurtureCardArt';

export function NurtureCommonCards({ design, cards, onAdd, onBusy }: { design: GameDesign; cards: Card[]; onAdd: (cards: Card[]) => void; onBusy: (busy: boolean) => void }) {
  const [count, setCount] = useState(10), [direction, setDirection] = useState('');
  const [drafts, setDrafts] = useState<Card[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  const generate = async () => {
    if (controller.current) return;
    const active = new AbortController(); controller.current = active; setBusy(true); onBusy(true); setError('');
    try { const next = await generateCommonCards(design, cards, count, direction, active.signal); active.signal.throwIfAborted(); setDrafts(next); }
    catch(e) { if (!active.signal.aborted) setError(e instanceof Error ? e.message : '普卡生成失败'); }
    finally { onBusy(false); controller.current = null; if (!active.signal.aborted) setBusy(false); }
  };
  return <details className="nurture-editor-fold"><summary>AI 批量设计普卡</summary><div><label>数量（3～30 张）<input disabled={busy} type="number" min={3} max={30} value={count} onChange={e => setCount(e.target.valueAsNumber)}/></label><label>卡面方向<textarea disabled={busy} maxLength={3000} value={direction} onChange={e => setDirection(e.target.value)} placeholder="例如：居家、读书、散步等平凡日常。"/></label><button className="nurture-add" type="button" disabled={busy} onClick={() => void generate()}><Sparkles size={16} className={busy ? 'animate-pulse' : undefined}/>{busy ? '正在设计普卡…' : '生成一批 R 普卡'}</button>
    {drafts.length > 0 && <><div className="nurture-card-grid">{drafts.map(c => <div className="nurture-card" key={c.id}><NurtureCardArt card={c}/></div>)}</div><p className="nurture-hint">先加入编辑中的卡池，可继续修改，再保存生效。新旧普卡均分现有普卡总权重；稀有卡权重保持原值。没有普卡时新建总权重 75 的普卡组。</p><button type="button" className="nurture-add" disabled={busy} onClick={() => { onAdd(mergeCommonCards(cards, drafts)); setDrafts([]); }}>将这 {drafts.length} 张普卡加入编辑中的卡池</button><button type="button" disabled={busy} onClick={() => setDrafts([])}>丢弃草稿</button></>}
    {error && <p className="nurture-error" role="alert">{error}</p>}</div></details>;
}
