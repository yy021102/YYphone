import type { Card, Plan, Save } from './nurture';

export type PoolCampaign = { name: string; startsAt: string; endsAt: string; updatedAt: string };
export const defaultPool = (): PoolCampaign => ({ name: '常驻卡池', startsAt: '', endsAt: '', updatedAt: '' });
export function validPool(v: unknown): v is PoolCampaign {
  if (!v || typeof v !== 'object') return false;
  const p = v as PoolCampaign;
  return ['name', 'startsAt', 'endsAt', 'updatedAt'].every(k => typeof p[k as keyof PoolCampaign] === 'string') && !!p.name.trim() && p.name.length <= 100 && [p.startsAt, p.endsAt, p.updatedAt].every(t => !t || Number.isFinite(Date.parse(t))) && (!p.startsAt || !p.endsAt || Date.parse(p.endsAt) > Date.parse(p.startsAt));
}
export function poolStatus(pool: PoolCampaign, now = Date.now()) {
  return pool.startsAt && Date.parse(pool.startsAt) > now ? 'upcoming' : pool.endsAt && Date.parse(pool.endsAt) <= now ? 'ended' : 'open';
}
export function poolContext(plan: Plan, save: Save, now = Date.now()) {
  const pool = plan.pool ?? save.pool ?? defaultPool();
  const previous = save.rounds.find(r => r.cursor === r.steps.length);
  const status = poolStatus(pool, now);
  const owned = new Map<string, number>();
  for (const card of save.collection) owned.set(card.id, (owned.get(card.id) ?? 0) + 1);
  const cards = plan.cards.map(c => ({ id: c.id, name: c.name, rarity: c.rarity, limited: c.limited ?? false, releasedAt: c.releasedAt ?? '', ownedCount: owned.get(c.id) ?? 0, newlyReleased: !!c.releasedAt && (!previous || Date.parse(c.releasedAt) > Date.parse(previous.createdAt)) }));
  const limited = cards.filter(c => c.limited);
  return { ...pool, status, isNew: status === 'open' && !!pool.updatedAt && pool.updatedAt !== previous?.poolRevision, cards, limitedMissing: limited.filter(c => !c.ownedCount).map(c => c.id), allLimitedOwned: limited.length > 0 && limited.every(c => c.ownedCount > 0) };
}
export function publishPool(plan: Plan, save: Save): Plan {
  const previous = save.pending ?? save;
  const pool = plan.pool ?? save.pool ?? defaultPool();
  const changed = JSON.stringify(plan.cards) !== JSON.stringify(previous.cards) || JSON.stringify(pool) !== JSON.stringify(previous.pool ?? defaultPool());
  if (!changed) return { ...plan, pool };
  const now = new Date().toISOString();
  const known = new Set(previous.cards.map(c => c.id));
  return { ...plan, pool: { ...pool, updatedAt: now }, cards: plan.cards.map(c => known.has(c.id) || c.releasedAt ? c : { ...c, releasedAt: now }) };
}
