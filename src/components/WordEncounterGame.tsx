import { useEffect, useRef, useState } from 'react';
import { Check, Heart, LockKeyhole, RefreshCw, Share2, Sparkles } from 'lucide-react';
import { cleanEncounterWord, encounterMatches, type EncounterAiInput, type EncounterResult } from '../utils/wordEncounter';

export function WordEncounterRecord({ result }: { result: EncounterResult }) {
  return <div className="encounter-record"><div className="encounter-record-head"><span>{result.userName}</span><Heart size={13}/><span>{result.actorName}</span></div>{result.rounds.map((round, i) => <div className={`encounter-record-row${encounterMatches(round.userWord, round.characterWord) ? ' is-match' : ''}`} key={i}><span>{round.userWord}</span><small>{String(i + 1).padStart(2, '0')}</small><span>{round.characterWord}</span></div>)}</div>;
}

export function WordEncounterGame({ people, userName, onAi, onShare }: { people: Array<{ id: string; name: string }>; userName: string; onAi: (input: EncounterAiInput) => Promise<string>; onShare: (result: EncounterResult) => Promise<void> | void }) {
  const [chosen, setChosen] = useState(people[0]?.id ?? '');
  const [game, setGame] = useState<EncounterResult | null>(null), [phase, setPhase] = useState<'write' | 'reveal' | 'done'>('write');
  const [draft, setDraft] = useState(''), [secret, setSecret] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [shared, setShared] = useState(false), [sharing, setSharing] = useState(false);
  const request = useRef<AbortController | null>(null), shareBusy = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const actorExists = !game || people.some(p => p.id === game.actorId);
  useEffect(() => { if (!actorExists) { request.current?.abort(); setBusy(false); setSecret(''); setError('这位角色已不在通讯录中，请重新选择。'); } }, [actorExists]);
  const ask = async (session: EncounterResult) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setSecret('');
    try {
      const word = cleanEncounterWord(await onAi({ actorId: session.actorId, history: session.rounds.map(round => ({ ...round })), signal: controller.signal }));
      if (request.current === controller && !controller.signal.aborted) setSecret(word);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '角色还没写好，请重试。'); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  const begin = () => {
    if (request.current) return;
    const actor = people.find(p => p.id === chosen); if (!actor) return;
    const next: EncounterResult = { id: `word-encounter-${crypto.randomUUID()}`, actorId: actor.id, actorName: actor.name, userName, rounds: [], matched: false };
    setGame(next); setDraft(''); setShared(false); setPhase('write'); void ask(next);
  };
  const reveal = () => {
    if (!game || busy || !secret || !actorExists) return;
    try {
      const userWord = cleanEncounterWord(draft), characterWord = cleanEncounterWord(secret);
      const matched = encounterMatches(userWord, characterWord);
      setGame({ ...game, rounds: [...game.rounds, { userWord, characterWord }], matched });
      setPhase(matched ? 'done' : 'reveal'); setSecret(''); setDraft(''); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '请写下一个词语。'); }
  };
  const reset = () => { request.current?.abort(); request.current = null; setGame(null); setSecret(''); setDraft(''); setBusy(false); setError(''); setShared(false); };
  const finish = () => { request.current?.abort(); request.current = null; setSecret(''); setDraft(''); setBusy(false); setError(''); setPhase('done'); };
  const share = async () => {
    if (!game || !game.rounds.length || shared || shareBusy.current || !actorExists) return;
    shareBusy.current = true; setSharing(true); setError('');
    try { await onShare({ ...game, rounds: game.rounds.map(round => ({ ...round })) }); setShared(true); }
    catch (e) { setError(e instanceof Error ? e.message : '转发失败，请重试。'); }
    finally { shareBusy.current = false; setSharing(false); }
  };
  return <section className="word-encounter" aria-label="同词相遇">
    <header className="encounter-title"><div className="encounter-symbol" aria-hidden="true"><i/><i/><Heart size={19}/></div><small>在两个词之间，找到我们</small><h2>同词相遇</h2><p>{!game ? '各写一词，看看思绪会在哪里碰面。' : phase === 'done' ? game.matched ? `第 ${game.rounds.length} 轮，我们想到一起了。` : '这一段联想，也有它的模样。' : `与 ${game.actorName} 的第 ${game.rounds.length + (phase === 'write' ? 1 : 0)} 轮`}</p></header>
    {!game ? <div className="encounter-paper"><label>和谁一起<select aria-label="同词相遇角色" value={people.some(p => p.id === chosen) ? chosen : ''} onChange={e => setChosen(e.target.value)}><option value="">选择角色</option>{people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><div className="encounter-rules"><p><b>01</b>各自写下一个词，揭晓前保密。</p><p><b>02</b>不同，就从上一轮两个词继续联想。</p><p><b>03</b>写出同一个词，就相遇了。</p></div><button type="button" className="encounter-primary" onClick={begin} disabled={!people.some(p => p.id === chosen)}>开始相遇</button>{!people.length && <p className="encounter-muted">先在通讯录里添加一位角色吧。</p>}</div> : <>
      {phase === 'write' && <div className="encounter-paper">
        {!!game.rounds.length && <div className="encounter-previous"><small>从上一轮出发</small><div><span>{game.rounds.at(-1)!.userWord}</span><i>＋</i><span>{game.rounds.at(-1)!.characterWord}</span></div></div>}
        <div className="encounter-secret"><LockKeyhole size={15}/><span>{busy ? `${game.actorName} 正在写词…` : secret ? `${game.actorName} 已封存答案` : '等对方写好，再一起揭晓'}</span>{!!secret && <Check size={14}/>}</div>
        <form onSubmit={e => { e.preventDefault(); reveal(); }}><label>你的词语<input aria-label="你的联想词" autoComplete="off" maxLength={40} placeholder={game.rounds.length ? '想到两者的什么交集？' : '自由写下此刻想到的一个词'} value={draft} onChange={e => setDraft(e.target.value)}/></label><button type="submit" className="encounter-primary" disabled={busy || !secret || !draft.trim() || !actorExists}><Sparkles size={15}/>一起揭晓</button></form>
        {error && !secret && actorExists && !busy && <button type="button" className="encounter-secondary" onClick={() => void ask(game)}><RefreshCw size={13}/>请对方重新写词</button>}
      </div>}
      {phase === 'reveal' && <div className="encounter-paper"><div className="encounter-reveal-pair"><div><small>{game.userName}</small><strong>{game.rounds.at(-1)!.userWord}</strong></div><span>＋</span><div><small>{game.actorName}</small><strong>{game.rounds.at(-1)!.characterWord}</strong></div></div><p className="encounter-muted">还差一点，从这两个词继续想。</p><button type="button" className="encounter-primary" disabled={!actorExists} onClick={() => { setPhase('write'); setError(''); void ask(game); }}>继续联想</button></div>}
      {phase === 'done' && <div className="encounter-paper"><div className={`encounter-result${game.matched ? ' is-match' : ''}`}><Heart size={20}/><small>{game.matched ? '我们相遇在' : '本局结束'}</small>{game.matched && <strong>{game.rounds.at(-1)!.userWord}</strong>}</div><WordEncounterRecord result={game}/><button type="button" className="encounter-primary" disabled={shared || sharing || !actorExists} onClick={() => void share()}><Share2 size={14}/>{shared ? '已转发' : sharing ? '正在转发…' : `转发给 ${game.actorName}`}</button><button type="button" className="encounter-secondary" disabled={sharing} onClick={reset}><RefreshCw size={13}/>再玩一局</button></div>}
      {phase !== 'done' && !!game.rounds.length && <details className="encounter-paper encounter-history"><summary>我们的联想路线 <span>{game.rounds.length} 轮</span></summary><WordEncounterRecord result={game}/></details>}
      {phase !== 'done' && <button type="button" className="encounter-exit" onClick={() => { if (!game.rounds.length) reset(); else finish(); }}>{game.rounds.length ? '结束本局，查看路线' : '重新选择角色'}</button>}
    </>}
    {error && <p role="alert" className="encounter-error">{error}</p>}
  </section>;
}
