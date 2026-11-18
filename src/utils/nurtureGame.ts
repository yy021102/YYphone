import type { Stats } from './nurture';

export const BODY_PARTS = ['头', '脸', '嘴', '脖子', '胸部', '手', '腰', '臀部', '大腿', '小腿', '胳膊', '肩', '脚'] as const;
export type BodyPart = typeof BODY_PARTS[number];
export type Portrait = { image: string; points: Partial<Record<BodyPart, { x: number; y: number }>>; replies: Partial<Record<BodyPart, string>> };
export const emptyPortrait = (): Portrait => ({ image: '', points: {}, replies: {} });
export const touchTargets = (portrait: Portrait) => BODY_PARTS.filter(part => portrait.points[part] && portrait.replies[part]?.trim()).map(part => ({ target: part, reply: portrait.replies[part]! }));
export function selectRoundTouches(portrait: Portrait, random = Math.random) {
  const targets = touchTargets(portrait);
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  return targets.slice(0, 3);
}
export function validateTouchReplies(portrait: Portrait) {
  const missing = BODY_PARTS.filter(part => portrait.points[part] && !portrait.replies[part]?.trim());
  if (missing.length) throw new Error(`请填写已定位部位的触碰发言：${missing.join('、')}。不想开放的部位请清除定位。`);
}
export type Wallet = { gems: number; coins: number; recharged: number };
export const initialWallet = (): Wallet => ({ gems: 300, coins: 1000, recharged: 0 });
export const SHOP = [
  { id: 'dress', name: '云朵连衣裙', type: '服装', currency: 'gems', price: 120, description: '柔软的裙摆，收藏今天的好心情。' },
  { id: 'sweater', name: '奶油针织衫', type: '服装', currency: 'coins', price: 300, description: '为微凉的午后添一点温暖。' },
  { id: 'cake', name: '草莓小蛋糕', type: '道具', currency: 'coins', price: 80, description: '一份甜甜的心意。' },
  { id: 'flowers', name: '一束小雏菊', type: '道具', currency: 'coins', price: 120, description: '把花和想念一起送给你。' },
] as const;
export const SCHEDULES = [
  { id: 'reading', name: '午后阅读', description: '一起翻开喜欢的书', delta: { mood: 3, energy: -5, affection: 2, growth: 10 } },
  { id: 'walk', name: '公园散步', description: '让风陪你走一会儿', delta: { mood: 10, energy: -8, affection: 5, growth: 2 } },
  { id: 'rest', name: '好好休息', description: '把疲惫留在柔软的枕头里', delta: { mood: 5, energy: 15, affection: 2, growth: 0 } },
] satisfies { id: string; name: string; description: string; delta: Stats }[];
export const DATES = [
  { id: 'cafe', name: '街角咖啡馆', price: 100, description: '靠窗的位置，为你留着。', delta: { mood: 10, energy: -5, affection: 12, growth: 2 } },
  { id: 'stars', name: '夜晚看星星', price: 150, description: '把今晚的星光装进口袋。', delta: { mood: 12, energy: -8, affection: 15, growth: 3 } },
] satisfies { id: string; name: string; price: number; description: string; delta: Stats }[];
export function imagePoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  if (rect.width <= 0 || rect.height <= 0) throw new Error('图片尚未加载完成。');
  return { x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) };
}
export function validPortrait(v: unknown): v is Portrait {
  if (!v || typeof v !== 'object') return false;
  const p = v as Portrait;
  return typeof p.image === 'string' && !!p.points && !!p.replies && BODY_PARTS.every(k => {
    const point = p.points[k];
    return (point === undefined || !!point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1) && (p.replies[k] === undefined || typeof p.replies[k] === 'string');
  });
}
export function validWallet(v: unknown): v is Wallet {
  return !!v && typeof v === 'object' && ['gems', 'coins', 'recharged'].every(k => Number.isFinite((v as Record<string, number>)[k]) && (v as Record<string, number>)[k] >= 0);
}
