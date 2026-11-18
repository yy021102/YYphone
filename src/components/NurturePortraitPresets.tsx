import { useState } from 'react';
import type { Portrait } from '../utils/nurtureGame';
import { readNurtureIdentity } from '../utils/nurtureInventory';
import { readPortraitPresets, savePortraitPreset, deletePortraitPreset } from '../utils/nurturePortraitPresets';
import { NurturePresetPanel } from './NurturePresetPanel';

export function NurturePortraitPresets({ value, onChange }: { value: Portrait; onChange: (portrait: Portrait) => void }) {
  const [userId] = useState(() => readNurtureIdentity().id);
  const [presets, setPresets] = useState(() => readPortraitPresets(userId));
  const refresh = () => setPresets(readPortraitPresets(userId));
  return <NurturePresetPanel title="立绘共享预设" items={presets} canSave={!!value.image}
    onApply={id => { const preset = presets.find(p => p.id === id); if (!preset) throw new Error('预设不存在'); onChange(structuredClone(preset.portrait)); return '已应用到当前编辑内容，请保存设置。'; }}
    onSave={(name, id) => { const preset = savePortraitPreset(userId, name, value, id); refresh(); return preset.id; }}
    onRename={(id, name) => { const preset = presets.find(p => p.id === id)!; savePortraitPreset(userId, name, preset.portrait, id); refresh(); }}
    onDelete={id => { deletePortraitPreset(userId, id); refresh(); }}/>
}
