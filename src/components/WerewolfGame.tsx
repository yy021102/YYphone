import { useEffect, useRef, useState } from 'react';
import { Moon, RotateCcw, Send, Share2, Shield, Sun } from 'lucide-react';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

export type WolfPerson = { id: string; name: string; kind: '角色' | 'NPC' | '玩家'; persona?: string };
export type WolfRole = 'wolf' | 'seer' | 'witch' | 'guard' | 'villager';
export type WolfSpeech = { id: string; text: string; vote?: string };
type Phase = 'night' | 'day' | 'vote' | 'ended';
type Game = {
  id: string;
  people: WolfPerson[];
  roles: Record<string, WolfRole>;
  alive: string[];
  day: number;
  phase: Phase;
  winner: 'wolf' | 'good' | null;
  threat: string;
  guardLast: string;
  healUsed: boolean;
  poisonUsed: boolean;
  known: Record<string, WolfRole>;
  discussionStarted: boolean;
  userSpeech: string;
  speeches: WolfSpeech[];
  announcement: string;
  history: string[];
};
type StoredSession = {
  version: 1;
  count: number;
  chosen: string[];
  roleChoice: WolfRole | 'random';
  game: Game | null;
  nightChoice: string;
  witchChoice: 'none' | 'heal' | 'poison';
  speechDraft: string;
  voteChoice: string;
  selectedShare: string[];
  shared: boolean;
};
type SpeakInput = {
  actor: WolfPerson;
  people: WolfPerson[];
  roles: Record<string, WolfRole>;
  alive: string[];
  day: number;
  announcement: string;
  userSpeech: string;
  history: string[];
  known: Record<string, WolfRole>;
  previousSpeeches: WolfSpeech[];
};
type Props = {
  people: WolfPerson[];
  userName: string;
  onSpeak: (input: SpeakInput) => Promise<WolfSpeech>;
  onShare: (result: { id: string; detail: string }, recipients: string[]) => void;
};

const STORAGE_KEY = 'yyphone:werewolf-session:v1';
const roleName: Record<WolfRole, string> = {
  wolf: '狼人', seer: '预言家', witch: '女巫', guard: '守卫', villager: '村民',
};
const roles: WolfRole[] = ['wolf', 'seer', 'witch', 'guard', 'villager'];
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const isRole = (value: unknown): value is WolfRole => roles.includes(value as WolfRole);
const isGame = (value: unknown): value is Game => {
  if (!isRecord(value) || !Array.isArray(value.people) || !isRecord(value.roles)) return false;
  const storedPeople = value.people;
  const storedRoles = value.roles;
  return typeof value.id === 'string' &&
    storedPeople.every(person => isRecord(person) && typeof person.id === 'string' && typeof person.name === 'string' && isRole(storedRoles[person.id])) &&
    Object.values(storedRoles).every(isRole) && isStringArray(value.alive) &&
    value.alive.every(id => storedPeople.some(person => isRecord(person) && person.id === id)) &&
    typeof value.day === 'number' && ['night', 'day', 'vote', 'ended'].includes(value.phase as string) &&
    (value.winner === null || value.winner === 'wolf' || value.winner === 'good') &&
    typeof value.threat === 'string' && typeof value.guardLast === 'string' &&
    typeof value.healUsed === 'boolean' && typeof value.poisonUsed === 'boolean' &&
    isRecord(value.known) && Object.values(value.known).every(isRole) &&
    typeof value.discussionStarted === 'boolean' && typeof value.userSpeech === 'string' &&
    Array.isArray(value.speeches) && value.speeches.every(speech =>
      isRecord(speech) && typeof speech.id === 'string' && typeof speech.text === 'string' &&
      (speech.vote === undefined || typeof speech.vote === 'string')) &&
    typeof value.announcement === 'string' && isStringArray(value.history);
};
const isStoredSession = (value: unknown): value is StoredSession => isRecord(value) &&
  value.version === 1 && typeof value.count === 'number' && isStringArray(value.chosen) &&
  (value.roleChoice === 'random' || isRole(value.roleChoice)) &&
  (value.game === null || isGame(value.game)) && typeof value.nightChoice === 'string' &&
  ['none', 'heal', 'poison'].includes(value.witchChoice as string) &&
  typeof value.speechDraft === 'string' && typeof value.voteChoice === 'string' &&
  isStringArray(value.selectedShare) && typeof value.shared === 'boolean';
