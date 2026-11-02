import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { compressImage } from '../utils/imageFile';
import { DESKTOP_WIDGET_TEMPLATES, isWidgetImage, minimumWidgetSize, WIDGET_NAMES, type DesktopWidgetItem } from '../utils/freeDesktop';
import type { DesktopCharacter } from './FreeDesktopWidgets';
import { DesktopTemplateThumbnail } from './DesktopTemplateArt';

export function DesktopOverlay({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <div className="free-overlay" data-no-desktop-swipe onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="free-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea,select,summary,[tabindex="0"]') ?? [])
          .filter(control => control.getClientRects().length > 0);
        if (!controls?.length) { event.preventDefault(); return; }
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header><span><small>MAKE IT YOURS</small><strong>{title}</strong></span><button type="button" aria-label="关闭面板" onClick={onClose}><X size={19}/></button></header>
      {children}
    </div>
  </div>;
}

export function DesktopWidgetEditor({ widget, characters, onSave, onClose }: {
  widget: DesktopWidgetItem; characters: DesktopCharacter[]; onSave: (widget: DesktopWidgetItem) => boolean; onClose: () => void;
}) {
  const [draft, setDraft] = useState<DesktopWidgetItem>(() => ({ ...widget, settings: { ...widget.settings, images: [...widget.settings.images], characterIds: [...widget.settings.characterIds] } }));
  const [imageUrl, setImageUrl] = useState(''), [backgroundUrl, setBackgroundUrl] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const patch = (settings: Partial<DesktopWidgetItem['settings']>) => { setDraft(current => ({ ...current, settings: { ...current.settings, ...settings } })); setError(''); };
  const min = minimumWidgetSize(draft.widgetType, draft.settings.template);
  const vinyl = draft.settings.template === 'vinyl', ticket = draft.settings.template === 'ticket';
  const hasImages = ['photo', 'character'].includes(draft.widgetType) || vinyl;
  const live = ['calendar', 'music'].includes(draft.widgetType);
  const templates = DESKTOP_WIDGET_TEMPLATES.filter(template => template.widgetType === draft.widgetType);
  const addImages = (images: string[]) => {
    setDraft(current => ({ ...current, settings: { ...current.settings, images: [...current.settings.images, ...images].slice(0, 12) } }));
    setError('');
  };
  const upload = async (files: FileList | null, target: 'images' | 'background' = 'images') => {
    if (!files?.length) return;
    if (target === 'images' && files.length + draft.settings.images.length > 12) { setError('每个组件最多放 12 张图片。'); return; }
    if (target === 'background' && files.length !== 1) { setError('背景图请选择一张图片。'); return; }
    setBusy(true); setError('');
    try {
      const images: string[] = [];
      for (const file of Array.from(files)) images.push(await compressImage(file, { maxDimension: 1200, maxBytes: 300 * 1024, preserveTransparency: true }));
      if (alive.current) {
        if (target === 'background') patch({ backgroundImage: images[0] });
        else addImages(images);
      }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '图片处理失败，请重试。'); }
    finally { if (alive.current) setBusy(false); }
  };
  return <DesktopOverlay title={`编辑${WIDGET_NAMES[draft.widgetType]}`} onClose={onClose}>
    <form className="free-widget-form" onSubmit={event => {
      event.preventDefault();
      if (busy) return;
      if (onSave(draft)) onClose();
      else setError('组件未能保存，请检查设置或存储空间后重试；关闭面板可查看桌面详细提示。');
    }}>
      <p className="free-help">{draft.settings.template ? '造型已经搭好，换图片、填文字即可保存。大小和配色都可以先不动。' : '宽高按网格自由组合；占用的位置会自动让开，不会覆盖其他内容。'}</p>
      {!!templates.length && <fieldset><legend>内置造型 · 不用写代码</legend>
        <label>组件款式<select value={draft.settings.template ?? ''} onChange={event => {
          const template = templates.find(template => template.id === event.target.value);
          const size = minimumWidgetSize(draft.widgetType, template?.id);
          setDraft(current => ({ ...current, w: Math.max(current.w, size.w), h: Math.max(current.h, size.h),
            settings: { ...current.settings, template: template?.id } }));
          setError('');
        }}><option value="">原有样式</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        {draft.settings.template && <DesktopTemplateThumbnail template={draft.settings.template} vinylColor={draft.settings.vinylColor} vinylOpacity={draft.settings.vinylOpacity}/>}
        <p className="free-help">换上图片、填好文字就能保存。造型外透明，背景图只显示在造型内部；上传图片会保留透明区域。切回原有样式不会清空图片和文字。</p>
      </fieldset>}
      <details className="free-widget-advanced" open={!draft.settings.template}><summary>大小设置（可选）</summary><div className="free-fields-two">
        <label>宽度 · {draft.w} 格<input aria-label="组件宽度" type="range" min={min.w} max={4} value={draft.w} onChange={event => setDraft(current => ({ ...current, w: Number(event.target.value) }))}/></label>
        <label>高度 · {draft.h} 格<input aria-label="组件高度" type="range" min={min.h} max={6} value={draft.h} onChange={event => setDraft(current => ({ ...current, h: Number(event.target.value) }))}/></label>
      </div></details>
      {(!live || vinyl) && draft.widgetType !== 'profile' && <><label>标题<input maxLength={80} value={draft.settings.title} placeholder="取一个喜欢的名字" onChange={event => patch({ title: event.target.value })}/></label>
      <label>文字<textarea maxLength={4000} rows={3} value={draft.settings.text} placeholder="写一点自己的话……" onChange={event => patch({ text: event.target.value })}/></label></>}
      {vinyl && <fieldset><legend>唱片盘面 · 颜色与透明度</legend>
        <label>盘面颜色<input aria-label="唱片盘面颜色" type="color" value={draft.settings.vinylColor ?? '#31313d'} onChange={event => patch({ vinylColor: event.target.value })}/></label>
        <label>盘面不透明度 · {draft.settings.vinylOpacity ?? 100}%<input aria-label="唱片盘面不透明度" type="range" min={0} max={100} value={draft.settings.vinylOpacity ?? 100} onChange={event => patch({ vinylOpacity: Number(event.target.value) })}/></label>
        <p className="free-help">0% 为完全透明，100% 为不透明；只调整外圈盘面，中心图片、文字和播放按钮不受影响。预览会跟随变化，保存后应用到桌面。</p>
        <button type="button" className="free-vinyl-reset" onClick={() => patch({ vinylColor: undefined, vinylOpacity: undefined })}>恢复原始盘面</button>
      </fieldset>}
      {draft.widgetType === 'countdown' && <label>纪念日期<input type="date" required value={draft.settings.date} onChange={event => patch({ date: event.target.value })}/></label>}
      {draft.widgetType === 'character' && <fieldset><legend>{ticket ? '头像来源（可选，也可只上传图片和填写称呼）' : '最多显示两位（含你），也可以只放合照'}</legend>
        <label className="free-character-choice"><input type="checkbox" checked={!!draft.settings.includePlayer} onChange={event => {
          if (event.target.checked && draft.settings.characterIds.length > 1) { setError('显示你的头像时，最多再选择一位角色。'); return; }
          patch({ includePlayer: event.target.checked });
        }}/>显示我的头像</label>
        {characters.length ? characters.map(person => <label className="free-character-choice" key={person.id}><input type="checkbox" checked={draft.settings.characterIds.includes(person.id)} onChange={event => {
          if (event.target.checked && draft.settings.characterIds.length + (draft.settings.includePlayer ? 1 : 0) >= 2) { setError('最多显示两位，包含你自己的头像。'); return; }
          patch({ characterIds: event.target.checked ? [...draft.settings.characterIds, person.id] : draft.settings.characterIds.filter(id => id !== person.id) });
        }}/>{person.name}</label>) : <p className="free-help">通讯录还没有角色，可以先放一张合照。</p>}
      </fieldset>}
      {ticket && <div className="free-fields-two">{[0, 1].map(index => <label key={index}>{index === 0 ? '左侧称呼' : '右侧称呼'}<input maxLength={80} placeholder="留空沿用资料姓名" value={draft.settings.personNames?.[index] ?? ''} onChange={event => {
        const names = [...(draft.settings.personNames ?? ['', ''])]; names[index] = event.target.value; patch({ personNames: names });
      }}/></label>)}</div>}
      {hasImages && <fieldset><legend>{vinyl ? '唱片中心图片（优先显示第一张）' : ticket ? '两位的头像（前两张依次替换；留空沿用资料头像）' : draft.widgetType === 'character' ? '合照（有图片时优先显示第一张）' : '相册（按顺序自动轮播）'}</legend>
        <div className="free-photo-list">{draft.settings.images.map((image, index) => <span key={`${index}:${image.slice(0, 35)}`}><img src={image} alt={`图片 ${index + 1}`}/><button type="button" aria-label={`移除图片 ${index + 1}`} onClick={() => patch({ images: draft.settings.images.filter((_, position) => position !== index) })}><Trash2 size={12}/></button></span>)}</div>
        <label className="free-upload"><Upload size={15}/>{busy ? '正在处理图片…' : '上传图片'}<input type="file" accept="image/*" multiple disabled={busy} onChange={event => { void upload(event.target.files); event.currentTarget.value = ''; }}/></label>
        <div className="free-url-row"><input aria-label="组件图片链接" placeholder="或粘贴图片链接" value={imageUrl} onChange={event => setImageUrl(event.target.value)}/><button type="button" disabled={busy} onClick={() => {
          if (!isWidgetImage(imageUrl.trim())) { setError('请输入有效的 http(s) 图片链接。'); return; }
          if (draft.settings.images.length >= 12) { setError('每个组件最多放 12 张图片。'); return; }
          addImages([imageUrl.trim()]); setImageUrl('');
        }}>添加</button></div>
        {draft.widgetType === 'photo' && <label>轮播间隔 · {draft.settings.interval} 秒<input type="range" min={3} max={60} value={draft.settings.interval} onChange={event => patch({ interval: Number(event.target.value) })}/></label>}
      </fieldset>}
      <details className="free-widget-advanced" open={!draft.settings.template}><summary>背景与配色（可选）</summary><fieldset><legend>组件背景图</legend>
        <p className="free-help">仅用于这一个组件，居中铺满；移除后恢复原背景。相册照片和合照仍显示在背景之上。</p>
        {draft.settings.backgroundImage && <div className="free-photo-list"><span><img src={draft.settings.backgroundImage} alt="组件背景预览"/><button type="button" aria-label="移除背景图" disabled={busy} onClick={() => patch({ backgroundImage: '' })}><Trash2 size={12}/></button></span></div>}
        <label className="free-upload"><Upload size={15}/>{busy ? '正在处理图片…' : '上传背景图'}<input aria-label="上传组件背景图" type="file" accept="image/*" disabled={busy} onChange={event => { void upload(event.target.files, 'background'); event.currentTarget.value = ''; }}/></label>
        <div className="free-url-row"><input aria-label="组件背景图链接" placeholder="或粘贴背景图链接" value={backgroundUrl} onChange={event => setBackgroundUrl(event.target.value)}/><button type="button" disabled={busy} onClick={() => {
          if (!isWidgetImage(backgroundUrl.trim())) { setError('请输入有效的 http(s) 背景图链接。'); return; }
          patch({ backgroundImage: backgroundUrl.trim() }); setBackgroundUrl('');
        }}>设为背景</button></div>
      </fieldset>
      {(!live || vinyl) && <div className="free-fields-two"><label>背景颜色<input type="color" value={draft.settings.background} onChange={event => patch({ background: event.target.value })}/></label><label>文字颜色<input type="color" value={draft.settings.color} onChange={event => patch({ color: event.target.value })}/></label></div>}
      {!draft.settings.template && <label>圆角 · {draft.settings.radius}px<input aria-label="组件圆角" type="range" min={0} max={48} value={draft.settings.radius} onChange={event => patch({ radius: Number(event.target.value) })}/></label>}
      {(!live || vinyl) && <label>文字大小 · {draft.settings.fontSize}px<input aria-label="组件字号" type="range" min={10} max={64} value={draft.settings.fontSize} onChange={event => patch({ fontSize: Number(event.target.value) })}/></label>}
      </details>
      {['calendar', 'music', 'profile'].includes(draft.widgetType) && <p className="free-help">内容继续关联原有日历、播放器或个人资料；背景图只覆盖本组件的外观，不修改原有设置。日历和音乐的其他内部样式沿用原组件设置。</p>}
      {error && <p role="alert" className="free-error">{error}</p>}
      <button className="free-primary" type="submit" disabled={busy}>保存组件</button>
    </form>
  </DesktopOverlay>;
}
