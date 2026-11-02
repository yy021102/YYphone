import { useRef, useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import type { AstrologyRecord } from '../utils/astrology';
import type { DivinationReader } from '../utils/divination';

export default function AstrologyReadingPanel({ record, people, reading, working, onInterpret, onCancel, onShare }: {
  record: AstrologyRecord; people: { id: string; name: string }[]; reading: boolean; working: boolean;
  onInterpret: (record: AstrologyRecord, reader: DivinationReader) => Promise<void>;
  onCancel: () => void; onShare: (record: AstrologyRecord, recipients: string[]) => void | Promise<void>;
}) {
  const [readerId, setReaderId] = useState('oracle'), [recipients, setRecipients] = useState<string[]>([]);
  const [consent, setConsent] = useState(false), [sharing, setSharing] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const shareLock = useRef(false);
  const disabled = reading || working || sharing;
  return <>
    <section className="stellar-paper"><span className="stellar-kicker">A LITTLE CONVERSATION</span><h3>{record.readingMode === 'question' ? '把问题，轻轻说给星空' : '让星图，成为一封信'}</h3>
      <p>{record.question}</p><p className="stellar-help">可选解读，每次由你手动请求 1 次 AI。会将本手记中完整出生资料、星盘或行运与问题发送到你配置的 API。比较盘包含双方资料；角色模式还使用其人设、聊天与本地记忆，不执行聊天动作。</p>
      <label className="stellar-reader">由谁读这片天空<select value={readerId} disabled={disabled} onChange={event => setReaderId(event.target.value)}><option value="oracle">AI 占星师</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <button type="button" className="stellar-primary" disabled={disabled} onClick={() => {
        setError(''); setNotice('');
        const person = people.find(person => person.id === readerId);
        if (readerId !== 'oracle' && !person) { setError('请重新选择仍在通讯录中的解读角色。'); return; }
        void onInterpret(record, person ? { mode: 'character', actorId: person.id, actorName: person.name } : { mode: 'oracle' });
      }}>{reading ? <Loader2 size={16} className="stellar-spin" /> : <Sparkles size={16} />}{reading ? '星空来信正在写下…' : '邀请解读 · 1 次 AI'}</button>
      {reading && <button type="button" className="stellar-secondary" onClick={onCancel}>取消本次解读</button>}
      {record.interpretations.map(attempt => <article className="stellar-reading" key={attempt.id}><div><strong>{attempt.reader.mode === 'oracle' ? 'AI 占星师' : attempt.reader.actorName}</strong><small>{new Date(attempt.createdAt).toLocaleDateString('zh-CN')}</small></div>
        {attempt.status === 'done' ? <p>{attempt.text}</p> : attempt.status === 'pending' ? <p role="status">正在解读，离开本页会取消请求。</p> : <p className="stellar-reading-error">{attempt.error}</p>}</article>)}
    </section>
    <section className="stellar-paper"><span className="stellar-kicker">SHARE A PIECE OF YOUR SKY</span><h3>把这封信，递给 TA</h3>
      <p className="stellar-help">转发完整出生资料、星盘或行运、问题和已完成解读，比较盘包含两人的资料。原档案修改或删除不会撤回已发卡片；再次转发同一份手记会更新原卡片。</p>
      {!people.length && <p className="stellar-empty">通讯录里还没有可转发的角色。</p>}
      <div className="stellar-share-people">{people.map(person => <label key={person.id} className="stellar-checkbox"><input type="checkbox" disabled={disabled} checked={recipients.includes(person.id)} onChange={event => setRecipients(current => event.target.checked ? [...current, person.id] : current.filter(id => id !== person.id))} /><span>{person.name}</span></label>)}</div>
      <label className="stellar-checkbox"><input type="checkbox" disabled={disabled} checked={consent} onChange={event => setConsent(event.target.checked)} /><span>我同意将这份完整出生资料转发给所选角色</span></label>
      <button type="button" className="stellar-secondary" disabled={!consent || !recipients.length || disabled} onClick={async () => {
        if (shareLock.current) return;
        shareLock.current = true; setSharing(true); setError(''); setNotice('');
        try { await onShare(record, recipients); setNotice('星空来信已转发，可以在聊天中打开完整手记。'); }
        catch (caught) { setError(caught instanceof Error ? caught.message : '转发保存失败，请重试。'); }
        finally { shareLock.current = false; setSharing(false); }
      }}><Send size={15} />转发星盘手记</button>
      {notice && <p className="stellar-notice" role="status">{notice}</p>}
    </section>
    {error && <p className="stellar-alert" role="alert">{error}</p>}
  </>;
}
