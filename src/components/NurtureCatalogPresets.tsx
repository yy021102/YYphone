import { useState } from 'react';
import type { GameDesign } from '../utils/nurtureDesign';
import { defaultDesign } from '../utils/nurtureDesign';
import { readNurtureIdentity } from '../utils/nurtureInventory';
import { readCatalogPresets, saveCatalogPreset, deleteCatalogPreset, applyCatalogPreset, type CatalogKind } from '../utils/nurtureCatalogPresets';
import { NurturePresetPanel } from './NurturePresetPanel';

export function NurtureCatalogPresets({ kind, design, onChange, disabled = false }: { kind: CatalogKind; design: GameDesign; onChange: (design: GameDesign) => void; disabled?: boolean }) {
  const [userId] = useState(() => readNurtureIdentity().id);
  const [presets, setPresets] = useState(() => readCatalogPresets(userId));
  const refresh = () => setPresets(readCatalogPresets(userId));
  return <NurturePresetPanel title={`${{ shop: '商城', schedules: '日程', dates: '约会' }[kind]}共享预设`} items={presets.filter(p => p.kind === kind).map(p => ({ ...p, count: p.entries.length }))} disabled={disabled} canSave={design[kind].length > 0} allowReplace
    onApply={(id, replace) => { const preset = presets.find(p => p.id === id)!; const next = applyCatalogPreset(design, preset, replace ? 'replace' : 'append'); onChange(next); return replace ? '已替换当前编辑内容，请保存页面以生效。' : `已追加 ${next[kind].length - design[kind].length} 项，已有内容自动跳过。请保存页面以生效。`; }}
    onSave={(name, id) => { const preset = saveCatalogPreset(userId, name, kind, design, id); refresh(); return preset.id; }}
    onRename={(id, name) => { const preset = presets.find(p => p.id === id)!; saveCatalogPreset(userId, name, kind, { ...defaultDesign(), [kind]: preset.entries }, id); refresh(); }}
    onDelete={id => { deleteCatalogPreset(userId, id); refresh(); }}/>
}
