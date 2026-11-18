import type { Card } from './nurture';

export const CARD_RARITIES = ['SSR', 'SR', 'R'] as const;
export const DEFAULT_RARITY_WEIGHTS = { SSR: 3, SR: 22, R: 75 };
export function changeCardRarity(card: Card, rarity: keyof typeof DEFAULT_RARITY_WEIGHTS): Card {
  return { ...card, rarity, weight: DEFAULT_RARITY_WEIGHTS[rarity], pityEligible: rarity === 'SSR' };
}
export function groupedCollection(cards: Card[]) {
  const groups = new Map<string, { card: Card; count: number }>();
  for (const card of cards) {
    const key = `${card.rarity.toUpperCase()}:${card.id}`;
    const entry = groups.get(key);
    if (entry) entry.count++;
    else groups.set(key, { card, count: 1 });
  }
  return [...groups.values()];
}
