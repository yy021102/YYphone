import { useEffect, useRef, useState } from 'react';
import { ImagePlus, MessageCircle, RotateCcw, Send, Share2, Sparkles, Undo2, X } from 'lucide-react';
import { compressWallpaper } from '../utils/imageFile';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

type Stone = 0 | 1 | 2;
type Contact = { id: string; name: string };
type Result = { id: string; opponentId: string; opponentName: string; userColor: '黑' | '白'; blackName: string; whiteName: string; blackSteps: number; whiteSteps: number; winner: string; summary: string };
type Talk = { from: 'user' | 'character'; text: string };
type Difficulty = 'easy' | 'normal' | 'hard';
type TalkMode = 'user' | 'auto' | 'undo-request';
type TalkReply = { text: string; yieldMove: boolean; approveUndo: boolean; requestUndo: boolean };
type Props = { contacts: Contact[]; userName: string; onShare: (result: Result, recipients: string[]) => void; onTalk: (opponentId: string, message: string, history: Talk[], situation: string, mode: TalkMode) => Promise<TalkReply> };
const BACKGROUND_KEY = 'yyphone:gomoku-background';
const SIZE = 15;
const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
const at = (x: number, y: number) => y * SIZE + x;
const inside = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const lineAt = (board: Stone[], index: number, color: Stone) => {
  const x = index % SIZE, y = Math.floor(index / SIZE);
  for (const [dx, dy] of directions) {
    const line = [index];
    for (const sign of [-1, 1]) {
      for (let n = 1; n < 5; n++) {
        const xx = x + dx * n * sign, yy = y + dy * n * sign;
        if (!inside(xx, yy) || board[at(xx, yy)] !== color) break;
        line.push(at(xx, yy));
      }
    }
    if (line.length >= 5) return line;
  }
  return [];
};
const chooseMove = (board: Stone[], own: Stone, other: Stone, difficulty: Difficulty, yielding = false) => {
  const empty = board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
  if (empty.length === 225) return at(7, 7);
  const nearby = empty.filter(i => {
    const x = i % SIZE, y = Math.floor(i / SIZE);
    return [-2,-1,0,1,2].some(dx => [-2,-1,0,1,2].some(dy => inside(x+dx,y+dy) && board[at(x+dx,y+dy)] !== 0));
  });
  const candidates = nearby.length ? nearby : empty;
  if (difficulty === 'easy' || yielding) {
    const safe = candidates.filter(i => {
      const next = [...board]; next[i] = own;
      return !lineAt(next, i, own).length;
    });
    return (safe.length ? safe : candidates)[Math.floor(Math.random() * (safe.length ? safe.length : candidates.length))];
  }
  for (const color of [own, other]) for (const i of candidates) {
    const next = [...board]; next[i] = color;
    if (lineAt(next, i, color).length) return i;
  }
  let best = candidates[0], bestScore = -Infinity;
  for (const i of candidates) {
    const x = i % SIZE, y = Math.floor(i / SIZE);
    let score = 0;
    if (difficulty === 'hard') {
      for (const color of [own, other]) for (const [dx, dy] of directions) {
        let count = 1, open = 0;
        for (const sign of [-1, 1]) {
          let n = 1;
          while (inside(x+dx*n*sign,y+dy*n*sign) && board[at(x+dx*n*sign,y+dy*n*sign)] === color) { count++; n++; }
          if (inside(x+dx*n*sign,y+dy*n*sign) && board[at(x+dx*n*sign,y+dy*n*sign)] === 0) open++;
        }
        score += (color === own ? 1 : 0.9) * (count >= 5 ? 100000 : count === 4 ? 8000 : count === 3 ? 250 : count === 2 ? 25 : 1) * (open === 2 ? 2 : open === 1 ? 1 : 0.1);
      }
    } else {
      for (const [dx, dy] of directions) for (const sign of [-1, 1]) for (let n = 1; n <= 4; n++) {
        const xx = x + dx * n * sign, yy = y + dy * n * sign;
        if (!inside(xx, yy) || board[at(xx, yy)] === 0) continue;
        score += board[at(xx, yy)] === own ? 5 - n : 4 - n;
      }
    }
    score -= (Math.abs(x - 7) + Math.abs(y - 7)) * 0.02;
    if (score > bestScore) { best = i; bestScore = score; }
  }
  return best;
};

