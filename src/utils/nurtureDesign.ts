import { SHOP, SCHEDULES, DATES } from './nurtureGame';
import type { Plan, Save, Stats } from './nurture';
import type { CSSProperties } from 'react';

export type NurtureColors = { buttonColor: string; buttonTextColor: string; textColor: string };
export const DEFAULT_NURTURE_COLORS: NurtureColors = { buttonColor: '#eee0e9', buttonTextColor: '#987a99', textColor: '#654e59' };
export const nurtureColorStyle = (colors?: NurtureColors) => colors ? { '--nurture-button-color': colors.buttonColor, '--nurture-button-text': colors.buttonTextColor, '--nurture-text-color': colors.textColor } as CSSProperties : undefined;

export type GameActivity = { id: string; name: string; description: string; price: number; delta: Stats };
export type GameProduct = { id: string; name: string; description: string; type: '服装' | '道具'; price: number; currency: 'gems' | 'coins'; image?: string; reaction?: string; effectsEnabled?: boolean; effects?: Stats };
export type GameDesign = { description: string; hero: { name: string; nickname: string; setting: string }; shop: GameProduct[]; schedules: GameActivity[]; dates: GameActivity[]; drawCost: number; rechargeGems: number; colors?: NurtureColors; statusNote?: string };
export const emptyDelta = (): Stats => ({ mood: 0, energy: 0, affection: 0, growth: 0 });
export function defaultDesign(userName = '我'): GameDesign {
  return { description: '一款以陪伴、触碰互动、日程培养、约会与卡面收集为核心的养成游戏。', hero: { name: userName, nickname: '', setting: '' }, shop: SHOP.map(p => ({ ...p })), schedules: SCHEDULES.map(a => ({ ...a, price: 0, delta: { ...a.delta } })), dates: DATES.map(a => ({ ...a, delta: { ...a.delta } })), drawCost: 100, rechargeGems: 60 };
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 6000) => typeof v === 'string' && v.length <= max;
const price = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= 1000000;
const delta = (v: unknown) => obj(v) && ['mood', 'energy', 'affection', 'growth'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && Math.abs(v[k]) <= 15);
const row = (v: unknown): v is Record<string, unknown> => obj(v) && text(v.id, 100) && !!v.id && text(v.name, 100) && !!String(v.name).trim() && text(v.description) && price(v.price);
export const validProduct = (p: unknown): p is GameProduct => row(p) && ['服装', '道具'].includes(String(p.type)) && ['gems', 'coins'].includes(String(p.currency)) && (p.image === undefined || typeof p.image === 'string') && (p.reaction === undefined || text(p.reaction, 1500)) && (p.effectsEnabled === undefined || typeof p.effectsEnabled === 'boolean') && (p.effects === undefined || delta(p.effects)) && (!p.effectsEnabled || delta(p.effects));
export function validateShopReactions(shop: GameProduct[]) {
  const missing = shop.filter(p => !p.reaction?.trim());
  if (missing.length) throw new Error(`请填写收到商品后的反应：${missing.map(p => p.name).join('、')}。`);
}
export function validDesign(v: unknown): v is GameDesign {
  if (obj(v) && v.statusNote !== undefined && !text(v.statusNote, 3000)) return false;
  if (obj(v) && v.colors !== undefined && (!obj(v.colors) || !['buttonColor', 'buttonTextColor', 'textColor'].every(k => typeof (v.colors as Record<string, unknown>)[k] === 'string' && /^#[0-9a-f]{6}$/i.test(String((v.colors as Record<string, unknown>)[k]))))) return false;
  if (!obj(v) || !text(v.description) || !String(v.description).trim() || !obj(v.hero) || !text(v.hero.name, 100) || !String(v.hero.name).trim() || !text(v.hero.nickname, 100) || !text(v.hero.setting) || !price(v.drawCost) || !price(v.rechargeGems) || v.rechargeGems === 0) return false;
  if (!Array.isArray(v.shop) || !v.shop.every(validProduct)) return false;
  for (const list of [v.schedules, v.dates]) if (!Array.isArray(list) || !list.every(a => row(a) && delta(a.delta))) return false;
  return [v.shop, v.schedules as GameActivity[], v.dates as GameActivity[]].every(list => new Set(list.map(p => p.id)).size === list.length);
}
export function validateDesign(v: unknown): asserts v is GameDesign {
  if (!validDesign(v)) throw new Error('请填写游戏描述和角色名字；条目名称不能为空，价格为非负整数，数值变化为 -15～15，补给星钻必须大于 0。');
}
export const currentPlan = (save: Save): Plan => {
  const plan = structuredClone(save.pending ?? { stats: save.stats, speech: '', cards: save.cards, event: save.event, pool: save.pool });
  if (plan.event.enabled && Date.parse(plan.event.endsAt) <= Date.now()) plan.event.enabled = false;
  return plan;
};
export function configureGame(save: Save, plan: Plan, design: GameDesign): Save {
  if (save.rounds[0] && save.rounds[0].cursor < save.rounds[0].steps.length) throw new Error('角色正在操作，播放完成后才能编辑。');
  validateDesign(design);
  return { ...save, pending: plan, design: structuredClone(design) };
}
