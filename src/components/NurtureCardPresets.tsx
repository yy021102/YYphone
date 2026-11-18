import { useState } from 'react';
import type { Card } from '../utils/nurture';
import { readNurtureIdentity } from '../utils/nurtureInventory';
import { readCardPresets, saveCardPreset, deleteCardPreset, importPresetCards } from '../utils/nurtureCardPresets';

export function NurtureCardPresets({ cards, onChange }: { cards: Card[]; onChange: (cards: Card[]) => void }) {
  const [userId] = useState(() => readNurtureIdentity().id);
  const [presets, setPresets] = useState(() => readCardPresets(userId));
  const [selected, setSelected] = useState(''), [name, setName] = useState('');
  const [exportIds, setExportIds] = useState<string[]>([]), [importIds, setImportIds] = useState<string[]>([]);
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const active = presets.find(p => p.id === selected);
  const save = (replace: boolean) => {
    try {
      const preset = saveCardPreset(userId, name, cards.filter(c => exportIds.includes(c.id)), replace ? selected : undefined);
      setPresets(readCardPresets(userId)); setSelected(preset.id); setImportIds(preset.cards.map(c => c.id)); setError(''); setNotice('卡面预设已保存，所有角色均可选用。');
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败'); }
  };
  const picker = (list: Card[], ids: string[], setIds: (ids: string[]) => void) => <>
    <div className="nurture-game-actions"><button type="button" onClick={() => setIds(list.map(c => c.id))}>全选</button><button type="button" onClick={() => setIds(list.filter(c => c.rarity.toUpperCase() === 'R').map(c => c.id))}>只选 R 普卡</button><button type="button" onClick={() => setIds([])}>取消选择</button></div>
    <div className="nurture-preset-card-list">{list.map(c => <label className="nurture-checkbox" key={c.id}><input type="checkbox" checked={ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))}/>{c.rarity} · {c.name}</label>)}</div>
  </>;
  return <details className="nurture-editor-fold"><summary>跨角色卡面预设 · 批量保存与使用</summary><div>
    <p className="nurture-hint">卡面图片、文字、稀有度和权重一起保存。可整组或勾选部分卡面加入当前卡池，已有卡面自动跳过；加入后请检查概率并保存卡池。</p>
    <label>共享卡面预设<select value={selected} onChange={e => { setSelected(e.target.value); const preset = presets.find(p => p.id === e.target.value); setImportIds(preset?.cards.map(c => c.id) ?? []); setName(preset?.name ?? ''); setNotice(''); setError(''); }}><option value="">选择预设</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}（{p.cards.length} 张）</option>)}</select></label>
    {active && <>{picker(active.cards, importIds, setImportIds)}<button type="button" disabled={!importIds.length} onClick={() => { const next = importPresetCards(cards, active.cards.filter(c => importIds.includes(c.id))); onChange(next); setNotice(`已加入 ${next.length - cards.length} 张卡面，请保存卡池。`); setError(''); }}>批量加入当前卡池</button><button type="button" onClick={() => { try { deleteCardPreset(userId, selected); setPresets(readCardPresets(userId)); setSelected(''); setImportIds([]); setName(''); setError(''); setNotice('预设已删除，已加入卡池的卡面不受影响。'); } catch { setError('删除失败'); } }}>删除预设</button></>}
    <h4>把当前卡面存为预设</h4>{cards.length ? picker(cards, exportIds, setExportIds) : <p className="nurture-hint">先添加卡面，再保存为预设。</p>}
    <label>预设名称<input maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="例如：日常 R 卡组"/></label>
    <button type="button" disabled={!exportIds.some(id => cards.some(c => c.id === id))} onClick={() => save(false)}>保存所选为新预设</button>{active && <button type="button" disabled={!exportIds.some(id => cards.some(c => c.id === id))} onClick={() => save(true)}>用所选卡面更新此预设</button>}
    {notice && <p className="nurture-hint" role="status">{notice}</p>}{error && <p className="nurture-error" role="alert">{error}</p>}
  </div></details>;
}
