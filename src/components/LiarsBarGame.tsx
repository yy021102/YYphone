import { useEffect, useRef, useState } from 'react';
import { BookOpen, RotateCcw, Share2, Sparkles, X } from 'lucide-react';
import { botLiarAction, challengeLiar, newLiarRound, playLiarCards, type LiarCard, type LiarRound } from '../utils/liarsBar';

type Contact = { id: string; name: string };
type Props = {
  contacts: Contact[];
  userName: string;
  onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void;
  onTalk?: (characterId: string, situation: string) => Promise<string>;
};
const rankLabel: Record<LiarCard['rank'], string> = { A: 'A', K: 'K', Q: 'Q', J: 'JOKER' };
const rankName: Record<'A' | 'K' | 'Q', string> = { A: '王牌', K: '国王', Q: '皇后' };
const cardInk: Record<LiarCard['rank'], string> = { A: 'text-[#e9d293]', K: 'text-[#d5b9a6]', Q: 'text-[#e9bbc6]', J: 'text-[#b9c8ec]' };

export function LiarsBarGame({ contacts, userName, onShare, onTalk }: Props) {
  const [chosen, setChosen] = useState<string[]>(() => contacts.slice(0, 3).map((contact) => contact.id));
  const [game, setGame] = useState<LiarRound | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shareWith, setShareWith] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [tableTalk, setTableTalk] = useState<{ name: string; text: string } | null>(null);
  const talkSequence = useRef(0);
  useEffect(() => {
    if (!game || game.winner !== null || game.turn === 0) return;
    const timer = window.setTimeout(() => {
      const actor = game.seats[game.turn];
      const next = botLiarAction(game);
      if (next === game) return;
      setGame((current) => current === game ? next : current);
      const challenged = next.log.slice(-3).some((line) => line.includes('质疑'));
      const fallback = challenged ? '我可不打算就这么信了。' : '这张牌，敢接吗？';
      setTableTalk({ name: actor.name, text: fallback });
      if (challenged && onTalk) {
        const sequence = ++talkSequence.current;
        void onTalk(actor.id, `骗子酒馆牌桌：桌面声明 ${game.table}。刚才${actor.name}质疑了${game.seats[game.pending!.seat].name}。公开结果：${next.log.slice(-3).join(' ')}请只就公开结果自然说一句话。`)
          .then((text) => { if (sequence === talkSequence.current && text.trim()) setTableTalk({ name: actor.name, text: text.trim().slice(0, 90) }); })
          .catch(() => {});
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [game, onTalk]);
  const start = () => {
    const others = chosen.map((id) => contacts.find((contact) => contact.id === id)).filter((contact): contact is Contact => !!contact);
    if (others.length < 1 || others.length > 3) return;
    talkSequence.current += 1;
    setGame(newLiarRound([{ id: 'user', name: userName || '我' }, ...others]));
    setShareWith(others.map((contact) => contact.id));
    setSelected([]);
    setShared(false);
    setTableTalk(null);
  };
  const play = () => {
    if (!game || !selected.length) return;
    setGame(playLiarCards(game, 0, selected));
    setSelected([]);
  };
  const challenge = () => {
    if (!game?.pending || !myTurn) return;
    const actor = game.seats[game.pending.seat];
    const next = challengeLiar(game, 0);
    setGame(next);
    setSelected([]);
    const caught = game.pending.cards.some((card) => card.rank !== game.table && card.rank !== 'J');
    setTableTalk({ name: actor.name, text: caught ? '……被你看穿了。' : '这回是你猜错了。' });
    if (onTalk) {
      const sequence = ++talkSequence.current;
      void onTalk(actor.id, `骗子酒馆牌桌：玩家质疑了${actor.name}。公开结果：${next.log.slice(-3).join(' ')}请根据这个结果自然回应玩家一句话。`)
        .then((text) => { if (sequence === talkSequence.current && text.trim()) setTableTalk({ name: actor.name, text: text.trim().slice(0, 90) }); })
        .catch(() => {});
    }
  };
  const hand = game?.seats[0].hand ?? [];
  const myTurn = game?.turn === 0 && game.winner === null;
  const result = game?.winner !== null && game ? {
    id: game.id,
    title: '骗子酒馆 · 对局结算',
    detail: `${game.seats.map((seat) => seat.name).join('、')}在骗子酒馆进行了一场 ${game.round} 局的牌桌较量。${game.seats[game.winner!].name}最终留在桌上。${game.seats.map((seat) => `${seat.name}${seat.out ? '出局' : '留桌'}，接受 ${seat.shots} 次命运判定`).join('；')}。`,
  } : null;

  return <section className="min-h-full bg-[#11191b] px-3 pb-8 pt-4 text-[#f4ebdb]">
    <div className="mx-auto max-w-[440px] space-y-4">
      <div className="relative overflow-hidden rounded-[30px] border border-[#b59b6d]/35 bg-[radial-gradient(circle_at_70%_0%,#51402b_0%,#222a29_42%,#111719_100%)] p-5 shadow-[0_20px_45px_rgba(0,0,0,.3)]">
        <div className="pointer-events-none absolute -right-7 -top-8 h-36 w-36 rounded-full border border-[#e6cb91]/15" />
        <div className="pointer-events-none absolute right-3 top-4 text-[80px] leading-none text-[#c5a674]/10">♠</div>
        <p className="text-[10px] font-semibold tracking-[.32em] text-[#d9ba80]">THE LIAR'S TABLE</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div><h2 className="font-serif text-[28px] font-bold tracking-wide">骗子酒馆</h2><p className="mt-1 text-xs leading-5 text-[#d7cfbd]/70">说真话也要有人信。说谎之前，先看对方的眼睛。</p></div>
          <button type="button" aria-label="查看规则" onClick={() => setRulesOpen(true)} className="rounded-full border border-[#d9ba80]/35 bg-white/5 p-2.5 text-[#d9ba80]"><BookOpen size={17}/></button>
        </div>
      </div>

      {!game && <div className="space-y-4 rounded-[28px] border border-[#b59b6d]/20 bg-[#202827] p-4 shadow-xl">
        <div className="flex items-center justify-between"><div><p className="text-sm font-bold">入座名单</p><p className="mt-1 text-[11px] text-[#bfb9a9]">选择 1 至 3 位角色，与你围桌对局。</p></div><span className="rounded-full border border-[#d9ba80]/25 px-2 py-1 text-[10px] text-[#d9ba80]">{chosen.length + 1} 人局</span></div>
        <div className="flex flex-wrap gap-2">
          {contacts.map((contact) => <button key={contact.id} type="button" onClick={() => setChosen((current) => current.includes(contact.id) ? current.filter((id) => id !== contact.id) : current.length < 3 ? [...current, contact.id] : current)} className={`rounded-full border px-3 py-2 text-xs transition ${chosen.includes(contact.id) ? 'border-[#d4b67c] bg-[#d4b67c]/15 text-[#f5dc9e]' : 'border-white/10 bg-white/5 text-[#bbb8ad]'}`}>{chosen.includes(contact.id) ? '✦ ' : ''}{contact.name}</button>)}
          {contacts.length === 0 && <p className="text-xs text-[#bfb9a9]">先在微信添加至少一位角色。</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-[#bfb9a9]"><div className="rounded-xl bg-black/15 py-2">暗扣 1–3 张</div><div className="rounded-xl bg-black/15 py-2">质疑上一手</div><div className="rounded-xl bg-black/15 py-2">留到最后</div></div>
        <button type="button" disabled={chosen.length < 1} onClick={start} className="w-full rounded-2xl bg-gradient-to-r from-[#b99a66] via-[#e5c992] to-[#b99a66] py-3 text-sm font-black text-[#282319] shadow-[0_8px_24px_rgba(202,164,93,.22)] disabled:opacity-40">推门入座</button>
      </div>}

      {game && <div className="space-y-3">
        <div className="flex items-center justify-between px-1 text-[11px] text-[#d4b67c]"><span>第 {game.round} 局 · {rankName[game.table]}桌</span><button type="button" onClick={() => { if (window.confirm('结束当前对局并重新入座？')) { setGame(null); setSelected([]); } }} className="flex items-center gap-1 text-[#a9a69b]"><RotateCcw size={13}/>重新入座</button></div>
        <div className="relative overflow-hidden rounded-[32px] border border-[#9b8054]/35 bg-[radial-gradient(ellipse_at_center,#33483c_0%,#20342c_55%,#16241f_100%)] p-4 shadow-[inset_0_0_0_6px_rgba(138,100,52,.14),0_18px_40px_rgba(0,0,0,.26)]">
          <div className="grid grid-cols-3 gap-2">
            {game.seats.slice(1).map((seat, index) => <div key={seat.id} className={`min-w-0 rounded-2xl border p-2 text-center ${seat.out ? 'border-white/5 bg-black/20 opacity-40' : game.turn === index + 1 ? 'border-[#f1d497]/60 bg-[#f1d497]/15' : 'border-white/10 bg-black/20'}`}><div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#dbc08c]/20 text-sm text-[#f0d6a5]">{seat.name.slice(0, 1)}</div><p className="mt-1 truncate text-[11px] font-bold">{seat.name}</p><p className="text-[10px] text-[#d6d2c2]/65">{seat.out ? '出局' : `${seat.hand.length} 张 · 判定 ${seat.shots}/6`}</p></div>)}
          </div>
          <div className="my-5 flex items-center justify-center gap-3"><div className="h-16 w-11 -rotate-12 rounded-lg border border-[#d9c99d]/40 bg-[#172923] p-1 shadow-lg"><div className="flex h-full items-center justify-center rounded border border-[#d9c99d]/30 text-xl text-[#ccb783]">♠</div></div><div className="relative z-10 flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full border-2 border-[#d8bb7e] bg-[#14231e] shadow-[0_0_0_7px_rgba(224,194,130,.08)]"><span className="text-[9px] tracking-widest text-[#d9bc82]">TABLE</span><strong className="font-serif text-[35px] leading-none text-[#f3dda6]">{game.table}</strong></div><div className="h-16 w-11 rotate-12 rounded-lg border border-[#d9c99d]/40 bg-[#172923] p-1 shadow-lg"><div className="flex h-full items-center justify-center rounded border border-[#d9c99d]/30 text-xl text-[#ccb783]">♠</div></div></div>
          <p className="min-h-8 text-center text-[11px] text-[#f3e7c9]">{game.pending ? `${game.seats[game.pending.seat].name}刚扣下 ${game.pending.cards.length} 张 ${game.table}；轮到${game.seats[game.turn].name}。` : game.reveal ? `上一手翻开：${game.reveal.cards.map((card) => rankLabel[card.rank]).join(' · ')}` : '牌已洗好，灯下的每张脸都很镇定。'}</p>
          <div className={`mt-3 rounded-2xl border px-3 py-2 text-center text-[11px] ${game.turn === 0 ? 'border-[#f0cf8c]/50 bg-[#f0cf8c]/15 text-[#ffe4ab]' : 'border-white/10 bg-black/15 text-[#c5c6b8]'}`}>{game.seats[0].name} · {game.seats[0].out ? '已出局' : `${hand.length} 张手牌 · 已接受 ${game.seats[0].shots}/6 次判定`} {myTurn ? ' · 轮到你' : ''}</div>
        </div>

        {tableTalk && <div className="flex items-start gap-2 rounded-2xl border border-[#cfb27d]/25 bg-[#c8a975]/10 px-3 py-2.5 text-xs"><span className="shrink-0 font-bold text-[#e6c586]">{tableTalk.name}</span><span className="leading-relaxed text-[#e4ddc9]">{tableTalk.text}</span></div>}
        <div className="rounded-[26px] border border-[#b59b6d]/20 bg-[#202827] p-4">
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-[#eee1c5]">你的手牌 <span className="font-normal text-[#a9a99b]">· 点击选择最多 3 张</span></p><span className="text-[10px] text-[#b8ab8a]">JOKER 万能</span></div>
          <div className="flex min-h-[104px] flex-wrap justify-center gap-1.5">{hand.map((card) => <button key={card.id} type="button" disabled={!myTurn} aria-label={`选择 ${rankLabel[card.rank]}`} onClick={() => setSelected((current) => current.includes(card.id) ? current.filter((id) => id !== card.id) : current.length < 3 ? [...current, card.id] : current)} className={`relative h-[92px] w-[57px] rounded-xl border-2 bg-gradient-to-b from-[#45413b] to-[#2b2c29] shadow-lg transition-all ${selected.includes(card.id) ? '-translate-y-3 border-[#f2d390] shadow-[0_8px_20px_rgba(230,199,128,.2)]' : 'border-[#847760]/65'} ${myTurn ? 'active:scale-95' : 'opacity-70'}`}><span className={`absolute left-1.5 top-1 text-[10px] ${cardInk[card.rank]}`}>{rankLabel[card.rank]}</span><span className={`font-serif text-2xl font-bold ${cardInk[card.rank]}`}>{card.rank === 'J' ? '★' : card.rank}</span><span className={`absolute bottom-1 right-1.5 rotate-180 text-[10px] ${cardInk[card.rank]}`}>{rankLabel[card.rank]}</span></button>)}</div>
          {myTurn && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!selected.length} onClick={play} className="rounded-xl bg-gradient-to-r from-[#c5a46b] to-[#e4ca92] py-3 text-xs font-black text-[#292319] disabled:opacity-35">扣牌 · 声称 {game.table}</button><button type="button" disabled={!game.pending} onClick={challenge} className="rounded-xl border border-[#db9182]/50 bg-[#693d38]/45 py-3 text-xs font-bold text-[#f8c2b5] disabled:opacity-35">质疑上一手</button></div>}
          {!myTurn && game.winner === null && <p className="mt-3 text-center text-[11px] text-[#bcb6a7]"><Sparkles size={13} className="mr-1 inline"/>对手正在权衡你的话……</p>}
        </div>

        {result && <div className="rounded-[26px] border border-[#d5b97b]/45 bg-gradient-to-br from-[#4a3e2d] to-[#222a27] p-4"><p className="text-[10px] tracking-widest text-[#e1c588]">FINAL VERDICT</p><h3 className="mt-1 font-serif text-xl font-bold">{game.seats[game.winner!].name}留在了桌上</h3><p className="mt-1 text-[11px] text-[#e2d6c0]/80">{game.round} 局牌 · {game.seats.filter((seat) => seat.out).length} 人出局</p><div className="mt-3 flex flex-wrap gap-1.5">{game.seats.slice(1).map((seat) => <label key={seat.id} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px]"><input type="checkbox" checked={shareWith.includes(seat.id)} onChange={() => setShareWith((current) => current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id])} className="mr-1"/>{seat.name}</label>)}</div><button type="button" disabled={!shareWith.length || shared} onClick={() => { onShare(result, shareWith); setShared(true); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e4ca92] py-2.5 text-xs font-bold text-[#292319] disabled:opacity-40"><Share2 size={14}/>{shared ? '已分享' : '分享战绩卡片'}</button></div>}

        <div className="rounded-2xl border border-white/5 bg-black/20 p-3"><p className="mb-2 text-[10px] font-bold tracking-widest text-[#c1a978]">牌桌动静</p><div className="max-h-36 space-y-1 overflow-y-auto text-[11px] leading-5 text-[#c6c4b9]">{game.log.slice(-8).reverse().map((line, index) => <p key={`${game.round}-${index}`}>· {line}</p>)}</div></div>
      </div>}
    </div>
    {rulesOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3"><div className="w-full max-w-[440px] rounded-[28px] border border-[#c4a977]/40 bg-[#26302d] p-5 text-sm text-[#eee6d6]"><div className="flex items-center justify-between"><h3 className="font-serif text-xl font-bold">牌桌规则</h3><button type="button" aria-label="关闭规则" onClick={() => setRulesOpen(false)}><X size={18}/></button></div><div className="mt-4 space-y-2 text-xs leading-6 text-[#d5d0c1]"><p>每局指定 A、K 或 Q 为桌面牌，JOKER 可代替。每人拿 5 张牌，轮流暗扣 1–3 张，声明它们都是桌面牌。</p><p>轮到你时，可以扣牌，也可以质疑上一人的全部牌。只要有一张不符，上一人说谎；全部有效，质疑者判断错误。</p><p>输掉质疑的人接受一次命运判定。每人的六次判定中有一次会出局；幸存者洗牌再开一局，留到最后的人获胜。对手只能看到自己的手牌和公开扣牌数量。</p></div><button type="button" onClick={() => setRulesOpen(false)} className="mt-5 w-full rounded-xl bg-[#d8bb82] py-2.5 font-bold text-[#24251d]">明白了</button></div></div>}
  </section>;
}
