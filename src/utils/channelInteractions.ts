import { channelStranger, parseChannelBatch, record, sampleChannelPeople, type ChannelPerson } from './channelLife';

/** A known role and strangers both participate, without giving a stranger a contact's name. */
export function channelCommentPeople(contacts: ChannelPerson[], count = 7, authorId?: string): ChannelPerson[] {
  const people = sampleChannelPeople(contacts.filter((person, index, all) => person.id !== 'self' && person.id !== authorId &&
    all.findIndex((other) => other.id === person.id) === index), Math.min(3, count - 2));
  while (people.length < count) {
    const person = channelStranger();
    if (!people.some((other) => other.name === person.name) && !contacts.some((other) => other.name === person.name)) people.push(person);
    // Also work if users have named many contacts after the built-in stranger names.
    else if (people.length < count) people.push(channelStranger(`路过的朋友${people.length + 1}`));
  }
  return people;
}

/** Validate all five posts and every attached comment before saving any of them. */
export function parseChannelPosts(result: unknown, authors: ChannelPerson[], commenters: ChannelPerson[]) {
  const posts = parseChannelBatch(result, authors);
  if (!record(result) || !Array.isArray(result.items)) throw new Error('帖子格式不完整。');
  return posts.map((post) => {
    const entry = (result.items as unknown[]).find((entry) => record(entry) && entry.authorId === post.author.id);
    if (!record(entry) || !Array.isArray(entry.comments) || entry.comments.length !== 4) throw new Error('帖子的评论不完整，请重试。');
    const people = entry.comments.map((comment) => record(comment) ? commenters.find((person) => person.id === comment.authorId && person.id !== post.author.id) : undefined);
    if (people.some((person) => !person) || new Set(people.map((person) => person?.id)).size !== 4) throw new Error('帖子的评论者缺失或重复。');
    if (entry.textImage !== undefined && typeof entry.textImage !== 'string') throw new Error('文字图格式无效。');
    if (entry.textVideo !== undefined && typeof entry.textVideo !== 'string') throw new Error('文字视频格式无效。');
    return { ...post, ...(typeof entry.textVideo === 'string' && entry.textVideo.trim() ? { textVideo: entry.textVideo.trim().slice(0, 2000) } : {}), ...(typeof entry.textImage === 'string' && entry.textImage.trim() ? { textImage: entry.textImage.trim().slice(0, 1000) } : {}), comments: parseChannelBatch({ items: entry.comments }, people as ChannelPerson[]) };
  });
}

export const CHANNEL_AUDIENCES = [
  { id: 'auto', label: '根据我的平台人设' }, { id: 'small', label: '素人小直播间' },
  { id: 'creator', label: '小有名气的博主' }, { id: 'famous', label: '热门网红直播间' }, { id: 'custom', label: '自己填写在线人数' },
] as const;
export function channelAudience(identity: string, mode = 'auto', custom = 0) {
  const resolved = mode === 'auto' ? /网红|明星|大主播|顶流|黑红|百万|千万/.test(identity) ? 'famous'
    : /素人|新人|新手/.test(identity) ? 'small' : /博主|主播|小有名气|达人|万粉/.test(identity) ? 'creator' : 'small' : mode;
  const range = resolved === 'custom' ? { min: Math.round(custom), max: Math.round(custom) }
    : resolved === 'famous' ? { min: 8000, max: 200000 } : resolved === 'creator' ? { min: 80, max: 2500 } : { min: 0, max: 30 };
  return { ...range, atmosphere: /黑红|黑粉|争议/.test(identity) ? '争议型直播间：有真粉、黑粉、串子和路人，观点冲突自然，不能全员吹捧。'
    : resolved === 'small' ? '素人直播间：人数少，偶尔冷场，路过的人和熟人随意聊几句，不虚构庞大粉丝团。'
    : '根据主播身份与本场话题，合理安排粉丝、路人、同好与不同意见，避免整齐划一地夸赞。' };
}
export function channelViewerCount(value: unknown, range: { min: number; max: number }, fallback: number) {
  return Math.max(range.min, Math.min(range.max, typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback));
}
