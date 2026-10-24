import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Compass, Heart, MessageCircle, Radio, UserRound,
  Sparkles, Plus, X, Search, Send, RefreshCw, Play, UsersRound,
} from 'lucide-react';
import { ChannelsProfile, type ChannelSettings } from './ChannelsProfile';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { requestConfiguredAiText } from '../utils/aiApi';
import { getWorldBookEntriesForContacts } from '../utils/worldBookPrompt';
import { ChannelsLiveRoom, LIVE_BACKGROUNDS, LIVE_GIFTS, type LiveBackground, type LiveGift, type LiveRoomState } from './ChannelsLiveRoom';
import { settleChannelGiftPayment } from '../utils/channelGiftFinance';
import { writeAlipayData } from '../utils/alipayData';

type Person = { id: string; name: string; avatarUrl?: string; persona?: string };
type Item = { id: string; author: Person; text: string; time: number; liked?: boolean; replies: string[]; ended?: boolean; live?: LiveRoomState };
type Kind = 'posts' | 'rooms' | 'messages';
type Data = { posts: Item[]; rooms: Item[]; messages: Item[]; following: string[] };
type Tab = 'plaza' | 'live' | 'messages' | 'me';
type Focus = { kind: Kind; id: string };

const DATA_KEY = 'yyphone:channels:life-v1';
const PROFILE_KEY = 'yyphone:channels:profile-settings';
const empty: Data = { posts: [], rooms: [], messages: [], following: [] };
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validLive = (value: unknown): value is LiveRoomState => isRecord(value) &&
  typeof value.viewers === 'number' && typeof value.hearts === 'number' &&
  (value.scene === undefined || typeof value.scene === 'string') &&
  Array.isArray(value.gifts) && value.gifts.every((gift: unknown) => isRecord(gift) &&
    typeof gift.id === 'string' && typeof gift.senderId === 'string' &&
    typeof gift.senderName === 'string' && typeof gift.giftId === 'string' && typeof gift.createdAt === 'number' &&
    (gift.amount === undefined || typeof gift.amount === 'number')) &&
  (value.background === undefined || isRecord(value.background) &&
    typeof value.background.presetId === 'string' && typeof value.background.imageUrl === 'string');
const validItem = (value: unknown): value is Item => isRecord(value) && typeof value.id === 'string' &&
  isRecord(value.author) && typeof value.author.id === 'string' && typeof value.author.name === 'string' &&
  typeof value.text === 'string' && typeof value.time === 'number' &&
  Array.isArray(value.replies) && value.replies.every((reply) => typeof reply === 'string') &&
  (value.live === undefined || validLive(value.live));
const validData = (value: unknown): value is Data => isRecord(value) &&
  ['posts', 'rooms', 'messages'].every((key) => Array.isArray(value[key]) && (value[key] as unknown[]).every(validItem)) &&
  Array.isArray(value.following) && value.following.every((id) => typeof id === 'string');
