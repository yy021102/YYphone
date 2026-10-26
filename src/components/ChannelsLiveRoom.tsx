import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Gift, Heart, Radio, Send, Sparkles, UsersRound, X } from 'lucide-react';
import { compressWallpaper } from '../utils/imageFile';
import { readAlipayData } from '../utils/alipayData';

export type LiveGift = { id: string; senderId: string; senderName: string; giftId: string; amount?: number; createdAt: number };
export type LiveBackground = { presetId: string; imageUrl: string };
export type LiveRoomState = { viewers: number; hearts: number; scene?: string; gifts: LiveGift[]; background?: LiveBackground;
  invitedRoleIds?: string[]; participantIds?: string[]; audience?: { min: number; max: number }; atmosphere?: string; hostActions?: string[] };
export const LIVE_GIFTS = [
  { id: 'flower', name: '小花', emoji: '🌷', price: 1 },
  { id: 'tea', name: '热茶', emoji: '🍵', price: 2 },
  { id: 'candy', name: '糖果', emoji: '🍬', price: 3 },
  { id: 'star', name: '星星', emoji: '⭐', price: 6 },
  { id: 'coffee', name: '咖啡', emoji: '☕', price: 12 },
  { id: 'bouquet', name: '花束', emoji: '💐', price: 18 },
  { id: 'cake', name: '蛋糕', emoji: '🎂', price: 38 },
  { id: 'music', name: '点歌', emoji: '🎵', price: 52 },
  { id: 'fireworks', name: '烟花', emoji: '🎆', price: 99 },
  { id: 'moon', name: '月亮船', emoji: '🌙', price: 188 },
  { id: 'castle', name: '梦幻城堡', emoji: '🏰', price: 520 },
  { id: 'galaxy', name: '星河', emoji: '🌌', price: 1314 },
] as const;
export const LIVE_BACKGROUNDS = [
  { id: 'night', name: '深夜电台', image: 'radial-gradient(ellipse at 68% 19%, #456c62 0%, #1b3734 37%, #0c1919 78%)' },
  { id: 'rose', name: '玫瑰晚霞', image: 'linear-gradient(150deg, #643e60 0%, #af6a74 45%, #362b48 100%)' },
  { id: 'blue', name: '蓝调时刻', image: 'radial-gradient(circle at 80% 5%, #397f9e 0%, #1b405e 42%, #0c1e32 100%)' },
  { id: 'amber', name: '暖光房间', image: 'linear-gradient(145deg, #6e4330 0%, #9c7653 42%, #252632 100%)' },
  { id: 'violet', name: '霓虹漫游', image: 'radial-gradient(circle at 20% 20%, #7b528f 0%, #413b72 50%, #171c38 100%)' },
] as const;

type LiveItem = {
  id: string;
  author: { id: string; name: string; avatarUrl?: string };
  text: string;
  time: number;
  replies: string[];
  replyAuthorIds?: string[];
  ended?: boolean;
  live?: LiveRoomState;
};

type Props = {
  room: LiveItem;
  me: { id: string; name: string; avatarUrl?: string };
  busy: boolean;
  error: string;
  following: boolean;
  onBack: () => void;
  onFollow: () => void;
  onSend: (text: string) => void;
  onAdvance: () => void;
  onGift: (giftId: string) => string | null;
  onBackgroundChange: (background: LiveBackground) => void;
  onLike: (amount?: number) => void;
  onAction?: (text: string) => void;
  onEnd: () => void;
};

const splitLine = (line: string) => {
  const divider = line.indexOf('：');
  return divider < 0 ? { name: '现场', text: line } : { name: line.slice(0, divider), text: line.slice(divider + 1) };
};