const describeBoardSituation = (board: Stone[], moves: number[], blackName: string, whiteName: string) => {
  const assess = (color: Stone) => {
    let openFour = 0, closedFour = 0, openThree = 0, openTwo = 0;
    for (let index = 0; index < board.length; index++) {
      if (board[index] !== color) continue;
      const x = index % SIZE, y = Math.floor(index / SIZE);
      for (const [dx, dy] of directions) {
        if (inside(x - dx, y - dy) && board[at(x - dx, y - dy)] === color) continue;
        let length = 0;
        while (inside(x + dx * length, y + dy * length) && board[at(x + dx * length, y + dy * length)] === color) length++;
        const beforeX = x - dx, beforeY = y - dy;
        const afterX = x + dx * length, afterY = y + dy * length;
        const openEnds = Number(inside(beforeX, beforeY) && board[at(beforeX, beforeY)] === 0)
          + Number(inside(afterX, afterY) && board[at(afterX, afterY)] === 0);
        if (length === 4 && openEnds === 2) openFour++;
        else if (length === 4 && openEnds === 1) closedFour++;
        else if (length === 3 && openEnds === 2) openThree++;
        else if (length === 2 && openEnds === 2) openTwo++;
      }
    }
    const winningMoves = board.reduce<number[]>((found, stone, index) => {
      if (stone !== 0) return found;
      const next = [...board]; next[index] = color;
      if (lineAt(next, index, color).length) found.push(index);
      return found;
    }, []);
    return { openFour, closedFour, openThree, openTwo, winningMoves };
  };
  const black = assess(1), white = assess(2);
  const describeThreats = (name: string, info: ReturnType<typeof assess>) =>
    `${name}：下一手可成五的落点${info.winningMoves.length}处，活四${info.openFour}处，冲四${info.closedFour}处，活三${info.openThree}处，活二${info.openTwo}处`;
  const last = moves.at(-1);
  const lastMoveText = last === undefined ? '尚未落子' :
    `上一手是${board[last] === 1 ? blackName : whiteName}落在第${Math.floor(last / SIZE) + 1}行第${last % SIZE + 1}列`;
  const recent = moves.slice(-6).map(index =>
    `${board[index] === 1 ? '黑' : '白'}${Math.floor(index / SIZE) + 1}行${index % SIZE + 1}列`).join('、');
  const diagram = Array.from({ length: SIZE }, (_, row) =>
    `${String(row + 1).padStart(2, '0')} ${board.slice(row * SIZE, (row + 1) * SIZE).map(stone => stone === 1 ? '●' : stone === 2 ? '○' : '·').join('')}`).join('\n');
  return `${lastMoveText}；最近落点：${recent || '无'}。${describeThreats(blackName, black)}；${describeThreats(whiteName, white)}。棋盘（●黑、○白、·空；从左到右为第1至15列）：\n${diagram}`;
};

