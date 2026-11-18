import type { Card } from '../utils/nurture';
import { CARD_RARITIES, groupedCollection } from '../utils/nurtureCollection';
import { NurtureCardArt } from './NurtureCardArt';

export function NurtureCollection({ cards }: { cards: Card[] }) {
  const entries = groupedCollection(cards);
  const legacy = [...new Set(entries.map(e => e.card.rarity.toUpperCase()))].filter(r => !CARD_RARITIES.includes(r as typeof CARD_RARITIES[number]));
  return <section className="nurture-collection"><h3>卡册 · {entries.length} 款 / {cards.length} 张</h3>{[...CARD_RARITIES, ...legacy].map(rarity => {
    const rows = entries.filter(e => e.card.rarity.toUpperCase() === rarity);
    return <details key={rarity} className="nurture-collection-tier" open><summary>{rarity}<small>{rows.length} 款</small></summary>{rows.length ? <div className="nurture-card-grid">{rows.map(({ card, count }) => <article key={card.id} className="nurture-card"><div className="nurture-owned-card-art"><NurtureCardArt card={card}/><small className="nurture-card-count" aria-label={`拥有 ${count} 张`}>×{count}</small></div><strong>{card.name}</strong><p>{card.description}</p></article>)}</div> : <p className="nurture-hint">暂未收藏 {rarity} 卡面。</p>}</details>;
  })}</section>;
}
