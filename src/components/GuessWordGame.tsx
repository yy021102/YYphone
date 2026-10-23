import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Send, Share2, Sparkles } from 'lucide-react';

export type GuessPerson = { id: string; name: string; kind: '角色' | 'NPC' | '玩家' };
export type GuessAiAction = 'choose' | 'describe' | 'guess';
export type GuessAiInput = { actor: GuessPerson; action: GuessAiAction; word?: string; clue?: string; history: GuessStep[]; multiplayer: boolean };
export type GuessAiOutput = { word?: string; text: string; guess?: string };
export type GuessStep = { actorId: string; actorName: string; kind: 'word' | 'clue' | 'guess'; text: string };
type Phase = 'choose' | 'describe' | 'guess' | 'done';
type Round = {
  id: string; players: GuessPerson[]; multiplayer: boolean; source: 'random' | 'custom';
  origin: string; currentWord: string; index: number; phase: Phase;
  steps: GuessStep[]; solved: boolean;
};
type Props = {
  people: GuessPerson[]; userName: string;
  onAi: (input: GuessAiInput) => Promise<GuessAiOutput>;
  onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void;
};
const WORDS = ['热气球','萤火虫','许愿池','旋转木马','草莓蛋糕','海底隧道','极光','纸飞机','橘子汽水','水晶球','月亮','行李箱','小熊猫','樱花','望远镜','唱片机','冰淇淋','星空','摩天轮','雨伞','灯塔','猫头鹰','图书馆','烟花','雪人','咖啡馆','蒲公英','蝴蝶结','日记本','潜水艇'];
const normalize = (text: string) => text.trim().replace(/[\s，。！？,.!?'“”‘’]/g, '').toLowerCase();
const cleanGuess = (text: string) => text.trim().replace(/^(我猜是|我觉得是|应该是|答案是|是)/, '').replace(/[。！？!?.]+$/, '').trim();
const normalizeGuess = (text: string) => normalize(cleanGuess(text));
const description = (step: GuessStep) => step.kind === 'word' ? '选词' : step.kind === 'clue' ? '描述' : '猜测';

export function GuessWordGame({ people, userName, onAi, onShare }: Props) {
  const [mode, setMode] = useState<'duo' | 'multi'>('duo');
  const [count, setCount] = useState(4);
  const [chosen, setChosen] = useState<string[]>(() => people.slice(0, 5).map(p => p.id));
  const [userSeat, setUserSeat] = useState(3);
  const [duoFirst, setDuoFirst] = useState<'user' | 'character'>('user');
  const [source, setSource] = useState<'random' | 'custom'>('random');
  const [round, setRound] = useState<Round | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedShare, setSelectedShare] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const requestKey = useRef('');
  const session = useRef(0);
  const needed = mode === 'duo' ? 1 : count - 1;
  const seats = Array.from({ length: needed }, (_, i) => chosen[i] ?? '');
  useEffect(() => {
    if (!round && chosen.length === 0 && people.length) setChosen(people.slice(0, 5).map(p => p.id));
  }, [people, round, chosen.length]);
  const valid = seats.every(Boolean) && new Set(seats).size === needed && seats.every(id => people.some(p => p.id === id));
  const personAt = (r: Round, phase: Phase) => phase === 'guess' ? r.players[r.index + 1] : r.players[r.index];
  const pushStep = (r: Round, actor: GuessPerson, kind: GuessStep['kind'], text: string) =>
    [...r.steps, { actorId: actor.id, actorName: actor.name, kind, text }];
  const afterGuess = (r: Round, actor: GuessPerson, guess: string): Round => {
    const steps = pushStep(r, actor, 'guess', guess);
    if (!r.multiplayer) {
      const solved = normalizeGuess(guess) === normalize(r.origin);
      return { ...r, steps, solved, phase: solved ? 'done' : 'describe' };
    }
    const last = r.index + 1 === r.players.length - 1;
    return { ...r, steps, currentWord: cleanGuess(guess), index: r.index + 1, phase: last ? 'done' : 'describe', solved: last && normalizeGuess(guess) === normalize(r.origin) };
  };
  const begin = () => {
    if (!valid) return;
    const others = seats.map(id => people.find(p => p.id === id)!);
    const user: GuessPerson = { id: 'user', name: userName, kind: '玩家' };
    const players = mode === 'duo'
      ? duoFirst === 'user' ? [user, others[0]] : [others[0], user]
      : [...others.slice(0, userSeat), user, ...others.slice(userSeat)];
    const word = source === 'random' ? WORDS[Math.floor(Math.random() * WORDS.length)] : '';
    const next: Round = { id: 'guess-'+crypto.randomUUID(), players, multiplayer: mode === 'multi', source, origin: word, currentWord: word, index: 0, phase: source === 'custom' ? 'choose' : 'describe', steps: [], solved: false };
    session.current++; requestKey.current = ''; setRound(next); setDraft(''); setError(''); setBusy(false); setShared(false);
    setSelectedShare(players.filter(p => p.id !== 'user').map(p => p.id));
  };
  useEffect(() => {
    if (!round || round.phase === 'done' || busy) return;
    const actor = personAt(round, round.phase);
    if (actor?.id === 'user') return;
    const key = round.id + ':' + round.phase + ':' + round.index + ':' + round.steps.length;
    if (requestKey.current === key) return;
    requestKey.current = key;
    const activeSession = session.current;
    setBusy(true); setError('');
    const lastClue = [...round.steps].reverse().find(step => step.kind === 'clue')?.text;
    const input: GuessAiInput = {
      actor, action: round.phase,
      word: round.phase === 'describe' ? round.currentWord : undefined,
      clue: round.phase === 'guess' ? lastClue : undefined,
      history: round.steps.slice(-14), multiplayer: round.multiplayer,
    };
    void onAi(input).then(answer => {
      if (activeSession !== session.current) return;
      if (round.phase === 'choose') {
        const word = (answer.word ?? answer.text).trim().slice(0, 30);
        if (!word) throw new Error('角色没有给出词语，请重试。');
        setRound({ ...round, origin: word, currentWord: word, phase: 'describe', steps: pushStep(round, actor, 'word', word) });
      } else if (round.phase === 'describe') {
        const text = answer.text.trim();
        if (!text) throw new Error('角色没有给出描述，请重试。');
        setRound({ ...round, phase: 'guess', steps: pushStep(round, actor, 'clue', text) });
      } else {
        const guess = (answer.guess ?? answer.text).trim().slice(0, 60);
        if (!guess) throw new Error('角色没有给出猜测，请重试。');
        setRound(afterGuess(round, actor, guess));
      }
    }).catch(cause => { if (activeSession === session.current) setError(cause instanceof Error ? cause.message : '角色暂时无法回应，请重试。'); })
      .finally(() => { if (activeSession === session.current) setBusy(false); });
  }, [round, busy, onAi]);
  const submit = () => {
    if (!round || busy) return;
    const text = draft.trim().slice(0, 500);
    if (!text) return;
    const actor = personAt(round, round.phase);
    if (actor.id !== 'user') return;
    if (round.phase === 'choose') setRound({ ...round, origin: text, currentWord: text, phase: 'describe', steps: pushStep(round, actor, 'word', text) });
    else if (round.phase === 'describe') setRound({ ...round, phase: 'guess', steps: pushStep(round, actor, 'clue', text) });
    else if (round.phase === 'guess') setRound(afterGuess(round, actor, text));
    setDraft('');
  };
  const detail = round ? [
    '猜词游戏 · ' + (round.multiplayer ? '多人传词' : '双人猜词'),
    '参与者与顺序：' + round.players.map((p, i) => (i + 1) + '.' + p.name).join(' → '),
    '原词：' + (round.origin || '未确定'),
    ...round.steps.map((step, i) => (i + 1) + '. ' + step.actorName + '【' + description(step) + '】' + step.text),
    round.phase === 'done' ? ('结果：' + (round.multiplayer ? '最终猜词：' + (round.steps.at(-1)?.text ?? '') + (round.solved ? '，传词成功。' : '，与原词不同。') : round.solved ? '猜中了。' : '未猜中，结束。')) : '结果：中途结束。',
  ].join('\n') : '';
  const closeRound = () => { if (round) { session.current++; setRound({ ...round, phase: 'done' }); } };
  const prompt = round?.phase === 'choose' ? '写一个词语，不要先透露给对方' : round?.phase === 'describe' ? '描述这个词，不要直接说出答案' : '根据上一条描述猜一个词';
  const currentActor = round && round.phase !== 'done' ? personAt(round, round.phase) : null;
  return <section className="min-h-full bg-gradient-to-b from-[#eff8fb] via-[#f7f5fb] to-[#fff5f0] px-4 py-5 text-[#4a6276]"><div className="mx-auto max-w-[430px] space-y-4">
    <div className="rounded-3xl border border-white/80 bg-gradient-to-r from-sky-100/90 to-pink-100/90 p-5 shadow-sm"><p className="text-[10px] font-bold tracking-[.15em] text-sky-600">微信游戏</p><h2 className="mt-1 text-2xl font-black">猜词 <Sparkles className="inline h-5 w-5 text-pink-400"/></h2><p className="mt-1 text-xs text-slate-500">把一个词交给想象力，看看它会变成什么</p></div>
    {!round && <div className="rounded-3xl bg-white/85 p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2"><button onClick={() => setMode('duo')} className={'rounded-xl px-3 py-2.5 text-sm font-bold ' + (mode === 'duo' ? 'bg-sky-200 text-sky-900' : 'bg-slate-100')}>两人互动</button><button onClick={() => setMode('multi')} className={'rounded-xl px-3 py-2.5 text-sm font-bold ' + (mode === 'multi' ? 'bg-sky-200 text-sky-900' : 'bg-slate-100')}>多人传词</button></div>
      {mode === 'multi' && <label className="mt-4 block text-xs">总人数（包含你）<select value={count} onChange={e => setCount(Number(e.target.value))} className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5">{[3,4,5,6].map(n => <option key={n} value={n}>{n} 人</option>)}</select></label>}
      <p className="mt-4 text-xs font-semibold">选择 {needed} 位角色或 NPC</p>
      {Array.from({ length: needed }, (_, i) => <select key={i} aria-label={'参与者 ' + (i + 1)} value={seats[i]} onChange={e => setChosen(old => Array.from({length:5}, (_, k) => k === i ? e.target.value : old[k] ?? ''))} className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm"><option value="">请选择</option>{people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.kind}</option>)}</select>)}
      {mode === 'duo' ? <label className="mt-4 block text-xs">谁先描述<select value={duoFirst} onChange={e => setDuoFirst(e.target.value as 'user' | 'character')} className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5"><option value="user">我先描述</option><option value="character">角色先描述</option></select></label>
        : <label className="mt-4 block text-xs">我的位置<select value={Math.min(userSeat, count-1)} onChange={e => setUserSeat(Number(e.target.value))} className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5">{Array.from({length:count}, (_, i) => <option key={i} value={i}>第 {i + 1} 位</option>)}</select></label>}
      <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setSource('random')} className={'rounded-xl px-3 py-2 text-xs font-semibold ' + (source === 'random' ? 'bg-pink-200' : 'bg-slate-100')}>随机抽词</button><button onClick={() => setSource('custom')} className={'rounded-xl px-3 py-2 text-xs font-semibold ' + (source === 'custom' ? 'bg-pink-200' : 'bg-slate-100')}>首位自己编词</button></div>
      {people.length < needed && <p className="mt-3 text-xs text-rose-500">参与者不足，请先在通讯录添加角色或 NPC。</p>}
      <button disabled={!valid} onClick={begin} className="mt-4 w-full rounded-xl bg-[#83b5cc] py-3 text-sm font-bold text-white disabled:opacity-40">开始猜词</button>
    </div>}
    {round && <><div className="rounded-2xl bg-white/80 p-3 shadow-sm"><p className="text-xs font-bold">传递顺序</p><div className="mt-2 flex flex-wrap gap-1.5">{round.players.map((p, i) => <span key={p.id} className={'rounded-full px-2.5 py-1 text-[11px] ' + (i === round.index || i === round.index + 1 && round.phase === 'guess' ? 'bg-sky-200 text-sky-900' : 'bg-slate-100')}>{i + 1}. {p.name}</span>)}</div></div>
      <div className="rounded-3xl bg-white/85 p-4 shadow-sm"><p className="text-xs font-bold text-sky-700">{round.phase === 'done' ? '本局结束' : currentActor?.name + ' · ' + (round.phase === 'choose' ? '选词' : round.phase === 'describe' ? '描述' : '猜词')}</p>
        {round.phase === 'describe' && currentActor?.id === 'user' && <p className="mt-2 rounded-xl bg-pink-50 p-2.5 text-sm">当前词语：<strong>{round.currentWord}</strong></p>}
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{round.steps.filter(step => step.kind !== 'word' || step.actorId === 'user' || round.phase === 'done').map((step, i) => <div key={i} className="rounded-xl bg-[#f5f8fb] p-2.5 text-xs"><span className="font-bold text-sky-700">{step.actorName} · {description(step)}</span><p className="mt-1 whitespace-pre-wrap text-slate-600">{step.text}</p></div>)}</div>
        {busy && <p className="mt-3 text-xs text-slate-400">{currentActor?.name}正在想…</p>}
        {error && <div className="mt-3"><p role="alert" className="text-xs text-rose-600">{error}</p><button onClick={() => { requestKey.current = ''; setError(''); setRound({ ...round }); }} className="mt-1 text-xs text-sky-700">重试这一步</button></div>}
        {round.phase !== 'done' && currentActor?.id === 'user' && <div className="mt-3"><p className="mb-1 text-xs text-slate-500">{prompt}</p><div className="flex gap-2"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} maxLength={500} className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none" placeholder={round.phase === 'choose' ? '输入词语' : round.phase === 'guess' ? '你猜是什么？' : '输入线索…'}/><button onClick={submit} disabled={!draft.trim()} className="rounded-xl bg-[#83b5cc] px-3 text-white disabled:opacity-40" aria-label="提交"><Send size={16}/></button></div></div>}
      </div>
      {round.phase !== 'done' && <button onClick={closeRound} className="flex items-center gap-1 text-xs text-slate-500"><RefreshCw size={13}/>结束并查看记录</button>}
      {round.phase === 'done' && <div className="rounded-3xl bg-white/90 p-4 shadow-sm"><p className="text-sm font-bold">完整记录</p><pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-slate-600">{detail}</pre><p className="mt-4 text-xs text-slate-500">分享给角色或 NPC</p><div className="mt-1 max-h-32 overflow-y-auto">{people.map(p => <label key={p.id} className="flex items-center gap-2 py-1.5 text-xs"><input type="checkbox" checked={selectedShare.includes(p.id)} onChange={e => setSelectedShare(old => e.target.checked ? [...old, p.id] : old.filter(id => id !== p.id))}/>{p.name}</label>)}</div><button disabled={!selectedShare.length || shared} onClick={() => { onShare({ id: round.id, title: '猜词游戏完整记录', detail }, selectedShare); setShared(true); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#83b5cc] py-3 text-sm font-bold text-white disabled:opacity-40"><Share2 size={15}/>{shared ? '已分享到聊天' : '分享完整记录'}</button><button onClick={() => { session.current++; setRound(null); setDraft(''); }} className="mt-3 w-full text-center text-xs text-slate-500">再玩一局</button></div>}
    </>}
  </div></section>;
}