export function GomokuGame({ contacts, userName, onShare, onTalk }: Props) {
  const [opponentId, setOpponentId] = useState(contacts[0]?.id ?? '');
  const [userColor, setUserColor] = useState<Stone>(1);
  const [board, setBoard] = useState<Stone[]>(Array(225).fill(0));
  const [turn, setTurn] = useState<Stone>(1);
  const [winner, setWinner] = useState<Stone>(0);
  const [winningLine, setWinningLine] = useState<number[]>([]);
  const [history, setHistory] = useState<Stone[]>([]);
  const [moveIndices, setMoveIndices] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [talk, setTalk] = useState<Talk[]>([]);
  const [draft, setDraft] = useState('');
  const [talkBusy, setTalkBusy] = useState(false);
  const [talkError, setTalkError] = useState('');
  const [mercyMoves, setMercyMoves] = useState(0);
  const [autoChatEnabled, setAutoChatEnabled] = useState(true);
  const [autoCount, setAutoCount] = useState(0);
  const [lastAutoStep, setLastAutoStep] = useState(0);
  const [lastManualStep, setLastManualStep] = useState(-10);
  const [lastMove, setLastMove] = useState(-1);
  const [pendingCharacterUndo, setPendingCharacterUndo] = useState(false);
  const [background, setBackground] = useState(() => readStoredValue(BACKGROUND_KEY, '', (value): value is string => typeof value === 'string'));
  const [backgroundDialogOpen, setBackgroundDialogOpen] = useState(false);
  const [backgroundDraft, setBackgroundDraft] = useState('');
  const [backgroundError, setBackgroundError] = useState('');
  const sessionRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const opponent = contacts.find(c => c.id === opponentId);
  const opponentColor: Stone = userColor === 1 ? 2 : 1;
  const blackName = userColor === 1 ? userName : opponent?.name ?? '角色';
  const whiteName = userColor === 2 ? userName : opponent?.name ?? '角色';
  const reset = (color = userColor, id = opponentId) => {
    sessionRef.current += 1;
    setBoard(Array(225).fill(0)); setHistory([]); setMoveIndices([]); setTurn(1); setWinner(0);
    setWinningLine([]); setResult(null); setSelected(id ? [id] : []); setShared(false);
    setUserColor(color); setOpponentId(id); setTalk([]); setTalkError(''); setMercyMoves(0);
    setAutoCount(0); setLastAutoStep(0); setLastManualStep(-10); setLastMove(-1); setTalkBusy(false); setPendingCharacterUndo(false);
  };
  const move = (i: number, color: Stone) => {
    if (winner || board[i] || turn !== color) return;
    const next = [...board]; next[i] = color;
    const nextHistory = [...history, color];
    const line = lineAt(next, i, color);
    const draw = nextHistory.length === 225;
    setBoard(next); setHistory(nextHistory); setMoveIndices(previous => [...previous, i]); setWinningLine(line); setLastMove(i);
    if (line.length || draw) {
      setWinner(line.length ? color : 0);
      const blackSteps = nextHistory.filter(x => x === 1).length;
      const whiteSteps = nextHistory.filter(x => x === 2).length;
      const winnerName = line.length ? color === 1 ? blackName : whiteName : '平局';
      const summary = `五子棋：${blackName}执黑（${blackSteps}步），${whiteName}执白（${whiteSteps}步）。${line.length ? `${winnerName}获胜，${color === 1 ? whiteName : blackName}落败。` : '双方平局。'}${talk.length ? ` 对局中聊到：${talk.slice(-8).map(item => `${item.from === 'user' ? userName : opponent?.name}：${item.text}`).join('；')}` : ''}`;
      setResult({ id: crypto.randomUUID(), opponentId, opponentName: opponent?.name ?? '角色', userColor: userColor === 1 ? '黑' : '白', blackName, whiteName, blackSteps, whiteSteps, winner: winnerName, summary });
    } else setTurn(color === 1 ? 2 : 1);
  };
  const undoRound = () => {
    const count = Math.min(2, moveIndices.length);
    if (!count) return;
    const next = [...board];
    moveIndices.slice(-count).forEach(index => { next[index] = 0; });
    const remaining = moveIndices.slice(0, -count);
    setBoard(next); setMoveIndices(remaining); setHistory(previous => previous.slice(0, -count));
    setTurn(remaining.length % 2 === 0 ? 1 : 2);
    setWinner(0); setResult(null); setWinningLine([]); setLastMove(remaining.at(-1) ?? -1);
    setPendingCharacterUndo(false); setLastManualStep(remaining.length);
  };
  const requestUndo = async () => {
    if (!opponent || !moveIndices.length || talkBusy || shared) return;
    const session = sessionRef.current;
    const next: Talk[] = [...talk, { from: 'user', text: '这轮可以悔棋吗？' }];
    setTalk(next); setTalkBusy(true); setTalkError(''); setLastManualStep(history.length);
    try {
      const response = await onTalk(opponentId, '我想悔棋，可以吗？', next, `当前共落子${history.length}手；申请撤回最近${Math.min(2, history.length)}手`, 'undo-request');
      if (session !== sessionRef.current) return;
      setTalk([...next, { from: 'character', text: response.text }]);
      if (response.approveUndo) undoRound();
    } catch (error) {
      if (session === sessionRef.current) setTalkError(error instanceof Error ? error.message : '悔棋请求失败，请重试。');
    } finally { if (session === sessionRef.current) setTalkBusy(false); }
  };
  const saveBackground = (value: string) => { setBackground(value); writeStoredValue(BACKGROUND_KEY, value); setBackgroundDialogOpen(false); setBackgroundError(''); };
  const applyBackgroundUrl = () => {
    try {
      const url = new URL(backgroundDraft.trim());
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('请输入 http 或 https 图片链接。');
      saveBackground(url.href);
    } catch { setBackgroundError('请输入有效的 http 或 https 图片链接。'); }
  };
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    try { saveBackground(await compressWallpaper(file)); }
    catch (error) { setBackgroundError(error instanceof Error ? error.message : '图片上传失败。'); }
  };
  useEffect(() => {
    if (!opponent || result || turn !== opponentColor || talkBusy || pendingCharacterUndo) return;
    const timer = window.setTimeout(() => {
      move(chooseMove(board, opponentColor, userColor, difficulty, mercyMoves > 0), opponentColor);
      if (mercyMoves > 0) setMercyMoves(n => n - 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [board, turn, opponentId, userColor, result, difficulty, mercyMoves, talkBusy, pendingCharacterUndo]);
  useEffect(() => {
    const steps = history.length;
    if (!opponent || !autoChatEnabled || result || talkBusy || pendingCharacterUndo || autoCount >= 3 ||
        steps < 10 || steps % 2 !== 0 || steps - lastManualStep < 10 ||
        (autoCount > 0 && steps - lastAutoStep < 10)) return;
    const session = sessionRef.current;
    setAutoCount(count => count + 1);
    setLastAutoStep(steps);
    setTalkBusy(true);
    const situation = `当前${blackName}执黑${history.filter(x => x === 1).length}步，${whiteName}执白${history.filter(x => x === 2).length}步；轮到${turn === userColor ? userName : opponent.name}落子；难度：${difficulty}。${describeBoardSituation(board, moveIndices, blackName, whiteName)}`;
    void onTalk(opponentId, '', talk, situation, 'auto')
      .then(response => {
        if (session !== sessionRef.current) return;
        setTalk(previous => [...previous, { from: 'character', text: response.text }]);
        if (response.requestUndo && history.length >= 2) setPendingCharacterUndo(true);
      })
      .catch(() => { /* 主动闲聊失败不打断棋局，也不重复请求这一轮。 */ })
      .finally(() => { if (session === sessionRef.current) setTalkBusy(false); });
  }, [history.length, opponentId, autoChatEnabled, result, talkBusy, pendingCharacterUndo, autoCount, lastAutoStep, lastManualStep]);
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [talk.length, talkBusy]);
  const sendTalk = async () => {
    const message = draft.trim();
    if (!message || !opponentId || talkBusy) return;
    const session = sessionRef.current;
    const next: Talk[] = [...talk, { from: 'user', text: message }];
    setTalk(next); setDraft(''); setTalkBusy(true); setTalkError(''); setLastManualStep(history.length);
    try {
      const response = await onTalk(opponentId, message, next, `难度${difficulty}；${blackName}执黑${history.filter(x => x === 1).length}步，${whiteName}执白${history.filter(x => x === 2).length}步；${result ? result.summary : `当前轮到${turn === userColor ? userName : opponent?.name}`}`, 'user');
      if (session !== sessionRef.current) return;
      setTalk([...next, { from: 'character', text: response.text }]);
      if (response.yieldMove) setMercyMoves(2);
    } catch (error) { if (session === sessionRef.current) setTalkError(error instanceof Error ? error.message : '角色暂时没有回应，请重试。'); }
    finally { if (session === sessionRef.current) setTalkBusy(false); }
  };
  if (!contacts.length) return <div className="p-6 text-center text-sm text-slate-500">请先在通讯录添加角色，再来下五子棋。</div>;
  return <section className="min-h-full bg-gradient-to-b from-[#e9f4ee] via-[#f7f7ef] to-[#f8efe4] px-4 pb-8 pt-4 text-[#294239]" style={background ? { backgroundImage: `linear-gradient(to bottom, rgba(235,247,239,.82), rgba(250,247,239,.82)), url("${background.replace(/"/g, '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
    <div className="mx-auto max-w-[420px]">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/90 bg-white/75 p-2.5 shadow-[0_8px_28px_rgba(68,97,78,0.08)]">
        <label className="min-w-0"><span className="mb-1 block pl-1 text-[10px] text-slate-500">对弈角色</span><select aria-label="对手" value={opponentId} onChange={e => reset(userColor, e.target.value)} className="w-full min-w-0 rounded-xl bg-[#f1f6f2] px-2 py-2 text-xs font-semibold outline-none"><option value="" disabled>选择角色</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="mb-1 block pl-1 text-[10px] text-slate-500">我的棋色</span><select aria-label="我的棋色" value={userColor} onChange={e => reset(Number(e.target.value) as Stone)} className="w-full rounded-xl bg-[#f1f6f2] px-2 py-2 text-xs font-semibold outline-none"><option value={1}>执黑</option><option value={2}>执白</option></select></label>
        <label><span className="mb-1 block pl-1 text-[10px] text-slate-500">棋力难度</span><select aria-label="难度" value={difficulty} onChange={e => { setDifficulty(e.target.value as Difficulty); reset(); }} className="w-full rounded-xl bg-[#f1f6f2] px-2 py-2 text-xs font-semibold outline-none"><option value="easy">简单</option><option value="normal">普通</option><option value="hard">困难</option></select></label>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button type="button" onClick={() => reset()} className="flex items-center gap-1.5 rounded-xl border border-white/90 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm"><RotateCcw size={15}/>重开</button>
        <button type="button" disabled={!moveIndices.length || talkBusy || shared || pendingCharacterUndo} onClick={() => void requestUndo()} className="flex items-center gap-1.5 rounded-xl border border-white/90 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm disabled:opacity-40"><Undo2 size={15}/>悔棋</button>
        <button type="button" onClick={() => { setBackgroundDraft(background.startsWith('http') ? background : ''); setBackgroundDialogOpen(true); }} className="flex items-center gap-1.5 rounded-xl border border-white/90 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm"><ImagePlus size={15}/>背景</button>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className={`rounded-2xl border bg-white/80 p-2.5 shadow-sm ${turn === userColor && !result ? 'border-emerald-500' : 'border-white'}`}><span className="text-[10px] text-slate-400">玩家</span><p className="truncate text-sm font-bold">{userName}</p><p className="mt-1 text-[11px] text-slate-600">{userColor === 1 ? '● 黑棋' : '○ 白棋'} · {history.filter(x => x === userColor).length} 步</p></div>
        <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold text-emerald-800">VS</span>
        <div className={`rounded-2xl border bg-white/80 p-2.5 shadow-sm ${turn === opponentColor && !result ? 'border-emerald-500' : 'border-white'}`}><span className="text-[10px] text-slate-400">对手</span><p className="truncate text-sm font-bold">{opponent?.name}</p><p className="mt-1 text-[11px] text-slate-600">{opponentColor === 1 ? '● 黑棋' : '○ 白棋'} · {history.filter(x => x === opponentColor).length} 步</p></div>
      </div>
      <p aria-live="polite" className="my-3 text-center text-xs font-semibold text-emerald-800">{result ? result.winner === '平局' ? '棋逢对手 · 平局' : `${result.winner}获胜 ✨` : turn === userColor ? '轮到你落子' : `${opponent?.name}正在思考…`}</p>
    </div>
    <div className="mx-auto aspect-square w-full max-w-[420px] rounded-[22px] border-[7px] border-[#c99b62] bg-[#e7bd78] p-2 shadow-[0_12px_28px_rgba(94,63,34,0.24),inset_0_2px_5px_rgba(116,75,33,0.15)]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)` }}>
        {board.map((stone, i) => <button key={i} type="button" onClick={() => move(i, userColor)} disabled={!!result || turn !== userColor || !!stone || talkBusy || pendingCharacterUndo} aria-label={`第${Math.floor(i / SIZE) + 1}行第${i % SIZE + 1}列`} className="relative flex items-center justify-center">
          <span className="absolute h-px w-full bg-amber-900/50"/><span className="absolute h-full w-px bg-amber-900/50"/>
          {!stone && [48, 56, 112, 168, 176].includes(i) && <span className="relative z-10 h-1 w-1 rounded-full bg-amber-950/60"/>}
          {!!stone && <span className={`relative z-10 h-[84%] w-[84%] rounded-full shadow-md ${stone === 1 ? 'bg-gradient-to-br from-[#4a4a4a] to-[#17191b]' : 'border border-[#c9c6bb] bg-gradient-to-br from-white to-[#e8e4da]'} ${winningLine.includes(i) ? 'ring-2 ring-rose-500' : lastMove === i ? 'ring-2 ring-emerald-500' : ''}`}/>}
        </button>)}
      </div>
    </div>
    <div className="mx-auto mt-4 max-w-[420px] overflow-hidden rounded-[22px] border border-white/90 bg-white/85 shadow-[0_8px_28px_rgba(68,97,78,0.08)]">
      <div className="flex items-center justify-between border-b border-emerald-50 px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><MessageCircle size={17}/></span><div><p className="text-sm font-bold">棋局小聊</p><p className="text-[10px] text-slate-400">和{opponent?.name}边下边聊</p></div></div><label className="flex items-center gap-1.5 text-[10px] text-slate-500"><input type="checkbox" checked={autoChatEnabled} onChange={e => setAutoChatEnabled(e.target.checked)} className="accent-emerald-600"/>主动发言</label></div>
      <div ref={chatScrollRef} className="max-h-44 min-h-16 space-y-2 overflow-y-auto px-4 py-3">{talk.length ? talk.map((item, i) => <div key={i} className={`flex ${item.from === 'user' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-[86%] rounded-2xl px-3 py-2 text-xs leading-5 ${item.from === 'user' ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm bg-[#f1f5f0] text-slate-700'}`}>{item.text}</p></div>) : <p className="py-2 text-center text-xs text-slate-400">落子之间，和 TA 聊两句吧</p>}{talkBusy && <p className="text-[11px] text-slate-400">{opponent?.name}正在想怎么说…</p>}</div>
      {pendingCharacterUndo && <div className="mx-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">{opponent?.name}想悔棋，你同意吗？</p><p className="mt-1 text-[11px] text-amber-700">同意后撤回最近一轮落子。</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { setTalk(previous => [...previous, { from: 'user', text: '好，这轮悔棋吧。' }]); undoRound(); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">同意</button><button type="button" onClick={() => { setPendingCharacterUndo(false); setLastManualStep(history.length); setTalk(previous => [...previous, { from: 'user', text: '这轮不悔棋。' }]); }} className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-600">不同意</button></div></div>}
      {mercyMoves > 0 && <p className="mt-2 text-xs text-amber-700">角色接下来的 {mercyMoves} 手会放松防守</p>}
      {talkError && <p role="alert" className="px-4 text-xs text-rose-600">{talkError}</p>}
      <div className="flex gap-2 border-t border-emerald-50 p-3"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void sendTalk(); }} placeholder="说点什么，或请 TA 让一让…" className="min-w-0 flex-1 rounded-xl bg-[#f3f7f3] px-3 py-2.5 text-xs outline-none"/><button type="button" disabled={talkBusy || !draft.trim()} onClick={() => void sendTalk()} className="flex w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm disabled:opacity-50" aria-label="发送游戏聊天"><Send size={16}/></button></div>
    </div>
    {result && <div className="mx-auto mt-4 max-w-[420px] rounded-[22px] border border-white/90 bg-white/85 p-4 shadow-sm"><p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={17} className="text-amber-500"/>对局结果</p><p className="mt-2 text-xs leading-5 text-slate-600">{result.summary}</p><div className="mt-4 border-t pt-3"><p className="mb-2 text-xs text-slate-500">分享给角色（可多选）</p><div className="max-h-40 overflow-y-auto">{contacts.map(c => <label key={c.id} className="flex items-center gap-2 py-1.5 text-sm"><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}/>{c.name}</label>)}</div><button type="button" disabled={!selected.length || shared} onClick={() => { onShare(result, selected); setShared(true); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"><Share2 size={16}/>{shared ? '已分享到聊天' : '分享结果卡片'}</button></div></div>}
    {backgroundDialogOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3" onClick={() => setBackgroundDialogOpen(false)}><div role="dialog" aria-modal="true" aria-label="设置五子棋背景" className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><h3 className="text-sm font-bold">棋局背景</h3><button type="button" aria-label="关闭" onClick={() => setBackgroundDialogOpen(false)}><X size={18}/></button></div><p className="mt-2 text-xs text-slate-500">选择本地图片，或粘贴图片链接。</p><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-800"><ImagePlus size={16}/>上传本地图片<input type="file" accept="image/*" className="hidden" onChange={event => void uploadBackground(event.target.files?.[0])}/></label><div className="mt-3 flex gap-2"><input aria-label="图片 URL" value={backgroundDraft} onChange={event => setBackgroundDraft(event.target.value)} placeholder="https://... 图片链接" className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs outline-none"/><button type="button" onClick={applyBackgroundUrl} className="rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white">使用链接</button></div>{backgroundError && <p role="alert" className="mt-2 text-xs text-rose-600">{backgroundError}</p>}{background && <button type="button" onClick={() => saveBackground('')} className="mt-3 text-xs text-slate-500">清除背景</button>}</div></div>}
  </section>;
}
