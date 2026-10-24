import { useEffect, useRef, useState } from 'react';
import { BookOpen, Eye, RotateCcw, Send, Share2 } from 'lucide-react';
import { actionCost, botPokerAction, cardText, formatPokerResult, HAND_NAMES, handScore, newPokerGame, pokerAction, pokerPayout, pokerSeatNet, pokerSeatPayout, type PokerCard, type PokerChatLine, type PokerGame } from '../utils/zhaJinHua';
import { pokerLedger, readPokerProgress, writePokerProgress } from '../utils/zhaJinHuaFinance';
import { readAlipayData } from '../utils/alipayData';

type Contact = { id: string; name: string };
type Props = {
  contacts: Contact[];
  userName: string;
  onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void;
  onTalk?: (characterId: string, message: string, context: string, history: PokerChatLine[]) => Promise<string>;
};

const cardColor = (card: PokerCard) => card.suit === '♥' || card.suit === '♦' ? 'text-[#bb4645]' : 'text-[#222c31]';
function PlayingCard({ card, hidden = false }: { card: PokerCard; hidden?: boolean }) {
  return <div className={`relative flex h-[76px] w-[51px] shrink-0 items-center justify-center rounded-lg border shadow-[0_5px_10px_rgba(0,0,0,.18)] ${hidden ? 'border-[#d8bd87] bg-[repeating-linear-gradient(45deg,#24443e_0px,#24443e_5px,#bda46b_5px,#bda46b_6px)]' : 'border-[#ddd5c5] bg-[#faf8f1]'}`}>
    {hidden ? <span className="rounded border border-[#d6bd86] bg-[#203a36] px-1.5 py-2 font-serif text-lg text-[#e1c890]">✦</span> : <><span className={`absolute left-1 top-0.5 text-xs font-bold ${cardColor(card)}`}>{cardText(card)}</span><span className={`text-[27px] ${cardColor(card)}`}>{card.suit}</span></>}
  </div>;
}

