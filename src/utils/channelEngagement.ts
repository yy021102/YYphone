import type { ChannelData, ChannelItem, ChannelPerson } from './channelLife';
import type { ChannelSettings } from './channelProfile';

export type ChannelEngagement = { followers: number; views: number; likes: number; comments: number; saves: number; shares: number };
const clamp = (value: number) => Math.max(0, Math.min(1000000000, Math.round(value)));
const unit = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967295;
};
export function inferChannelFollowers(persona: string): number {
  const match = persona.match(/(?:粉丝(?:数)?[：:\s]*)?(\d+(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千|[kwm])?\s*(?:粉丝|粉|followers)/i)
    ?? persona.match(/粉丝(?:数)?[：:\s]*(\d+(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千|[kwm])?/i);
  if (match) {
    const multiplier: Record<string, number> = { 亿: 1e8, 千万: 1e7, 百万: 1e6, 十万: 1e5, 万: 1e4, 千: 1e3, k: 1e3, w: 1e4, m: 1e6 };
    return clamp(Number(match[1]) * (multiplier[match[2]?.toLowerCase()] || 1));
  }
  if (/千万粉|顶流|巨星/.test(persona)) return 5000000;
  if (/百万粉|明星/.test(persona)) return 1000000;
  if (/素人|新人|新手|零粉/.test(persona)) return /零粉/.test(persona) ? 0 : 50;
  if (/网红|黑红|大主播/.test(persona)) return 200000;
  if (/博主|主播|达人|创作者/.test(persona)) return 8000;
  return 80;
}
export function channelFollowers(person: ChannelPerson, settings: ChannelSettings): number {
  if (person.id === 'self') return settings.followerCount ?? 0;
  const role = settings.roles.find(role => role.contactId === person.id);
  return role?.followerCount ?? inferChannelFollowers(role?.persona?.trim() || role?.identity.trim() || person.persona || '');
}
/** Account-sized social activity is stored once per post; reopening never rerolls it. */
export function createChannelEngagement(post: ChannelItem, settings: ChannelSettings): ChannelEngagement {
  const followers = channelFollowers(post.author, settings);
  const activity = unit(`${post.id}:views`);
  const attitude = post.author.id === 'self' ? `${settings.persona ?? settings.identity} ${settings.audienceAttitude || ''}`
    : settings.roles.find(role => role.contactId === post.author.id)?.audienceAttitude || '';
  const controversy = /黑粉|争议|黑红/.test(attitude);
  const views = Math.max(post.replies.length, clamp(followers * (.12 + activity * 1.6) * (controversy ? 1.3 : 1) + activity * 40));
  const likes = clamp(views * (.02 + unit(`${post.id}:likes`) * (controversy ? .04 : .09)));
  return { followers, views, likes, comments: Math.max(post.replies.length, clamp(likes * (.04 + unit(`${post.id}:comments`) * (controversy ? .3 : .12)))),
    saves: clamp(likes * (.06 + unit(`${post.id}:saves`) * .23)), shares: clamp(likes * (.02 + unit(`${post.id}:shares`) * .14)) };
}
export function ensureChannelEngagement(data: ChannelData, settings: ChannelSettings, contacts: ChannelPerson[] = []): ChannelData {
  return data.posts.some(post => !post.engagement) ? { ...data, posts: data.posts.map(post => post.engagement ? post : { ...post, engagement: createChannelEngagement({ ...post, author: contacts.find(person => person.id === post.author.id) ?? post.author }, settings) }) } : data;
}
export function formatChannelCount(value: number): string {
  return value >= 1e8 ? `${Number((value / 1e8).toFixed(1))}亿` : value >= 1e4 ? `${Number((value / 1e4).toFixed(1))}万` : String(value);
}