const initialSession = (people: WolfPerson[]): StoredSession => ({
  version: 1, count: 6, chosen: people.slice(0, 7).map(person => person.id),
  roleChoice: 'random', game: null, nightChoice: '', witchChoice: 'none',
  speechDraft: '', voteChoice: '', selectedShare: [], shared: false,
});
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
};
const resultOf = (alive: string[], assigned: Record<string, WolfRole>): Game['winner'] => {
  const wolves = alive.filter(id => assigned[id] === 'wolf').length;
  return wolves === 0 ? 'good' : wolves >= alive.length - wolves ? 'wolf' : null;
};
const wolfVictim = (alive: string[], assigned: Record<string, WolfRole>) => {
  const candidates = alive.filter(id => assigned[id] !== 'wolf');
  return candidates.length ? pick(candidates) : '';
};
const nameOf = (game: Game, id: string) => game.people.find(person => person.id === id)?.name ?? '未知';
const completeHistory = (game: Game) => [
  `狼人杀 · ${game.people.length} 人局`,
  `参与者：${game.people.map(person => person.name).join('、')}`,
  `胜利阵营：${game.winner === 'wolf' ? '狼人' : '好人'}`,
  `身份：${game.people.map(person => `${person.name}—${roleName[game.roles[person.id]]}`).join('；')}`,
  ...game.history,
].join('\n');

