import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Heart, Plus, Save, Trash2, X } from 'lucide-react';
import { BUILTIN_THOUGHT_PRESETS, builtinThoughtLayout, isThoughtPresetList, makeThoughtSnapshot, validateThoughtTemplate, type ThoughtField, type ThoughtPreset } from '../utils/thoughtPresets';
import { ThoughtCard } from './ThoughtCard';
import './thoughtWorkshop.css';

export function ThoughtWorkshop({ presets, selectedId, characterName, onSaveLibrary, onApply, onClose }: {
  presets: ThoughtPreset[]; selectedId?: string; characterName: string;
  onSaveLibrary: (presets: ThoughtPreset[]) => Promise<void>;
  onApply: (id: string) => Promise<void>; onClose: () => void;
}) {
  const library = [...BUILTIN_THOUGHT_PRESETS, ...presets];
  const [draft, setDraft] = useState<ThoughtPreset>(() => structuredClone(library.find(item => item.id === (selectedId || 'classic')) ?? BUILTIN_THOUGHT_PRESETS[0]));
  const [tab, setTab] = useState<'fields' | 'style' | 'preview'>('fields');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current, parent = root?.parentElement;
    if (!root || !parent) return;
    const previous = document.activeElement;
    const siblings = [...parent.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== root)
      .map(element => ({ element, inert: element.inert }));
    siblings.forEach(({ element }) => { element.inert = true; });
    root.querySelector<HTMLButtonElement>('button[aria-label="关闭心声工坊"]')?.focus({ preventScroll: true });
    return () => {
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      const target = previous instanceof HTMLElement && previous !== document.body && previous.isConnected && previous.getClientRects().length
        ? previous : parent.querySelector<HTMLButtonElement>('button[aria-label="更多聊天功能"],button[aria-label="心声工坊"]');
      if (target?.getClientRects().length) target.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    if (!busy && root?.getClientRects().length && document.activeElement === document.body) {
      root.querySelector<HTMLButtonElement>('button[aria-label="关闭心声工坊"]')?.focus({ preventScroll: true });
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!root?.getClientRects().length) return;
      if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const nodes = [...root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),iframe')]
          .filter(node => node.getClientRects().length);
        const next = event.shiftKey ? nodes[nodes.length - 1] : nodes[0];
        if (next && (!root.contains(document.activeElement) ||
          (event.shiftKey ? document.activeElement === nodes[0] : document.activeElement === nodes[nodes.length - 1]))) {
          event.preventDefault(); next.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [busy, onClose]);
  const builtin = BUILTIN_THOUGHT_PRESETS.some(item => item.id === draft.id);
  const change = (patch: Partial<ThoughtPreset>) => { setDraft(value => ({ ...value, ...patch })); setError(''); setNotice(''); setConfirmDelete(false); };
  const fieldChange = (index: number, patch: Partial<ThoughtField>) => {
    if (patch.key === 'thought' && draft.fields[index].key !== 'thought') { setError('thought 是原始心声的保留键，请为新栏目使用其他键。'); return; }
    change({ fields: draft.fields.map((field, at) => at === index ? { ...field, ...patch } : field) });
  };
  const move = (index: number, offset: number) => {
    const fields = [...draft.fields]; [fields[index], fields[index + offset]] = [fields[index + offset], fields[index]]; change({ fields });
  };
  const preview = useMemo(() => {
    try {
      validateThoughtTemplate(draft);
      const sample = Object.fromEntries(draft.fields.filter(field => field.key !== 'thought').map(field => [field.key,
        field.key === 'affection' ? '比起方才，更愿意向你靠近一点。' : `${field.label}的示例内容 · 正式内容会随每轮聊天生成。`]));
      return { snapshot: makeThoughtSnapshot(draft, sample, '看到你的消息时，忍不住笑了一下。想再和你多聊一会儿。', characterName, '2026-01-01T12:00:00Z'), error: '' };
    } catch (error) { return { snapshot: undefined, error: error instanceof Error ? error.message : '预览失败。' }; }
  }, [draft, characterName]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch (error) { console.error('Could not update thought preset.', error); setError(error instanceof Error ? error.message : '心声预设保存失败，请检查本地存储。'); }
    finally { setBusy(false); }
  };
  const save = async (apply: boolean) => {
    validateThoughtTemplate(draft);
    const original = library.find(item => item.id === draft.id);
    const unchanged = original && JSON.stringify(original) === JSON.stringify(draft);
    const target = { ...structuredClone(draft), id: builtin && !unchanged ? `thought-${crypto.randomUUID()}` : draft.id };
    if (!unchanged) {
      const next = [...presets.filter(item => item.id !== target.id), target];
      if (!isThoughtPresetList(next)) throw new Error('预设格式无效或数量超过 80 个，请检查栏目、名称和模板。');
      await onSaveLibrary(next);
    }
    setDraft(target);
    setNotice('预设已保存。使用「保存并应用」可让本聊天之后的回复采用它。');
    if (apply) { await onApply(target.id); onClose(); }
  };
  return <section ref={rootRef} className="yy-thought-workshop" role="dialog" aria-modal="true" aria-labelledby="thought-workshop-title">
    <header className="yy-thought-workshop-header">
      <div className="yy-thought-workshop-mark"><Heart size={20} /></div>
      <div><h2 id="thought-workshop-title">心声工坊</h2><p>把看不见的心事，写成喜欢的样子</p></div>
      <button type="button" aria-label="关闭心声工坊" disabled={busy} onClick={onClose}><X size={20} /></button>
    </header>
    <div className="yy-thought-workshop-scroll">
      <p className="yy-thought-help">预设全局共用，本聊天独立选择。每轮保存当时的内容与样式，之后修改、切换或删除预设都不会改写旧心声。</p>
      <div className="yy-thought-library">
        {library.map(preset => <button key={preset.id} type="button" disabled={busy} aria-pressed={draft.id === preset.id} onClick={() => {
          setDraft(structuredClone(preset)); setError(''); setNotice(''); setConfirmDelete(false);
        }}><span>{preset.name}</span>{(selectedId || 'classic') === preset.id && <small><Check size={10} /> 本聊天使用中</small>}</button>)}
      </div>
      <div className="yy-thought-tools">
        <button type="button" disabled={busy} onClick={() => change({ id: `thought-${crypto.randomUUID()}`, name: '我的心声预设' })}><Plus size={13} />新建</button>
        <button type="button" disabled={busy} onClick={() => change({ id: `thought-${crypto.randomUUID()}`, name: `${draft.name.slice(0, 50)} · 副本` })}><Copy size={13} />复制</button>
        {!builtin && presets.some(item => item.id === draft.id) && <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={13} />删除</button>}
      </div>
      {confirmDelete && <div className="yy-thought-confirm">
        <p>删除这个预设？引用它的聊天将恢复「柔光心声」，已生成的心声不会改变。</p>
        <button type="button" disabled={busy} onClick={() => void run(async () => {
          await onSaveLibrary(presets.filter(item => item.id !== draft.id));
          setDraft(structuredClone(BUILTIN_THOUGHT_PRESETS[0])); setConfirmDelete(false);
        })}>确认删除</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button>
      </div>}
      <fieldset disabled={busy} className="yy-thought-editor">
        <label>预设名称<input aria-label="心声预设名称" value={draft.name} maxLength={60} onChange={event => change({ name: event.target.value })} /></label>
        {builtin && <p className="yy-thought-help">内置预设修改后会另存为你的预设，不覆盖原版。</p>}
        <nav className="yy-thought-tabs" aria-label="心声编辑区域">
          {([['fields', '内容栏目'], ['style', '高级样式'], ['preview', '实时预览']] as const).map(([id, name]) =>
            <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{name}</button>)}
        </nav>
        {tab === 'fields' && <>
          <label>整体生成要求<textarea aria-label="心声整体提示词" rows={3} maxLength={4000} value={draft.prompt} onChange={event => change({ prompt: event.target.value })} placeholder="例如：语气克制温柔，穿着保持连续，好感度不机械上涨……" /></label>
          <p className="yy-thought-help">以下内容是虚构角色状态，不读取玩家真实信息，不会发布动态或改写其他 App。心声始终保留中文，与聊天正文语言独立。</p>
          {draft.fields.map((field, index) => <section key={index} className="yy-thought-field-editor">
            <div className="yy-thought-field-heading"><span>栏目 {index + 1}</span><div>
              <button type="button" aria-label={`上移${field.label}`} disabled={!index} onClick={() => move(index, -1)}><ArrowUp size={13} /></button>
              <button type="button" aria-label={`下移${field.label}`} disabled={index === draft.fields.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13} /></button>
              <button type="button" aria-label={`删除${field.label}栏目`} disabled={field.key === 'thought'} onClick={() => change({ fields: draft.fields.filter((_, at) => at !== index) })}><Trash2 size={13} /></button>
            </div></div>
            <div className="yy-thought-field-inputs">
              <label>显示名称<input aria-label={`栏目${index + 1}名称`} maxLength={40} value={field.label} onChange={event => fieldChange(index, { label: event.target.value })} /></label>
              <label>栏目键<input aria-label={`栏目${index + 1}键`} maxLength={40} readOnly={field.key === 'thought'} value={field.key} onChange={event => fieldChange(index, { key: event.target.value })} /></label>
            </div>
            <textarea aria-label={`栏目${index + 1}生成要求`} rows={2} maxLength={1000} value={field.instruction} onChange={event => fieldChange(index, { instruction: event.target.value })} placeholder="告诉 AI 这栏要生成什么、如何保持连续……" />
          </section>)}
          <button type="button" className="yy-thought-add" disabled={draft.fields.length >= 16} onClick={() => {
            let index = 1; while (draft.fields.some(field => field.key === `field_${index}`)) index++;
            change({ fields: [...draft.fields, { key: `field_${index}`, label: '新栏目', instruction: '' }] });
          }}><Plus size={14} />添加栏目</button>
        </>}
        {tab === 'style' && <>
          <p className="yy-thought-help">用 {'{{characterName}}'}、{'{{time}}'}、{'{{fields}}'} 或下方栏目键插入内容。内容会自动转义，不作为 HTML 执行。改名或删除栏目后请同步修改自定义占位符。</p>
          <div className="yy-thought-tokens">{draft.fields.map(field => <code key={field.key}>{`{{${field.key}}}`}</code>)}</div>
          <label>HTML 展示模板<textarea className="is-code" aria-label="心声HTML模板" rows={7} maxLength={16000} spellCheck={false} value={draft.html} onChange={event => change({ html: event.target.value })} /></label>
          <label>CSS 样式<textarea className="is-code" aria-label="心声CSS样式" rows={9} maxLength={16000} spellCheck={false} value={draft.css} onChange={event => change({ css: event.target.value })} /></label>
          {builtinThoughtLayout(draft) ? <p className="yy-thought-help">内置版式随内容自动撑开，不使用固定高度；仅在内容超过屏幕时滚动整个展示区域。修改 HTML 或 CSS 后，可为自定义模板设置高度。</p> :
            <label>自定义模板高度（160—700px）<input type="number" aria-label="心声卡片高度" min={160} max={700} value={draft.height} onChange={event => change({ height: Number(event.target.value) })} /></label>}
          <p className="yy-thought-help">展示时直接呈现模板本身，不再套外层卡片或重复标题。仅支持展示用 HTML 与 CSS，不运行 JavaScript、表单或外部链接；图片仅支持 data 格式，不加载外部字体或网络资源。自定义模板内容超出设定高度时可在模板内滚动。</p>
        </>}
        {tab === 'preview' && <><p className="yy-thought-help">下面是示例数据，不会调用 AI，不会写入聊天。</p>
          {preview.snapshot ? <ThoughtCard snapshot={preview.snapshot} /> : <p role="alert" className="yy-thought-error">{preview.error}</p>}</>}
      </fieldset>
      {preview.error && tab !== 'preview' && <p role="alert" className="yy-thought-error">{preview.error}</p>}
      {error && <p role="alert" className="yy-thought-error">{error}</p>}
      {notice && <p role="status" className="yy-thought-help">{notice}</p>}
    </div>
    <footer className="yy-thought-workshop-footer">
      <button type="button" disabled={busy || !!preview.error} onClick={() => void run(() => save(false))}><Save size={14} />保存预设</button>
      <button type="button" disabled={busy || !!preview.error} onClick={() => void run(() => save(true))}>{busy ? '正在保存…' : '保存并应用到本聊天'}</button>
    </footer>
  </section>;
}
