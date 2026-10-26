import type { LiveRoomState } from '../components/ChannelsLiveRoom';
import type { ChannelEngagement } from './channelEngagement';
import { isChannelMedia, channelVisibleText, type ChannelMedia } from './channelMessageMedia';

export type ChannelPerson = { id: string; name: string; avatarUrl?: string; persona?: string; accountId?: string; forumNickname?: string; forumHandle?: string };
export type ChannelKind = 'posts' | 'rooms' | 'messages';
export type ChannelItem = {
  id: string; author: ChannelPerson; text: string; time: number; liked?: boolean; replies: string[]; ended?: boolean; live?: LiveRoomState;
  topic?: string; imageUrl?: string; readAt?: number; lastIncomingAt?: number; ownReplyIndices?: number[]; sourcePostId?: string;
  replyAuthorIds?: string[]; endedAt?: number; textImage?: string; textVideo?: string; engagement?: ChannelEngagement;
  replyMedia?: Record<string, ChannelMedia>;
};
export type ChannelData = { posts: ChannelItem[]; rooms: ChannelItem[]; messages: ChannelItem[]; following: string[]; saved?: string[] };
export const CHANNEL_DATA_KEY = 'yyphone:channels:life-v1';
export const CHANNEL_TOPICS = [
  { id: 'daily', label: '生活碎片', emoji: '☁', color: '#628e83', bg: 'linear-gradient(135deg,#deeee5,#ecf4ef 58%,#f8ecd6)' },
  { id: 'heart', label: '心动现场', emoji: '♡', color: '#ba7c90', bg: 'linear-gradient(135deg,#f5dce8,#fbedee 58%,#f5e6cb)' },
  { id: 'night', label: '深夜电台', emoji: '☾', color: '#7d82ad', bg: 'linear-gradient(135deg,#e0e4f5,#edeafa 58%,#e5f1f2)' },
  { id: 'fun', label: '快乐放送', emoji: '✷', color: '#b78b47', bg: 'linear-gradient(135deg,#f6e9c5,#fcf3df 58%,#f5e0d6)' },
  { id: 'explore', label: '出走一下', emoji: '↗', color: '#6e98b5', bg: 'linear-gradient(135deg,#d9eaf6,#ebf5fa 58%,#e5ecdd)' },
] as const;
export const CHANNEL_IDEAS = [
  { label: '下班后的另一面', topic: 'daily', text: '下班后的小小自由，写点出人意料的生活细节' },
  { label: '有点心动', topic: 'heart', text: '一次不经意的心动，有分寸、有细节，别都写成告白' },
  { label: '凌晨两点', topic: 'night', text: '深夜还醒着的人，聊各自不同的小心事和生活' },
  { label: '快乐发疯', topic: 'fun', text: '生活里的反差和好笑瞬间，各有各的幽默，不要套梗' },
  { label: '周末出逃', topic: 'explore', text: '短暂出走，散步、旅行、发现陌生街角，不必都去远方' },
  { label: '小动物来营业', topic: 'daily', text: '遇见小动物的意外小故事，不要给所有人都编造宠物' },
] as const;
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validLive = (value: unknown): value is LiveRoomState => record(value) && number(value.viewers) && number(value.hearts) &&
  (value.hostActions === undefined || Array.isArray(value.hostActions) && value.hostActions.every(action => typeof action === 'string')) &&
  ['invitedRoleIds', 'participantIds'].every((key) => value[key] === undefined || Array.isArray(value[key]) && value[key].every((id) => typeof id === 'string')) &&
  (value.atmosphere === undefined || typeof value.atmosphere === 'string') &&
  (value.audience === undefined || record(value.audience) && number(value.audience.min) && number(value.audience.max) && value.audience.max >= value.audience.min) &&
  (value.scene === undefined || typeof value.scene === 'string') && Array.isArray(value.gifts) && value.gifts.every((gift) => record(gift) &&
    typeof gift.id === 'string' && typeof gift.senderId === 'string' && typeof gift.senderName === 'string' && typeof gift.giftId === 'string' && number(gift.createdAt) &&
    (gift.amount === undefined || number(gift.amount))) &&
  (value.background === undefined || record(value.background) && typeof value.background.presetId === 'string' && typeof value.background.imageUrl === 'string');