export function WerewolfGame({ people, userName, onSpeak, onShare }: Props) {
  const [saved] = useState(() => readStoredValue(STORAGE_KEY, initialSession(people), isStoredSession));
  const [count, setCount] = useState(saved.count);
  const [chosen, setChosen] = useState(saved.chosen);
  const [roleChoice, setRoleChoice] = useState(saved.roleChoice);
  const [game, setGame] = useState<Game | null>(saved.game);
  const [nightChoice, setNightChoice] = useState(saved.nightChoice);
  const [witchChoice, setWitchChoice] = useState(saved.witchChoice);
  const [speechDraft, setSpeechDraft] = useState(saved.speechDraft);
  const [voteChoice, setVoteChoice] = useState(saved.voteChoice);
  const [selectedShare, setSelectedShare] = useState(saved.selectedShare);
  const [shared, setShared] = useState(saved.shared);
  const [busy, setBusy] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const [error, setError] = useState('');
  const runId = useRef(0);

  useEffect(() => {
    writeStoredValue(STORAGE_KEY, {
      version: 1, count, chosen, roleChoice, game, nightChoice, witchChoice,
      speechDraft, voteChoice, selectedShare, shared,
    } satisfies StoredSession);
  }, [count, chosen, roleChoice, game, nightChoice, witchChoice, speechDraft, voteChoice, selectedShare, shared]);
  useEffect(() => () => { runId.current++; }, []);

  const commitGame = (next: Game | null) => {
    setGame(next);
    const latest = readStoredValue(STORAGE_KEY, saved, isStoredSession);
    writeStoredValue(STORAGE_KEY, { ...latest, game: next });
  };
  const needed = count - 1;
  const seats = Array.from({ length: needed }, (_, index) => chosen[index] ?? '');
  const valid = seats.every(Boolean) && new Set(seats).size === needed &&
    seats.every(id => people.some(person => person.id === id));
  const userRole = game?.roles.user;
  const userAlive = !!game?.alive.includes('user');
  const othersAlive = game?.alive.filter(id => id !== 'user') ?? [];
  const pendingSpeakers = game?.phase === 'day'
    ? game.people.filter(person => person.id !== 'user' && game.alive.includes(person.id) &&
        !game.speeches.some(speech => speech.id === person.id)) : [];

  const createGame = (players: WolfPerson[]) => {
    runId.current++;
    setBusy(false);
    const size = players.length;
    const pool: WolfRole[] = [
      'wolf', 'wolf', 'seer', 'witch', ...(size >= 7 ? ['guard' as WolfRole] : []),
      ...Array(size - (size >= 7 ? 5 : 4)).fill('villager') as WolfRole[],
    ];
    let assigned: Record<string, WolfRole>;
    if (roleChoice === 'random') {
      const shuffled = shuffle(pool);
      assigned = Object.fromEntries(players.map((person, index) => [person.id, shuffled[index]]));
    } else {
      const remaining = [...pool];
      const index = remaining.indexOf(roleChoice);
      if (index < 0) return;
      remaining.splice(index, 1);
      const shuffled = shuffle(remaining);
      assigned = Object.fromEntries(players.map((person, position) =>
        [person.id, position === 0 ? roleChoice : shuffled[position - 1]]));
    }
    const alive = players.map(person => person.id);
    const next: Game = {
      id: `werewolf-${crypto.randomUUID()}`, people: players, roles: assigned, alive,
      day: 1, phase: 'night', winner: null, threat: wolfVictim(alive, assigned),
      guardLast: '', healUsed: false, poisonUsed: false, known: {},
      discussionStarted: false, userSpeech: '', speeches: [],
      announcement: '夜幕降临', history: ['第 1 夜开始'],
    };
    commitGame(next);
    setNightChoice(''); setWitchChoice('none'); setSpeechDraft(''); setVoteChoice('');
    setError(''); setCurrentSpeaker(''); setShared(false);
    setSelectedShare(players.filter(person => person.id !== 'user').map(person => person.id));
  };
  const start = () => {
    if (!valid) return;
    createGame([{ id: 'user', name: userName, kind: '玩家' },
      ...seats.map(id => people.find(person => person.id === id)!) ]);
  };
  const restart = () => { if (game) createGame(game.people); };

  const finishNight = () => {
    if (!game || game.phase !== 'night' || busy) return;
    const next: Game = { ...game, alive: [...game.alive], known: { ...game.known }, history: [...game.history] };
    const role = next.roles.user;
    let victim = role === 'wolf' && userAlive ? nightChoice || next.threat : next.threat;
    if (!victim || !next.alive.includes(victim) || next.roles[victim] === 'wolf')
      victim = wolfVictim(next.alive, next.roles);

    let guarded = '';
    const guard = next.alive.find(id => next.roles[id] === 'guard');
    if (guard) {
      const candidates = next.alive.filter(id => id !== next.guardLast);
      guarded = guard === 'user' && nightChoice
        ? nightChoice !== next.guardLast ? nightChoice : pick(candidates)
        : pick(candidates);
      next.guardLast = guarded;
    }
    const witch = next.alive.find(id => next.roles[id] === 'witch');
    let healed = false;
    let poisoned = '';
    if (witch === 'user') {
      if (witchChoice === 'heal' && !next.healUsed) { healed = true; next.healUsed = true; }
      if (witchChoice === 'poison' && !next.poisonUsed && nightChoice && nightChoice !== 'user') {
        poisoned = nightChoice; next.poisonUsed = true;
      }
    } else if (witch) {
      if (!next.healUsed && Math.random() < 0.32) { healed = true; next.healUsed = true; }
      else if (!next.poisonUsed && next.day > 1 && Math.random() < 0.16) {
        const targets = next.alive.filter(id => id !== witch && id !== victim);
        if (targets.length) { poisoned = pick(targets); next.poisonUsed = true; }
      }
    }
    const seer = next.alive.find(id => next.roles[id] === 'seer');
    let inspected = '';
    if (seer === 'user' && nightChoice && nightChoice !== 'user') inspected = nightChoice;
    else if (seer) {
      const targets = next.alive.filter(id => id !== seer && !next.known[id]);
      if (targets.length) inspected = pick(targets);
    }
    if (inspected) next.known[inspected] = next.roles[inspected];
    const deaths = [...new Set([
      ...(victim && victim !== guarded && !healed ? [victim] : []),
      ...(poisoned ? [poisoned] : []),
    ])];
    next.alive = next.alive.filter(id => !deaths.includes(id));
    next.history.push(`第 ${next.day} 夜：狼人袭击 ${nameOf(next, victim)}；守卫守护 ${guarded ? nameOf(next, guarded) : '无人'}；女巫${healed ? '使用解药' : '未用解药'}${poisoned ? `、毒杀 ${nameOf(next, poisoned)}` : ''}；预言家${inspected ? `查验 ${nameOf(next, inspected)}（${roleName[next.roles[inspected]]}）` : '未查验'}。`);
    next.announcement = deaths.length ? `昨夜出局：${deaths.map(id => nameOf(next, id)).join('、')}` : '昨晚是平安夜';
    next.history.push(`第 ${next.day} 天：${next.announcement}`);
    next.winner = resultOf(next.alive, next.roles);
    next.phase = next.winner ? 'ended' : 'day';
    next.discussionStarted = false; next.userSpeech = ''; next.speeches = [];
    commitGame(next);
    setNightChoice(''); setWitchChoice('none');
  };

  const speak = async () => {
    if (!game || game.phase !== 'day' || busy) return;
    let working: Game = game;
    if (!working.discussionStarted) {
      const userSpeech = userAlive ? speechDraft.trim().slice(0, 500) : '';
      working = {
        ...working, discussionStarted: true, userSpeech,
        history: [...working.history, ...(userSpeech ? [`你发言：${userSpeech}`] : [])],
      };
      commitGame(working);
      setSpeechDraft('');
    }
    const token = ++runId.current;
    setBusy(true); setError('');
    let pendingName = '';
    try {
      const speakers = working.people.filter(person => person.id !== 'user' && working.alive.includes(person.id));
      for (const actor of speakers) {
        if (working.speeches.some(speech => speech.id === actor.id)) continue;
        pendingName = actor.name;
        setCurrentSpeaker(actor.name);
        const result = await onSpeak({
          actor, people: working.people, roles: working.roles, alive: working.alive,
          day: working.day, announcement: working.announcement,
          userSpeech: working.userSpeech, history: working.history,
          known: working.known, previousSpeeches: working.speeches,
        });
        if (runId.current !== token) return;
        const text = result.text?.trim().slice(0, 240);
        if (!text) throw new Error('没有返回有效发言。');
        const speech: WolfSpeech = { id: actor.id, text, vote: result.vote };
        working = {
          ...working,
          speeches: [...working.speeches, speech],
          history: [...working.history, `${actor.name}发言：${text}`],
        };
        commitGame(working);
      }
      if (runId.current === token) commitGame({ ...working, phase: 'vote' });
    } catch (cause) {
      if (runId.current === token) {
        const reason = cause instanceof Error ? cause.message : '请求失败';
        setError(`${pendingName || '角色'}发言失败：${reason.slice(0, 140)}。点击重试会从这位角色继续。`);
      }
    } finally {
      if (runId.current === token) { setBusy(false); setCurrentSpeaker(''); }
    }
  };

  const vote = () => {
    if (!game || game.phase !== 'vote' || busy || (userAlive && !voteChoice)) return;
    const next: Game = { ...game, alive: [...game.alive], history: [...game.history] };
    const votes: Record<string, number> = {};
    const detail: string[] = [];
    for (const id of next.alive) {
      let target = '';
      if (id === 'user') target = voteChoice;
      else {
        const candidates = next.alive.filter(other => other !== id);
        const knownWolf = id === next.people.find(person => next.roles[person.id] === 'seer')?.id
          ? candidates.find(other => next.known[other] === 'wolf') : undefined;
        const preferred = next.roles[id] === 'wolf'
          ? candidates.filter(other => next.roles[other] !== 'wolf') : candidates;
        const suggested = next.speeches.find(speech => speech.id === id)?.vote;
        target = knownWolf ?? (suggested && preferred.includes(suggested)
          ? suggested : pick(preferred.length ? preferred : candidates));
      }
      if (target && next.alive.includes(target)) {
        votes[target] = (votes[target] ?? 0) + 1;
        detail.push(`${nameOf(next, id)}投给${nameOf(next, target)}`);
      }
    }
    const highest = Math.max(0, ...Object.values(votes));
    const leaders = Object.keys(votes).filter(id => votes[id] === highest);
    const out = leaders.length === 1 ? leaders[0] : '';
    if (out) next.alive = next.alive.filter(id => id !== out);
    next.history.push(`第 ${next.day} 天投票：${detail.join('；')}。${out ? `放逐 ${nameOf(next, out)}（${roleName[next.roles[out]]}）` : '票数相同，无人出局'}`);
    next.winner = resultOf(next.alive, next.roles);
    next.announcement = out ? `投票放逐了 ${nameOf(next, out)}（${roleName[next.roles[out]]}）` : '投票平局，无人出局';
    next.phase = next.winner ? 'ended' : 'night';
    if (!next.winner) next.day++;
    next.threat = wolfVictim(next.alive, next.roles);
    next.speeches = []; next.userSpeech = ''; next.discussionStarted = false;
    commitGame(next);
    setVoteChoice(''); setNightChoice(''); setWitchChoice('none');
  };

  const roleHint = game && userAlive
    ? userRole === 'wolf'
      ? `狼人同伴：${game.people.filter(person => person.id !== 'user' && game.roles[person.id] === 'wolf').map(person => person.name).join('、')}`
      : userRole === 'seer'
        ? Object.entries(game.known).map(([id, role]) => `${nameOf(game, id)}：${roleName[role]}`).join('；')
        : ''
    : '';
  const actionRole = game?.phase === 'night' && userAlive ? userRole : null;
  const targetPeople = game?.people.filter(person => person.id !== 'user' && game.alive.includes(person.id) &&
    (actionRole !== 'wolf' || game.roles[person.id] !== 'wolf')) ?? [];
  const detail = game?.phase === 'ended' ? completeHistory(game) : '';

  return <section className="min-h-full bg-gradient-to-b from-[#e9edf8] via-[#f5f1f8] to-[#f9f6f2] px-4 py-5 text-[#48546d]">
    <div className="mx-auto max-w-[440px] space-y-4">
      <div className="rounded-3xl border border-white/60 bg-gradient-to-r from-[#c9d1e7]/85 to-[#e8d5e8]/85 p-5 shadow-sm">
        <p className="text-[10px] font-bold tracking-[.16em]">微信游戏 · 推理之夜</p>
        <h2 className="mt-1 text-2xl font-black">狼人杀 <Moon className="inline h-5 w-5 text-indigo-600" /></h2>
        <p className="mt-1 text-xs">白天辨认谎言，夜晚守住秘密</p>
      </div>
      <details className="rounded-2xl border border-white/70 bg-white/65 p-3 text-xs shadow-sm">
        <summary className="cursor-pointer font-bold text-[#596987]">游戏规则</summary>
        <p className="mt-2 leading-5">夜晚狼人袭击、预言家查验、女巫用药，7 人以上还有守卫。白天发言后投票，得票最多的人出局；平票无人出局。狼人全部出局则好人获胜；狼人数量达到其余存活人数则狼人获胜。</p>
      </details>
      {game && game.phase !== 'ended' && <details className="rounded-2xl border border-white/70 bg-white/70 p-3 text-xs shadow-sm">
        <summary className="cursor-pointer font-bold">公开记录</summary>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-slate-600">
          {game.history.filter(line => !line.includes(' 夜：')).map((line, index) => <p key={index}>{line}</p>)}
        </div>
      </details>}

      {!game && <div className="rounded-3xl bg-white/85 p-4 shadow-sm">
        <p className="text-sm font-bold">组建村庄</p>
        <label className="mt-3 block text-xs">总人数
          <select value={count} onChange={event => setCount(Number(event.target.value))} className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5">
            {[6, 7, 8].map(size => <option key={size} value={size}>{size} 人（含你）</option>)}
          </select>
        </label>
        <p className="mt-3 text-xs">选择 {needed} 位角色或 NPC</p>
        <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
          {seats.map((id, index) => <select key={index} aria-label={`参与者 ${index + 1}`} value={id}
            onChange={event => setChosen(previous => Array.from({ length: 7 }, (_, position) =>
              position === index ? event.target.value : previous[position] ?? ''))}
            className="w-full rounded-xl bg-slate-100 px-3 py-2 text-xs">
            <option value="">请选择</option>
            {people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.kind}</option>)}
          </select>)}
        </div>
        <label className="mt-3 block text-xs">我的身份
          <select value={roleChoice} onChange={event => setRoleChoice(event.target.value as WolfRole | 'random')}
            className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5">
            <option value="random">随机分配</option>
            {roles.filter(role => role !== 'guard' || count >= 7).map(role =>
              <option key={role} value={role}>{roleName[role]}</option>)}
          </select>
        </label>
        <p className="mt-2 text-[11px] text-slate-500">6 人：2 狼、预言家、女巫、2 村民；7 人以上加入守卫。</p>
        {people.length < needed && <p className="mt-2 text-xs text-rose-600">参与者不足，请先添加角色或 NPC。</p>}
        <button type="button" disabled={!valid || (roleChoice === 'guard' && count < 7)} onClick={start}
          className="mt-4 w-full rounded-xl bg-[#7d8eaf] py-3 text-sm font-bold text-white disabled:opacity-40">开始游戏</button>
      </div>}

      {game && <>
        <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">第 {game.day} 天 · {game.phase === 'night' ? '夜晚' : game.phase === 'ended' ? '终局' : '白天'}</span>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">你的身份：{roleName[userRole!]}</span>
          </div>
          {roleHint && <p className="mt-2 text-xs text-indigo-600">{roleHint}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {game.people.map(person => <span key={person.id} className={`rounded-full px-2 py-1 text-[11px] ${game.alive.includes(person.id) ? 'bg-[#e5ebf6]' : 'bg-slate-100 text-slate-400 line-through'}`}>{person.name}</span>)}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">进度自动保存，退出后再进入可继续。</p>
          <button type="button" onClick={restart}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#7181a2]"><RotateCcw size={14} />重开本局</button>
        </div>

        {game.phase === 'night' && <div className="rounded-3xl bg-[#e9eafa] p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Moon size={17} />夜晚行动</h3>
          <p className="mt-2 text-xs leading-5">{!userAlive ? '你已出局，点击继续观看。'
            : actionRole === 'wolf' ? '选择今夜袭击对象；你的狼人同伴不会成为目标。'
              : actionRole === 'seer' ? '选择查验一位玩家，天亮后会看到身份。'
                : actionRole === 'witch' ? `今晚的袭击对象：${nameOf(game, game.threat)}。你可选择用解药、毒药或不行动。`
                  : actionRole === 'guard' ? '选择守护对象，不能连续两夜守护同一人。'
                    : '村民夜晚没有行动，等待天亮。'}</p>
          {userAlive && (['wolf', 'seer', 'guard'].includes(actionRole ?? '') || (actionRole === 'witch' && witchChoice === 'poison')) &&
            <select value={nightChoice} onChange={event => setNightChoice(event.target.value)} className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs">
              <option value="">自动选择 / 暂不选择</option>
              {(actionRole === 'guard' ? game.people.filter(person => game.alive.includes(person.id) && person.id !== game.guardLast) : targetPeople)
                .map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>}
          {userAlive && actionRole === 'witch' && <div className="mt-3 grid grid-cols-3 gap-2">
            {(['none', 'heal', 'poison'] as const).map(choice => <button type="button" key={choice}
              disabled={(choice === 'heal' && game.healUsed) || (choice === 'poison' && game.poisonUsed)}
              onClick={() => setWitchChoice(choice)} className={`rounded-xl px-2 py-2 text-xs disabled:opacity-40 ${witchChoice === choice ? 'bg-indigo-300' : 'bg-white'}`}>
              {choice === 'none' ? '不行动' : choice === 'heal' ? '用解药' : '用毒药'}
            </button>)}
          </div>}
          <button type="button" onClick={finishNight} disabled={actionRole === 'witch' && witchChoice === 'poison' && !nightChoice}
            className="mt-4 w-full rounded-xl bg-[#7d8eaf] py-2.5 text-xs font-bold text-white disabled:opacity-40">天亮了</button>
        </div>}

        {(game.phase === 'day' || game.phase === 'vote') && <div className="rounded-3xl bg-white/85 p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Sun size={17} />白天讨论</h3>
          <p className="mt-2 rounded-xl bg-indigo-50 p-3 text-xs">{game.announcement}</p>
          {game.userSpeech && <p className="mt-2 text-xs"><strong>你：</strong>{game.userSpeech}</p>}
          {game.speeches.map(speech => <p key={speech.id} className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs">
            <strong>{nameOf(game, speech.id)}：</strong>{speech.text}
          </p>)}
          {game.phase === 'day' && <>
            {!game.discussionStarted && userAlive && <textarea value={speechDraft} onChange={event => setSpeechDraft(event.target.value)}
              rows={3} maxLength={500} placeholder="说说你的判断，也可以留空跳过…"
              className="mt-3 w-full rounded-xl bg-slate-100 p-3 text-xs outline-none" />}
            {game.discussionStarted && <p className="mt-3 text-[11px] text-slate-500">
              已完成 {game.speeches.length} / {game.people.filter(person => person.id !== 'user' && game.alive.includes(person.id)).length} 位角色发言。每位角色单独调用一次 API，已完成的发言会保存。
            </p>}
            {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
            <button type="button" disabled={busy} onClick={() => void speak()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7d8eaf] py-2.5 text-xs font-bold text-white disabled:opacity-40">
              <Send size={14} />{busy ? `${currentSpeaker || '角色'}正在发言…` : error ? `重试 ${pendingSpeakers[0]?.name || '角色'} 发言` : game.discussionStarted ? '继续生成剩余发言' : '结束发言，听大家说'}
            </button>
          </>}
          {game.phase === 'vote' && <>
            <p className="mt-4 text-xs font-bold">投票放逐</p>
            {userAlive && <select value={voteChoice} onChange={event => setVoteChoice(event.target.value)}
              className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2 text-xs">
              <option value="">选择一位玩家</option>
              {othersAlive.map(id => <option key={id} value={id}>{nameOf(game, id)}</option>)}
            </select>}
            <button type="button" disabled={userAlive && !voteChoice} onClick={vote}
              className="mt-3 w-full rounded-xl bg-[#7d8eaf] py-2.5 text-xs font-bold text-white disabled:opacity-40">
              {userAlive ? '确认投票' : '观看投票'}
            </button>
          </>}
        </div>}

        {game.phase === 'ended' && <div className="rounded-3xl bg-white/90 p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold">{game.winner === 'wolf' ? <Moon size={20} /> : <Shield size={20} />}{game.winner === 'wolf' ? '狼人获胜' : '好人获胜'}</h3>
          <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-5 text-slate-600">{detail}</pre>
          <p className="mt-4 text-xs font-bold">分享完整战报</p>
          <div className="mt-2 max-h-28 overflow-y-auto">{people.map(person => <label key={person.id} className="flex items-center gap-2 py-1.5 text-xs">
            <input type="checkbox" checked={selectedShare.includes(person.id)}
              onChange={event => setSelectedShare(previous => event.target.checked ? [...previous, person.id] : previous.filter(id => id !== person.id))} />{person.name}
          </label>)}</div>
          <button type="button" disabled={!selectedShare.length || shared} onClick={() => { onShare({ id: game.id, detail }, selectedShare); setShared(true); }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7d8eaf] py-3 text-sm font-bold text-white disabled:opacity-40">
            <Share2 size={15} />{shared ? '已分享到聊天' : '分享战报'}
          </button>
        </div>}
      </>}
    </div>
  </section>;
}
