import { useEffect, useState } from 'react';
import { BookOpen, RotateCcw, Share2, X } from 'lucide-react';
import { chooseReversiMove, newReversiGame, placeReversiStone, reversiCounts, reversiMoves, type ReversiState } from '../utils/reversiGame';
import { BoardGameChat, type BoardGameChatLine } from './BoardGameChat';

type Contact = { id: string; name: string };
type Props = { contacts: Contact[]; userName: string; onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void; onTalk: (id: string, gameName: string, message: string, context: string, history: BoardGameChatLine[]) => Promise<string> };

export function ReversiGame({ contacts, userName, onShare, onTalk }: Props) {
  const [opponentId, setOpponentId] = useState(contacts[0]?.id ?? '');
  const [userColor, setUserColor] = useState<1 | 2>(1);
  const [game, setGame] = useState<ReversiState>(() => newReversiGame());
  const [gameId, setGameId] = useState(() => crypto.randomUUID());
  const [depth, setDepth] = useState(3);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const opponent = contacts.find((contact) => contact.id === opponentId);
  const botColor = userColor === 1 ? 2 : 1;
  const legal = reversiMoves(game.board, game.turn);
  const counts = reversiCounts(game.board);
  const blackName = userColor === 1 ? userName : opponent?.name ?? '角色';
  const whiteName = userColor === 2 ? userName : opponent?.name ?? '角色';
  const winner = counts.black === counts.white ? '平局' : counts.black > counts.white ? blackName : whiteName;
  const result = game.finished ? { id: gameId, title: '黑白棋对局结果',
    detail: `黑白棋：${blackName}执黑 ${counts.black} 子，${whiteName}执白 ${counts.white} 子。${winner === '平局' ? '双方平局。' : `${winner}获胜。`}共 ${game.moves} 手。` } : null;
  const chatContext = `黑白棋第 ${game.moves} 手；${blackName}执黑 ${counts.black} 子，${whiteName}执白 ${counts.white} 子；${game.finished ? '已经终局' : `轮到${game.turn === 1 ? blackName : whiteName}`}。棋盘从上到下：\n${Array.from({ length: 8 }, (_, row) => game.board.slice(row * 8, (row + 1) * 8).map((stone) => stone === 1 ? '●' : stone === 2 ? '○' : '·').join('')).join('\n')}`;
  const reset = (color = userColor) => { setUserColor(color); setGame(newReversiGame()); setGameId(crypto.randomUUID()); setRecipients([]); setShared(false); setNotice(''); };
  useEffect(() => {
    if (!opponent || game.finished || game.turn !== botColor) return;
    const timer = window.setTimeout(() => {
      const move = chooseReversiMove(game, depth);
      if (move < 0) return;
      const next = placeReversiStone(game, move);
      if (!next) return;
      setGame((current) => current === game ? next : current);
      setNotice(next.finished ? '双方均无合法落点，对局结束。' : next.passed ? `${userName}无合法落点，自动跳过。` : `${opponent.name}翻转 ${next.flipped.length} 子`);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [game, botColor, opponent, depth, userName]);
  const play = (index: number) => {
    if (game.finished || game.turn !== userColor) return;
    const next = placeReversiStone(game, index);
    if (!next) return;
    setGame(next);
    setNotice(next.finished ? '双方均无合法落点，对局结束。' : next.passed ? `${opponent?.name}无合法落点，自动跳过。` : `翻转 ${next.flipped.length} 子`);
  };
  if (!contacts.length) return <div className="p-6 text-center text-sm text-slate-500">请先在通讯录添加角色，再来玩黑白棋。</div>;
  return <section className="min-h-full bg-gradient-to-b from-[#e7f2ec] via-[#f7faf5] to-[#e8f0ee] px-3 pb-8 pt-4 text-[#29493e]"><div className="mx-auto max-w-[440px] space-y-3">
    <div className="rounded-[26px] border border-white bg-white/80 p-4 shadow-[0_10px_30px_rgba(35,91,65,.1)]"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.25em] text-[#65a88a]">FLIP THE GAME</p><h2 className="mt-1 text-[23px] font-black">黑白棋 · 反转局势</h2><p className="mt-1 text-[11px] text-slate-500">围住对方的棋，一手翻转整排。</p></div><button type="button" aria-label="黑白棋规则" onClick={() => setRulesOpen(true)} className="rounded-full bg-emerald-50 p-2 text-emerald-700"><BookOpen size={17}/></button></div><div className="mt-4 grid grid-cols-3 gap-2 text-[11px]"><label>对手<select aria-label="黑白棋对手" value={opponentId} onChange={(event) => { setOpponentId(event.target.value); reset(); }} className="mt-1 w-full rounded-xl bg-[#edf5ef] px-2 py-2 font-semibold"><option value="" disabled>选择</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label><label>执子<select aria-label="黑白棋执子" value={userColor} onChange={(event) => reset(Number(event.target.value) as 1 | 2)} className="mt-1 w-full rounded-xl bg-[#edf5ef] px-2 py-2 font-semibold"><option value={1}>黑棋</option><option value={2}>白棋</option></select></label><label>对手棋力<select aria-label="黑白棋难度" value={depth} onChange={(event) => { setDepth(Number(event.target.value)); reset(); }} className="mt-1 w-full rounded-xl bg-[#edf5ef] px-2 py-2 font-semibold"><option value={1}>轻松</option><option value={2}>普通</option><option value={3}>认真</option></select></label></div></div>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className={`rounded-2xl border bg-white/80 p-2.5 ${game.turn === 1 && !game.finished ? 'border-emerald-500' : 'border-white'}`}><p className="text-[10px] text-slate-500">● 黑棋</p><p className="truncate text-xs font-bold">{blackName}</p><p className="mt-1 text-lg font-black">{counts.black}</p></div><span className="text-[10px] text-slate-400">VS</span><div className={`rounded-2xl border bg-white/80 p-2.5 ${game.turn === 2 && !game.finished ? 'border-emerald-500' : 'border-white'}`}><p className="text-[10px] text-slate-500">○ 白棋</p><p className="truncate text-xs font-bold">{whiteName}</p><p className="mt-1 text-lg font-black">{counts.white}</p></div></div>
    <div className="rounded-[24px] border-[6px] border-[#184f3d] bg-[#267654] p-1.5 shadow-[0_14px_30px_rgba(22,84,59,.25)]"><div className="grid aspect-square grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border border-[#164a37]"><>{game.board.map((stone, index) => <button key={index} type="button" onClick={() => play(index)} disabled={game.finished || game.turn !== userColor || !legal.includes(index)} aria-label={`第${Math.floor(index / 8) + 1}行第${index % 8 + 1}列${stone === 1 ? '黑子' : stone === 2 ? '白子' : legal.includes(index) ? '可落子' : '空位'}`} className={`relative flex items-center justify-center border border-[#154e3b]/70 ${index % 2 === Math.floor(index / 8) % 2 ? 'bg-[#2f815b]' : 'bg-[#297653]'}`}>{stone ? <span className={`h-[78%] w-[78%] rounded-full shadow-[0_3px_5px_rgba(0,0,0,.3)] ${stone === 1 ? 'bg-gradient-to-br from-[#4b5050] to-[#111619]' : 'border border-slate-200 bg-gradient-to-br from-white to-[#d9e0da]'} ${game.lastMove === index ? 'ring-2 ring-amber-300' : ''}`}/> : game.turn === userColor && legal.includes(index) && !game.finished ? <span className={`h-2 w-2 rounded-full ${userColor === 1 ? 'bg-black/30' : 'bg-white/55'}`}/> : null}</button>)}</></div></div>
    <div className="rounded-2xl border border-white bg-white/80 px-3 py-3 text-center text-xs"><p className="font-bold">{game.finished ? `${winner} · 对局结束` : game.turn === userColor ? '轮到你 · 亮点为合法落点' : `${opponent?.name}正在选择…`}</p><p className="mt-1 text-[11px] text-slate-500">{notice || '黑棋先手 · 没有合法落点时自动跳过'}</p></div>
    <button type="button" onClick={() => reset()} className="flex w-full items-center justify-center gap-1 rounded-xl bg-white/85 py-2.5 text-xs font-bold"><RotateCcw size={14}/>重新开局</button>
    <BoardGameChat key={`${gameId}-${opponentId}`} gameName="黑白棋" opponentId={opponentId} opponentName={opponent?.name ?? '角色'} context={chatContext} moveCount={game.moves} onTalk={onTalk}/>
    {result && <div className="rounded-[24px] border border-emerald-100 bg-white/90 p-4"><p className="text-sm font-bold">结算卡片</p><p className="mt-2 text-xs leading-5">{result.detail}</p><div className="mt-3 flex flex-wrap gap-2">{contacts.map((contact) => <label key={contact.id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px]"><input type="checkbox" checked={recipients.includes(contact.id)} onChange={() => setRecipients((current) => current.includes(contact.id) ? current.filter((id) => id !== contact.id) : [...current, contact.id])} className="mr-1"/>{contact.name}</label>)}</div><button type="button" disabled={shared || !recipients.length} onClick={() => { onShare(result, recipients); setShared(true); }} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Share2 size={14}/>{shared ? '已分享' : '分享对局卡片'}</button></div>}
  </div>{rulesOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3"><div className="w-full max-w-[440px] rounded-[25px] bg-white p-5 text-xs leading-6"><div className="flex items-center justify-between"><h3 className="text-base font-bold">黑白棋规则</h3><button type="button" aria-label="关闭规则" onClick={() => setRulesOpen(false)}><X size={17}/></button></div><p className="mt-3">黑棋先手。落子必须在横、竖或斜线上夹住至少一枚对方棋子，夹住的棋子全部翻面。棋盘上的亮点是你当前能下的位置。</p><p className="mt-2">没有合法落点会自动跳过；双方都无法落子时结束，棋子多的一方获胜。</p><button type="button" onClick={() => setRulesOpen(false)} className="mt-4 w-full rounded-xl bg-emerald-700 py-2 text-white">知道了</button></div></div>}</section>;
}