export function ZhaJinHuaGame({ contacts, userName, onShare, onTalk }: Props) {
  const [game, setGame] = useState<PokerGame | null>(null);
  const gameRef = useRef<PokerGame | null>(null);
  const [chosen, setChosen] = useState<string[]>(() => contacts.slice(0, 2).map(contact => contact.id));
  const [buyIn, setBuyIn] = useState(20);
  const [balance, setBalance] = useState(() => readAlipayData().balance);
  const [error, setError] = useState('');
  const [rules, setRules] = useState(false);
  const [shareWith, setShareWith] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatTarget, setChatTarget] = useState('all');
  const [talking, setTalking] = useState<string[]>([]);

  useEffect(() => {
    const saved = readPokerProgress();
    if (saved) {
      try {
        pokerLedger(saved.id, 'buy-in', saved.buyIn);
        if (saved.winner !== null) pokerLedger(saved.id, 'payout', pokerPayout(saved));
        gameRef.current = saved;
        setGame(saved);
        setShareWith(saved.seats.slice(1).map(seat => seat.id).filter(id => contacts.some(contact => contact.id === id)));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '恢复牌局失败');
        writePokerProgress(null);
      }
    }
    setBalance(readAlipayData().balance);
  }, []);

  const commit = (next: PokerGame) => {
    gameRef.current = next;
    writePokerProgress(next);
    if (next.winner !== null) {
      try { setBalance(pokerLedger(next.id, 'payout', pokerPayout(next))); }
      catch (cause) { setError(cause instanceof Error ? cause.message : '结算失败，重新进入牌局可继续结算'); }
    }
    setGame(next);
  };
  const appendChat = (senderId: string, name: string, text: string, gameId?: string): PokerChatLine | null => {
    const current = gameRef.current;
    if (!current || (gameId && current.id !== gameId)) return null;
    const line = { id: `poker-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, senderId, name, text, at: new Date().toISOString() };
    const next = { ...current, chat: [...(current.chat ?? []), line] };
    gameRef.current = next;
    writePokerProgress(next);
    setGame(next);
    return line;
  };
  const replaceChat = (gameId: string, lineId: string, text: string) => {
    const current = gameRef.current;
    if (!current || current.id !== gameId) return;
    const next = { ...current, chat: (current.chat ?? []).map(line => line.id === lineId ? { ...line, text } : line) };
    gameRef.current = next;
    writePokerProgress(next);
    setGame(next);
  };
  const askCharacter = (snapshot: PokerGame, actorId: string, message: string, fallback: string) => {
    const seat = snapshot.seats.find(item => item.id === actorId);
    if (!seat) return;
    const line = appendChat(actorId, seat.name, fallback, snapshot.id);
    if (!line || !onTalk || !contacts.some(contact => contact.id === actorId)) return;
    const context = `微信小游戏炸金花，仅是模拟牌局。公开动态：${snapshot.log.slice(-7).join(' ')}。底池 ¥${snapshot.pot}，当前闷注 ¥${snapshot.bet}。你的手牌：${seat.cards.map(cardText).join(' ')}，牌型 ${HAND_NAMES[handScore(seat.cards)[0]]}，剩余筹码 ¥${seat.chips}。对手暗牌未知。${snapshot.winner !== null ? `本局已结束，${snapshot.seats[snapshot.winner].name}获胜。` : ''}只能发言，不能改变程序决定的出牌、输赢或金额。`;
    setTalking(current => [...current, actorId]);
    void onTalk(actorId, message, context, snapshot.chat ?? [])
      .then(reply => { if (reply.trim()) replaceChat(snapshot.id, line.id, reply.trim().slice(0, 200)); })
      .catch(() => {})
      .finally(() => setTalking(current => current.filter(id => id !== actorId)));
  };
  useEffect(() => {
    if (!game || game.winner !== null || game.turn === 0) return;
    const timer = window.setTimeout(() => {
      const actor = game.seats[game.turn];
      const next = botPokerAction(game);
      if (next === game) return;
      commit(next);
      const latest = next.log[next.log.length - 1];
      if (!latest.includes('看了牌')) askCharacter(next, actor.id, `你刚才的行动：${latest}。在牌桌上自然地说一句话。`, latest.includes('弃牌') ? '这手我不跟了。' : latest.includes('比牌') ? '翻牌吧，别猜了。' : '先跟着，看你怎么出。');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [game, onTalk]);

  const start = () => {
    setError('');
    const selected = chosen.map(id => contacts.find(contact => contact.id === id)).filter((contact): contact is Contact => !!contact).slice(0, 2);
    const opponents = [...selected];
    while (opponents.length < 2) opponents.push({ id: `table-bot-${opponents.length}`, name: opponents.length ? '牌桌客人' : '牌桌客人甲' });
    const next = newPokerGame([{ id: 'user', name: userName || '我' }, ...opponents], buyIn);
    try {
      writePokerProgress(next); // 先存进度；若写账时中断，返回后可用账本 ID 对账。
      setBalance(pokerLedger(next.id, 'buy-in', buyIn));
      gameRef.current = next;
      setGame(next); setChatDraft(''); setChatTarget('all'); setShared(false); setShareWith(selected.map(contact => contact.id));
    } catch (cause) {
      writePokerProgress(null);
      setError(cause instanceof Error ? cause.message : '买入失败');
    }
  };
  const play = (action: Parameters<typeof pokerAction>[1], target?: number) => {
    if (!game || game.turn !== 0 || game.winner !== null) return;
    const next = pokerAction(game, action, target);
    if (next !== game) commit(next);
  };
  const sendChat = () => {
    const current = gameRef.current;
    const text = chatDraft.trim().slice(0, 500);
    if (!current || !text) return;
    const line = appendChat('user', current.seats[0].name, text, current.id);
    if (!line) return;
    setChatDraft('');
    const targets = current.seats.slice(1).filter(seat => chatTarget === 'all' || seat.id === chatTarget);
    for (const seat of targets) askCharacter(gameRef.current ?? current, seat.id, text, current.winner === null ? '听着呢，你继续说。' : '这局打得挺有意思。');
  };
  const leave = () => {
    if (!game) return;
    if (game.winner === null && !window.confirm('离桌将放弃已投入底池的筹码，剩余筹码会退回支付宝。确定离桌吗？')) return;
    try {
      if (game.winner === null) {
        const terminal: PokerGame = { ...game, winner: game.seats[1].folded ? 2 : 1,
          seats: game.seats.map((seat, index) => index === 0 ? { ...seat, folded: true } : seat),
          log: [...game.log, `${game.seats[0].name}离桌，未下注筹码退回支付宝。`] };
        writePokerProgress(terminal);
        setBalance(pokerLedger(game.id, 'payout', pokerPayout(terminal)));
      } else {
        setBalance(pokerLedger(game.id, 'payout', pokerPayout(game)));
      }
      writePokerProgress(null); gameRef.current = null; setGame(null); setTalking([]); setShared(false); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '退还筹码失败'); }
  };
  const myTurn = game?.turn === 0 && game.winner === null;
  const player = game?.seats[0];
  const result = game?.winner !== null && game ? {
    id: game.id, title: '炸金花 · 牌局结算',
    detail: formatPokerResult(game),
  } : null;

  return <section className="min-h-full bg-[#101b1a] px-3 pb-8 pt-4 text-[#f3ebd9]"><div className="mx-auto max-w-[440px] space-y-3">
    <div className="relative overflow-hidden rounded-[28px] border border-[#d5b878]/35 bg-[radial-gradient(circle_at_80%_0%,#536546_0%,#233b33_50%,#172621_100%)] p-5 shadow-xl">
      <div className="pointer-events-none absolute -right-4 -top-10 text-[100px] text-[#e8cd8f]/10">♠</div>
      <p className="text-[10px] font-bold tracking-[.3em] text-[#d7c087]">THREE CARD POKER</p>
      <div className="mt-2 flex items-center justify-between"><div><h2 className="font-serif text-[28px] font-bold">炸金花</h2><p className="mt-1 text-xs text-[#e6ddc7]/70">三个人，一桌暗牌，一场心理战。</p></div><button type="button" aria-label="查看规则" onClick={() => setRules(!rules)} className="rounded-full border border-[#e4cb8e]/30 p-2 text-[#e4cb8e]"><BookOpen size={17}/></button></div>
    </div>
    {rules && <div className="rounded-2xl border border-[#bda878]/25 bg-[#22322d] p-4 text-xs leading-6 text-[#dbd5c6]"><p>每人三张牌。牌型从大到小：豹子、顺金、金花、顺子、对子、单张；A23 是最小顺子，同牌比牌由发起者输。</p><p className="mt-1">闷牌可跟注、加注；看牌后投注翻倍。比牌花双倍当前注，至少两次行动后可发起。最多 15 次行动自动开牌。每局从支付宝余额买入，离桌退还未下注筹码，结局返还剩余筹码与赢得的底池。</p></div>}
    {error && <p role="alert" className="rounded-xl border border-red-300/30 bg-red-900/25 px-3 py-2 text-xs text-red-200">{error}</p>}
    {!game && <div className="space-y-4 rounded-[26px] border border-[#c5ab76]/20 bg-[#1b2a27] p-4">
      <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">入座与买入</h3><p className="mt-1 text-[11px] text-[#c1b9a3]">选择至多两位角色；空位由牌桌客人补齐。</p></div><span className="rounded-full bg-[#d6bc80]/10 px-2 py-1 text-[11px] text-[#e0c78e]">余额 ¥{balance.toFixed(2)}</span></div>
      <div className="flex flex-wrap gap-2">{contacts.map(contact => <button key={contact.id} type="button" onClick={() => setChosen(current => current.includes(contact.id) ? current.filter(id => id !== contact.id) : current.length < 2 ? [...current, contact.id] : current)} className={`rounded-full border px-3 py-1.5 text-xs ${chosen.includes(contact.id) ? 'border-[#e0c27f] bg-[#e0c27f]/15 text-[#ffe6aa]' : 'border-white/10 text-[#bebbad]'}`}>{contact.name}</button>)}</div>
      <div><p className="mb-2 text-xs text-[#d9d0b8]">每人买入</p><div className="grid grid-cols-4 gap-2">{[10, 20, 50, 100].map(amount => <button key={amount} type="button" onClick={() => setBuyIn(amount)} className={`rounded-xl border py-2 text-xs ${buyIn === amount ? 'border-[#e2c588] bg-[#dec17e]/20 text-[#f9e2a9]' : 'border-white/10 bg-white/5 text-[#bcb7a8]'}`}>¥{amount}</button>)}</div></div>
      <button type="button" disabled={balance < buyIn} onClick={start} className="w-full rounded-2xl bg-gradient-to-r from-[#b99a60] to-[#edcf8c] py-3 text-sm font-bold text-[#283026] disabled:opacity-40">买入 ¥{buyIn} · 开始牌局</button>
    </div>}
    {game && <div className="space-y-3">
      <div className="flex items-center justify-between px-1 text-[11px] text-[#d6c18f]"><span>支付宝余额 ¥{balance.toFixed(2)}</span><button type="button" onClick={leave} className="flex items-center gap-1 text-[#c9c1ad]"><RotateCcw size={13}/>{game.winner === null ? '离桌退筹码' : '再开一局'}</button></div>
      <div className="relative overflow-hidden rounded-[30px] border border-[#a88950]/45 bg-[radial-gradient(ellipse_at_center,#386b50_0%,#234b3b_53%,#17352e_100%)] p-3 shadow-[inset_0_0_0_6px_rgba(102,58,24,.18),0_15px_35px_rgba(0,0,0,.3)]">
        <div className="grid grid-cols-2 gap-2">{game.seats.slice(1).map((seat, i) => <div key={seat.id} className={`rounded-xl border p-2 text-center ${seat.folded ? 'border-white/5 bg-black/20 opacity-55' : game.turn === i + 1 && game.winner === null ? 'border-[#f1d08d] bg-[#e7c985]/15' : 'border-white/10 bg-black/15'}`}><p className="truncate text-xs font-bold">{seat.name}</p><p className="mt-0.5 text-[10px] text-[#dddbc8]/70">{seat.folded ? '已出局' : `筹码 ¥${seat.chips} · ${seat.looked ? '已看牌' : '闷牌'}`}</p><div className="mt-2 flex justify-center gap-0.5">{seat.cards.map((card, index) => <div key={index} className="scale-[.68] -mx-1.5 -my-2"><PlayingCard card={card} hidden={game.winner === null}/></div>)}</div></div>)}</div>
        <div className="my-4 flex flex-col items-center"><p className="text-[10px] tracking-[.25em] text-[#e3cf98]">POT</p><p className="font-serif text-[32px] font-bold text-[#ffe8af]">¥{game.pot}</p><p className="text-[10px] text-[#e4dec8]/70">当前闷注 ¥{game.bet} · {game.actions}/15 手</p></div>
        <div className={`rounded-xl border px-3 py-2 text-center text-xs ${myTurn ? 'border-[#e5c47c]/60 bg-[#e5c47c]/15 text-[#ffe4a2]' : 'border-white/10 bg-black/15'}`}>{game.winner !== null ? `${game.seats[game.winner].name}赢得牌局` : myTurn ? '轮到你出手' : `等待 ${game.seats[game.turn].name}…`}</div>
      </div>
      <div className="rounded-[25px] border border-[#c8ac70]/20 bg-[#1d2d29] p-4"><div className="flex justify-between text-xs"><span className="font-bold">{player?.name}的手牌</span><span className="text-[#d2bc88]">筹码 ¥{player?.chips} · {player?.looked ? HAND_NAMES[handScore(player.cards)[0]] : '未看牌'}</span></div><div className="my-4 flex justify-center gap-2">{player?.cards.map((card, i) => <PlayingCard key={i} card={card} hidden={!player.looked && game.winner === null}/>)}</div>
        {myTurn && <><div className="grid grid-cols-3 gap-2"><button type="button" disabled={player?.looked} onClick={() => play('look')} className="rounded-xl border border-[#dfc68f]/35 py-2.5 text-xs text-[#eed9a7] disabled:opacity-35"><Eye size={13} className="mr-1 inline"/>看牌</button><button type="button" disabled={(player?.chips ?? 0) < actionCost(game)} onClick={() => play('call')} className="rounded-xl bg-[#e3c582] py-2.5 text-xs font-bold text-[#26352d] disabled:opacity-35">跟注 ¥{actionCost(game)}</button><button type="button" disabled={game.bet >= Math.max(2, Math.floor(game.buyIn / 4)) || (player?.chips ?? 0) < actionCost(game, 0, Math.min(game.bet * 2, Math.max(2, Math.floor(game.buyIn / 4))))} onClick={() => play('raise')} className="rounded-xl border border-[#e3c582]/40 py-2.5 text-xs text-[#e8d5a4] disabled:opacity-35">加注</button></div><div className="mt-2 flex gap-2"><button type="button" onClick={() => play('fold')} className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs text-[#c8c2b6]">弃牌</button>{game.seats.slice(1).map((seat, i) => <button key={seat.id} type="button" disabled={seat.folded || game.actions < 2 || (player?.chips ?? 0) < actionCost(game) * 2} onClick={() => play('compare', i + 1)} className="flex-1 rounded-xl border border-[#dba884]/40 bg-[#8d5840]/20 py-2.5 text-xs text-[#f2c1a4] disabled:opacity-35">比{seat.name.slice(0, 3)}</button>)}</div></>}
      </div>
      <div className="rounded-[25px] border border-[#c8ac70]/20 bg-[#1d2d29] p-3">
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-[#e6d6aa]">牌桌聊天</p><span className="text-[10px] text-[#b8ad91]">{talking.length ? '有人正在回应…' : '聊天不消耗行动回合'}</span></div>
        <div className="max-h-56 min-h-24 space-y-2 overflow-y-auto rounded-2xl bg-black/20 p-2.5" aria-live="polite">
          {(game.chat ?? []).length ? (game.chat ?? []).map(line => <div key={line.id} className={`flex ${line.senderId === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 ${line.senderId === 'user' ? 'bg-[#d8bd82] text-[#25352e]' : 'bg-white/10 text-[#eee9da]'}`}><p className={`mb-0.5 text-[10px] font-bold ${line.senderId === 'user' ? 'text-[#5c4c30]' : 'text-[#d9c28a]'}`}>{line.name}</p><p className="whitespace-pre-wrap break-words">{line.text}</p></div></div>) : <p className="py-7 text-center text-[11px] text-[#aaa897]">想说什么都可以，牌桌上的人会接话。</p>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => setChatTarget('all')} className={`rounded-full border px-2.5 py-1 text-[10px] ${chatTarget === 'all' ? 'border-[#d9bf84] bg-[#d9bf84]/20 text-[#f7dfaa]' : 'border-white/10 text-[#bdb8aa]'}`}>全桌</button>{game.seats.slice(1).map(seat => <button key={seat.id} type="button" onClick={() => setChatTarget(seat.id)} className={`rounded-full border px-2.5 py-1 text-[10px] ${chatTarget === seat.id ? 'border-[#d9bf84] bg-[#d9bf84]/20 text-[#f7dfaa]' : 'border-white/10 text-[#bdb8aa]'}`}>{seat.name}</button>)}</div>
        <div className="mt-2 flex items-end gap-2"><textarea value={chatDraft} onChange={event => setChatDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChat(); } }} maxLength={500} rows={2} placeholder="在牌桌上说点什么…" className="min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-[#10221e] px-3 py-2 text-xs text-white outline-none placeholder:text-[#8c9c92] focus:border-[#d9bf84]/60"/><button type="button" disabled={!chatDraft.trim()} onClick={sendChat} aria-label="发送牌桌消息" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d9bf84] text-[#21352b] disabled:opacity-40"><Send size={17}/></button></div>
      </div>
      {result && <div className="rounded-[25px] border border-[#e0c481]/40 bg-gradient-to-br from-[#514b32] to-[#26332a] p-4"><p className="text-[10px] tracking-[.2em] text-[#e9d399]">SETTLEMENT</p><h3 className="mt-1 font-serif text-xl font-bold">{game.seats[game.winner!].name}赢得底池</h3><div className="mt-3 space-y-1.5">{game.seats.map((seat, index) => { const net = pokerSeatNet(game, index); return <div key={seat.id} className="flex items-start justify-between gap-2 rounded-xl bg-black/15 px-3 py-2 text-[11px]"><div><b>{seat.name}{index === game.winner ? ' 👑' : ''}</b><p className="mt-0.5 text-[#e4dcc6]/80">{seat.cards.map(cardText).join(' ')} · {HAND_NAMES[handScore(seat.cards)[0]]}</p></div><div className="shrink-0 text-right"><b className={net >= 0 ? 'text-[#f7dfaa]' : 'text-[#dcc6b5]'}>{net >= 0 ? '+' : '−'}¥{Math.abs(net)}</b><p className="mt-0.5 text-[#e4dcc6]/70">返还 ¥{pokerSeatPayout(game, index)}</p></div></div>; })}</div><p className="mt-2 text-[10px] text-[#e0d6ba]/75">完整牌面、输赢及局内对话会一起写入分享卡片。</p><div className="mt-3 flex flex-wrap gap-1.5">{game.seats.slice(1).filter(seat => contacts.some(contact => contact.id === seat.id)).map(seat => <label key={seat.id} className="rounded-full border border-white/20 px-2 py-1 text-[11px]"><input type="checkbox" checked={shareWith.includes(seat.id)} onChange={() => setShareWith(current => current.includes(seat.id) ? current.filter(id => id !== seat.id) : [...current, seat.id])} className="mr-1"/>{seat.name}</label>)}</div><button type="button" disabled={!shareWith.length} onClick={() => { onShare(result, shareWith); setShared(true); }} className="mt-3 w-full rounded-xl bg-[#e6cb8b] py-2.5 text-xs font-bold text-[#26342b] disabled:opacity-40"><Share2 size={14} className="mr-1 inline"/>{shared ? '更新分享卡片' : '分享战绩卡片'}</button></div>}
      <div className="rounded-2xl bg-black/20 p-3"><p className="mb-2 text-[10px] font-bold tracking-widest text-[#d4b87d]">牌桌动态</p><div className="max-h-36 space-y-1 overflow-y-auto text-[11px] leading-5 text-[#d1cec0]">{game.log.slice(-8).reverse().map((line, i) => <p key={`${game.actions}-${i}`}>· {line}</p>)}</div></div>
    </div>}
  </div></section>;
}
