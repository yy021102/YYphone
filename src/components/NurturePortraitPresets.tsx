import { useState } from 'react';
import type { Portrait } from '../utils/nurtureGame';
import { readNurtureIdentity } from '../utils/nurtureInventory';
import { readPortraitPresets, savePortraitPreset, deletePortraitPreset } from '../utils/nurturePortraitPresets';

export function NurturePortraitPresets({ value, onChange }: { value: Portrait; onChange: (portrait: Portrait) => void }) {
  const [userId] = useState(() => readNurtureIdentity().id);
  const [presets, setPresets] = useState(() => readPortraitPresets(userId));
  const [selected, setSelected] = useState(''), [name, setName] = useState('');
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const save = (replace: boolean) => {
    try {
      const preset = savePortraitPreset(userId, name, value, replace ? selected : undefined);
      setPresets(readPortraitPresets(userId)); setSelected(preset.id); setName(preset.name);
      setError(''); setNotice('预设已保存，其他角色可在这里选用。');
    } catch (e) { setError(e instanceof Error ? e.message : '预设保存失败'); }
  };
  return <div className="nurture-portrait-presets"><p className="nurture-hint">预设包含立绘、部位定位和触碰发言，同一身份下的所有角色都能选用。切换后保存设置，才会应用到当前角色。</p>
    <label>选择共享预设<select value={selected} onChange={e => { const id = e.target.value; setSelected(id); const preset = presets.find(p => p.id === id); setName(preset?.name ?? ''); setError(''); setNotice(''); }}><option value="">新建预设</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {selected && <button type="button" onClick={() => { const preset = presets.find(p => p.id === selected); if (preset) { onChange(structuredClone(preset.portrait)); setError(''); setNotice('已切换预设，请保存设置以应用到当前角色。'); } }}>使用此预设</button>}
    <label>预设名称<input maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="例如：日常立绘"/></label>
    <div className="nurture-game-actions"><button type="button" onClick={() => save(false)}>另存为新预设</button>{selected && <><button type="button" onClick={() => save(true)}>更新此预设</button><button type="button" onClick={() => { try { deletePortraitPreset(userId, selected); setPresets(readPortraitPresets(userId)); setSelected(''); setName(''); setError(''); setNotice('预设已删除，角色当前使用的立绘不受影响。'); } catch { setError('删除预设失败'); } }}>删除预设</button></>}</div>
    {notice && <p className="nurture-hint" role="status">{notice}</p>}{error && <p className="nurture-error" role="alert">{error}</p>}
  </div>;
}
