import { useEffect, useState } from 'react';
import { BookOpen, RotateCcw, Share2, X } from 'lucide-react';
import { chooseGoMove, goAreaScore, goGroup, newGoGame, passGoTurn, placeGoStone, resumeGoGame, type GoSize, type GoState } from '../utils/goGame';
import { BoardGameChat, type BoardGameChatLine } from './BoardGameChat';

type Contact = { id: string; name: string };
type Props = { contacts: Contact[]; userName: string; onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void; onTalk: (id: string, gameName: string, message: string, context: string, history: BoardGameChatLine[]) => Promise<string> };

export function GoGame({ contacts, userName, onShare, onTalk }: Props) {
  const [size, setSize] = useState<GoSize>(9);
  const [opponentId, setOpponentId] = useState(contacts[0]?.id ?? '');
  const [userColor, setUserColor] = useState<1 | 2>(1);
  const [game, setGame] = useState<GoState>(() => newGoGame());
  const [gameId, setGameId] = useState(() => crypto.randomUUID());
  const [selected, setSelected] = useState(-1);
  const [dead, setDead] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [notice, setNotice] = useState('');
  const opponent = contacts.find((contact) => contact.id === opponentId);
  const botColor = userColor === 1 ? 2 : 1;
  const myTurn = game.phase === 'play' && !finished && game.turn === userColor;
  const score = goAreaScore(game, dead);
  const blackName = userColor === 1 ? userName : opponent?.name ?? '角色';
  const whiteName = userColor === 2 ? userName : opponent?.name ?? '角色';
  const result = finished ? {
    id: gameId, title: '围棋对局结果',
    detail: `围棋 ${size} 路：${blackName}执黑 ${score.black} 目，${whiteName}执白 ${score.white} 目（含贴目 ${score.komi}）。${score.winner === 1 ? blackName : whiteName}获胜。共 ${game.moves} 手，提子：黑 ${game.captures[0]}、白 ${game.captures[1]}。`,
  } : null;
  const chatContext = `围棋 ${size} 路；${blackName}执黑，${whiteName}执白；当前第 ${game.moves} 手；${game.phase === 'score' ? '双方停手，正在计分' : `轮到${game.turn === 1 ? blackName : whiteName}`}；提子黑 ${game.captures[0]}、白 ${game.captures[1]}。棋盘从上到下：\n${Array.from({ length: size }, (_, row) => game.board.slice(row * size, (row + 1) * size).map((stone) => stone === 1 ? '●' : stone === 2 ? '○' : '·').join('')).join('\n')}`;
  const reset = (nextSize = size, nextColor = userColor) => {
    setSize(nextSize); setUserColor(nextColor); setGame(newGoGame(nextSize)); setGameId(crypto.randomUUID());
    setSelected(-1); setDead([]); setFinished(false); setRecipients([]); setShared(false); setNotice('');
  };
  useEffect(() => {
    if (!opponent || finished || game.phase !== 'play' || game.turn !== botColor) return;
    const timer = window.setTimeout(() => {
      const move = chooseGoMove(game);
      const next = move < 0 ? passGoTurn(game) : placeGoStone(game, move);
      if (!next) return;
      setGame((current) => current === game ? next : current);
      setNotice(move < 0 ? `${opponent.name}停一手` : next.lastCaptured.length ? `${opponent.name}提掉 ${next.lastCaptured.length} 子` : `${opponent.name}落子`);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [game, opponent, botColor, finished]);
  const clickPoint = (index: number) => {
    if (finished) return;
    if (game.phase === 'score') {
      if (!game.board[index]) return;
      const group = goGroup(game.board, index, size).stones;
      const marked = new Set(dead);
      if (group.every((stone) => marked.has(stone))) group.forEach((stone) => marked.delete(stone));
      else group.forEach((stone) => marked.add(stone));
      setDead([...marked]);
      return;
    }
    if (!myTurn || game.board[index]) return;
    if (selected !== index) { setSelected(index); return; }
    const next = placeGoStone(game, index);
    if (!next) { setNotice('此处不能落子：无气或重复局面。'); setSelected(-1); return; }
    setGame(next); setSelected(-1);
    setNotice(next.lastCaptured.length ? `你提掉 ${next.lastCaptured.length} 子` : '已落子');
  };
  const pass = () => { if (!myTurn) return; setGame(passGoTurn(game)); setSelected(-1); setNotice('你停一手'); };
  if (!contacts.length) return <div className="p-6 text-center text-sm text-slate-500">请先在通讯录添加角色，再来下围棋。</div>;
  return <section className="min-h-full bg-gradient-to-b from-[#f2e9d4] via-[#f9f3e7] to-[#e9eee6] px-3 pb-8 pt-4 text-[#3d493e]">
    <div className="mx-auto max-w-[440px] space-y-3">
      <div className="rounded-[26px] border border-white/70 bg-white/75 p-4 shadow-[0_10px_30px_rgba(97,73,34,.1)]">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.25em] text-[#9b8054]">THE QUIET BOARD</p><h2 className="mt-1 font-serif text-[23px] font-black">围棋 · 一方天地</h2><p className="mt-1 text-[11px] text-slate-500">围地、提子，等对方先露破绽。</p></div><button type="button" aria-label="围棋规则" onClick={() => setRulesOpen(true)} className="rounded-full bg-[#f2e8d4] p-2 text-[#96744a]"><BookOpen size={17}/></button></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]"><label>对手<select aria-label="围棋对手" value={opponentId} onChange={(event) => { setOpponentId(event.target.value); reset(); }} className="mt-1 w-full rounded-xl bg-[#f5f0e5] px-2 py-2 font-semibold"><option value="" disabled>选择</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label><label>棋盘<select aria-label="围棋棋盘" value={size} onChange={(event) => reset(Number(event.target.value) as GoSize)} className="mt-1 w-full rounded-xl bg-[#f5f0e5] px-2 py-2 font-semibold"><option value={9}>9 路</option><option value={13}>13 路</option></select></label><label>执子<select aria-label="围棋执子" value={userColor} onChange={(event) => reset(size, Number(event.target.value) as 1 | 2)} className="mt-1 w-full rounded-xl bg-[#f5f0e5] px-2 py-2 font-semibold"><option value={1}>黑棋</option><option value={2}>白棋</option></select></label></div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className={`rounded-2xl border bg-white/80 p-2.5 ${game.turn === 1 && game.phase === 'play' ? 'border-[#ad8250]' : 'border-white'}`}><p className="text-[10px] text-slate-500">● 黑 · 提 {game.captures[0]}</p><p className="truncate text-xs font-bold">{blackName}</p></div><span className="text-[10px] text-[#9a8d74]">VS</span><div className={`rounded-2xl border bg-white/80 p-2.5 ${game.turn === 2 && game.phase === 'play' ? 'border-[#ad8250]' : 'border-white'}`}><p className="text-[10px] text-slate-500">○ 白 · 提 {game.captures[1]}</p><p className="truncate text-xs font-bold">{whiteName}</p></div></div>
      <div className="rounded-[22px] border-[5px] border-[#b78b52] bg-[#dab374] p-2 shadow-[0_13px_30px_rgba(103,74,34,.25)]"><div className="grid aspect-square" style={{ gridTemplateColumns: `repeat(${size},1fr)`, gridTemplateRows: `repeat(${size},1fr)` }}>{game.board.map((stone, index) => <button key={index} type="button" onClick={() => clickPoint(index)} disabled={finished || game.phase === 'play' && (!myTurn || !!stone)} aria-label={`第${Math.floor(index / size) + 1}行第${index % size + 1}列${stone === 1 ? '黑子' : stone === 2 ? '白子' : '空位'}`} className="relative flex items-center justify-center"><span className={`absolute h-px bg-[#78552e]/65 ${index % size === 0 ? 'left-1/2 right-0' : index % size === size - 1 ? 'left-0 right-1/2' : 'inset-x-0'}`}/><span className={`absolute w-px bg-[#78552e]/65 ${index < size ? 'bottom-0 top-1/2' : index >= size * (size - 1) ? 'bottom-1/2 top-0' : 'inset-y-0'}`}/>{stone ? <span className={`relative z-10 h-[80%] w-[80%] rounded-full shadow-[0_2px_3px_rgba(0,0,0,.35)] ${stone === 1 ? 'bg-gradient-to-br from-[#464747] to-[#15191a]' : 'border border-stone-300 bg-gradient-to-br from-white to-[#d6d6d2]'} ${dead.includes(index) ? 'opacity-35 ring-2 ring-rose-500' : game.lastMove === index ? 'ring-2 ring-emerald-500' : ''}`}/> : selected === index && myTurn ? <span className="relative z-10 h-[72%] w-[72%] rounded-full border-2 border-emerald-600 bg-slate-800/50"/> : game.phase === 'score' && score.territory[index] === 1 ? <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-stone-800/60"/> : game.phase === 'score' && score.territory[index] === 2 ? <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-white/90"/> : null}</button>)}</div></div>
      <div className="rounded-2xl border border-white bg-white/75 p-3 text-center text-xs"><p className="font-bold text-[#5d6c5b]">{finished ? `${score.winner === 1 ? blackName : whiteName}获胜` : game.phase === 'score' ? '双方已停手 · 标记死子后确认计分' : myTurn ? '轮到你 · 点两次交叉点确认' : `${opponent?.name}正在思考…`}</p><p className="mt-1 text-[11px] text-slate-500">{notice || (game.phase === 'score' ? '点棋子可标记整组死子；有争议可继续对局。' : `${size} 路棋盘 · 白棋贴 ${score.komi} 目`)}</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => reset()} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/80 py-2.5 text-xs font-bold"><RotateCcw size={14}/>重开</button>{game.phase === 'play' ? <button type="button" disabled={!myTurn} onClick={pass} className="flex-1 rounded-xl bg-[#406657] py-2.5 text-xs font-bold text-white disabled:opacity-40">停一手</button> : !finished ? <><button type="button" onClick={() => { setGame(resumeGoGame(game)); setDead([]); setNotice('继续对局'); }} className="flex-1 rounded-xl bg-white/80 py-2.5 text-xs font-bold">继续下</button><button type="button" onClick={() => setFinished(true)} className="flex-1 rounded-xl bg-[#406657] py-2.5 text-xs font-bold text-white">确认计分</button></> : null}</div>
      <BoardGameChat key={`${gameId}-${opponentId}`} gameName="围棋" opponentId={opponentId} opponentName={opponent?.name ?? '角色'} context={chatContext} moveCount={game.moves} onTalk={onTalk}/>
      {game.phase === 'score' && <div className="rounded-2xl border border-white/70 bg-white/80 p-3 text-center text-xs"><p className="font-bold">面积计分 · 黑 {score.black} ｜白 {score.white}</p><p className="mt-1 text-[10px] text-slate-500">白棋含贴目 {score.komi}；灰化的棋组按死子移除。</p></div>}
      {result && <div className="rounded-[24px] border border-[#d4c2a1] bg-white/85 p-4"><p className="text-sm font-bold">对局结束</p><p className="mt-2 text-xs leading-5">{result.detail}</p><div className="mt-3 flex flex-wrap gap-2">{contacts.map((contact) => <label key={contact.id} className="rounded-full bg-[#f4eee4] px-2.5 py-1 text-[11px]"><input type="checkbox" checked={recipients.includes(contact.id)} onChange={() => setRecipients((current) => current.includes(contact.id) ? current.filter((id) => id !== contact.id) : [...current, contact.id])} className="mr-1"/>{contact.name}</label>)}</div><button type="button" disabled={shared || !recipients.length} onClick={() => { onShare(result, recipients); setShared(true); }} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[#406657] py-2.5 text-xs font-bold text-white disabled:opacity-40"><Share2 size={14}/>{shared ? '已分享' : '分享对局卡片'}</button></div>}
    </div>
    {rulesOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3"><div className="w-full max-w-[440px] rounded-[25px] bg-[#fffaf0] p-5 text-xs leading-6"><div className="flex items-center justify-between"><h3 className="text-base font-bold">围棋规则</h3><button type="button" aria-label="关闭规则" onClick={() => setRulesOpen(false)}><X size={17}/></button></div><p className="mt-3">黑先白后，棋子落在交叉点。相连的一组棋没有“气”时会被提走；不能自杀，也不能重复此前的棋盘局面。可以停一手，双方连续停手进入计分。</p><p className="mt-2">本玩法按棋盘上的活子和围住的空点计算面积，白棋有贴目。计分前可点击整组死子将其移除；判断有争议时点“继续下”。</p><button type="button" onClick={() => setRulesOpen(false)} className="mt-4 w-full rounded-xl bg-[#406657] py-2 text-white">知道了</button></div></div>}
  </section>;
}