const validItem = (value: unknown): value is ChannelItem => record(value) && typeof value.id === 'string' && record(value.author) &&
  typeof value.author.id === 'string' && typeof value.author.name === 'string' && typeof value.text === 'string' && number(value.time) &&
  ['avatarUrl', 'persona', 'accountId', 'forumNickname', 'forumHandle'].every((key) => (value.author as Record<string, unknown>)[key] === undefined || typeof (value.author as Record<string, unknown>)[key] === 'string') &&
  ['liked', 'ended'].every((key) => value[key] === undefined || typeof value[key] === 'boolean') &&
  Array.isArray(value.replies) && value.replies.every((reply) => typeof reply === 'string') &&
  (value.engagement === undefined || record(value.engagement) && ['followers', 'views', 'likes', 'comments', 'saves', 'shares'].every(key =>
    Number.isSafeInteger((value.engagement as Record<string, unknown>)[key]) && number((value.engagement as Record<string, unknown>)[key]))) &&
  (value.live === undefined || validLive(value.live)) &&
  ['topic', 'imageUrl', 'sourcePostId', 'textImage', 'textVideo'].every((key) => value[key] === undefined || typeof value[key] === 'string') &&
  (value.replyMedia === undefined || record(value.replyMedia) && Object.entries(value.replyMedia).every(([index, media]) => /^\d+$/.test(index) && Number(index) < (value.replies as string[]).length && isChannelMedia(media))) &&
  ['readAt', 'lastIncomingAt', 'endedAt'].every((key) => value[key] === undefined || number(value[key])) &&
  (value.replyAuthorIds === undefined || Array.isArray(value.replyAuthorIds) && value.replyAuthorIds.length === value.replies.length && value.replyAuthorIds.every((id) => typeof id === 'string')) &&
  (value.ownReplyIndices === undefined || Array.isArray(value.ownReplyIndices) && value.ownReplyIndices.every((index) => Number.isInteger(index) && index >= 0 && index < (value.replies as string[]).length));
export const isChannelData = (value: unknown): value is ChannelData => record(value) &&
  ['posts', 'rooms', 'messages'].every((key) => Array.isArray(value[key]) && value[key].every(validItem)) &&
  Array.isArray(value.following) && value.following.every((id) => typeof id === 'string') &&
  (value.saved === undefined || Array.isArray(value.saved) && value.saved.every((id) => typeof id === 'string'));