const make = (author: Person, text: string): Item => ({ id: crypto.randomUUID(), author, text, time: Date.now(), replies: [] });
const makeRoom = (author: Person, text: string): Item => ({ ...make(author, text), live: { viewers: author.id === 'self' ? 1 : 18 + Math.floor(Math.random() * 180), hearts: 0, gifts: [] } });
const tabs = [
  { id: 'plaza', label: '广场', icon: Compass },
  { id: 'live', label: '直播', icon: Radio },
  { id: 'messages', label: '私信', icon: MessageCircle },
  { id: 'me', label: '我', icon: UserRound },
] as const;
const strangers = ['巷口的风', '晚睡的橘子', '山间来信', '今天慢一点', '雨停以后', '第七页日记'];
const stranger = (): Person => ({ id: `stranger:${crypto.randomUUID()}`, name: strangers[Math.floor(Math.random() * strangers.length)] });
const formatTime = (time: number) => new Date(time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const textInput = 'w-full rounded-2xl border border-[#dce8e2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#49977d]';

function Avatar({ person, image, size = 'md' }: { person: Person; image?: string; size?: 'md' | 'lg' }) {
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#d5eadc] to-[#b2d8cd] font-bold text-[#265f53] ${size === 'lg' ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-sm'}`}>
    {image || person.avatarUrl ? <img alt={`${person.name}头像`} src={image || person.avatarUrl} className="h-full w-full object-cover" /> : person.name.slice(0, 1)}
  </span>;
}

export function ChannelsApp({ userName, avatarUrl, contacts, onBack }: { userName: string; avatarUrl?: string; contacts: Person[]; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('plaza');
  const [data, setData] = useState(() => readStoredValue(DATA_KEY, empty, validData));
  const dataRef = useRef(data);
  dataRef.current = data;
  const [panel, setPanel] = useState<'compose' | 'refresh' | null>(null);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState('');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { writeStoredValue(DATA_KEY, data); }, [data]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [tab, focus?.id]);

  const profile = readStoredValue<{ settings?: ChannelSettings }>(PROFILE_KEY, {},
    (value): value is { settings?: ChannelSettings } => isRecord(value));
  const settings = profile.settings;
  const me: Person = { id: 'self', name: settings?.nickname?.trim() || userName || '我', avatarUrl: settings?.avatarUrl || avatarUrl };
  const selected = focus ? data[focus.kind].find((item) => item.id === focus.id) : undefined;
  const followed = (id: string) => data.following.includes(id);
  const isFriend = (id: string) => contacts.some((contact) => contact.id === id);

  const kind: Kind = tab === 'live' ? 'rooms' : tab === 'messages' ? 'messages' : 'posts';
  const items = useMemo(() => data[kind].filter((item) => {
    const matchesFilter = tab === 'messages'
      ? filter === 'all' ? isFriend(item.author.id) : !isFriend(item.author.id)
      : filter === 'self' ? item.author.id === 'self'
        : filter === 'following' ? followed(item.author.id) : item.author.id !== 'self';
    return matchesFilter && `${item.author.name} ${item.text} ${item.replies.join(' ')}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => b.time - a.time), [data, kind, filter, search, tab, contacts]);

  const add = (target: Kind, item: Item) => setData((current) => ({ ...current, [target]: [item, ...current[target]] }));
  const update = (target: Kind, id: string, change: (item: Item) => Item) => setData((current) => ({
    ...current, [target]: current[target].map((item) => item.id === id ? change(item) : item),
  }));
  const commitData = (next: Data) => {
    writeStoredValue(DATA_KEY, next);
    dataRef.current = next;
    setData(next);
  };
  const recordGift = (roomId: string, gift: LiveGift, charge: 'sent' | 'received' | null) => {
    const current = dataRef.current;
    const room = current.rooms.find((item) => item.id === roomId);
    const choice = LIVE_GIFTS.find((item) => item.id === gift.giftId);
    if (!room || room.ended || !choice) throw new Error('这场直播已结束，礼物未送出。');
    if (room.live?.gifts.some((item) => item.id === gift.id)) return;
    const next: Data = { ...current, rooms: current.rooms.map((item) => item.id !== roomId ? item : ({
      ...item,
      time: Date.now(),
      replies: [...item.replies, `${gift.senderName}：送出了${choice.name}（¥${choice.price}）`],
      live: { viewers: item.live?.viewers ?? 1, scene: item.live?.scene, hearts: item.live?.hearts ?? 0,
        background: item.live?.background, gifts: [...(item.live?.gifts ?? []), gift] },
    })) };
    const payment = charge ? settleChannelGiftPayment({ eventId: gift.id, direction: charge, amount: choice.price }) : null;
    try {
      commitData(next);
    } catch (cause) {
      if (payment?.previous) {
        writeAlipayData(payment.previous);
        if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('yyphone:finance-change'));
      }
      throw cause;
    }
  };
  const open = (target: Kind, id: string) => { setFocus({ kind: target, id }); setReply(''); };
  const switchTab = (next: Tab) => { setTab(next); setPanel(null); setFocus(null); setFilter('all'); setSearch(''); setReply(''); setError(''); };
  const follow = (id: string) => setData((current) => ({ ...current,
    following: current.following.includes(id) ? current.following.filter((value) => value !== id) : [...current.following, id],
  }));
  const openMessage = (author: Person) => {
    const existing = data.messages.find((item) => item.author.id === author.id);
    const item = existing ?? make(author, '');
    if (!existing) add('messages', item);
    setTab('messages'); setPanel(null); setFilter(isFriend(author.id) ? 'all' : 'stranger'); open('messages', item.id);
  };

  const cast = () => {
    const linked = settings?.roles?.map((role) => contacts.find((contact) => contact.id === role.contactId))
      .filter((contact): contact is Person => !!contact) ?? [];
    return linked.length ? linked : contacts;
  };
  const promptContext = (actors: Person[]) => [
    '你正在续写一个小手机内的虚构视频号平台。内容真实自然，符合人物设定、已有关系和时间线。不替玩家发言或决定行动。只输出 JSON。',
    `玩家：${JSON.stringify(me)}；玩家在平台的身份：${settings?.identity || '普通用户'}。`,
    `平台设定：${settings?.platformSetting || '一个分享生活与直播的社交平台'}`,
    `平台专用提示词：${settings?.prompt || '无'}`,
    `相关角色人设：${JSON.stringify(actors.map((actor) => ({ id: actor.id, name: actor.name, persona: actor.persona || '', role: settings?.roles?.find((role) => role.contactId === actor.id) })))}`,
    `角色彼此关系：${JSON.stringify(settings?.relationships ?? [])}`,
    `世界书：${getWorldBookEntriesForContacts(actors.map((actor) => actor.id), settings?.worldBookIds).join('\n') || '无'}`,
  ].join('\n');

  async function generate(targetKind: Kind, target?: Item, chosen?: Person) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const audience = cast();
    const actor = target?.author.id === 'self'
      ? audience[Math.floor(Math.random() * audience.length)] ?? stranger()
      : target?.author ?? chosen ?? stranger();
    try {
      const task = target
        ? `请以 ${actor.name} 的身份接续${targetKind === 'rooms' ? '直播间现场与弹幕' : targetKind === 'messages' ? '私信' : '帖子评论'}。原内容：${JSON.stringify(target)}。只回复最新互动，保持自然，不能替玩家说话。返回 {"text":"一段回应"}。`
        : `请以 ${actor.name} 的身份生成${targetKind === 'posts' ? '生活帖子' : targetKind === 'rooms' ? '直播标题和开场场景' : '主动发给玩家的私信'}。用户给的方向：${draft.trim() || '自由日常'}。近期内容：${JSON.stringify(data[targetKind].slice(0, 6))}。返回 {"text":"内容"}。`;
      const result: unknown = JSON.parse(await requestConfiguredAiText(promptContext([actor]), task, { json: true, maxTokens: 1400 }));
      if (!isRecord(result) || typeof result.text !== 'string' || !result.text.trim()) throw new Error('返回内容不完整，请重试。');
      const content = result.text.trim().slice(0, 4000);
      if (target) update(targetKind, target.id, (item) => ({ ...item, time: Date.now(), replies: [...item.replies, `${actor.name}：${content}`] }));
      else if (targetKind === 'messages') setData((current) => {
        const existing = current.messages.find((item) => item.author.id === actor.id);
        return { ...current, messages: existing
          ? current.messages.map((item) => item.id === existing.id ? { ...item, time: Date.now(), replies: [...item.replies, `${actor.name}：${content}`] } : item)
          : [make(actor, content), ...current.messages] };
      });
      else add(targetKind, targetKind === 'rooms' ? makeRoom(actor, content) : make(actor, content));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '生成失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function refreshFeed() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setPanel(null);
    const targetKind: 'posts' | 'rooms' = tab === 'live' ? 'rooms' : 'posts';
    const people = [...cast().slice(0, 3), stranger(), stranger()];
    try {
      const task = `请为名单中每个人各写一条${targetKind === 'rooms' ? '直播标题与开场场景' : '生活帖子'}，各有不同的生活细节和说话方式。名单：${JSON.stringify(people)}。方向：${draft.trim() || '自由日常'}。近期内容：${JSON.stringify(data[targetKind].slice(0, 6))}。返回 {"items":[{"authorId":"名单中的 ID","text":"内容"}]}。`;
      const result: unknown = JSON.parse(await requestConfiguredAiText(promptContext(people), task, { json: true, maxTokens: 2800 }));
      if (!isRecord(result) || !Array.isArray(result.items)) throw new Error('刷新内容格式不完整，请重试。');
      const entries: unknown[] = result.items;
      const generated = people.map((person) => {
        const entry = entries.find((value) => isRecord(value) && value.authorId === person.id);
        if (!isRecord(entry) || typeof entry.text !== 'string' || !entry.text.trim()) throw new Error('刷新内容不完整，请重试。');
        return targetKind === 'rooms' ? makeRoom(person, entry.text.trim().slice(0, 4000)) : make(person, entry.text.trim().slice(0, 4000));
      });
      setData((current) => ({ ...current, [targetKind]: [...generated, ...current[targetKind]] }));
      setDraft(''); setFilter('all');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '刷新失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function advanceLive(room: Item) {
    if (lock.current || room.ended) return;
    lock.current = true; setBusy(true); setError('');
    const actors = [room.author, ...cast(), stranger(), stranger()]
      .filter((person, index, list) => person.id !== 'self' && list.findIndex((other) => other.id === person.id) === index);
    try {
      const task = [
        `续写直播间「${room.text}」。主播：${room.author.name}；${room.author.id === 'self' ? '主播是玩家，不代替玩家说话或做动作。' : '主播可以自然说话、做事。'}`,
        `目前场景：${room.live?.scene || room.text}`,
        `最近弹幕与互动：${JSON.stringify(room.replies.slice(-22))}`,
        `可发言的主播与观众：${JSON.stringify(actors.map(({ id, name }) => ({ id, name })))}`,
        '推进一点现场变化，体现主播与观众的呼应；弹幕有不同语气，不要刷重复短句。不要编造玩家发言或已经发生的礼物。',
        `可用礼物和价格：${LIVE_GIFTS.map((gift) => `${gift.id}=¥${gift.price}`).join('、')}。礼物由观众送给主播；若主播是玩家，收到礼物会按标价入账，所以只有剧情自然合适时才送，保持低频。`,
        `返回 JSON：{"scene":"本轮现场画面/声音的简短描写","messages":[{"authorId":"名单中的 ID","text":"一条自然弹幕或主播发言"}],"gift":{"authorId":"名单中的 ID","giftId":"有效礼物 ID"}}。messages 2 至 5 条；gift 可省略。`,
      ].join('\n');
      const result: unknown = JSON.parse(await requestConfiguredAiText(promptContext(actors), task, { json: true, maxTokens: 1700 }));
      if (!isRecord(result) || typeof result.scene !== 'string' || !result.scene.trim() || !Array.isArray(result.messages)) throw new Error('直播现场内容不完整，请重试。');
      const scene = result.scene.trim().slice(0, 220);
      const lines = result.messages.slice(0, 5).flatMap((value: unknown) => {
        if (!isRecord(value) || typeof value.authorId !== 'string' || typeof value.text !== 'string' || !value.text.trim()) return [];
        const speaker = actors.find((actor) => actor.id === value.authorId);
        return speaker ? [`${speaker.name}：${value.text.trim().slice(0, 180)}`] : [];
      });
      if (!lines.length) throw new Error('直播弹幕为空，请重试。');
      const speakerCount = new Set(lines.map((line) => line.split('：', 1)[0])).size;
      const rawGift = isRecord(result.gift) ? result.gift : null;
      const giftSender = rawGift && typeof rawGift.authorId === 'string' ? actors.find((actor) => actor.id === rawGift.authorId && actor.id !== room.author.id) : undefined;
      const giftChoice = rawGift && typeof rawGift.giftId === 'string' ? LIVE_GIFTS.find((gift) => gift.id === rawGift.giftId) : undefined;
      const latest = dataRef.current;
      const latestRoom = latest.rooms.find((item) => item.id === room.id);
      if (!latestRoom || latestRoom.ended) return;
      commitData({ ...latest, rooms: latest.rooms.map((current) => {
        if (current.id !== room.id) return current;
        const live = current.live ?? { viewers: current.author.id === 'self' ? 1 : 38, hearts: 0, gifts: [] };
        return { ...current, time: Date.now(), replies: [...current.replies, ...lines],
          live: { ...live, viewers: Math.max(live.viewers, speakerCount + 1), scene } };
      }) });
      if (giftSender && giftChoice) {
        const gift: LiveGift = { id: crypto.randomUUID(), senderId: giftSender.id, senderName: giftSender.name,
          giftId: giftChoice.id, amount: giftChoice.price, createdAt: Date.now() };
        recordGift(room.id, gift, room.author.id === 'self' ? 'received' : null);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '直播现场生成失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  const autoStarted = useRef(new Set<string>());
  useEffect(() => {
    if (focus?.kind !== 'rooms' || !selected || selected.ended || selected.replies.length || autoStarted.current.has(selected.id)) return;
    autoStarted.current.add(selected.id);
    void advanceLive(selected);
  }, [focus?.id, focus?.kind, selected?.id]);

  const sendLive = (room: Item, text: string) => update('rooms', room.id, (current) => ({
    ...current, time: Date.now(), replies: [...current.replies, `${me.name}：${text}`],
  }));
  const likeLive = (room: Item) => update('rooms', room.id, (current) => ({ ...current,
    live: { ...current.live, viewers: current.live?.viewers ?? 1, scene: current.live?.scene,
      gifts: current.live?.gifts ?? [], hearts: (current.live?.hearts ?? 0) + 1 },
  }));
  const giveLive = (room: Item, giftId: string): string | null => {
    const giftChoice = LIVE_GIFTS.find((gift) => gift.id === giftId);
    if (!giftChoice || room.author.id === 'self') return '不能给自己的直播间送礼。';
    const gift: LiveGift = { id: crypto.randomUUID(), senderId: me.id, senderName: me.name,
      giftId, amount: giftChoice.price, createdAt: Date.now() };
    try { recordGift(room.id, gift, 'sent'); return null; }
    catch (cause) { return cause instanceof Error ? cause.message : '礼物结算失败，请重试。'; }
  };
  const changeLiveBackground = (room: Item, background: LiveBackground) => update('rooms', room.id, (current) => ({
    ...current, live: { viewers: current.live?.viewers ?? 1, hearts: current.live?.hearts ?? 0,
      scene: current.live?.scene, gifts: current.live?.gifts ?? [], background },
  }));

  const sendReply = () => {
    if (!focus || !selected || !reply.trim()) return;
    update(focus.kind, selected.id, (item) => ({ ...item, time: Date.now(), replies: [...item.replies, `${me.name}：${reply.trim()}`] }));
    setReply('');
  };
  const create = () => {
    if (!draft.trim()) return;
    const targetKind = tab === 'live' ? 'rooms' : 'posts';
    const item = targetKind === 'rooms' ? makeRoom(me, draft.trim()) : make(me, draft.trim());
    add(targetKind, item); setDraft(''); setPanel(null); setFilter('self');
    if (targetKind === 'rooms') open(targetKind, item.id);
  };

  const feedCard = (item: Item) => {
    const live = kind === 'rooms';
    const liveBackground = item.live?.background;
    const livePreset = LIVE_BACKGROUNDS.find((preset) => preset.id === liveBackground?.presetId) ?? LIVE_BACKGROUNDS[0];
    return <article key={item.id} className="overflow-hidden rounded-[24px] border border-[#e8eee9] bg-white shadow-[0_8px_24px_rgba(28,64,50,0.045)]">
      {live && <button type="button" onClick={() => open(kind, item.id)} className="relative flex h-[168px] w-full items-center justify-center overflow-hidden bg-cover bg-center text-white" style={{ backgroundImage: liveBackground?.imageUrl ? `url("${liveBackground.imageUrl.replaceAll('"', '%22')}")` : livePreset.image }}>
        <span className="absolute -left-12 -bottom-20 h-44 w-44 rounded-full border border-white/15" />
        <span className="absolute right-5 top-5 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold tracking-widest backdrop-blur-sm">{item.ended ? '回放' : '● LIVE'}</span>
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/15 backdrop-blur-sm"><Play size={22} fill="currentColor" /></span>
        <span className="absolute bottom-4 left-5 flex items-center gap-1.5 text-[11px] text-white/85"><UsersRound size={13} />{item.ended ? '直播回放' : `${(item.live?.viewers ?? 38).toLocaleString('zh-CN')} 人在看`} · {item.author.name}</span>
      </button>}
      <div className="p-4">
        <div className="flex items-center gap-2.5"><Avatar person={item.author} image={item.author.id === 'self' ? me.avatarUrl : undefined} />
          <div className="min-w-0 flex-1"><strong className="block truncate text-[13px] text-[#1e3932]">{item.author.name}</strong><span className="text-[10px] text-[#96a69f]">{formatTime(item.time)}</span></div>
          {item.author.id !== 'self' && <button type="button" onClick={() => follow(item.author.id)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${followed(item.author.id) ? 'bg-[#eef4ef] text-[#5b7769]' : 'bg-[#225f4f] text-white'}`}>{followed(item.author.id) ? '已关注' : '+ 关注'}</button>}
        </div>
        <button type="button" onClick={() => open(kind, item.id)} className="mt-3 block w-full whitespace-pre-wrap break-words text-left text-[13px] leading-6 text-[#2f4038]">{item.text}</button>
        <div className="mt-4 flex items-center gap-4 border-t border-[#f0f3ef] pt-3 text-[11px] text-[#789084]">
          {!live && <button type="button" aria-label="喜欢帖子" aria-pressed={!!item.liked} onClick={() => update('posts', item.id, (current) => ({ ...current, liked: !current.liked }))} className={`flex items-center gap-1 ${item.liked ? 'text-rose-500' : ''}`}><Heart size={15} fill={item.liked ? 'currentColor' : 'none'} />{item.liked ? '已喜欢' : '喜欢'}</button>}
          <button type="button" onClick={() => open(kind, item.id)} className="flex items-center gap-1"><MessageCircle size={15} />{item.replies.length ? `${item.replies.length} 条互动` : live ? '进入直播' : '评论'}</button>
          {item.author.id !== 'self' && <button type="button" onClick={() => openMessage(item.author)} className="ml-auto flex items-center gap-1">私信 <ArrowRight size={13} /></button>}
        </div>
      </div>
    </article>;
  };

  return <section className="relative flex h-full min-h-0 flex-col bg-[#f5f7f4] text-[#263b32]">
    <div ref={scrollRef} className={`min-h-0 flex-1 overscroll-contain ${focus?.kind === 'rooms' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      {tab === 'me' ? <><button type="button" aria-label="返回发现" onClick={onBack} className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-sm"><X size={18} /></button><ChannelsProfile userName={userName} avatarUrl={avatarUrl} contacts={contacts} /></> : <>
        {focus?.kind !== 'rooms' && <header className="sticky top-0 z-10 border-b border-[#e8ede8] bg-white/95 px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button type="button" aria-label={focus ? '返回列表' : '返回发现'} onClick={() => focus ? setFocus(null) : onBack()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f6f2]"><ArrowLeft size={19} /></button>
            <div className="min-w-0 flex-1"><p className="text-[9px] font-bold tracking-[0.2em] text-[#74917e]">WECHAT CHANNELS</p><h1 className="truncate text-[19px] font-black tracking-tight">{selected ? focus?.kind === 'messages' ? selected.author.name : '动态详情' : tab === 'plaza' ? '发现生活' : tab === 'live' ? '正在发生' : '私信'}</h1></div>
            {!focus && <><button type="button" aria-label={tab === 'messages' ? '发起聊天' : tab === 'live' ? '我要开播' : '发布帖子'} onClick={() => setPanel('compose')} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff3ef]"><Plus size={19} /></button><button type="button" aria-label="生成内容" disabled={busy} onClick={() => setPanel('refresh')} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#246b54] text-white disabled:opacity-40"><Sparkles size={17} /></button></>}
          </div>
        </header>}
        {focus?.kind !== 'rooms' && error && <p role="alert" className="mx-4 mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        {focus?.kind !== 'rooms' && busy && <p role="status" className="mx-4 mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">正在让故事继续…</p>}
        {selected && focus ? focus.kind === 'rooms' ? <ChannelsLiveRoom room={selected} me={me} busy={busy} error={error} following={followed(selected.author.id)} onBack={() => setFocus(null)} onFollow={() => follow(selected.author.id)} onSend={(text) => sendLive(selected, text)} onAdvance={() => void advanceLive(selected)} onGift={(giftId) => giveLive(selected, giftId)} onBackgroundChange={(background) => changeLiveBackground(selected, background)} onLike={() => likeLive(selected)} onEnd={() => update('rooms', selected.id, (item) => ({ ...item, ended: true }))} /> : <div className="flex min-h-full flex-col px-4 pb-5 pt-4">
          <article className="rounded-[24px] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><Avatar person={selected.author} image={selected.author.id === 'self' ? me.avatarUrl : undefined} /><div><strong className="text-sm">{selected.author.name}</strong><p className="text-[10px] text-slate-400">{formatTime(selected.time)}</p></div></div>{selected.text && <p className="whitespace-pre-wrap break-words text-sm leading-7">{selected.text}</p>}{!selected.text && focus.kind === 'messages' && <p className="text-xs text-[#9eada3]">给 {selected.author.name} 发一条消息，开始对话。</p>}</article>
          <div className="mt-5 mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#789185]"><span className="h-px flex-1 bg-[#dfe8df]" />{focus.kind === 'messages' ? '对话记录' : '评论区'}<span className="h-px flex-1 bg-[#dfe8df]" /></div>
          <div className="space-y-2 pb-3">{selected.replies.length ? selected.replies.map((line, index) => <p key={index} className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-xs leading-6 ${line.startsWith(`${me.name}：`) ? 'ml-auto rounded-br-sm bg-[#d9eddb]' : 'mr-auto rounded-bl-sm bg-white'}`}>{line}</p>) : <p className="py-8 text-center text-xs text-[#9eada3]">还没有互动，写下第一句吧。</p>}</div>
          <div className="mt-auto rounded-[22px] border border-[#e7ede8] bg-white p-3 shadow-sm"><textarea aria-label="互动内容" className="min-h-16 w-full resize-none bg-transparent px-1 text-sm leading-6 outline-none" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={focus.kind === 'posts' ? '留下一条评论…' : '说点什么…'} maxLength={4000} /><div className="flex items-center gap-2"><button type="button" disabled={busy} onClick={() => void generate(focus.kind, selected)} className="rounded-full bg-[#edf4ed] px-3 py-2 text-[11px] font-bold text-[#356a57] disabled:opacity-40">生成回应</button><button type="button" disabled={!reply.trim() || busy} onClick={sendReply} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#246b54] text-white disabled:opacity-35" aria-label="发送"><Send size={15} /></button></div></div>
        </div> : <>
          <div className="sticky top-[64px] z-[5] mt-3 border-b border-[#e9eee8] bg-[#f5f7f4]/95 px-4 backdrop-blur-xl"><div className="flex gap-6">{(tab === 'messages' ? [['all', '好友'], ['stranger', '陌生人']] : [['all', '推荐'], ['following', '关注'], ['self', '我的']]).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`relative py-3 text-xs ${filter === id ? 'font-bold text-[#1f624b] after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-[#278a63]' : 'text-[#96a79b]'}`}>{label}</button>)}</div></div>
          <div className="px-4 py-3"><label className="flex items-center gap-2 rounded-full bg-white px-4 text-[#a1ada5]"><Search size={15} /><input aria-label="搜索内容" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'messages' ? '搜索联系人或聊天内容' : '搜索人或内容'} className="min-w-0 flex-1 bg-transparent py-2.5 text-xs outline-none" /></label></div>
          {items.length ? tab === 'messages' ? <div className="mx-4 overflow-hidden rounded-[22px] bg-white">{items.map((item) => <button type="button" key={item.id} onClick={() => open('messages', item.id)} className="flex w-full items-center gap-3 border-b border-[#f1f3ef] px-4 py-4 text-left last:border-0"><Avatar person={item.author} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-[13px]">{item.author.name}</strong><time className="text-[10px] text-[#a1ada5]">{formatTime(item.time)}</time></span><span className="mt-1 block truncate text-[11px] text-[#9baa9e]">{item.replies.at(-1) || item.text || '发一条消息开始对话'}</span></span><ArrowRight size={14} className="text-[#b4c1b7]" /></button>)}</div> : <div className="space-y-3 px-4 pb-5">{items.map(feedCard)}</div>
            : <div className="mx-4 rounded-[22px] border border-dashed border-[#d7e4d8] bg-white/75 px-6 py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf6ed] text-[#7aaa89]">{tab === 'messages' ? <MessageCircle size={25} /> : tab === 'live' ? <Radio size={25} /> : <Compass size={25} />}</span><p className="mt-4 text-sm font-semibold">{search ? '没有找到相关内容' : filter === 'following' ? '还没有关注的人' : tab === 'messages' ? '这里还没有私信' : '故事还在路上'}</p><p className="mt-1 text-[11px] leading-5 text-[#98a99c]">{tab === 'messages' ? '点右上角＋选择角色，或让一封新来信出现。' : '试着刷新内容，或先写下属于你的第一条。'}</p>{!search && <button type="button" onClick={() => setPanel(tab === 'messages' ? 'compose' : 'refresh')} className="mt-4 rounded-full bg-[#246b54] px-4 py-2 text-[11px] font-bold text-white">{tab === 'messages' ? '发起聊天' : '看看新内容'}</button>}</div>}
          <div className="h-5" />
        </>}
      </>}
    </div>

    {panel && <div className="absolute inset-0 z-30 flex items-end bg-[#122a22]/35 backdrop-blur-sm" onClick={() => setPanel(null)}><section role="dialog" aria-modal="true" aria-label={panel === 'compose' ? '发布与聊天' : '刷新内容'} onClick={(event) => event.stopPropagation()} className="max-h-[86%] w-full overflow-y-auto rounded-t-[28px] bg-[#f8faf7] p-5 pb-[calc(env(safe-area-inset-bottom)+22px)] shadow-2xl"><div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[#cbd9ce]" /><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[0.18em] text-[#77a28a]">CREATE A MOMENT</p><h2 className="mt-1 text-lg font-bold">{tab === 'messages' ? panel === 'compose' ? '找个人聊聊' : '等一封来信' : panel === 'refresh' ? '更新此刻' : tab === 'live' ? '开启你的现场' : '分享此刻'}</h2></div><button type="button" aria-label="关闭" onClick={() => setPanel(null)} className="rounded-full bg-white p-2"><X size={17} /></button></div>
      {tab === 'messages' ? <div className="space-y-2">{panel === 'refresh' && <button type="button" disabled={busy} onClick={() => { setPanel(null); setFilter('stranger'); void generate('messages'); }} className="mb-3 flex w-full items-center justify-between rounded-2xl bg-[#e5f0e7] p-4 text-xs font-semibold text-[#246b54]">让陌生人写一封来信 <Sparkles size={16} /></button>}<p className="text-[11px] text-[#92a195]">{panel === 'compose' ? '选择一位角色，开启视频号内的对话。' : '也可以让熟悉的角色主动联系你。'}</p>{contacts.map((contact) => <button type="button" disabled={busy} key={contact.id} onClick={() => { if (panel === 'compose') openMessage(contact); else { setPanel(null); setFilter('all'); void generate('messages', undefined, contact); } }} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left"><Avatar person={contact} /><span className="flex-1 text-sm font-semibold">{contact.name}</span><ArrowRight size={16} className="text-[#a5b6a8]" /></button>)}{!contacts.length && <p className="py-5 text-center text-xs text-[#9eada1]">通讯录里还没有角色。</p>}</div>
        : <><p className="mb-3 text-xs leading-5 text-[#8e9e92]">{panel === 'refresh' ? '写下一个方向，也可以留空，让他们自由更新。' : tab === 'live' ? '你可以开一场聊天、做饭或分享此刻的直播。' : '一句心情，也可以是一条好动态。'}</p><textarea autoFocus aria-label={panel === 'compose' ? '发布内容' : '刷新方向'} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder={panel === 'refresh' ? '可选：今天想看什么故事…' : '此刻，你想说些什么…'} className={`${textInput} min-h-36 resize-none`} /><button type="button" disabled={busy || panel === 'compose' && !draft.trim()} onClick={() => panel === 'refresh' ? void refreshFeed() : create()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#246b54] py-3.5 text-sm font-bold text-white disabled:opacity-40">{panel === 'refresh' ? <RefreshCw size={16} /> : <Send size={16} />}{panel === 'refresh' ? '刷新内容' : tab === 'live' ? '开始直播' : '发布动态'}</button></>}
      </section></div>}

    {focus?.kind !== 'rooms' && <nav aria-label="视频号导航" className="grid shrink-0 grid-cols-4 border-t border-[#e3ece3] bg-white pb-[env(safe-area-inset-bottom)]">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => switchTab(id)} className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] ${tab === id ? 'font-bold text-[#237454]' : 'text-[#a5b3a8]'}`}>{tab === id && <span className="absolute top-0 h-[3px] w-7 rounded-b-full bg-[#2d8e64]" />}<Icon size={19} />{label}</button>)}</nav>}
  </section>;
}
