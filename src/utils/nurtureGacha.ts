import { requestConfiguredAiText } from './aiApi';
import { parseAiJson } from './aiResponse';
import type { Card, Step } from './nurture';
import type { GameDesign } from './nurtureDesign';
import { RECHARGE_PLAYBACK_MS } from './nurtureRecharge';

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const PITY_LIMIT = 60;
export const isPityRare = (card: Card) => card.pityEligible ?? ['SSR', 'UR', 'SP'].includes(card.rarity.toUpperCase());
export function validatePityPool(cards: Card[]) {
  if (cards.some(c => c.weight > 0) && !cards.some(c => c.weight > 0 && isPityRare(c))) throw new Error('60 抽保底需要至少一张在池稀有卡，请勾选“计入保底稀有”并设置正权重。');
}
export function prepareDrawSequence(cards: Card[], pity: number, choose: (cards: Card[]) => Card | undefined, count = 80) {
  validatePityPool(cards);
  const rare = cards.filter(c => c.weight > 0 && isPityRare(c));
  const sequence: Card[] = [], counters: number[] = [];
  for (let i = 0; i < count; i++) {
    const card = choose(pity === PITY_LIMIT - 1 ? rare : cards);
    if (!card) break;
    pity = isPityRare(card) ? 0 : pity + 1;
    sequence.push(card); counters.push(pity);
  }
  return { cards: sequence, counters };
}
export const cardsForDraw = (step: Step): Card[] => step.drawnCards ?? (step.card ? [step.card] : []);
export const playbackDuration = (step?: Step) => step?.kind === 'status' ? Math.min(16000, Math.max(5000, ((step.statusNote?.length ?? 0) + step.thought.length) * 36)) : step?.kind === 'gift' ? Math.min(14000, Math.max(6000, (step.speech.length + step.thought.length) * 32)) : step?.kind === 'recharge' ? RECHARGE_PLAYBACK_MS : step?.draw && cardsForDraw(step).length ? cardsForDraw(step).length === 10 ? 9500 : 6500 : 3200;
export async function generateCommonCards(design: GameDesign, existing: Card[], count: number, direction: string, signal: AbortSignal): Promise<Card[]> {
  if (!Number.isInteger(count) || count < 3 || count > 30) throw new Error('批量生成数量请填写 3～30 张。');
  if (direction.length > 3000) throw new Error('卡面方向请控制在 3000 字以内。');
  const raw = await requestConfiguredAiText('你是养成游戏的卡面策划。按游戏介绍与人物设定批量设计普通R卡：朴素、日常、有具体生活细节，把重大剧情和珍贵时刻留给稀有卡。每张卡名和场景不同，不重复已有卡名。只写画面与氛围，不替user编造对白或承诺。不要生成图片URL、稀有卡或概率。只返回JSON：{"cards":[{"name":"卡名","description":"画面描述","artText":"显示在文字卡面上的短文"}]}，数量严格等于count。', JSON.stringify({ task: 'common-cards', game: design.description, hero: design.hero, existingNames: existing.map(c => c.name), count, direction }), { json: true, signal, maxTokens: 6000, includeGlobalWorldBooks: true });
  signal.throwIfAborted();
  const parsed = parseAiJson(raw);
  if (!obj(parsed) || !Array.isArray(parsed.cards) || parsed.cards.length !== count) throw new Error('AI 返回的普卡数量不符，请重试。');
  const names = new Set(existing.map(c => c.name.trim().toLocaleLowerCase()));
  return parsed.cards.map(c => {
    if (!obj(c) || !['name', 'description', 'artText'].every(k => typeof c[k] === 'string' && String(c[k]).trim() && String(c[k]).length <= (k === 'name' ? 100 : 1500))) throw new Error('AI 返回的普卡内容不完整，请重试。');
    const key = String(c.name).trim().toLocaleLowerCase();
    if (names.has(key)) throw new Error('AI 返回了重复卡名，请重试。');
    names.add(key);
    return { id: crypto.randomUUID(), name: String(c.name).trim(), description: String(c.description), artText: String(c.artText), artType: 'text', image: '', rarity: 'R', weight: 1, pityEligible: false };
  });
}
export function mergeCommonCards(existing: Card[], drafts: Card[]): Card[] {
  const commons = existing.filter(c => c.rarity.toUpperCase() === 'R' && c.weight > 0);
  const budget = commons.reduce((n, c) => n + c.weight, 0) || 75;
  const weight = budget / (commons.length + drafts.length);
  if (!drafts.length) return existing;
  return [...existing.map(c => commons.includes(c) ? { ...c, weight } : c), ...drafts.map(c => ({ ...c, rarity: 'R', weight }))];
}