export function channelTopic(item: Pick<ChannelItem, 'topic' | 'text'>) {
  const inferred = /深夜|晚安|失眠|夜里|凌晨|月亮/.test(item.text) ? 'night' : /喜欢|心动|约会|想你|拥抱/.test(item.text) ? 'heart'
    : /旅行|散步|海边|出发|城市|山顶/.test(item.text) ? 'explore' : /笑死|哈哈|搞笑|离谱|发疯/.test(item.text) ? 'fun' : 'daily';
  return CHANNEL_TOPICS.find((topic) => topic.id === item.topic) ?? CHANNEL_TOPICS.find((topic) => topic.id === inferred)!;
}
export const hasChannelUnread = (item: ChannelItem) => (item.lastIncomingAt ?? 0) > (item.readAt ?? 0);
export function channelReply(line: string) {
  const index = line.indexOf('：');
  return index < 0 ? { name: '', text: line } : { name: line.slice(0, index), text: line.slice(index + 1) };
}
export function appendChannelReply(item: ChannelItem, person: ChannelPerson, text: string, options: { own?: boolean; thread?: boolean; read?: boolean; now: number }): ChannelItem {
  return { ...item, replies: [...item.replies, `${person.name}：${text}`],
    ...(item.engagement && !options.thread ? { engagement: { ...item.engagement, comments: Math.max(item.engagement.comments + 1, item.replies.length + 1), views: Math.max(item.engagement.views, item.engagement.comments + 1, item.replies.length + 1) } } : {}),
    replyAuthorIds: [...(item.replyAuthorIds ?? item.replies.map(() => '')), person.id],
    ownReplyIndices: options.own ? [...(item.ownReplyIndices ?? []), item.replies.length] : item.ownReplyIndices,
    time: options.thread ? options.now : item.time,
    ...(options.thread && !options.own ? { lastIncomingAt: options.now, ...(options.read ? { readAt: options.now } : {}) } : {}),
  };
}
export function channelItems(data: ChannelData, options: { kind: ChannelKind; filter: string; search: string; topic: string; friendIds: string[] }) {
  const { kind, filter, search, topic, friendIds } = options;
  const keyword = search.trim().toLowerCase();
  return data[kind].filter((item) => {
    const match = kind === 'messages' ? filter === 'stranger' ? !friendIds.includes(item.author.id) : friendIds.includes(item.author.id)
      : filter === 'self' ? item.author.id === 'self' : filter === 'saved' ? (data.saved ?? []).includes(item.id)
      : filter === 'following' ? data.following.includes(item.author.id) && (kind !== 'rooms' || !item.ended)
      : filter === 'replay' ? item.ended === true : item.author.id !== 'self' && (kind !== 'rooms' || !item.ended);
    return match && (kind !== 'posts' || topic === 'all' || channelTopic(item).id === topic) &&
      (!keyword || `${item.author.name} ${item.text} ${item.replies.join(' ')}`.toLowerCase().includes(keyword));
  }).sort((a, b) => (kind === 'rooms' && b.ended ? b.endedAt ?? b.time : b.time) - (kind === 'rooms' && a.ended ? a.endedAt ?? a.time : a.time));
}
export function sampleChannelPeople<T>(items: T[], count: number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const chosen = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[chosen]] = [shuffled[chosen], shuffled[index]];
  }
  return shuffled.slice(0, count);
}
const strangerNames = ['巷口的风', '晚睡的橘子', '山间来信', '今天慢一点', '雨停以后', '第七页日记', '青柠苏打', '桃子售罄', '松间月', '不加糖的云', '散步暂停', '薄荷来电'];
export function channelStranger(name = strangerNames[Math.floor(Math.random() * strangerNames.length)]): ChannelPerson {
  return { id: `stranger:${crypto.randomUUID()}`, name, persona: '视频号的普通路人；只知道平台公开内容，不知道玩家的私聊或线下秘密。' };
}
export function channelFeedPeople(contacts: ChannelPerson[]): ChannelPerson[] {
  const selected = sampleChannelPeople(contacts.filter((person, index, all) => person.id !== 'self' && all.findIndex((other) => other.id === person.id) === index), 3);
  const names = sampleChannelPeople(strangerNames.filter((name) => !selected.some((person) => person.name === name)), 5 - selected.length);
  return [...selected, ...names.map(channelStranger)];
}
export function parseChannelBatch(result: unknown, people: ChannelPerson[]) {
  if (!record(result) || !Array.isArray(result.items) || result.items.length !== people.length) throw new Error('返回内容不完整，请重试。');
  const entries: unknown[] = result.items;
  const texts = new Set<string>();
  return people.map((author) => {
    const matches = entries.filter((entry) => record(entry) && entry.authorId === author.id);
    const entry = matches[0];
    if (matches.length !== 1 || !record(entry) || typeof entry.text !== 'string' || !entry.text.trim()) throw new Error('本批内容缺少发言者或正文，请重试。');
    const text = channelVisibleText(entry.text).slice(0, 2000);
    const key = text.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
    if (!key || texts.has(key)) throw new Error('本批内容有重复，请重试。');
    texts.add(key);
    return { author, text, topic: channelTopic({ topic: typeof entry.topic === 'string' ? entry.topic : undefined, text }).id };
  });
}
export function channelPublicContext(data: ChannelData) {
  return {
    posts: [...data.posts].filter((item) => item.author.id === 'self').sort((a, b) => b.time - a.time).slice(0, 3).map((item) => ({ text: item.text.slice(0, 1600), ...(item.textImage ? { textImage: item.textImage.slice(0, 1000) } : {}), ...(item.textVideo ? { textVideo: item.textVideo.slice(0, 2000) } : {}), time: item.time })),
    lives: [...data.rooms].filter((item) => item.author.id === 'self').sort((a, b) => b.time - a.time).slice(0, 2).map((item) => ({ title: item.text.slice(0, 500), scene: item.live?.scene?.slice(0, 1000), ended: !!item.ended })),
  };
}
