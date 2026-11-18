import { readStoredValue, writeStoredValue } from './localStorage';
import { validatePlan, type Card } from './nurture';
import { emptyDelta } from './nurtureDesign';

export type CardPreset = { id: string; name: string; cards: Card[] };
const keyFor = (userId: string) => `yyphone:nurture-card-presets:${encodeURIComponent(userId || 'default')}`;
function validateCards(cards: Card[]) {
  validatePlan({ stats: emptyDelta(), speech: '', cards: cards.map(c => ({ ...c, weight: c.weight === 0 ? 1 : c.weight })), event: { enabled: false, title: '', description: '', endsAt: '' } });
}
export function readCardPresets(userId: string): CardPreset[] {
  return structuredClone(readStoredValue<CardPreset[]>(keyFor(userId), [], (v): v is CardPreset[] => {
    if (!Array.isArray(v)) return false;
    try { return v.every(p => { if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.cards)) return false; validateCards(p.cards); return true; }); } catch { return false; }
  }));
}
export function saveCardPreset(userId: string, name: string, cards: Card[], id?: string) {
  if (!name.trim() || name.trim().length > 100) throw new Error('请填写 1～100 字的预设名称。');
  if (!cards.length) throw new Error('请至少选择一张卡面。');
  // Presets can also contain cards that are temporarily out of the pool.
  validateCards(cards);
  const presets = readCardPresets(userId);
  if (id && !presets.some(p => p.id === id)) throw new Error('该预设已删除。');
  const preset = { id: id ?? crypto.randomUUID(), name: name.trim(), cards: structuredClone(cards) };
  writeStoredValue(keyFor(userId), id ? presets.map(p => p.id === id ? preset : p) : [...presets, preset]);
  return preset;
}
export function deleteCardPreset(userId: string, id: string) {
  writeStoredValue(keyFor(userId), readCardPresets(userId).filter(p => p.id !== id));
}
export function importPresetCards(existing: Card[], incoming: Card[]): Card[] {
  const next = structuredClone(existing), ids = new Set(next.map(c => c.id)), names = new Set(next.map(c => c.name.trim().toLocaleLowerCase()));
  for (const card of incoming) {
    if (ids.has(card.id) || names.has(card.name.trim().toLocaleLowerCase())) continue;
    next.push(structuredClone(card)); ids.add(card.id); names.add(card.name.trim().toLocaleLowerCase());
  }
  return next;
}
