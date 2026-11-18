import { useState, type ReactNode } from 'react';

type Item = { id: string; name: string; count?: number };
export function NurturePresetPanel({ title, items, disabled = false, canSave, useOptions, saveOptions, allowReplace = false, onApply, onSave, onRename, onDelete }: {
  title: string; items: Item[]; disabled?: boolean; canSave: boolean;
  useOptions?: (id: string) => ReactNode; saveOptions?: ReactNode; allowReplace?: boolean;
  onApply: (id: string, replace: boolean) => string;
  onSave: (name: string, id?: string) => string;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const [view, setView] = useState<'use' | 'save'>('use');
  const [selected, setSelected] = useState(''), [target, setTarget] = useState(''), [name, setName] = useState('');
  const [replace, setReplace] = useState(false), [confirm, setConfirm] = useState<'apply' | 'save' | 'delete' | null>(null);
  const [renameName, setRenameName] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const active = items.find(i => i.id === selected);
  const run = (action: () => string) => { try { setNotice(action()); setError(''); setConfirm(null); } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); } };
  const switchView = (next: 'use' | 'save') => { setView(next); setConfirm(null); setError(''); setNotice(''); if (next === 'save') { setTarget(''); setName(''); } };
  const checkName = (value: string, id = '') => { if (items.some(i => i.id !== id && i.name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase())) throw new Error('已有同名预设，请换个名称，或选择覆盖已有预设。'); };
  const save = () => run(() => { checkName(name, target); const id = onSave(name, target || undefined); setSelected(id); setRenameName(name.trim()); return target ? '预设已更新，其他角色已使用的内容不会跟随改变。' : '预设已保存，可切换到「使用预设」套用。'; });
  return <details className="nurture-editor-fold nurture-preset-panel"><summary>{title}</summary><fieldset disabled={disabled}>
    <div className="nurture-preset-tabs" role="tablist" aria-label={title}><button type="button" role="tab" aria-selected={view === 'use'} onClick={() => switchView('use')}>使用预设</button><button type="button" role="tab" aria-selected={view === 'save'} onClick={() => switchView('save')}>保存预设</button></div>
    {view === 'use' ? <>
      {items.length ? <><label>预设<select value={active?.id ?? ''} onChange={e => { setSelected(e.target.value); setRenameName(items.find(i => i.id === e.target.value)?.name ?? ''); setReplace(false); setConfirm(null); setError(''); setNotice(''); }}><option value="">请选择预设</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}{i.count !== undefined ? `（${i.count} 项）` : ''}</option>)}</select></label>
        {active && <>{useOptions?.(active.id)}{allowReplace && <label>应用方式<select value={replace ? 'replace' : 'append'} onChange={e => { setReplace(e.target.value === 'replace'); setConfirm(null); }}><option value="append">追加，跳过已有内容</option><option value="replace">替换当前全部内容</option></select></label>}
          {confirm === 'apply' ? <div className="nurture-preset-confirm"><p>当前编辑内容将被这套预设替换，是否继续？</p><button type="button" className="preset-primary" onClick={() => run(() => onApply(active.id, true))}>确认替换</button><button type="button" onClick={() => setConfirm(null)}>取消</button></div> : <button type="button" className="preset-primary" onClick={() => replace ? setConfirm('apply') : run(() => onApply(active.id, false))}>应用预设</button>}
          <details className="nurture-preset-manage" key={active.id}><summary>更多操作</summary><label>预设名称<input value={renameName} maxLength={100} onChange={e => setRenameName(e.target.value)}/></label><div className="nurture-preset-actions"><button type="button" onClick={() => run(() => { checkName(renameName, active.id); onRename(active.id, renameName); return '预设已重命名。'; })}>保存名称</button><button type="button" className="preset-danger" onClick={() => setConfirm('delete')}>删除预设</button></div>{confirm === 'delete' && <div className="nurture-preset-confirm"><p>删除「{active.name}」？已经套用到角色的内容会保留。</p><button type="button" className="preset-danger" onClick={() => run(() => { onDelete(active.id); setSelected(''); return '预设已删除。'; })}>确认删除</button><button type="button" onClick={() => setConfirm(null)}>取消</button></div>}</details>
        </>}
      </> : <div className="nurture-preset-empty"><p>还没有共享预设</p><button type="button" onClick={() => switchView('save')}>把当前内容存一份</button></div>}
    </> : <>
      {saveOptions}<label>预设名称<input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="给这份预设起个名字"/></label>
      <details className="nurture-preset-manage"><summary>覆盖已有预设</summary><label>保存位置<select value={target} onChange={e => { setTarget(e.target.value); setName(items.find(i => i.id === e.target.value)?.name ?? ''); setConfirm(null); }}><option value="">另存为新预设</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label></details>
      {confirm === 'save' ? <div className="nurture-preset-confirm"><p>覆盖「{items.find(i => i.id === target)?.name}」的共享内容？</p><button type="button" className="preset-primary" onClick={save}>确认覆盖</button><button type="button" onClick={() => setConfirm(null)}>取消</button></div> : <button type="button" className="preset-primary" disabled={!canSave || !name.trim()} onClick={() => target ? setConfirm('save') : save()}>{target ? '更新预设' : '保存为新预设'}</button>}
    </>}
    {notice && <p className="nurture-preset-notice" role="status">{notice}</p>}{error && <p className="nurture-error" role="alert">{error}</p>}
  </fieldset></details>;
}
