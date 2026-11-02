import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { characterProfileFromProposal, parseCharacterBirthReply } from '../utils/astrologyCharacters';
import type { BirthProfile, CharacterBirthInput } from '../utils/astrology';

export default function CharacterBirthDraft({ people, profileId, initialActorId, onRequest, onDraft, onBusyChange, disabled }: {
  people: { id: string; name: string }[]; profileId: string;
  onRequest: (input: CharacterBirthInput) => Promise<string>; onDraft: (profile: BirthProfile) => void;
  onBusyChange: (busy: boolean) => void; disabled: boolean;
  initialActorId?: string;
}) {
  const [actorId, setActorId] = useState(initialActorId ?? people[0]?.id ?? '');
  const [requirements, setRequirements] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; onBusyChange(false); }, []);
  const cancel = () => { controller.current?.abort(); controller.current = null; setBusy(false); onBusyChange(false); };
  const generate = async () => {
    if (controller.current) return;
    const actor = people.find(person => person.id === actorId);
    if (!actor) { setError('请先选择仍在通讯录中的角色。'); return; }
    const active = new AbortController(); controller.current = active; setBusy(true); onBusyChange(true); setError('');
    try {
      const text = await onRequest({ kind: 'birth-draft', actorId, requirements, signal: active.signal });
      active.signal.throwIfAborted();
      const proposal = parseCharacterBirthReply(text);
      const profile = characterProfileFromProposal(proposal, actor, profileId);
      active.signal.throwIfAborted();
      onDraft(profile);
    } catch (caught) {
      if (!active.signal.aborted) setError(caught instanceof Error ? caught.message : '角色草稿生成失败，请手动重试。');
    } finally { if (controller.current === active) { controller.current = null; setBusy(false); onBusyChange(false); } }
  };
  return <section className="stellar-paper stellar-character-draft">
    <span className="stellar-kicker">LET THEM WRITE THEIR SKY</span><h3>让角色填写 TA 的星空</h3>
    <p className="stellar-help">会将角色人设、相关玩家与世界书设定、填写需求发送到你配置的 API，不附带聊天历史。优先沿用明确生日、时间；缺失信息可按角色补设。缺时间时，AI 建议上升星座，程序再寻找相容的时间，补设字段会留在档案中供你核对。</p>
    <label>填写角色<select value={actorId} disabled={busy} onChange={event => { cancel(); setActorId(event.target.value); }}><option value="">请选择角色</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <label>补充要求<textarea rows={2} maxLength={500} disabled={busy} value={requirements} onChange={event => setRequirements(event.target.value)} placeholder="例如：沿用设定中的生日，时间按外冷内热的创作印象来。" /></label>
    {error && <p className="stellar-alert" role="alert">{error}</p>}
    <button type="button" className="stellar-secondary" disabled={busy || disabled || !actorId} onClick={() => void generate()}>{busy ? <Loader2 size={15} className="stellar-spin" /> : <Sparkles size={15} />}{busy ? '正在填写草稿…' : '按人设填写草稿 · 1 次 AI'}</button>
    {busy && <button type="button" className="stellar-secondary" onClick={cancel}>取消填写</button>}
    <p className="stellar-help">生成后不会自动保存。请核对下方生日、城市、创作理由与时间，修改满意后再确认。</p>
  </section>;
}
