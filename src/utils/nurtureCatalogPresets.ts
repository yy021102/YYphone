import { readStoredValue, writeStoredValue } from './localStorage';
import { defaultDesign, validDesign, validateShopReactions, type GameDesign, type GameProduct, type GameActivity } from './nurtureDesign';

export type CatalogKind = 'shop' | 'schedules' | 'dates';
export type CatalogPreset = { id: string; name: string; kind: CatalogKind; entries: (GameProduct | GameActivity)[] };
const keyFor = (userId: string) => `yyphone:nurture-catalog-presets:${encodeURIComponent(userId || 'default')}`;
function validPreset(v: unknown): v is CatalogPreset {
  if (!v || typeof v !== 'object') return false;
  const p = v as CatalogPreset;
  return typeof p.id === 'string' && !!p.id && typeof p.name === 'string' && !!p.name.trim() && p.name.length <= 100 && ['shop', 'schedules', 'dates'].includes(p.kind) && Array.isArray(p.entries) && validDesign({ ...defaultDesign(), [p.kind]: p.entries });
}
export function readCatalogPresets(userId: string): CatalogPreset[] {
  return structuredClone(readStoredValue<CatalogPreset[]>(keyFor(userId), [], (v): v is CatalogPreset[] => Array.isArray(v) && v.every(validPreset)));
}
export function saveCatalogPreset(userId: string, name: string, kind: CatalogKind, design: GameDesign, id?: string) {
  const preset: CatalogPreset = { id: id ?? crypto.randomUUID(), name: name.trim(), kind, entries: structuredClone(design[kind]) };
  if (!validPreset(preset)) throw new Error('请填写预设名称（最多 100 字），并检查条目名称、价格和数值变化。');
  if (!preset.entries.length) throw new Error('请先添加至少一个条目。');
  if (kind === 'shop') validateShopReactions(design.shop);
  const presets = readCatalogPresets(userId);
  if (id && !presets.some(p => p.id === id && p.kind === kind)) throw new Error('该预设已删除，请另存为新预设。');
  writeStoredValue(keyFor(userId), id ? presets.map(p => p.id === id ? preset : p) : [...presets, preset]);
  return preset;
}
export function deleteCatalogPreset(userId: string, id: string) {
  writeStoredValue(keyFor(userId), readCatalogPresets(userId).filter(p => p.id !== id));
}
export function applyCatalogPreset(design: GameDesign, preset: CatalogPreset, mode: 'append' | 'replace'): GameDesign {
  if (!validPreset(preset)) throw new Error('预设格式无效。');
  const existing: (GameProduct | GameActivity)[] = design[preset.kind];
  const entries = mode === 'replace' ? [] : structuredClone(existing);
  const ids = new Set(entries.map(e => e.id)), names = new Set(entries.map(e => e.name.trim().toLocaleLowerCase()));
  for (const entry of preset.entries) {
    if (ids.has(entry.id) || names.has(entry.name.trim().toLocaleLowerCase())) continue;
    entries.push(structuredClone(entry)); ids.add(entry.id); names.add(entry.name.trim().toLocaleLowerCase());
  }
  return { ...design, [preset.kind]: entries };
}
