import { useState } from 'react';
import type { Card } from '../utils/nurture';
import { readNurtureIdentity } from '../utils/nurtureInventory';
import { readCardPresets, saveCardPreset, deleteCardPreset, importPresetCards } from '../utils/nurtureCardPresets';
import { NurturePresetPanel } from './NurturePresetPanel';

type Scope = 'all' | 'R' | 'rare';
const filterCards = (cards: Card[], scope: Scope) => cards.filter(c => scope === 'all' || (scope === 'R' ? c.rarity.toUpperCase() === 'R' : c.rarity.toUpperCase() !== 'R'));
function ScopeSelect({ value, onChange }: { value: Scope; onChange: (scope: Scope) => void }) {
  return <label>卡面范围<select value={value} onChange={e => onChange(e.target.value as Scope)}><option value="all">全部卡面</option><option value="R">仅 R 普卡</option><option value="rare">仅 SR 及以上</option></select></label>;
}
export function NurtureCardPresets({ cards, onChange }: { cards: Card[]; onChange: (cards: Card[]) => void }) {
  const [userId] = useState(() => readNurtureIdentity().id);
  const [presets, setPresets] = useState(() => readCardPresets(userId));
  const [useScope, setUseScope] = useState<Scope>('all'), [saveScope, setSaveScope] = useState<Scope>('all');
  const refresh = () => setPresets(readCardPresets(userId));
  return <NurturePresetPanel title="卡面共享预设" items={presets.map(p => ({ ...p, count: p.cards.length }))} canSave={filterCards(cards, saveScope).length > 0}
    useOptions={() => <ScopeSelect value={useScope} onChange={setUseScope}/>} saveOptions={<ScopeSelect value={saveScope} onChange={setSaveScope}/>}
    onApply={id => { const incoming = filterCards(presets.find(p => p.id === id)!.cards, useScope); if (!incoming.length) throw new Error('这份预设没有所选稀有度的卡面。'); const next = importPresetCards(cards, incoming); onChange(next); return `已加入 ${next.length - cards.length} 张卡面，已有卡面自动跳过。请保存卡池。`; }}
    onSave={(name, id) => { const preset = saveCardPreset(userId, name, filterCards(cards, saveScope), id); refresh(); return preset.id; }}
    onRename={(id, name) => { const preset = presets.find(p => p.id === id)!; saveCardPreset(userId, name, preset.cards, id); refresh(); }}
    onDelete={id => { deleteCardPreset(userId, id); refresh(); }}/>
}
