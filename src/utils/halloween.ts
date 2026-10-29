import { setStorageItemsAtomically } from './dbStorage';
import { readStoredValue, writeStoredValue } from './localStorage';

export const HALLOWEEN_SETTINGS_KEY = 'yyphone:halloween-settings';
export const HALLOWEEN_SEEN_KEY = 'yyphone:halloween-seen';
export const HALLOWEEN_BEST_KEY = 'yyphone:halloween-best';
export const HALLOWEEN_REWARD_KEY = 'yyphone:halloween-reward';
export const HALLOWEEN_CHANGE = 'yyphone:halloween-change';
export const HALLOWEEN_OPEN = 'yyphone:halloween-open';
export const DEFAULT_HALLOWEEN_SETTINGS = { enabled: true };
export const halloweenDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
export function isHalloweenSeason(now = new Date()): boolean {
  return now.getMonth() === 9 && now.getDate() >= 29 || now.getMonth() === 10 && now.getDate() === 1;
}
export const readHalloweenSettings = () => readStoredValue(HALLOWEEN_SETTINGS_KEY, DEFAULT_HALLOWEEN_SETTINGS,
  (v): v is typeof DEFAULT_HALLOWEEN_SETTINGS => !!v && typeof v === 'object' && 'enabled' in v && typeof v.enabled === 'boolean');
export const readHalloweenSeen = () => readStoredValue(HALLOWEEN_SEEN_KEY, [] as string[],
  (v): v is string[] => Array.isArray(v) && v.every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)));
export function halloweenIsDue(settings: { enabled: boolean }, seen: string[], now = new Date()): boolean {
  return settings.enabled && isHalloweenSeason(now) && !seen.includes(halloweenDate(now));
}
export function markHalloweenSeen(now = new Date()) {
  writeStoredValue(HALLOWEEN_SEEN_KEY, [...new Set([...readHalloweenSeen(), halloweenDate(now)])].slice(-16));
}
export async function saveHalloweenSettings(settings: { enabled: boolean }) {
  await setStorageItemsAtomically({ [HALLOWEEN_SETTINGS_KEY]: { enabled: settings.enabled === true } });
  window.dispatchEvent(new Event(HALLOWEEN_CHANGE));
}
const readHalloweenScores = () => readStoredValue(HALLOWEEN_BEST_KEY, {} as Record<string, number>,
    (v): v is Record<string, number> => !!v && typeof v === 'object' && !Array.isArray(v) &&
      Object.entries(v).every(([year, score]) => /^\d{4}$/.test(year) && typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 3));
export const readHalloweenBest = (year = new Date().getFullYear()): number | undefined => readHalloweenScores()[String(year)];
export function keepHalloweenBest(score: number, year = new Date().getFullYear()): number {
  if (!Number.isInteger(score) || score < 0 || score > 3) throw new Error('糖果数量无效。');
  const best = Math.max(readHalloweenBest(year) ?? 0, score);
  // This is only a local game record, never an inventory item, payment or character memory.
  writeStoredValue(HALLOWEEN_BEST_KEY, { ...readHalloweenScores(), [year]: best });
  window.dispatchEvent(new Event(HALLOWEEN_CHANGE));
  return best;
}

export interface HalloweenReward { candies: number; unlocked: boolean; settledGames: string[] }
export function readHalloweenReward(): HalloweenReward {
  // Older versions kept only the best score. Give those earned candies back once.
  return readStoredValue(HALLOWEEN_REWARD_KEY, { candies: Math.max(0, ...Object.values(readHalloweenScores())), unlocked: false, settledGames: [] },
    (v): v is HalloweenReward => !!v && typeof v === 'object' && 'candies' in v && Number.isSafeInteger(v.candies) && Number(v.candies) >= 0 &&
      'unlocked' in v && typeof v.unlocked === 'boolean' && 'settledGames' in v && Array.isArray(v.settledGames) && v.settledGames.every(id => typeof id === 'string'));
}
// Serialize settlement and redemption, including rapid clicks from different entry points.
let rewardQueue: Promise<unknown> = Promise.resolve();
function rewardTransaction<T>(work: () => Promise<T>): Promise<T> {
  const next = rewardQueue.then(work, work);
  rewardQueue = next.catch(() => undefined);
  return next;
}
export function completeHalloweenGame(score: number, gameId: string, year = new Date().getFullYear()) {
  return rewardTransaction(async () => {
    if (!Number.isInteger(score) || score < 0 || score > 3 || !gameId.trim()) throw new Error('糖果成绩无效。');
    const reward = readHalloweenReward();
    const best = Math.max(readHalloweenBest(year) ?? 0, score);
    if (reward.settledGames.includes(gameId)) return { best: readHalloweenBest(year), reward };
    const next = { ...reward, candies: reward.candies + score, settledGames: [...reward.settledGames, gameId].slice(-100) };
    await setStorageItemsAtomically({ [HALLOWEEN_BEST_KEY]: { ...readHalloweenScores(), [year]: best }, [HALLOWEEN_REWARD_KEY]: next });
    window.dispatchEvent(new Event(HALLOWEEN_CHANGE));
    return { best, reward: next };
  });
}
export function redeemHalloweenTheme() {
  return rewardTransaction(async () => {
    const reward = readHalloweenReward();
    if (reward.unlocked) return reward;
    if (reward.candies < 3) throw new Error('再攒几颗糖，就能带走南瓜夜宴。');
    const next = { ...reward, candies: reward.candies - 3, unlocked: true };
    await setStorageItemsAtomically({ [HALLOWEEN_REWARD_KEY]: next });
    window.dispatchEvent(new Event(HALLOWEEN_CHANGE));
    return next;
  });
}

export type PumpkinOrder = [number, number, number];
export interface HalloweenRound { target: number; swaps: Array<[number, number]> }
export function swapPumpkins(order: PumpkinOrder, swap: [number, number]): PumpkinOrder {
  const next: PumpkinOrder = [...order];
  [next[swap[0]], next[swap[1]]] = [next[swap[1]], next[swap[0]]];
  return next;
}
export function makeHalloweenRound(round: number, random = Math.random): HalloweenRound {
  const target = Math.min(2, Math.max(0, Math.floor(random() * 3)));
  const swaps: Array<[number, number]> = [];
  for (let index = 0; index < 3 + Math.min(2, Math.max(0, round)); index++) {
    const first = Math.floor(random() * 3);
    let second = (first + 1 + Math.floor(random() * 2)) % 3;
    const previous = swaps.at(-1);
    if (previous?.includes(first) && previous.includes(second)) second = 3 - first - second;
    swaps.push([first, second]);
  }
  return { target, swaps };
}
export const HALLOWEEN_TITLES = ['幽灵认证的同伙', '偶尔靠谱的讨糖鬼', '南瓜街的熟客', '今晚的糖果大盗'];
export const HALLOWEEN_QUIPS = ['糖没找着，捣蛋天赋倒是满分。', '一颗也算开张，剩下的下次再讨。', '两颗到手，最后一颗先记幽灵账上。', '三颗全中。南瓜店长决定假装没看见。'];