export function ChannelsLiveRoom({ room, me, busy, error, following, onBack, onFollow, onSend, onAdvance, onGift, onBackgroundChange, onLike, onAction, onEnd }: Props) {
  const [draft, setDraft] = useState('');
  const [action, setAction] = useState('');
  const likeCallback = useRef(onLike);
  likeCallback.current = onLike;
  const [giftOpen, setGiftOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState(() => room.live?.background?.imageUrl.startsWith('data:') ? '' : room.live?.background?.imageUrl ?? '');
  const [backgroundError, setBackgroundError] = useState('');
  const [giftError, setGiftError] = useState('');
  const [walletBalance, setWalletBalance] = useState(() => typeof window === 'undefined' ? 0 : readAlipayData().balance);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [viewerShift, setViewerShift] = useState(0);
  const [ticker, setTicker] = useState(0);
  const [hearts, setHearts] = useState<Array<{ id: number; left: number }>>([]);
  const [giftBurst, setGiftBurst] = useState<LiveGift | null>(null);
  const lastGiftId = useRef(room.live?.gifts.at(-1)?.id);
  const chatRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef(0);
  useEffect(() => {
    if (room.ended) return;
    const timer = window.setInterval(() => {
      if (document.hidden || !(room.live?.viewers ?? 0)) return;
      const count = Math.max(1, Math.min(200, Math.ceil((room.live?.viewers ?? 1) * .008 * Math.random())));
      likeCallback.current(count);
      const id = ++pulseRef.current;
      setHearts(current => [...current.slice(-3), { id, left: 87 + Math.random() * 7 }]);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [room.id, room.ended, room.live?.viewers]);

  useEffect(() => {
    if (room.ended) return;
    const audienceTimer = window.setInterval(() => {
      setViewerShift((value) => Math.max(-2, Math.min(18, value + Math.floor(Math.random() * 5) - 2)));
    }, 4200);
    const barrageTimer = window.setInterval(() => setTicker((value) => value + 1), 6200);
    return () => { window.clearInterval(audienceTimer); window.clearInterval(barrageTimer); };
  }, [room.id, room.ended]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [room.replies.length]);

  useEffect(() => {
    const latest = room.live?.gifts.at(-1);
    if (!latest || latest.id === lastGiftId.current) return;
    lastGiftId.current = latest.id;
    setGiftBurst(latest);
    const timer = window.setTimeout(() => setGiftBurst(null), 2600);
    return () => window.clearTimeout(timer);
  }, [room.live?.gifts]);

  useEffect(() => {
    const refresh = () => setWalletBalance(readAlipayData().balance);
    window.addEventListener('yyphone:finance-change', refresh);
    return () => window.removeEventListener('yyphone:finance-change', refresh);
  }, []);

  const live = room.live;
  const viewers = room.ended ? live?.viewers ?? 0 : Math.max(live?.audience?.min ?? 0,
    Math.min(live?.audience?.max ?? Infinity, (live?.viewers ?? 1) + viewerShift));
  const isHost = (line: string, index: number) => room.replyAuthorIds?.[index] ? room.replyAuthorIds[index] === room.author.id : splitLine(line).name === room.author.name;
  const audienceLines = room.replies.filter((line, index) => !isHost(line, index));
  const hostLines = room.replies.filter(isHost);
  const recent = audienceLines.slice(-60);
  const moving = audienceLines.length ? splitLine(audienceLines[(ticker + audienceLines.length - 1) % audienceLines.length]) : null;
  const gift = giftBurst ? LIVE_GIFTS.find((item) => item.id === giftBurst.giftId) : undefined;
  const background = live?.background;
  const backgroundPreset = LIVE_BACKGROUNDS.find((item) => item.id === background?.presetId) ?? LIVE_BACKGROUNDS[0];

  const saveBackgroundUrl = () => {
    const url = backgroundUrl.trim();
    if (url && !/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
      setBackgroundError('请输入 http(s) 图片链接，或上传本地图片。');
      return;
    }
    onBackgroundChange({ presetId: background?.presetId ?? 'night', imageUrl: url });
    setBackgroundError(''); setBackgroundOpen(false);
  };
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    setUploadingBackground(true); setBackgroundError('');
    try {
      const imageUrl = await compressWallpaper(file);
      onBackgroundChange({ presetId: background?.presetId ?? 'night', imageUrl });
      setBackgroundUrl(imageUrl); setBackgroundOpen(false);
    } catch (cause) { setBackgroundError(cause instanceof Error ? cause.message : '图片处理失败，请重试。'); }
    finally { setUploadingBackground(false); }
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };
  const like = () => {
    onLike();
    const id = ++pulseRef.current;
    setHearts((current) => [...current.slice(-4), { id, left: 87 + Math.random() * 7 }]);
    window.setTimeout(() => setHearts((current) => current.filter((item) => item.id !== id)), 1500);
  };

  return <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#101918] text-white">
    <style>{`
      @keyframes channel-float { from { transform: translate3d(0,20px,0); opacity: 0; } 18% { opacity: 1; } to { transform: translate3d(0,-125px,0); opacity: 0; } }
      @keyframes channel-gift { 0% { transform: translate3d(0,20px,0) scale(.6); opacity: 0; } 20% { transform: translate3d(0,0,0) scale(1.12); opacity: 1; } 70% { transform: scale(1); opacity: 1; } 100% { transform: translate3d(0,-20px,0) scale(1.05); opacity: 0; } }
      @keyframes channel-barrage { from { transform: translateX(102vw); } to { transform: translateX(-120%); } }
      @keyframes channel-glow { 0%,100% { opacity: .38; transform: scale(1); } 50% { opacity: .7; transform: scale(1.12); } }
      @media (prefers-reduced-motion: reduce) { .channel-heart, .channel-gift, .channel-barrage, .channel-glow { animation: none !important; } }
    `}</style>
    <div className="relative min-h-0 flex-1 overflow-hidden" onDoubleClick={!room.ended ? like : undefined}>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: background?.imageUrl ? `url("${background.imageUrl.replaceAll('"', '%22')}")` : backgroundPreset.image }} />
      {background?.imageUrl && <div className="absolute inset-0 bg-[#091815]/30" />}
      <div className="channel-glow absolute -right-16 top-[15%] h-60 w-60 rounded-full bg-[#a8bba1]/15 blur-3xl" style={{ animation: 'channel-glow 9s ease-in-out infinite' }} />
      <div className="channel-glow absolute -left-20 top-[45%] h-56 w-56 rounded-full bg-[#b89c75]/10 blur-3xl" style={{ animation: 'channel-glow 11s ease-in-out infinite' }} />
      <div className="absolute left-[15%] top-[20%] h-[42%] w-[70%] rounded-[45%] border border-white/[0.07]" />
      <div className="absolute left-[23%] top-[25%] h-[30%] w-[54%] rounded-[45%] border border-white/[0.06]" />
      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-[#081311] via-[#081311]/60 to-transparent" />

      <div className="absolute inset-x-0 top-0 z-20 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="退出直播间" onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur"><ArrowLeft size={20} /></button>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-black/30 p-1 pr-2 backdrop-blur">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#87b89e] text-xs font-bold">{room.author.avatarUrl ? <img alt="" src={room.author.avatarUrl} className="h-full w-full object-cover" /> : room.author.name.charAt(0)}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{room.author.name}</strong><span className="block text-[9px] text-white/65">{room.ended ? '直播已结束' : '正在直播'}</span></span>
            {room.author.id !== 'self' && <button type="button" onClick={onFollow} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${following ? 'bg-white/20' : 'bg-[#ed535e]'}`}>{following ? '已关注' : '+ 关注'}</button>}
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-2.5 py-2 text-[10px] font-semibold backdrop-blur"><UsersRound size={12} />{room.ended ? '回放' : viewers.toLocaleString('zh-CN')}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 pl-1 text-[10px]"><span className={`rounded-full px-2 py-1 font-bold tracking-wide ${room.ended ? 'bg-white/20' : 'bg-[#ef3e55]'}`}>{room.ended ? '回放' : '● 直播中'}</span><span className="rounded-full bg-black/25 px-2 py-1 text-white/75">{live?.hearts ?? 0} 喜欢 · {live?.gifts.length ?? 0} 礼物</span></div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[18%] z-10 h-24 overflow-hidden">
        {moving && !room.ended && <div key={ticker} className="channel-barrage absolute top-3 inline-flex max-w-max items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] text-white shadow-lg backdrop-blur" style={{ animation: 'channel-barrage 6s linear forwards' }}><span className="font-bold text-[#b0efd1]">{moving.name}</span>{moving.text.slice(0, 60)}</div>}
      </div>

      <div className="pointer-events-none absolute inset-x-5 top-[28%] z-[2] text-center">
        <Radio size={19} className="mx-auto mb-3 text-white/35" />
        <p className="text-[10px] font-bold tracking-[0.3em] text-white/45">LIVE MOMENT</p>
        <h2 className="mx-auto mt-3 line-clamp-3 max-w-[290px] whitespace-pre-wrap break-words text-[16px] font-semibold leading-6 text-white drop-shadow-lg">{live?.scene || room.text}</h2>
        {live?.scene && <p className="mt-3 line-clamp-2 text-[11px] text-white/50">{room.text}</p>}
      </div>
      <section aria-label="主播动态" className="absolute inset-x-4 top-[46%] z-10 max-h-[19%] overflow-y-auto rounded-2xl border border-white/20 bg-black/35 p-3 text-xs backdrop-blur-md">
        <strong className="text-[#f4d3a4]">主播 · {room.author.name}</strong>
        {(live?.hostActions ?? []).slice(-2).map((text, i) => <p key={`action-${i}`} className="mt-1 italic text-white/65">{text}</p>)}
        {hostLines.slice(-3).map((line, i) => <p key={i} className="mt-1 whitespace-pre-wrap text-white">{splitLine(line).text}</p>)}
      </section>

      {giftBurst && gift && <div key={giftBurst.id} className="channel-gift pointer-events-none absolute inset-x-5 top-[42%] z-30 flex flex-col items-center text-center" style={{ animation: 'channel-gift 2.6s ease-out forwards' }}><span className="text-6xl drop-shadow-[0_12px_28px_rgba(255,219,112,.5)]">{gift.emoji}</span><span className="mt-2 rounded-full bg-black/55 px-4 py-2 text-xs font-bold backdrop-blur">{giftBurst.senderName} 送出 {gift.name} · ¥{giftBurst.amount ?? gift.price}{room.author.id === 'self' ? ' 已入账' : ''}</span></div>}
      {hearts.map((heart) => <Heart key={heart.id} size={27} fill="#ff688c" className="channel-heart pointer-events-none absolute bottom-[90px] z-20 text-[#ff688c] drop-shadow-lg" style={{ left: `${heart.left}%`, animation: 'channel-float 1.5s ease-out forwards' }} />)}

      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3">
        <div ref={chatRef} aria-label="直播间弹幕" className="mb-2 max-h-[27vh] min-h-12 space-y-1 overflow-y-auto overscroll-contain pr-7 text-[11px] leading-5 [scrollbar-width:none]">
          {recent.length ? recent.map((line, index) => { const entry = splitLine(line); return <p key={`${index}-${line}`} className="w-fit max-w-[95%] rounded-xl bg-black/20 px-2.5 py-1 text-white/90 backdrop-blur-sm"><span className={`mr-1 font-bold ${entry.name === me.name ? 'text-[#ffd4aa]' : 'text-[#aee4cb]'}`}>{entry.name}</span>{entry.text}</p>; }) : <p className="w-fit rounded-xl bg-black/20 px-2.5 py-1 text-white/60">欢迎来到直播间，发条弹幕吧。</p>}
        </div>
        {error && <p role="alert" className="mb-2 rounded-lg bg-rose-500/30 px-2 py-1 text-[11px]">{error}</p>}
        {busy && <p role="status" className="mb-2 text-[10px] text-[#bde2c5]">现场正在继续…</p>}
      </div>
    </div>

    <div className="z-20 shrink-0 border-t border-white/10 bg-[#0a1513] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5">
      {room.ended ? <div className="flex items-center justify-between px-2 py-2 text-xs text-white/60"><span>直播已结束</span><button type="button" onClick={onBack} className="rounded-full bg-white/10 px-3 py-1.5 text-white">返回</button></div> : <>
        {room.author.id === 'self' && <div className="mb-2 flex gap-2"><input aria-label="主播行为" value={action} maxLength={1000} onChange={e => setAction(e.target.value)} placeholder="写下动作…" className="h-9 min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-xs" /><button type="button" disabled={!action.trim()} onClick={() => { onAction?.(action.trim()); setAction(''); }} className="rounded-xl bg-white/10 px-3 text-xs disabled:opacity-40">记录动作</button></div>}
        <div className="flex items-center gap-2">
          <input aria-label="发送直播弹幕" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} maxLength={300} placeholder="说点什么…" className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/10 px-4 text-xs text-white outline-none placeholder:text-white/45 focus:border-white/35" />
          <button type="button" aria-label="发送弹幕" disabled={!draft.trim()} onClick={send} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#275544] disabled:opacity-40"><Send size={15} /></button>
          {room.author.id !== 'self' && <button type="button" aria-label="送礼物" onClick={() => { setWalletBalance(readAlipayData().balance); setGiftError(''); setGiftOpen(true); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8df9b]/15 text-[#f8df9b]"><Gift size={19} /></button>}
          <button type="button" aria-label="点赞直播" onClick={like} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ef6080]/15 text-[#ff83a0]"><Heart size={19} /></button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1"><button type="button" disabled={busy} onClick={onAdvance} className="flex items-center gap-1 rounded-full bg-[#c9e9d1]/10 px-3 py-1.5 text-[10px] font-bold text-[#b5dfc1] disabled:opacity-40"><Sparkles size={13} />刷新直播</button><div className="flex items-center gap-3"><button type="button" onClick={() => { setBackgroundUrl(background?.imageUrl.startsWith('data:') ? '' : background?.imageUrl ?? ''); setBackgroundError(''); setBackgroundOpen(true); }} className="flex items-center gap-1 text-[10px] text-white/65"><Camera size={13} />背景</button>{room.author.id === 'self' && <button type="button" onClick={onEnd} className="text-[10px] text-white/50">结束直播</button>}</div></div>
      </>}
    </div>

    {giftOpen && <div className="absolute inset-0 z-40 flex items-end bg-black/55" onClick={() => setGiftOpen(false)}><section role="dialog" aria-modal="true" aria-label="送直播礼物" onClick={(event) => event.stopPropagation()} className="max-h-[85%] w-full overflow-y-auto rounded-t-[26px] bg-[#f9faf6] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-4 text-[#254638]"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-base font-bold">送礼物</h3><p className="mt-1 text-[11px] text-[#84978a]">支付宝模拟余额 ¥{walletBalance.toFixed(2)} · 送出即扣费</p></div><button type="button" aria-label="关闭礼物面板" onClick={() => setGiftOpen(false)} className="rounded-full bg-[#ecf1e9] p-2"><X size={17} /></button></div>{giftError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-2 text-[11px] text-rose-700">{giftError}</p>}<div className="grid grid-cols-4 gap-2">{LIVE_GIFTS.map((giftItem) => <button type="button" key={giftItem.id} onClick={() => { const failure = onGift(giftItem.id); if (failure) setGiftError(failure); else { setGiftError(''); setGiftOpen(false); } }} className="rounded-2xl bg-white px-2 py-3 text-center shadow-sm active:scale-95"><span className="block text-3xl">{giftItem.emoji}</span><span className="mt-2 block text-[11px] font-semibold">{giftItem.name}</span><span className="mt-1 block text-[10px] font-bold text-[#a7774f]">¥{giftItem.price}</span></button>)}</div></section></div>}

    {backgroundOpen && <div className="absolute inset-0 z-40 flex items-end bg-black/55" onClick={() => setBackgroundOpen(false)}><section role="dialog" aria-modal="true" aria-label="自定义直播背景" onClick={(event) => event.stopPropagation()} className="max-h-[86%] w-full overflow-y-auto rounded-t-[26px] bg-[#f9faf6] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-4 text-[#254638]"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-base font-bold">直播背景</h3></div><button type="button" aria-label="关闭背景设置" onClick={() => setBackgroundOpen(false)} className="rounded-full bg-[#ecf1e9] p-2"><X size={17} /></button></div><div className="grid grid-cols-3 gap-2">{LIVE_BACKGROUNDS.map((preset) => <button type="button" key={preset.id} onClick={() => { onBackgroundChange({ presetId: preset.id, imageUrl: '' }); setBackgroundUrl(''); setBackgroundOpen(false); }} className={`overflow-hidden rounded-xl border text-left ${background?.presetId === preset.id && !background.imageUrl ? 'border-[#3a986d]' : 'border-transparent'}`}><span className="block h-16" style={{ backgroundImage: preset.image }} /><span className="block bg-white px-2 py-1.5 text-[10px] font-semibold">{preset.name}</span></button>)}</div><label className="mt-4 block text-[11px] font-semibold">图片链接<input value={backgroundUrl} onChange={(event) => setBackgroundUrl(event.target.value)} placeholder={background?.imageUrl.startsWith('data:') ? '已使用本地图片，可输入链接替换' : 'https://...'} className="mt-1 w-full rounded-xl border border-[#dde8df] bg-white px-3 py-2 text-xs outline-none" /></label><div className="mt-3 flex gap-2"><label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-[#e6f0e7] px-3 py-2.5 text-[11px] font-bold text-[#30694e]">{uploadingBackground ? '处理中…' : '上传本地图片'}<input type="file" accept="image/*" disabled={uploadingBackground} className="hidden" onChange={(event) => { void uploadBackground(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><button type="button" onClick={saveBackgroundUrl} className="flex-1 rounded-xl bg-[#287050] px-3 py-2.5 text-[11px] font-bold text-white">应用链接</button></div>{backgroundError && <p role="alert" className="mt-2 text-[11px] text-rose-600">{backgroundError}</p>}</section></div>}
  </div>;
}
