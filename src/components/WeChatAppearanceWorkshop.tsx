import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Eye, LayoutTemplate, LoaderCircle, MessageCircle, RotateCcw, Upload } from 'lucide-react';
import { applyBubblePreset, applyChatCombination, applyChatPage, captureChatCombination, captureChatPage, compileChatAppearance, DEFAULT_BUBBLE_STYLE, exportChatAppearance, importChatAppearance, independentBubbles, resetChatAppearance, type AppearancePart, type BubbleStyle, type ChatAppearance } from '../utils/chatAppearance';
import { DEFAULT_WECHAT_THEME_CSS, WECHAT_THEME_CSS_LIMIT } from '../utils/wechatTheme';
import { compressImageFile, compressWallpaper } from '../utils/imageFile';
import { AvatarFrameEditor } from './AvatarFrameEditor';
import { WeChatAppearancePreview } from './WeChatAppearancePreview';
import './weChatAppearanceWorkshop.css';

type Tab = 'page' | 'bubbles' | 'preview';
interface Props { appearance: ChatAppearance; userName: string; userAvatar?: string; onSave: (next: ChatAppearance) => Promise<void> }
export function WeChatAppearanceWorkshop({ appearance, userName, userAvatar, onSave }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(appearance));
  const [tab, setTab] = useState<Tab>('page');
  const [darkPreview, setDarkPreview] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Record<AppearancePart, string>>({ page: '', bubbles: '', all: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const part: AppearancePart = tab === 'preview' ? 'all' : tab;
  const bubbles = independentBubbles(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(appearance);
  let validationError = '', compiledCss = '';
  try { compiledCss = compileChatAppearance(draft); } catch (cause) { validationError = cause instanceof Error ? cause.message : 'CSS 无效'; }
  const edit = (patch: Partial<ChatAppearance>) => { setDraft(current => ({ ...current, ...patch })); setMessage(''); setError(''); };
  const editBubbles = (patch: Partial<BubbleStyle>) => edit({ bubbleMode: 'custom', bubbleOverride: { ...bubbles, ...patch } });
  const save = async (next: ChatAppearance, librariesOnly = false) => {
    if (busy) return false;
    setBusy(true); setError(''); setMessage('');
    try {
      compileChatAppearance(next);
      await onSave(librariesOnly ? { ...appearance, presets: next.presets, pagePresets: next.pagePresets, bubblePresets: next.bubblePresets } : next);
      if (mounted.current) { setDraft(next); setMessage(librariesOnly ? '预设已保存。' : '美化已应用并保存。'); }
      return true;
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); return false; }
    finally { if (mounted.current) setBusy(false); }
  };
  const choose = (id: string) => {
    setSelected(current => ({ ...current, [part]: id }));
    if (!id) return;
    if (part === 'bubbles') { const preset = draft.bubblePresets?.find(p => p.id === id); if (preset) setDraft(applyBubblePreset(draft, preset)); }
    else { const preset = (part === 'page' ? draft.pagePresets : draft.presets)?.find(p => p.id === id); if (preset) setDraft(part === 'page' ? applyChatPage(draft, preset) : applyChatCombination(draft, preset)); }
    setMessage(''); setError('');
  };
  const savePreset = async () => {
    if (!name.trim()) { setError('请填写预设名称。'); return; }
    const id = `style-${crypto.randomUUID()}`, label = name.trim().slice(0, 40);
    const next = part === 'bubbles' ? { ...draft, bubblePresets: [...(draft.bubblePresets ?? []), { id, name: label, ...bubbles }] }
      : part === 'page' ? { ...draft, pagePresets: [...(draft.pagePresets ?? []), { id, name: label, ...captureChatPage(draft) }] }
      : { ...draft, presets: [...draft.presets, { id, name: label, ...captureChatCombination(draft) }] };
    if (await save(next, true)) { setName(''); setSelected(current => ({ ...current, [part]: id })); }
  };
  const removePreset = async () => {
    const id = selected[part]; if (!id) return;
    const next = part === 'bubbles' ? { ...draft, bubblePresets: draft.bubblePresets?.filter(p => p.id !== id) }
      : part === 'page' ? { ...draft, pagePresets: draft.pagePresets?.filter(p => p.id !== id) } : { ...draft, presets: draft.presets.filter(p => p.id !== id) };
    if (await save(next, true)) setSelected(current => ({ ...current, [part]: '' }));
  };
  const restore = (target: AppearancePart) => {
    setDraft(resetChatAppearance(draft, target)); setError(''); setSelected(current => target === 'all' ? { page: '', bubbles: '', all: '' } : { ...current, [target]: '' });
    setMessage(`${target === 'page' ? '页面' : target === 'bubbles' ? '气泡' : '全部'}已恢复默认，应用并保存后生效。`);
  };
  const copyCss = async () => {
    try { await navigator.clipboard.writeText(part === 'bubbles' ? bubbles.css : draft.themeCss ?? ''); setMessage('CSS 已复制。'); }
    catch { setError('未能自动复制，请在代码框内全选并复制。'); }
  };
  const download = () => {
    try {
      compileChatAppearance(draft);
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportChatAppearance(draft, part), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `yyphone-chat-${part === 'all' ? 'appearance' : part}.json`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导出失败。'); }
  };
  const loadFile = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const next = importChatAppearance(draft, JSON.parse(await file.text()), part);
      if (mounted.current) { setDraft(next); setMessage('已载入美化，可预览后应用。'); setSelected(current => ({ ...current, [part]: '' })); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '导入失败。'); }
    finally { if (mounted.current) setBusy(false); }
  };
  const upload = async (key: 'backgroundUrl' | 'sendIconUrl' | 'generateIconUrl', file?: File) => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try { const url = key === 'backgroundUrl' ? await compressWallpaper(file) : await compressImageFile(file); if (mounted.current) edit({ [key]: url }); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '图片处理失败。'); }
    finally { if (mounted.current) setBusy(false); }
  };
  const presets = part === 'bubbles' ? draft.bubblePresets ?? [] : part === 'page' ? draft.pagePresets ?? [] : draft.presets;
  const title = part === 'page' ? '页面' : part === 'bubbles' ? '气泡' : '整套';

  return <div className="wechat-workshop">
    <header className="workshop-heading"><span className="workshop-heading-icon"><LayoutTemplate size={23} /></span><div><h2>美化工坊</h2><p>喜欢的页面，配上喜欢的气泡。</p></div></header>
    <div className="workshop-tabs" role="tablist" aria-label="美化栏目">
      {([{ id: 'page', label: '页面', Icon: LayoutTemplate }, { id: 'bubbles', label: '气泡', Icon: MessageCircle }, { id: 'preview', label: '预览', Icon: Eye }] as const).map(({ id, label, Icon }) => <button key={id} id={`workshop-tab-${id}`} role="tab" aria-controls="workshop-panel" aria-selected={tab === id} onClick={() => { setTab(id); setName(''); setMessage(''); setError(''); }}><Icon size={15} />{label}</button>)}
    </div>
    <section className="workshop-preview-card">
      <div className="workshop-preview-heading"><span>实时预览</span><div className="workshop-preview-mode" aria-label="预览模式"><button aria-pressed={!darkPreview} onClick={() => setDarkPreview(false)}>浅色</button><button aria-pressed={darkPreview} onClick={() => setDarkPreview(true)}>深色</button></div></div>
      <WeChatAppearancePreview appearance={draft} compiledCss={compiledCss} dark={darkPreview} tall={tab === 'preview'} userAvatar={userAvatar} userName={userName} />
      {darkPreview && <p className="workshop-note">深色预览使用系统样式，自定义美化在浅色模式生效。</p>}
    </section>
    <fieldset disabled={busy} className="workshop-fields" id="workshop-panel" role="tabpanel" aria-labelledby={`workshop-tab-${tab}`}>
      {tab === 'page' && <>
        <section className="workshop-card">
          <div className="workshop-card-heading"><h3>页面 CSS</h3><button onClick={() => void copyCss()}><Copy size={13} />复制</button></div>
          <p className="workshop-note">可修改背景、标题栏、头像、输入栏与页面原配气泡。代码可复制给 AI 修改。</p>
          <textarea aria-label="页面 CSS" value={draft.themeCss ?? ''} onChange={e => edit({ themeCss: e.target.value })} rows={12} maxLength={WECHAT_THEME_CSS_LIMIT} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          <button className="workshop-text-button" onClick={() => edit({ themeCss: DEFAULT_WECHAT_THEME_CSS })}>填入默认 CSS</button>
        </section>
        <section className="workshop-card">
          <h3>背景与图标</h3>
          {([['backgroundUrl', '聊天背景'], ['sendIconUrl', '发送图标'], ['generateIconUrl', '生成图标']] as const).map(([key, label]) => <div className="workshop-image-field" key={key}>
            <label>{label}<input type="url" aria-label={`${label}链接`} placeholder={draft[key]?.startsWith('data:') ? '已使用本地图片' : '图片链接'} value={draft[key]?.startsWith('data:') ? '' : draft[key] ?? ''} onChange={e => edit({ [key]: e.target.value })} /></label>
            <div className="workshop-inline"><label className="workshop-upload"><Upload size={13} />上传图片<input type="file" aria-label={`上传${label}`} accept="image/*" onChange={e => { void upload(key, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label><button onClick={() => edit({ [key]: '' })}>{key === 'backgroundUrl' ? '移除背景' : '恢复图标'}</button></div>
          </div>)}
        </section>
        <details className="workshop-card"><summary>头像框</summary><div className="workshop-detail-body">
          <AvatarFrameEditor title="我的头像框" value={draft.userAvatarFrame} onChange={next => edit({ userAvatarFrame: next })} previewUrl={userAvatar} previewText={userName.slice(0, 1)} radiusClass="rounded-xl" />
          <AvatarFrameEditor title="角色头像框" value={draft.characterAvatarFrame} onChange={next => edit({ characterAvatarFrame: next })} previewText="TA" radiusClass="rounded-xl" />
        </div></details>
        <details className="workshop-card"><summary>兼容旧版 CSS</summary><div className="workshop-detail-body">
          <label>旧版气泡 CSS<textarea aria-label="旧版气泡 CSS" rows={5} value={draft.bubbleCss ?? ''} onChange={e => edit({ bubbleCss: e.target.value })} maxLength={20000} spellCheck={false} /></label>
          <label>旧版布局 CSS<textarea aria-label="旧版布局 CSS" rows={5} value={draft.layoutCss ?? ''} onChange={e => edit({ layoutCss: e.target.value })} maxLength={20000} spellCheck={false} /></label>
        </div></details>
      </>}
      {tab === 'bubbles' && <>
        <section className="workshop-card">
          <h3>气泡样式</h3><div className="workshop-mode"><button aria-pressed={draft.bubbleMode !== 'custom'} onClick={() => edit({ bubbleMode: 'follow' })}>跟随页面</button><button aria-pressed={draft.bubbleMode === 'custom'} onClick={() => editBubbles({})}>独立气泡</button></div>
          <p className="workshop-note">{draft.bubbleMode === 'custom' ? '独立替换文字与语音气泡，页面和红包转账卡片继续沿用原样式。' : '使用当前页面原配的气泡，也可在下方选择独立气泡预设。'}</p>
        </section>
        {draft.bubbleMode === 'custom' && <>
          <section className="workshop-card"><h3>颜色与透明度</h3><div className="workshop-colors">
            {([['userBubbleColor', 'userBubbleOpacity', '我的气泡'], ['characterBubbleColor', 'characterBubbleOpacity', '角色气泡']] as const).map(([color, alpha, label]) => <div key={color}>
              <label>{label}<div className="workshop-color-input"><input aria-label={`${label}颜色`} type="color" value={/^#[a-f\d]{6}$/i.test(bubbles[color]) ? bubbles[color] : '#ffffff'} onChange={e => editBubbles({ [color]: e.target.value })} /><input aria-label={`${label}色值`} value={bubbles[color]} maxLength={7} onChange={e => editBubbles({ [color]: e.target.value })} /></div></label>
              <label className="workshop-note">透明度 {Math.round(bubbles[alpha] * 100)}%<input aria-label={`${label}透明度`} type="range" min={0} max={100} value={bubbles[alpha] * 100} onChange={e => editBubbles({ [alpha]: Number(e.target.value) / 100 })} /></label>
            </div>)}
          </div></section>
          <section className="workshop-card"><div className="workshop-card-heading"><h3>气泡 CSS</h3><button onClick={() => void copyCss()}><Copy size={13} />复制</button></div><p className="workshop-note">默认代码已标注主体、尖角和语音，可交给 AI 改写。支持图片与动画。</p>
            <textarea aria-label="气泡 CSS" value={bubbles.css} onChange={e => editBubbles({ css: e.target.value })} rows={12} maxLength={WECHAT_THEME_CSS_LIMIT} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
            <button className="workshop-text-button" onClick={() => editBubbles({ css: DEFAULT_BUBBLE_STYLE.css })}>填入默认气泡 CSS</button>
          </section>
        </>}
      </>}
      <section className="workshop-card">
        <h3>{title}预设</h3>
        <div className="workshop-inline"><input aria-label={`${title}预设名称`} placeholder="预设名称" maxLength={40} value={name} onChange={e => setName(e.target.value)} /><button className="workshop-soft-button" disabled={!!validationError || part === 'bubbles' && draft.bubbleMode !== 'custom'} onClick={() => void savePreset()}>新建预设</button></div>
        <div className="workshop-inline"><select aria-label={`选择${title}预设`} value={selected[part]} onChange={e => choose(e.target.value)}><option value="">选择已保存的{title}预设</option>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button disabled={!selected[part]} className="workshop-delete" onClick={() => void removePreset()}>删除</button></div>
        <div className="workshop-inline"><button className="workshop-secondary" disabled={part === 'bubbles' && draft.bubbleMode !== 'custom'} onClick={download}><Download size={13} />导出{title}</button><button className="workshop-secondary" onClick={() => importRef.current?.click()}><Upload size={13} />导入{title}</button></div>
        {part === 'bubbles' && draft.bubbleMode !== 'custom' && <p className="workshop-note">切到独立气泡后，可保存或导出气泡。</p>}
        <input ref={importRef} type="file" aria-label={`导入${title}文件`} accept="application/json,.json" hidden onChange={e => { void loadFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </section>
      <section className="workshop-card workshop-restores"><h3>恢复默认</h3>
        <button onClick={() => restore(part)}><RotateCcw size={14} />{part === 'all' ? '全部恢复默认' : `${title}恢复默认`}</button>
        {part === 'all' && <p className="workshop-note">恢复系统默认页面和气泡，保留已保存的预设。</p>}
      </section>
    </fieldset>
    <footer className="workshop-save-bar">
      {validationError && <p role="alert" className="workshop-error">{validationError}</p>}
      {error && <p role="alert" className="workshop-error">{error}</p>}
      {message && <p role="status" className="workshop-message">{message}</p>}
      <div className="workshop-save-row"><span>{busy ? '正在处理…' : changed ? '有未应用的修改' : '已保存'}</span><button disabled={busy || !!validationError} onClick={() => void save(draft)}>{busy ? <LoaderCircle size={15} className="workshop-spin" /> : <Check size={15} />}应用并保存</button></div>
    </footer>
  </div>;
}
