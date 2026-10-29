import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Compass, Heart, MessageCircle, Radio, UserRound,
  Sparkles, Plus, X, Send, RefreshCw, Play, UsersRound, Eye,
  Bookmark, ImagePlus, ChevronRight, Check, Trash2, Forward, Type,
} from 'lucide-react';
import { ChannelsProfile } from './ChannelsProfile';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { requestConfiguredAiText } from '../utils/aiApi';
import { CHAT_COMMUNICATION_RULES } from '../utils/chatCommunication';
import { ChannelsLiveRoom, LIVE_BACKGROUNDS, LIVE_GIFTS, type LiveBackground, type LiveGift } from './ChannelsLiveRoom';
import { settleChannelGiftPayment } from '../utils/channelGiftFinance';
import { writeAlipayData } from '../utils/alipayData';
import { generateStrangerMessages } from '../utils/channelStrangerMessages';
import { compressChatPhoto } from '../utils/imageFile';
import { CHANNEL_DATA_KEY, isChannelData, record, channelReply, channelItems,
  hasChannelUnread, appendChannelReply, channelFeedPeople, channelStranger, sampleChannelPeople, parseChannelBatch, channelPublicContext,
  type ChannelData, type ChannelItem, type ChannelKind, type ChannelPerson } from '../utils/channelLife';
import { CHANNEL_AUDIENCES, channelAudience, channelViewerCount, channelCommentPeople, parseChannelPosts } from '../utils/channelInteractions';
import { buildChannelMemory } from '../utils/channelMemory';
import { CHANNEL_PROFILE_KEY, emptyChannelProfile, isChannelProfile, channelPerson, channelPlatformPublicContext, type ChannelProfileStore } from '../utils/channelProfile';
import { TextImageCard } from './MomentCards';
import { clearChannelSection, createChannelArchive, trimChannelReplays, type ChannelArchive } from '../utils/channelArchive';
import { setStorageItemsAtomically } from '../utils/dbStorage';
import { buildChannelActorContext, channelWorldContext } from '../utils/channelActorContext';
import { channelFollowers, createChannelEngagement, ensureChannelEngagement, formatChannelCount } from '../utils/channelEngagement';
import { channelVisibleText, parseChannelMessages, type ChannelMedia } from '../utils/channelMessageMedia';

