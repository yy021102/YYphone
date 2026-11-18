import { useState } from 'react';
import type { GameDesign } from '../utils/nurtureDesign';
import { readNurtureIdentity } from '../utils/nurtureInventory';
import { readCatalogPresets, saveCatalogPreset, deleteCatalogPreset, applyCatalogPreset, type CatalogKind } from '../utils/nurtureCatalogPresets';

const labels = { shop: '商城', schedules: '日程', dates: '约会' };
export function NurtureCatalogPresets({ kind, design, onChange, disabled = false }: { kind: CatalogKind; design: GameDesign; onChange: (design: GameDesign) => void; disabled?: boolean }) {
  const [userId] = useState(() => readNurtureIdentity().id);
  const [presets, setPresets] = useState(() => readCatalogPresets(userId));
  const [selected, setSelected] = useState(''), [name, setName] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const active = presets.find(p => p.id === selected && p.kind === kind);
  const refresh = () => setPresets(readCatalogPresets(userId));
  const perform = (action: () => void) => { try { action(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); } };
  const save = (replace: boolean) => perform(() => {
    const preset = saveCatalogPreset(userId, name, kind, design, replace ? selected : undefined);
    refresh(); setSelected(preset.id); setName(preset.name); setConfirmReplace(false); setNotice('预设已保存，其他角色也能选用。');
  });
  const apply = (mode: 'append' | 'replace') => perform(() => {
    if (!active) return;
    const next = applyCatalogPreset(design, active, mode);
    onChange(next); setConfirmReplace(false); setNotice(mode === 'append' ? `已追加 ${next[kind].length - design[kind].length} 个条目，已有条目自动跳过。请保存页面以生效。` : '已套用整套预设，请保存页面以生效。');
  });
  return <details className="nurture-editor-fold"><summary>{labels[kind]}预设 · 跨角色套用</summary><fieldset disabled={disabled}>
    <p className="nurture-hint">保存当前全部{labels[kind]}条目。{kind === 'shop' ? '商品图片、价格、收礼反应与数值影响一起保存。' : '活动内容、价格与数值变化一起保存。'}套用只修改当前编辑内容，角色存档各自独立。</p>
    <label>选择预设<select value={selected} onChange={e => { setSelected(e.target.value); setName(presets.find(p => p.id === e.target.value)?.name ?? ''); setConfirmReplace(false); setNotice(''); setError(''); }}><option value="">新建或选择预设</option>{presets.filter(p => p.kind === kind).map(p => <option key={p.id} value={p.id}>{p.name}（{p.entries.length} 项）</option>)}</select></label>
    {active && <><p className="nurture-hint">{active.entries.map(e => e.name).join('、')}</p><div className="nurture-game-actions"><button type="button" onClick={() => apply('append')}>追加到当前{labels[kind]}</button><button type="button" onClick={() => setConfirmReplace(true)}>替换为整套预设</button></div>{confirmReplace && <div><p>将替换当前{labels[kind]}的编辑内容，确认套用？</p><button type="button" onClick={() => apply('replace')}>确认替换</button><button type="button" onClick={() => setConfirmReplace(false)}>取消</button></div>}</>}
    <label>预设名称<input maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder={`例如：日常${labels[kind]}`}/></label>
    <div className="nurture-game-actions"><button type="button" disabled={!design[kind].length} onClick={() => save(false)}>保存当前内容为新预设</button>{active && <><button type="button" disabled={!design[kind].length} onClick={() => save(true)}>更新此预设</button><button type="button" onClick={() => perform(() => { deleteCatalogPreset(userId, active.id); refresh(); setSelected(''); setName(''); setConfirmReplace(false); setNotice('已删除预设，角色已使用的内容保留。'); })}>删除预设</button></>}</div>
    {notice && <p className="nurture-hint" role="status">{notice}</p>}{error && <p className="nurture-error" role="alert">{error}</p>}
  </fieldset></details>;
}