type Person = ChannelPerson;
type Item = ChannelItem;
type Kind = ChannelKind;
type Data = ChannelData;
type Tab = 'plaza' | 'live' | 'messages' | 'me';
type Focus = { kind: Kind; id: string };
const DATA_KEY = CHANNEL_DATA_KEY;
const PROFILE_KEY = CHANNEL_PROFILE_KEY;
const empty: Data = { posts: [], rooms: [], messages: [], following: [], saved: [] };
const validData = isChannelData;
const isRecord = record;
const make = (author: Person, text: string): Item => ({ id: crypto.randomUUID(), author, text, time: Date.now(), replies: [] });
const makeRoom = (author: Person, text: string): Item => ({ ...make(author, text), live: { viewers: author.id === 'self' ? 1 : 18 + Math.floor(Math.random() * 180), hearts: 0, gifts: [] } });
const tabs = [
  { id: 'plaza', label: '广场', icon: Compass },
  { id: 'live', label: '直播', icon: Radio },
  { id: 'messages', label: '私信', icon: MessageCircle },
  { id: 'me', label: '我', icon: UserRound },
] as const;
const stranger = channelStranger;
const formatTime = (time: number) => new Date(time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Avatar({ person, image, size = 'md' }: { person: Person; image?: string; size?: 'md' | 'lg' }) {
  return <span className={`channel-avatar ${size === 'lg' ? 'is-large' : ''}`}>
    {image || person.avatarUrl ? <img alt={`${person.name}头像`} src={image || person.avatarUrl} className="h-full w-full object-cover" /> : person.name.slice(0, 1)}
  </span>;
}

export function ChannelsApp({ userName, avatarUrl, contacts: sourceContacts, onBack, onForward }: { userName: string; avatarUrl?: string; contacts: Person[]; onBack: () => void;
  onForward: (post: Item, contactIds: string[]) => string | null }) {
  const [tab, setTab] = useState<Tab>('plaza');
  const [data, setData] = useState(() => readStoredValue(DATA_KEY, empty, validData));
  const dataRef = useRef(data);
  dataRef.current = data;
  const [panel, setPanel] = useState<'compose' | 'refresh' | null>(null);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState('');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [composerImage, setComposerImage] = useState('');
  const [textImage, setTextImage] = useState('');
  const [textVideo, setTextVideo] = useState('');
  const [mediaKind, setMediaKind] = useState<ChannelMedia['kind'] | ''>('');
  const [mediaText, setMediaText] = useState('');
  const [mediaAmount, setMediaAmount] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [authorSheet, setAuthorSheet] = useState<Person | null>(null);
  const [notice, setNotice] = useState('');
  const [busyLabel, setBusyLabel] = useState('加载中…');
  const [forwardPost, setForwardPost] = useState<Item | null>(null);
  const [forwardIds, setForwardIds] = useState<string[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [audienceMode, setAudienceMode] = useState('auto');
  const [customViewers, setCustomViewers] = useState('10');
  const [atmosphere, setAtmosphere] = useState('');
  const lock = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listPositions = useRef<Record<string, number>>({});
  const imageInput = useRef<HTMLInputElement>(null);
  const replyInput = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const revealOwnReply = useRef(false);
  const composerToken = useRef(0);
  const viewRef = useRef({ tab, focus });
  viewRef.current = { tab, focus };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; composerToken.current++; }; }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2400); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { if (error && !panel) scrollRef.current?.scrollTo({ top: 0 }); }, [error, panel]);
  useEffect(() => {
    nearBottom.current = true;
    scrollRef.current?.scrollTo({ top: focus?.kind === 'messages' ? scrollRef.current.scrollHeight : focus ? 0 : listPositions.current[`${tab}:${filter}`] ?? 0 });
    setMediaKind(''); setMediaUrl(''); setMediaText('');
  }, [tab, focus?.id, filter]);

  const profile = readStoredValue(PROFILE_KEY, emptyChannelProfile(), isChannelProfile);
  const settings = profile.settings;
  const contacts = sourceContacts.map(person => channelPerson(person, settings));
  const me: Person = { id: 'self', name: settings?.nickname?.trim() || userName || '我', avatarUrl: settings?.avatarUrl || avatarUrl };
  const selected = focus ? data[focus.kind].find((item) => item.id === focus.id) : undefined;
  useEffect(() => {
    if (revealOwnReply.current || focus?.kind === 'messages' && nearBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    revealOwnReply.current = false;
  }, [selected?.id, selected?.replies.length]);
  const followed = (id: string) => data.following.includes(id);
  const isFriend = (id: string) => contacts.some((contact) => contact.id === id);

  const kind: Kind = tab === 'live' ? 'rooms' : tab === 'messages' ? 'messages' : 'posts';
  const items = useMemo(() => channelItems(data, { kind, filter, search: '', topic: 'all', friendIds: contacts.map((person) => person.id) }), [data, kind, filter, contacts]);
  const unread = data.messages.filter(hasChannelUnread).length;
  const ownLive = data.rooms.find((item) => item.author.id === 'self' && !item.ended);
  const savedIds = data.saved ?? [];

  const commitData = (value: Data) => {
    const next = ensureChannelEngagement(trimChannelReplays(value), settings, sourceContacts);
    writeStoredValue(DATA_KEY, next);
    dataRef.current = next;
    setData(next);
  };
  const mutate = (change: (current: Data) => Data): boolean => {
    try { commitData(change(dataRef.current)); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); return false; }
  };
  useEffect(() => {
    const current = dataRef.current;
    if (trimChannelReplays(current) !== current || current.posts.some(post => !post.engagement)) mutate(current => current);
  }, [data.posts, settings]);
  const exportArchive = (store: ChannelProfileStore) => {
    const archive = createChannelArchive(dataRef.current, store);
    const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `视频号-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importArchive = async (archive: ChannelArchive) => {
    if (lock.current) throw new Error('请等待当前操作完成。');
    lock.current = true; setBusy(true); setBusyLabel('导入中…'); setError('');
    try {
      const next = trimChannelReplays(archive.data);
      await setStorageItemsAtomically({ [DATA_KEY]: next, [PROFILE_KEY]: archive.profile });
      dataRef.current = next; setData(next); setFocus(null); setAuthorSheet(null); setForwardPost(null); setReply(''); setFilter('all');
      autoStarted.current.clear(); setNotice('已导入');
    } finally { lock.current = false; setBusy(false); }
  };
  const clearSection = (target: Kind): boolean => {
    if (lock.current) return false;
    if (!mutate(current => clearChannelSection(current, target))) return false;
    if (focus?.kind === target) setFocus(null);
    if (target === 'rooms') autoStarted.current.clear();
    if (target === 'posts') setForwardPost(null);
    return true;
  };
  const add = (target: Kind, item: Item) => mutate((current) => ({ ...current, [target]: [item, ...current[target]] }));
  const update = (target: Kind, id: string, change: (item: Item) => Item) => mutate((current) => ({ ...current, [target]: current[target].map((item) => item.id === id ? change(item) : item) }));
  const savePost = (id: string) => {
    const saved = (dataRef.current.saved ?? []).includes(id);
    if (mutate((current) => ({ ...current, saved: saved ? (current.saved ?? []).filter((value) => value !== id) : [...(current.saved ?? []), id] }))) setNotice(saved ? '已取消收藏' : '已收藏');
  };
  const closePanel = () => { composerToken.current++; setPanel(null); setImageBusy(false); };
  const showPanel = (next: 'compose' | 'refresh') => {
    if (next === 'compose' && tab === 'live' && ownLive) { open('rooms', ownLive.id); return; }
    composerToken.current++; setPanel(next); setDraft(''); setComposerImage(''); setTextImage(''); setTextVideo(''); setImageBusy(false); setError('');
    if (next === 'compose' && tab === 'live') { setInvitedIds([]); setAudienceMode('auto'); setCustomViewers('10'); setAtmosphere(''); }
  };
  const uploadPostImage = async (file?: File) => {
    if (!file || imageBusy) return;
    const token = composerToken.current; setImageBusy(true);
    try { const image = await compressChatPhoto(file); if (mounted.current && token === composerToken.current) setComposerImage(image); }
    catch (cause) { if (mounted.current && token === composerToken.current) setError(cause instanceof Error ? cause.message : '图片读取失败。'); }
    finally { if (mounted.current && token === composerToken.current) setImageBusy(false); }
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
      replyAuthorIds: [...(item.replyAuthorIds ?? item.replies.map(() => '')), gift.senderId],
      live: { ...item.live, viewers: item.live?.viewers ?? 1, scene: item.live?.scene, hearts: item.live?.hearts ?? 0,
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
  const open = (target: Kind, id: string) => {
    const item = dataRef.current[target].find((item) => item.id === id);
    if (!item) return;
    if (target === 'messages' && hasChannelUnread(item)) update('messages', id, (item) => ({ ...item, readAt: Date.now() }));
    if (target !== 'messages' && viewRef.current.tab !== (target === 'rooms' ? 'live' : 'plaza')) { setTab(target === 'rooms' ? 'live' : 'plaza'); setFilter('all'); }
    setAuthorSheet(null); setFocus({ kind: target, id }); setReply(''); setError('');
  };
  const switchTab = (next: Tab) => { setTab(next); closePanel(); setAuthorSheet(null); setFocus(null); setFilter('all'); setReply(''); setError(''); };
  const follow = (id: string) => mutate((current) => ({ ...current,
    following: current.following.includes(id) ? current.following.filter((value) => value !== id) : [...current.following, id],
  }));
  const openMessage = (author: Person, post?: Item) => {
    const existing = dataRef.current.messages.find((item) => item.author.id === author.id);
    const item = existing ?? { ...make(author, ''), ...(post ? { sourcePostId: post.id } : {}) };
    if (!existing && !add('messages', item)) return;
    if (existing && post) update('messages', existing.id, (current) => ({ ...current, sourcePostId: post.id }));
    setTab('messages'); setPanel(null); setFilter(isFriend(author.id) ? 'all' : 'stranger'); open('messages', item.id);
    if (post) setReply(`看到你的动态「${post.text.slice(0, 28)}${post.text.length > 28 ? '…' : ''}」，`);
  };

  const cast = () => {
    const linked = settings?.roles?.map((role) => contacts.find((contact) => contact.id === role.contactId))
      .filter((contact): contact is Person => !!contact) ?? [];
    return linked.length ? linked : contacts;
  };
  const promptContext = async (actors: Person[], privateConversation = false, query = '') => [
    ...(privateConversation ? [CHAT_COMMUNICATION_RULES] : []),
    '你正在续写一个小手机内的虚构视频号平台。内容真实自然，符合人物设定、已有关系和时间线。不替玩家发言或决定行动。只输出 JSON。',
    '视频号只呈现公开可见的发言、行为和消息，不生成心声、内心独白、thought、thinking 或 think 标签。',
    `当前设备时间：${new Date().toLocaleString('zh-CN')}。保持当下的季节、作息与已有剧情连贯。`,
    `玩家昵称：${me.name}；视频号身份：${settings?.identity || '普通用户'}；公开简介：${settings?.bio || '未填写'}。`,
    `玩家平台人设：${settings.persona || settings.identity || '未填写'}；路人印象：${settings.audienceAttitude || '根据公开内容自然判断'}；关注数：${settings.followingCount ?? dataRef.current.following.length}；粉丝数：${settings.followerCount ?? 0}。路人对玩家的态度遵循这些公开设定。`,
    `平台设定：${settings?.platformSetting || '一个分享生活与直播的社交平台'}`,
    `平台专用提示词：${settings?.prompt || '无'}`,
    `角色的平台公开人设与路人印象：${JSON.stringify(channelPlatformPublicContext(settings, sourceContacts))}`,
    '角色的本人人设、绑定世界书决定核心性格、背景与世界观；平台人设限定公开身份和表达方式，不把角色写成另一人。路人对每位角色的态度由平台人设、路人印象和公开内容决定；有争议、黑粉或特定粉圈时自然体现，不默认所有人友善、欣赏或追捧。',
    `本轮发言者与账号规模：${JSON.stringify(actors.map(actor => ({ id: actor.id, name: actor.name, accountId: actor.accountId, followers: channelFollowers(actor, settings), role: settings.roles.find(role => role.contactId === actor.id) })))}`,
    `角色本人设定与绑定世界书，以及用户开启的私有上下文：${JSON.stringify(await buildChannelActorContext(actors, sourceContacts, settings, query || draft || selected?.text || '视频号日常'))}`,
    '私有上下文按角色ID归属，只供所属角色本人参考，可影响其语气、动机与选择。公开帖子、评论、直播不得泄露私聊和私密记忆；路人和其他角色不能知道、引用或套用这些内容。',
    `相关角色彼此关系：${JSON.stringify(settings?.relationships?.filter((relation) => actors.some((actor) => actor.id === relation.leftId) && actors.some((actor) => actor.id === relation.rightId)) ?? [])}`,
    '陌生人只能知道公开视频号资料与公开互动，不知道玩家的私信、线下秘密。旧内容仅供保持连续性，不把别人的经历移植给当前人物。',
    `平台世界书：${channelWorldContext(settings, [query || draft || selected?.text || '']) || '无'}`,
    ...(privateConversation && actors.length === 1 ? [buildChannelMemory(actors[0].id, false)] : []),
  ].join('\n');

  async function generate(targetKind: Kind, target?: Item, chosen?: Person) {
    if (targetKind === 'posts' && target) { await generateDiscussion(target); return; }
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setBusyLabel('回复中…');
    const audience = cast();
    const actor = target?.author.id === 'self'
      ? audience[Math.floor(Math.random() * audience.length)] ?? stranger()
      : target?.author ?? chosen ?? stranger();
    try {
      const source = dataRef.current.posts.find((item) => item.id === target?.sourcePostId && item.author.id === actor.id);
      const task = target
        ? `请以 ${actor.name} 的身份接续${targetKind === 'rooms' ? '直播间现场与弹幕' : '私信'}。原内容：${JSON.stringify({ text: target.text, replies: target.replies.slice(-24) })}。${source ? `这段对话从你的动态「${source.text.slice(0, 1600)}」开始。` : ''}只回复最新互动，保持自然，不能替玩家说话。返回 {"text":"一段回应"}。`
        : `请以 ${actor.name} 的身份生成${targetKind === 'posts' ? '生活帖子' : targetKind === 'rooms' ? '直播标题和开场场景' : '主动发给玩家的私信'}。玩家最近的公开动态：${JSON.stringify(channelPublicContext(dataRef.current))}。返回 {"text":"内容"}。`;
      const result: unknown = JSON.parse(await requestConfiguredAiText(await promptContext([actor], targetKind === 'messages', `${target?.text || ''} ${target?.replies.slice(-3).join(' ') || ''}`), task + (targetKind === 'messages' ? '\n私信按微信聊天规范：口语短句，一轮1至6条，长短错落，不写大段，按角色习惯少用句末标点，不强制所有人同一种口吻。只写实际发送的消息，不写心声。覆盖前述返回格式，返回 {"messages":[{"kind":"text|image|voice|video|transfer","text":"文字或媒体内容描述","amount":转账金额}]}。图片、语音、视频用文字描述，转账仅在情境合理时使用，amount为正数。' : ''), { json: true, maxTokens: 1400, imageUrls: targetKind === 'messages' ? Object.values(target?.replyMedia ?? {}).flatMap(media => media.kind === 'image' && media.url ? [media.url] : []).slice(-4) : undefined }));
      if (targetKind === 'messages') {
        const messages = parseChannelMessages(result);
        if (!mounted.current) return;
        mutate(current => {
          const existing = current.messages.find(item => target ? item.id === target.id : item.author.id === actor.id);
          let next = existing ?? make(actor, '');
          for (const message of messages) {
            const index = next.replies.length;
            next = appendChannelReply(next, actor, message.text, { now: Date.now(), thread: true, read: viewRef.current.focus?.id === next.id });
            if (message.media) next = { ...next, replyMedia: { ...next.replyMedia, [index]: message.media } };
          }
          return { ...current, messages: existing ? current.messages.map(item => item.id === next.id ? next : item) : [next, ...current.messages] };
        });
        return;
      }
      if (!isRecord(result) || typeof result.text !== 'string' || !result.text.trim()) throw new Error('返回内容不完整，请重试。');
      const content = channelVisibleText(result.text).slice(0, 4000);
      if (!mounted.current) return;
      if (target) update(targetKind, target.id, (item) => appendChannelReply(item, actor, content, { now: Date.now(), thread: false }));
      else add(targetKind, targetKind === 'rooms' ? makeRoom(actor, content) : make(actor, content));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '生成失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function refreshFeed() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setPanel(null); setBusyLabel('刷新中…');
    const targetKind: 'posts' | 'rooms' = tab === 'live' ? 'rooms' : 'posts';
    const people = channelFeedPeople(cast());
    const commenters = channelCommentPeople(cast());
    try {
      const task = [
        `为名单中每个人各写一条${targetKind === 'rooms' ? '直播标题与开场场景，30～100字' : '生活帖子，40～200字'}，恰好五条。名单：${JSON.stringify(people.map(({ id, name }) => ({ id, name })))}`,
        `方向：${draft.trim() || '自由日常，各有不同的话题'}。五个人分别偏向具体日常、轻松反差、同好交流、真诚感受、有趣提问；口吻和长度有区别，不全是抒情、夸赞或恋爱。`,
        `玩家最近公开动态：${JSON.stringify(channelPublicContext(dataRef.current))}。可自然呼应，但不必每条围着玩家转，不编造玩家发言。`,
        `避免重复近期内容：${JSON.stringify(dataRef.current[targetKind].slice(0, 8).map((item) => ({ name: item.author.name, text: item.text.slice(0, 350) })))}`,
        '不添加话题标签，不编造图片地址、播放量或点赞数。',
        '帖子适合配图时，可额外返回 textImage 字符串描述画面，最多1000字；适合视频时返回 textVideo 字符串描述视频画面、声音与情节，最多2000字；不适合时省略，不生成图片URL。',
        targetKind === 'posts' ? `每篇帖子自带四条评论，四位不同的人评论，不能自己评论自己。评论者名单：${JSON.stringify(commenters.map(({ id, name }) => ({ id, name })))}。评论紧扣各自帖子的细节，语气有差异，别只夸赞。返回 {"items":[{"authorId":"发帖人名单中的ID","text":"正文","comments":[{"authorId":"评论者名单中的ID","text":"评论"}]}]}。五位发帖人各一次，每篇四条评论。`
          : '根据每位主播的平台身份、人设生成在线人数和氛围：素人通常0～30，小博主80～2500，热门网红8000～200000；黑红主播有黑粉和串子。返回 {"items":[{"authorId":"名单中的ID","text":"直播标题与场景","viewers":20,"atmosphere":"符合该主播身份的观众构成和现场氛围"}]}。每个 ID 恰好一次。',
      ].join('\n');
      let generated: Array<{ author: Person; text: string; textImage?: string; textVideo?: string; comments?: ReturnType<typeof parseChannelBatch>; viewers?: number; atmosphere?: string }> | undefined;
      let issue = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await requestConfiguredAiText(await promptContext([...people, ...commenters]), task + (issue ? `\n上次格式错误：${issue}。请完整重写五条及全部评论。` : ''), { json: true, maxTokens: targetKind === 'posts' ? 6500 : 3000 });
        try {
          const parsed: unknown = JSON.parse(raw);
          generated = targetKind === 'posts' ? parseChannelPosts(parsed, people, commenters) : parseChannelBatch(parsed, people).map((post) => {
            const entry = isRecord(parsed) && Array.isArray(parsed.items) ? parsed.items.find((value) => isRecord(value) && value.authorId === post.author.id) : undefined;
            return { ...post, viewers: isRecord(entry) && typeof entry.viewers === 'number' ? entry.viewers : undefined, atmosphere: isRecord(entry) && typeof entry.atmosphere === 'string' ? entry.atmosphere.slice(0, 1000) : undefined };
          }); break;
        } catch (cause) { issue = cause instanceof Error ? cause.message : '格式不完整'; }
      }
      if (!generated) throw new Error(issue || '这次内容没有生成完整，请重试。');
      if (!mounted.current) return;
      const cards = generated.map((entry) => {
        if (targetKind === 'posts') {
          const post = { ...make(entry.author, entry.text), ...(entry.textImage ? { textImage: entry.textImage } : {}), ...(entry.textVideo ? { textVideo: entry.textVideo } : {}) };
          return (entry.comments ?? []).reduce<Item>((item, comment) => appendChannelReply(item, comment.author, comment.text, { now: Date.now() }), { ...post, engagement: createChannelEngagement(post, settings) });
        }
        const role = settings.roles.find(role => role.contactId === entry.author.id);
        const identity = `${role?.persona ?? role?.identity ?? ''} ${entry.author.persona || ''}`;
        const range = channelAudience(identity);
        const room = makeRoom(entry.author, entry.text);
        return { ...room, live: { ...room.live!, audience: { min: range.min, max: range.max }, viewers: channelViewerCount(entry.viewers, range, Math.max(1, range.min)), atmosphere: entry.atmosphere || range.atmosphere } };
      });
      commitData({ ...dataRef.current, [targetKind]: [...cards, ...dataRef.current[targetKind]] });
      setDraft(''); setNotice('已刷新');
      if (viewRef.current.tab === (targetKind === 'rooms' ? 'live' : 'plaza')) setFilter('all');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '刷新失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function refreshStrangerMessages() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setPanel(null); setBusyLabel('刷新中…');
    setFilter('stranger');
    try {
      const current = dataRef.current;
      const generated = await generateStrangerMessages({
        profile: { nickname: me.name, identity: settings?.identity, bio: settings?.bio, persona: settings.persona, audienceAttitude: settings.audienceAttitude, followerCount: settings.followerCount, followingCount: settings.followingCount,
          platformSetting: settings?.platformSetting, prompt: `${settings?.prompt || ''}\n平台公开角色设定：${JSON.stringify(channelPlatformPublicContext(settings, sourceContacts))}` },
        posts: current.posts, rooms: current.rooms, messages: current.messages,
        contactNames: [...new Set([...contacts.map(contact => contact.name), ...sourceContacts.flatMap(contact => [contact.name, contact.forumNickname || ''])].filter(Boolean))],
        worldBook: channelWorldContext(settings, [...current.posts.slice(-6).map(post => post.text), ...current.rooms.slice(-3).map(room => room.text)]),
      });
      const latest = dataRef.current;
      if (!mounted.current) return;
      commitData({ ...latest, messages: [...generated.map((item) => ({ ...make(item.author, item.text), lastIncomingAt: Date.now(), readAt: 0 })), ...latest.messages] });
      setNotice('私信已刷新');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '陌生人私信刷新失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function generateDiscussion(post: Item) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setBusyLabel('刷新评论中…');
    const people = channelCommentPeople(cast(), 7, post.author.id);
    try {
      const task = `为这条动态生成七条新的评论。作者：${currentPerson(post.author).name}。原文：${post.text.slice(0, 2000)}。文字图：${(post.textVideo || post.textImage)?.slice(0, 2000) || '无'}。最近评论：${JSON.stringify(post.replies.slice(-12))}。名单：${JSON.stringify(people.map(({ id, name }) => ({ id, name })))}。每人各一条，包含关联角色与路人（没有角色时全是路人）。角色根据平台人设、与玩家的关系评论；路人对作者的看法以平台人设和路人印象为准，不能一律夸赞。自然且不重复，不替玩家发言，不编造配图中未描述的细节。返回 {"items":[{"authorId":"名单中的ID","text":"10～90字的评论"}]}。`;
      let generated: ReturnType<typeof parseChannelBatch> | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await requestConfiguredAiText(await promptContext(people, false, `${post.text} ${post.textImage || ''}`), task + (attempt ? '\n上次格式不完整，请严格按七个ID完整返回七条评论。' : ''), { json: true, maxTokens: 2800 });
        try { generated = parseChannelBatch(JSON.parse(raw), people); break; } catch (cause) { if (attempt) throw cause; }
      }
      if (!generated) throw new Error('评论未生成完整，请重试。');
      if (!mounted.current) return;
      if (update('posts', post.id, (current) => generated!.reduce((item, entry) => appendChannelReply(item, entry.author, entry.text, { now: Date.now() }), current))) setNotice('评论已刷新');
    } catch (cause) { setError(`评论刷新失败：${cause instanceof Error ? cause.message : '请重试'}。`); }
    finally { lock.current = false; setBusy(false); }
  }

  async function advanceLive(room: Item) {
    if (lock.current || room.ended) return;
    lock.current = true; setBusy(true); setError(''); setBusyLabel('刷新直播中…');
    const invited = contacts.filter((person) => room.live?.invitedRoleIds?.includes(person.id));
    const viewers = [...(room.author.id === 'self' ? invited : sampleChannelPeople(cast(), 3)), ...channelCommentPeople(contacts).filter((person) => person.id.startsWith('stranger:'))]
      .filter((person, index, list) => person.id !== room.author.id && list.findIndex((other) => other.id === person.id) === index)
      .slice(0, Math.min(7, room.live?.audience?.max ?? 7));
    const actors = [...(room.author.id === 'self' ? [] : [room.author]), ...viewers];
    try {
      const task = [
        `续写直播间「${room.text}」。主播：${room.author.name}；${room.author.id === 'self' ? '主播是玩家，不代替玩家说话或做动作。' : '主播可以自然说话、做事。'}`,
        `目前场景：${room.live?.scene || room.text}`,
        `人数设定：${JSON.stringify(room.live?.audience || { min: 0, max: 200000 })}；当前在线 ${room.live?.viewers ?? 1}。${room.replies.length ? '人数随内容合理小幅变化。' : '这是开场，请按主播人设与规模选择合理的初始人数。'}在线人数只统计观众，不含主播。弹幕人数不能大于在线人数。`,
        `本场观众构成与氛围：${room.live?.atmosphere || '根据主播的平台身份合理生成，不要全员夸赞。'}。邀请观看的角色：${JSON.stringify(invited.map((person) => ({ id: person.id, name: person.name })))}。这些角色已受邀来到现场；没有受邀的熟人不要凭空到场。`,
        `最近弹幕与互动：${JSON.stringify(room.replies.slice(-22))}；主播动作：${JSON.stringify(room.live?.hostActions?.slice(-6) ?? [])}`,
        `可发言的主播与观众：${JSON.stringify(actors.map(({ id, name }) => ({ id, name })))}`,
        '推进一点现场变化，体现主播与观众的呼应；弹幕有不同语气，不要刷重复短句。不要编造玩家发言、玩家动作或已经发生的礼物。不写心声。非玩家主播的可见动作单独放在 hostAction 字段，主播发言放在 messages 中并使用主播ID。',
        `可用礼物和价格：${LIVE_GIFTS.map((gift) => `${gift.id}=¥${gift.price}`).join('、')}。礼物由观众送给主播；若主播是玩家，收到礼物会按标价入账，所以只有剧情自然合适时才送，保持低频。`,
        `返回 JSON：{"scene":"本轮现场画面/声音的简短描写","viewers":20,"messages":[{"authorId":"名单中的 ID","text":"一条自然弹幕或主播发言"}],"gift":{"authorId":"名单中的 ID","giftId":"有效礼物 ID"}}。messages 2 至 5 条，可由同一人连续说话；若人数为0可返回空弹幕并描写安静的现场；gift 可省略。`,
      ].join('\n');
      const result: unknown = JSON.parse(await requestConfiguredAiText(await promptContext(actors, false, `${room.text} ${room.replies.slice(-4).join(' ')}`), task, { json: true, maxTokens: 1700 }));
      if (!mounted.current) return;
      if (!isRecord(result) || typeof result.scene !== 'string' || !result.scene.trim() || !Array.isArray(result.messages)) throw new Error('直播现场内容不完整，请重试。');
      const scene = channelVisibleText(result.scene).slice(0, 220);
      const entries = result.messages.slice(0, 5).flatMap((value: unknown) => {
        if (!isRecord(value) || typeof value.authorId !== 'string' || typeof value.text !== 'string' || !value.text.trim()) return [];
        const speaker = actors.find((actor) => actor.id === value.authorId);
        const text = channelVisibleText(value.text).slice(0, 180);
        return speaker && text && value.kind !== 'thought' ? [{ speaker, text }] : [];
      });
      if (!entries.length && !(typeof result.viewers === 'number' && result.viewers === 0)) throw new Error('直播弹幕为空，请重试。');
      const lines = entries.map(({ speaker, text }) => `${speaker.name}：${text}`);
      const speakerCount = new Set(entries.filter(({ speaker }) => speaker.id !== room.author.id).map(({ speaker }) => speaker.id)).size;
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
          replyAuthorIds: [...(current.replyAuthorIds ?? current.replies.map(() => '')), ...entries.map(({ speaker }) => speaker.id)],
          live: { ...live, viewers: Math.max(speakerCount, channelViewerCount(result.viewers, live.audience ?? { min: 0, max: 200000 }, Math.max(live.viewers, speakerCount))), scene,
            ...(room.author.id !== 'self' && typeof result.hostAction === 'string' && channelVisibleText(result.hostAction) ? { hostActions: [...(live.hostActions ?? []), channelVisibleText(result.hostAction).slice(0, 1000)] } : {}),
            participantIds: [...new Set([...(live.participantIds ?? []), ...entries.map(({ speaker }) => speaker.id)])] } };
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
    if (focus?.kind !== 'rooms' || !selected || selected.ended || selected.replies.length || lock.current || autoStarted.current.has(selected.id)) return;
    autoStarted.current.add(selected.id);
    void advanceLive(selected);
  }, [focus?.id, focus?.kind, selected?.id, busy]);

  const sendLive = (room: Item, text: string) => update('rooms', room.id, (current) => ({
    ...appendChannelReply(current, me, text, { now: Date.now(), own: true }), time: Date.now(),
  }));
  const likeLive = (room: Item, amount = 1) => update('rooms', room.id, (current) => current.ended ? current : ({ ...current,
    live: { ...current.live, viewers: current.live?.viewers ?? 1, scene: current.live?.scene,
      gifts: current.live?.gifts ?? [], hearts: (current.live?.hearts ?? 0) + amount },
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
    ...current, live: { ...current.live, viewers: current.live?.viewers ?? 1, hearts: current.live?.hearts ?? 0,
      scene: current.live?.scene, gifts: current.live?.gifts ?? [], background },
  }));

  const sendReply = () => {
    if (!focus || !selected || !reply.trim()) return;
    revealOwnReply.current = true;
    if (update(focus.kind, selected.id, (item) => appendChannelReply(item, me, reply.trim(), { own: true, thread: focus.kind === 'messages', now: Date.now() }))) setReply('');
    else revealOwnReply.current = false;
  };
  const sendMedia = () => {
    if (!selected || focus?.kind !== 'messages' || !mediaKind || mediaBusy) return;
    const amount = Number(mediaAmount);
    if (mediaKind === 'transfer' && (!/^\d+(\.\d{1,2})?$/.test(mediaAmount) || amount <= 0 || amount > 200000)) { setError('请输入有效金额（最多两位小数，上限20万）。'); return; }
    if (!mediaText.trim() && !mediaUrl && mediaKind !== 'transfer') return;
    const media: ChannelMedia = { kind: mediaKind, text: mediaText.trim() || (mediaKind === 'transfer' ? '转账' : '图片'), ...(mediaUrl ? { url: mediaUrl } : {}), ...(mediaKind === 'transfer' ? { amount, id: crypto.randomUUID() } : {}) };
    let payment: ReturnType<typeof settleChannelGiftPayment> | undefined;
    try {
      if (media.kind === 'transfer') payment = settleChannelGiftPayment({ eventId: media.id!, direction: 'sent', amount });
      if (!update('messages', selected.id, item => ({ ...appendChannelReply(item, me, `[${media.kind}] ${media.text}${media.amount ? ` ¥${media.amount.toFixed(2)}` : ''}`, { own: true, thread: true, now: Date.now() }), replyMedia: { ...item.replyMedia, [item.replies.length]: media } }))) throw new Error('消息未保存，请重试。');
      revealOwnReply.current = true; setMediaKind(''); setMediaText(''); setMediaUrl(''); setMediaAmount(''); setError('');
    } catch (e) { if (payment?.previous) writeAlipayData(payment.previous); setError(e instanceof Error ? e.message : '发送失败'); }
  };
  const acceptTransfer = (item: Item, index: number, media: ChannelMedia) => {
    if (!media.id || !media.amount || media.accepted) return;
    let payment: ReturnType<typeof settleChannelGiftPayment> | undefined;
    try {
      payment = settleChannelGiftPayment({ eventId: media.id, direction: 'received', amount: media.amount });
      if (!update('messages', item.id, current => ({ ...current, replyMedia: { ...current.replyMedia, [index]: { ...media, accepted: true } } }))) throw new Error('收款未保存，请重试。');
    } catch (e) { if (payment?.previous) writeAlipayData(payment.previous); setError(e instanceof Error ? e.message : '收款失败'); }
  };
  const create = () => {
    if ((!draft.trim() && (tab === 'live' || !textImage.trim() && !textVideo.trim() && !composerImage)) || imageBusy || lock.current) return;
    const targetKind = tab === 'live' ? 'rooms' : 'posts';
    const currentLive = dataRef.current.rooms.find((item) => item.author.id === 'self' && !item.ended);
    if (targetKind === 'rooms' && currentLive) { closePanel(); open('rooms', currentLive.id); return; }
    const invites = invitedIds.filter((id) => contacts.some((contact) => contact.id === id));
    if (targetKind === 'rooms' && audienceMode === 'custom' && (!Number.isInteger(Number(customViewers)) || Number(customViewers) < Math.max(1, invites.length) || Number(customViewers) > 1000000)) {
      setError(`在线人数请填写 ${Math.max(1, invites.length)}～1000000 的整数，不能少于受邀角色人数。`); return;
    }
    const range = channelAudience(`${settings.persona || settings.identity || ''} ${settings?.bio || ''}`, audienceMode, Number(customViewers));
    const item = targetKind === 'rooms' ? { ...makeRoom(me, draft.trim()), live: { viewers: Math.max(range.min, invites.length), hearts: 0, gifts: [],
      invitedRoleIds: invites, participantIds: invites, audience: { min: Math.max(range.min, invites.length), max: Math.max(range.max, invites.length) },
      atmosphere: `${range.atmosphere}${atmosphere.trim() ? `\n玩家指定：${atmosphere.trim()}` : ''}` } }
      : { ...make(me, draft.trim()), ...(composerImage ? { imageUrl: composerImage } : {}), ...(textImage.trim() ? { textImage: textImage.trim() } : {}), ...(textVideo.trim() ? { textVideo: textVideo.trim() } : {}) };
    const prepared = targetKind === 'posts' ? { ...item, engagement: createChannelEngagement(item, settings) } : item;
    if (!add(targetKind, prepared)) return;
    setDraft(''); closePanel(); setFilter('self'); setComposerImage(''); setTextImage('');
    setNotice(targetKind === 'rooms' ? '已开播' : '已发布'); open(targetKind, item.id);
    if (targetKind === 'posts') void generateDiscussion(prepared);
  };

  const relativeTime = (time: number) => {
    const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
    return minutes < 1 ? '刚刚' : minutes < 60 ? `${minutes} 分钟前` : minutes < 1440 ? `${Math.floor(minutes / 60)} 小时前` : formatTime(time);
  };
  const browseOwn = (destination: 'posts' | 'rooms' | 'saved' | 'following') => {
    switchTab(destination === 'rooms' ? 'live' : 'plaza');
    setFilter(destination === 'saved' ? 'saved' : destination === 'following' ? 'following' : 'self');
  };
  const currentPerson = (person: Person) => person.id === 'self' ? me : contacts.find((contact) => contact.id === person.id) ?? channelPerson(person, settings);
  const showAuthor = (person: Person) => person.id === 'self' ? switchTab('me') : setAuthorSheet(currentPerson(person));
  const chooseActor = (name: string): Person => {
    if (name === me.name || name === userName) return me;
    const original = sourceContacts.find(person => person.name === name || person.forumNickname === name);
    return contacts.find(person => person.name === name) ?? (original ? currentPerson(original) : undefined)
      ?? [...data.posts, ...data.rooms, ...data.messages].find(item => item.author.name === name)?.author ?? { id: `public:${name}`, name: name || '路人' };
  };
  const replyPerson = (item: Item, index: number) => {
    const id = item.replyAuthorIds?.[index];
    return id === 'self' ? me : contacts.find(person => person.id === id) ?? chooseActor(channelReply(item.replies[index]).name || item.author.name);
  };
  const displayRoom = (room: Item): Item => ({ ...room, author: currentPerson(room.author),
    replies: room.replies.map((line, index) => `${replyPerson(room, index).name}：${channelReply(line).text}`) });
  const cover = (item: Item) => {
    return <div className={`channel-post-media ${item.imageUrl && item.textImage ? 'has-both' : ''}`}>{item.imageUrl && <img className="channel-post-photo" src={item.imageUrl} alt={`${currentPerson(item.author).name}发布的配图`} loading="lazy" />}{item.textImage && <div className="channel-text-image"><TextImageCard text={item.textImage} large /></div>}{item.textVideo && <div className="channel-text-video"><Play size={26} /><strong>视频</strong><p>{item.textVideo}</p></div>}</div>;
  };
  const feedCard = (item: Item, full = false) => {
    const person = currentPerson(item.author); const saved = savedIds.includes(item.id);
    const engagement = item.engagement;
    if (kind === 'rooms') {
      const background = item.live?.background;
      const preset = LIVE_BACKGROUNDS.find((preset) => preset.id === background?.presetId) ?? LIVE_BACKGROUNDS[0];
      return <article key={item.id} className="channel-live-card">
        <button type="button" className="channel-live-cover" aria-label={`进入${person.name}的${item.ended ? '直播回放' : '直播间'}`} onClick={() => open('rooms', item.id)} style={{ backgroundImage: background?.imageUrl ? `url("${background.imageUrl.replaceAll('"', '%22')}")` : preset.image }}>
          <span className={`channel-live-state ${item.ended ? 'is-ended' : ''}`}>{item.ended ? '回放' : '● 直播中'}</span>
          <span className="channel-live-cover-art" aria-hidden="true"><Radio size={52} strokeWidth={1} /></span><span className="channel-live-cover-ring" />
          <span className="channel-live-scene">{item.live?.scene || item.text}</span><span className="channel-live-enter"><Play size={15} fill="currentColor" />{item.ended ? '查看回放' : '进入直播'}</span>
        </button>
        <div className="channel-live-meta"><button className="channel-author" type="button" onClick={() => showAuthor(person)}><Avatar person={person} /><span><strong>{person.name}</strong><small>{item.ended ? '已结束' : '直播中'}</small></span></button>
          <span className="channel-live-numbers"><UsersRound size={12} />{item.live?.viewers ?? 0}<Heart size={12} />{item.live?.hearts ?? 0}</span></div>
      </article>;
    }
    return <article key={item.id} className="channel-post" aria-label={`${person.name}的动态`}>
      <div className="channel-post-head"><button type="button" className="channel-author" onClick={() => showAuthor(person)}><Avatar person={person} /><span><strong>{person.name}</strong><small>{relativeTime(item.time)}</small></span></button>
        {person.id !== 'self' ? <button type="button" onClick={() => follow(person.id)} className={`channel-follow ${followed(person.id) ? 'is-followed' : ''}`} aria-pressed={followed(person.id)}>{followed(person.id) ? <><Check size={11} />已关注</> : <><Plus size={11} />关注</>}</button> : <span className="channel-self-tag">我发布的</span>}
      </div>
      {(item.imageUrl || item.textImage || item.textVideo) && (full ? cover(item) : <button type="button" className="channel-cover-button" aria-label={`查看${person.name}的动态`} onClick={() => open('posts', item.id)}>{cover(item)}</button>)}
      <div className="channel-post-body"><p className={full ? '' : 'is-preview'}>{item.text}</p>
        {!full && item.text.length > 140 && <button type="button" className="channel-expand" onClick={() => open('posts', item.id)}>展开 <ChevronRight size={11} /></button>}
      </div>
      <div className="channel-post-actions">
        <button type="button" aria-label="喜欢帖子" aria-pressed={!!item.liked} onClick={() => update('posts', item.id, (current) => ({ ...current, liked: !current.liked }))}><Heart size={17} fill={item.liked ? 'currentColor' : 'none'} /><span>{formatChannelCount((engagement?.likes ?? 0) + Number(!!item.liked))}</span></button>
        <button type="button" aria-label="查看评论" onClick={() => full ? replyInput.current?.focus() : open('posts', item.id)}><MessageCircle size={17} /><span>{formatChannelCount(Math.max(engagement?.comments ?? 0, item.replies.length))}</span></button>
        <button type="button" aria-label={saved ? '取消收藏动态' : '收藏动态'} aria-pressed={saved} onClick={() => savePost(item.id)}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /><span>{formatChannelCount((engagement?.saves ?? 0) + Number(saved))}</span></button>
        <button type="button" aria-label="转发帖子给角色" onClick={() => { setForwardPost({ ...item, author: person }); setForwardIds([]); setError(''); }}><Forward size={16} /><span>{formatChannelCount(engagement?.shares ?? 0)}</span></button>
        {person.id !== 'self' && <button type="button" aria-label={`私信${person.name}`} onClick={() => openMessage(person, item)}><Send size={15} /></button>}
      </div>
      {engagement && <div className="channel-post-views" aria-label="浏览量"><Eye size={12} />{formatChannelCount(engagement.views)}</div>}
      {!full && item.replies.length > 0 && <button type="button" className="channel-comment-preview" onClick={() => open('posts', item.id)}><MessageCircle size={12} /><span><strong>{replyPerson(item, item.replies.length - 1).name}</strong>：{channelReply(item.replies.at(-1)!).text}</span><ChevronRight size={12} /></button>}
    </article>;
  };
  const renderReplies = (item: Item, thread: boolean) => item.replies.map((line, index) => {
    const entry = channelReply(line); const person = replyPerson(item, index);
    const own = item.ownReplyIndices?.includes(index) || item.replyAuthorIds?.[index] === 'self' || !item.replyAuthorIds?.[index] && (entry.name === me.name || entry.name === userName);
    return <div key={index} className={thread ? `channel-message ${own ? 'is-own' : ''}` : 'channel-comment'}>
      <Avatar person={own ? me : person} /><div>{!own || !thread ? <strong>{own ? '我' : person.name}{!thread && person.id === item.author.id && <small>作者</small>}</strong> : null}{thread && item.replyMedia?.[index] ? (() => { const m = item.replyMedia[index]; return <div className={`channel-dm-media is-${m.kind}`}>{m.url && <a href={m.url} target="_blank" rel="noreferrer"><img alt={m.text} src={m.url} /></a>}<strong>{({ image: '▧ 图片', video: '▷ 视频', voice: '◖ 语音', transfer: '⇄ 转账' })[m.kind]}{m.amount ? ` ¥${m.amount.toFixed(2)}` : ''}</strong><p>{m.text}</p>{m.kind === 'transfer' && (!own ? <button type="button" disabled={m.accepted} onClick={() => acceptTransfer(item, index, m)}>{m.accepted ? '已收款' : '收款'}</button> : <small>已转出</small>)}</div>; })() : <p>{entry.text}</p>}</div>
    </div>;
  });
  const renderComposer = (post: boolean) => <div className="channel-reply-composer">
    {!post && <><div className="channel-dm-tools">{(['image', 'voice', 'video', 'transfer'] as const).map(kind => <button type="button" key={kind} aria-pressed={mediaKind === kind} onClick={() => { setMediaKind(mediaKind === kind ? '' : kind); setMediaUrl(''); setMediaText(''); }}>{({ image: '图片', voice: '语音', video: '视频', transfer: '转账' })[kind]}</button>)}</div>{mediaKind && <div className="channel-dm-attachment"><textarea aria-label="附件内容" placeholder={mediaKind === 'transfer' ? '转账备注' : '描述内容'} value={mediaText} onChange={e => setMediaText(e.target.value)} maxLength={2000} />{mediaKind === 'transfer' && <input aria-label="转账金额" type="number" min="0.01" step="0.01" value={mediaAmount} onChange={e => setMediaAmount(e.target.value)} />}{mediaKind === 'image' && <><input aria-label="私信上传图片" type="file" accept="image/*" disabled={mediaBusy} onChange={async e => { const file = e.target.files?.[0]; const id = focus?.id; if (!file) return; setMediaBusy(true); try { const url = await compressChatPhoto(file); if (mounted.current && viewRef.current.focus?.id === id) setMediaUrl(url); } catch { setError('图片处理失败'); } finally { setMediaBusy(false); } }} />{mediaUrl && <img src={mediaUrl} alt="待发送图片" />}</>}<button type="button" disabled={mediaBusy} onClick={sendMedia}>{mediaBusy ? '处理中…' : '发送附件'}</button></div>}</>}
    <div className="channel-reply-field"><textarea ref={replyInput} aria-label="互动内容" rows={2} maxLength={2000} placeholder={post ? '评论' : '发送消息'} value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendReply(); } }} />
      <button type="button" className="channel-send" aria-label="发送" disabled={!reply.trim()} onClick={sendReply}><Send size={17} /></button></div>
    <button type="button" disabled={busy} className="channel-ai-reply" aria-label={post ? '刷新评论' : '回复'} onClick={() => selected && void generate(post ? 'posts' : 'messages', selected)}><Sparkles size={14} />{busy ? '加载中…' : post ? '刷新评论' : '回复'}<ChevronRight size={13} /></button>
  </div>;
  const liveFocus = focus?.kind === 'rooms';
  const profileStats = { posts: data.posts.filter((item) => item.author.id === 'self').length, rooms: data.rooms.filter((item) => item.author.id === 'self').length,
    saved: data.posts.filter((item) => savedIds.includes(item.id)).length, following: data.following.length };
  const refreshLabel = tab === 'messages' ? '刷新私信' : tab === 'live' ? '刷新直播' : '刷新广场';

  return <section className={`channels-app ${liveFocus ? 'is-live-room' : ''}`}>
    {tab !== 'me' && !liveFocus && <header className="channel-header">
      <button type="button" className="channel-icon-button" aria-label={focus ? '返回列表' : '返回发现'} onClick={() => focus ? setFocus(null) : onBack()}><ArrowLeft size={20} /></button>
      <div className="channel-header-title"><h1>{selected ? focus?.kind === 'messages' ? currentPerson(selected.author).name : '动态' : tab === 'plaza' ? '视频号' : tab === 'live' ? '直播' : '私信'}</h1></div>
      {!focus ? <><button type="button" className="channel-icon-button" aria-label={tab === 'messages' ? '发起聊天' : tab === 'live' ? '我要开播' : '发布帖子'} onClick={() => showPanel('compose')}><Plus size={20} /></button>
        <button type="button" className="channel-icon-button is-primary" aria-label={tab === 'messages' ? '刷新私信' : tab === 'live' ? '刷新直播' : '刷新广场'} disabled={busy} onClick={() => tab === 'messages' && filter === 'stranger' ? void refreshStrangerMessages() : showPanel('refresh')}>{busy ? <RefreshCw size={17} className="animate-spin" /> : <Sparkles size={18} />}</button></>
        : selected && <button type="button" className="channel-icon-button" aria-label="查看作者主页" onClick={() => showAuthor(selected.author)}><UserRound size={18} /></button>}
    </header>}
    <main ref={scrollRef} className={`channel-scroll ${liveFocus ? 'is-room' : ''}`} onScroll={(event) => { const element = event.currentTarget; if (!focus) listPositions.current[`${tab}:${filter}`] = element.scrollTop; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 130; }}>
      {tab === 'me' ? <><button type="button" className="channel-profile-exit" aria-label="返回发现" onClick={onBack}><X size={19} /></button><ChannelsProfile userName={userName} avatarUrl={avatarUrl} contacts={sourceContacts} stats={profileStats} onView={browseOwn} dataBusy={busy} onExport={exportArchive} onImport={importArchive} onClear={clearSection} /></> : <>
        {!liveFocus && error && <p role="alert" className="channel-error">{error}</p>}
        {!liveFocus && busy && <div role="status" className="channel-loading"><RefreshCw size={14} className="animate-spin" /><span>{busyLabel}</span></div>}
        {selected && focus ? focus.kind === 'rooms' ? <ChannelsLiveRoom room={displayRoom(selected)} me={me} busy={busy} error={error} following={followed(selected.author.id)} onBack={() => setFocus(null)} onFollow={() => follow(selected.author.id)} onSend={(text) => sendLive(selected, text)} onAdvance={() => void advanceLive(selected)} onGift={(giftId) => giveLive(selected, giftId)} onBackgroundChange={(background) => changeLiveBackground(selected, background)} onLike={(amount) => likeLive(selected, amount)} onAction={(text) => update('rooms', selected.id, item => item.ended ? item : ({ ...item, live: { ...item.live!, hostActions: [...(item.live?.hostActions ?? []), text] } }))} onEnd={() => update('rooms', selected.id, (item) => ({ ...item, ended: true, endedAt: Date.now(), time: Date.now() }))} />
          : focus.kind === 'messages' ? <div className="channel-thread">
            <div className="channel-thread-note"><small>{formatTime(selected.time)}</small></div>
            {selected.sourcePostId && data.posts.find((item) => item.id === selected.sourcePostId) && <button type="button" className="channel-source-post" onClick={() => { setTab('plaza'); open('posts', selected.sourcePostId!); }}><MessageCircle size={14} /><span>{data.posts.find((item) => item.id === selected.sourcePostId)?.text}</span><ChevronRight size={13} /></button>}
            <div className="channel-conversation">{selected.text && <div className="channel-message"><Avatar person={currentPerson(selected.author)} /><div><strong>{currentPerson(selected.author).name}</strong><p>{selected.text}</p></div></div>}{renderReplies(selected, true)}
              {!selected.text && !selected.replies.length && <p className="channel-gentle-empty">暂无消息</p>}</div>
            {renderComposer(false)}
          </div> : <div className="channel-post-detail">{feedCard(selected, true)}<div className="channel-discussion-title"><h2>评论 <span>{formatChannelCount(Math.max(selected.engagement?.comments ?? 0, selected.replies.length))}</span></h2></div><div className="channel-comments">{selected.replies.length ? renderReplies(selected, false) : <p className="channel-gentle-empty">暂无评论</p>}</div>{renderComposer(true)}</div>
          : <>
              {tab === 'live' && ownLive && <button type="button" className="channel-own-live" onClick={() => open('rooms', ownLive.id)}><Radio size={16} /><span>返回我的直播</span><ArrowRight size={16} /></button>}
            <div className="channel-filter-bar">{(tab === 'messages' ? [['all', '好友'], ['stranger', '陌生人']] : tab === 'live' ? [['all', '正在直播'], ['following', '关注'], ['self', '我的'], ['replay', '回放']] : [['all', '发现'], ['following', '关注'], ['self', '我的'], ['saved', '收藏']]).map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); }}>{label}{tab === 'messages' && data.messages.some((item) => hasChannelUnread(item) && (id === 'all' ? isFriend(item.author.id) : !isFriend(item.author.id))) && <i />}</button>)}</div>
            {items.length ? tab === 'messages' ? <div className="channel-inbox-list">{items.map((item) => <button type="button" key={item.id} className="channel-inbox-row" onClick={() => open('messages', item.id)}>
              <span className="channel-inbox-avatar"><Avatar person={currentPerson(item.author)} />{hasChannelUnread(item) && <i aria-label="未读消息" />}</span><span className="channel-inbox-copy"><span><strong>{currentPerson(item.author).name}</strong><time>{relativeTime(item.time)}</time></span><small>{channelReply(item.replies.at(-1) || '').text || item.text || '暂无消息'}</small></span><ChevronRight size={13} /></button>)}</div>
              : <div className="channel-feed">{items.map((item) => feedCard(item))}</div>
              : busy ? <div className="channel-feed" aria-hidden="true"><div className="channel-skeleton" /><div className="channel-skeleton" /></div>
              : <div className="channel-empty"><span>{tab === 'messages' ? <Send size={28} /> : tab === 'live' ? <Radio size={28} /> : filter === 'saved' ? <Bookmark size={28} /> : <Compass size={28} />}</span><h3>{filter === 'saved' ? '暂无收藏' : tab === 'messages' ? '暂无私信' : filter === 'replay' ? '暂无回放' : tab === 'live' ? '暂无直播' : '暂无动态'}</h3></div>}
          </>}
      </>}
    </main>
    {notice && <div role="status" className="channel-toast"><Check size={13} />{notice}</div>}

    {panel && <div className="channel-modal" onClick={closePanel} onKeyDown={(event) => { if (event.key === 'Escape') closePanel(); }}><section role="dialog" aria-modal="true" aria-label={panel === 'compose' ? '发布与聊天' : '刷新内容'} className="channel-sheet" onClick={(event) => event.stopPropagation()}><div className="channel-sheet-grip" /><header><h2>{panel === 'refresh' ? refreshLabel : tab === 'messages' ? '发起私信' : tab === 'live' ? '开始直播' : '发布动态'}</h2><button type="button" aria-label="关闭" className="channel-icon-button" onClick={closePanel}><X size={18} /></button></header>
      {error && <p role="alert" className="channel-error">{error}</p>}
      {tab === 'messages' ? <div className="channel-sheet-content">{panel === 'refresh' && <button type="button" disabled={busy} className="channel-primary-button" onClick={() => void refreshStrangerMessages()}><Sparkles size={16} />刷新私信</button>}
        <p className="channel-sheet-label">好友</p>{contacts.map((person) => <button type="button" disabled={busy} className="channel-person-option" key={person.id} onClick={() => { if (panel === 'compose') openMessage(person); else { closePanel(); setFilter('all'); void generate('messages', undefined, person); } }}><Avatar person={person} /><span><strong>{person.name}</strong>{person.accountId && <small>@{person.accountId}</small>}</span><ChevronRight size={15} /></button>)}{!contacts.length && <p className="channel-help">暂无角色</p>}
        {panel === 'compose' && data.messages.some((item) => !isFriend(item.author.id)) && <><p className="channel-sheet-label">最近联系人</p>{data.messages.filter((item) => !isFriend(item.author.id)).slice(0, 5).map((item) => <button type="button" className="channel-person-option" key={item.id} onClick={() => openMessage(item.author)}><Avatar person={item.author} /><span><strong>{item.author.name}</strong><small>{channelReply(item.replies.at(-1) || '').text || item.text.slice(0, 40)}</small></span><ChevronRight size={15} /></button>)}</>}
      </div> : <div className="channel-sheet-content">
        <textarea autoFocus aria-label={panel === 'compose' ? '发布内容' : '刷新方向'} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={4} placeholder={panel === 'refresh' ? '刷新方向（可选）' : tab === 'live' ? '直播主题' : '输入内容'} className="channel-compose-text" />
        {panel === 'compose' && tab === 'live' && <div className="channel-live-setup">
          <fieldset><legend>邀请观众</legend><div className="channel-invite-list">{contacts.map((person) => <label key={person.id}><input type="checkbox" aria-label={`邀请${person.name}观看`} checked={invitedIds.includes(person.id)} onChange={(event) => setInvitedIds((ids) => event.target.checked ? [...ids, person.id] : ids.filter((id) => id !== person.id))} /><Avatar person={person} /><span>{person.name}</span></label>)}{!contacts.length && <p className="channel-help">暂无角色</p>}</div></fieldset>
          <label className="channel-setup-field">观众规模<select aria-label="直播观众规模" value={audienceMode} onChange={(event) => setAudienceMode(event.target.value)}>{CHANNEL_AUDIENCES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          {audienceMode === 'auto' && <p className="channel-help">平台身份：{settings?.identity || '素人'}</p>}
          {audienceMode === 'custom' && <label className="channel-setup-field">在线观众人数<input aria-label="直播在线人数" type="number" min={Math.max(1, invitedIds.length)} max={1000000} step={1} value={customViewers} onChange={(event) => setCustomViewers(event.target.value)} /></label>}
          <label className="channel-setup-field">本场氛围<textarea aria-label="直播氛围" rows={3} maxLength={1000} value={atmosphere} onChange={(event) => setAtmosphere(event.target.value)} /></label>
        </div>}
        {panel === 'compose' && tab === 'plaza' && <><input ref={imageInput} type="file" accept="image/*" aria-label="发布动态配图" className="hidden" disabled={imageBusy} onChange={(event) => { void uploadPostImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />{composerImage && <div className="channel-upload-preview"><img alt="待发布的配图" src={composerImage} /><button type="button" aria-label="移除动态配图" onClick={() => setComposerImage('')}><Trash2 size={15} /></button></div>}<button type="button" disabled={imageBusy} className="channel-image-picker" onClick={() => imageInput.current?.click()}><ImagePlus size={17} />{imageBusy ? '处理图片…' : composerImage ? '更换配图' : '添加图片'}</button></>}
        {panel === 'compose' && tab === 'plaza' && <details className="channel-text-image-editor"><summary><Type size={16} />文字图</summary><textarea aria-label="文字图内容" rows={3} maxLength={1000} value={textImage} onChange={event => setTextImage(event.target.value)} />{textImage.trim() && <div className="channel-text-image"><TextImageCard text={textImage.trim()} large /></div>}</details>}
        {panel === 'compose' && tab === 'plaza' && <details className="channel-text-image-editor"><summary><Play size={16} />文字视频</summary><textarea aria-label="文字视频内容" rows={3} maxLength={2000} value={textVideo} onChange={e => setTextVideo(e.target.value)} placeholder="描述视频画面、声音和情节" /></details>}
        <button type="button" disabled={busy || imageBusy || panel === 'compose' && !draft.trim() && (tab === 'live' || !composerImage && !textImage.trim() && !textVideo.trim())} className="channel-primary-button" onClick={() => panel === 'refresh' ? void refreshFeed() : create()}>{panel === 'refresh' ? <Sparkles size={16} /> : <Send size={16} />}{panel === 'refresh' ? refreshLabel : tab === 'live' ? '开始直播' : '发布动态'}</button>
      </div>}
    </section></div>}

    {forwardPost && <div className="channel-modal" onClick={() => setForwardPost(null)} onKeyDown={(event) => { if (event.key === 'Escape') setForwardPost(null); }}><section role="dialog" aria-modal="true" aria-label="转发帖子给角色" className="channel-sheet" onClick={(event) => event.stopPropagation()}><div className="channel-sheet-grip" /><header><h2>转发给角色</h2><button type="button" aria-label="关闭转发" className="channel-icon-button" onClick={() => setForwardPost(null)}><X size={18} /></button></header><p className="channel-forward-preview">{forwardPost.author.name}：{forwardPost.text}</p>
      {error && <p role="alert" className="channel-error">{error}</p>}<div className="channel-sheet-content">{contacts.map((person) => <label className="channel-person-option" key={person.id}><input type="checkbox" aria-label={`转发给${person.name}`} checked={forwardIds.includes(person.id)} onChange={(event) => setForwardIds((ids) => event.target.checked ? [...ids, person.id] : ids.filter((id) => id !== person.id))} /><Avatar person={person} /><span><strong>{person.name}</strong><small>发送到微信聊天</small></span></label>)}{!contacts.length && <p className="channel-help">先在微信通讯录创建角色，再来分享帖子。</p>}
        <button type="button" disabled={!forwardIds.length} className="channel-primary-button" onClick={() => { const issue = onForward(forwardPost, forwardIds); if (issue) setError(issue); else { update('posts', forwardPost.id, post => post.engagement ? { ...post, engagement: { ...post.engagement, shares: post.engagement.shares + forwardIds.length, views: Math.max(post.engagement.views, post.engagement.shares + forwardIds.length) } } : post); setForwardPost(null); setNotice(`已转发给 ${forwardIds.length} 位角色`); } }}><Forward size={16} />转发{forwardIds.length ? `（${forwardIds.length}）` : ''}</button></div></section></div>}

    {authorSheet && <div className="channel-modal" onClick={() => setAuthorSheet(null)} onKeyDown={(event) => { if (event.key === 'Escape') setAuthorSheet(null); }}><section role="dialog" aria-modal="true" aria-label="视频号作者主页" className="channel-sheet channel-author-sheet" onClick={(event) => event.stopPropagation()}><div className="channel-sheet-grip" /><button type="button" aria-label="关闭作者主页" className="channel-icon-button channel-sheet-close" onClick={() => setAuthorSheet(null)}><X size={18} /></button><div className="channel-author-hero"><Avatar person={authorSheet} size="lg" /><h2>{authorSheet.name}</h2><div className="channel-author-followers"><strong>{formatChannelCount(channelFollowers(authorSheet, settings))}</strong><span>粉丝</span></div>{authorSheet.accountId && <p>@{authorSheet.accountId}</p>}{settings.roles.find(role => role.contactId === authorSheet.id)?.identity && <p>{settings.roles.find(role => role.contactId === authorSheet.id)?.identity}</p>}</div><div className="channel-author-sheet-actions"><button type="button" className="channel-primary-button" onClick={() => follow(authorSheet.id)}>{followed(authorSheet.id) ? <Check size={15} /> : <Plus size={15} />}{followed(authorSheet.id) ? '已关注' : '关注'}</button><button type="button" className="channel-secondary-button" onClick={() => openMessage(authorSheet)}><Send size={15} />私信</button></div><p className="channel-sheet-label">动态</p><div className="channel-author-posts">{[...data.posts, ...data.rooms].filter((item) => item.author.id === authorSheet.id).sort((a, b) => b.time - a.time).slice(0, 12).map((item) => <button type="button" key={item.id} onClick={() => { const room = data.rooms.some((room) => room.id === item.id); setTab(room ? 'live' : 'plaza'); open(room ? 'rooms' : 'posts', item.id); }}><span><MessageCircle size={18} /></span><div><strong>{item.text}</strong><small>{relativeTime(item.time)}</small></div><ChevronRight size={14} /></button>)}</div></section></div>}
    {!liveFocus && <nav aria-label="视频号导航" className="channel-nav">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-label={label} aria-current={tab === id ? 'page' : undefined} onClick={() => switchTab(id)}><span><Icon size={20} strokeWidth={tab === id ? 2 : 1.6} />{id === 'messages' && unread > 0 && <i aria-hidden="true">{unread > 99 ? '99+' : unread}</i>}</span>{label}</button>)}</nav>}
  </section>;
}
