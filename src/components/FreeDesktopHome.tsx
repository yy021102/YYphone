import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Plus, Pencil, Check, Move, X, Clock3, CalendarDays, Image, Type, Heart, Users, Music, IdCard, RotateCcw } from 'lucide-react';
import { ALL_APPS } from '../data/mockData';
import type { AppIconOverrides, AppId, AppMetadata, UserProfile } from '../types';
import type { DesktopPage } from '../utils/desktopNavigation';
import {
  canRemoveDesktopWidget, completeFreeDesktopLayout, defaultFreeDesktopLayout, DESKTOP_MAX_ROWS, findFreeCell,
  DESKTOP_WIDGET_TEMPLATES, moveDesktopItem, newDesktopTemplate, newDesktopWidget, putDesktopWidget, removeDesktopWidget, REQUIRED_WIDGET_TYPES, WIDGET_NAMES, WIDGET_TYPES,
  type DesktopDrop, type DesktopWidgetItem, type DesktopWidgetType, type FreeDesktopLayout,
} from '../utils/freeDesktop';
import { DesktopPageNavigation } from './DesktopPager';
import { DesktopOverlay, DesktopWidgetEditor } from './DesktopWidgetEditor';
import { FreeDesktopWidget, readDesktopCharacters } from './FreeDesktopWidgets';
import { DesktopTemplateThumbnail } from './DesktopTemplateArt';

const widgetIcons = { clock: Clock3, calendar: CalendarDays, photo: Image, text: Type, countdown: Heart, character: Users, music: Music, profile: IdCard };
interface Props {
  value?: FreeDesktopLayout; onSave?: (value: FreeDesktopLayout) => boolean;
  page: DesktopPage; onPageChange: (page: DesktopPage) => void; profile: UserProfile; appIcons: AppIconOverrides;
  onOpenApp: (id: AppId) => void; onProfile: () => void; onNotes: () => void; renderIcon: (name: string, className?: string) => ReactNode;
}
interface Gesture { id: string | null; pointer: number; x: number; y: number; lastX: number; lastY: number; active: boolean; moved: boolean; scrolling: boolean; scrollTop: number }
export function FreeDesktopHome({ value, onSave, page, onPageChange, profile, appIcons, onOpenApp, onProfile, onNotes, renderIcon }: Props) {
  const { layout, repairError } = useMemo(() => {
    const original = value ?? defaultFreeDesktopLayout();
    try { return { layout: completeFreeDesktopLayout(original), repairError: '' }; }
    catch (cause) { return { layout: original, repairError: cause instanceof Error ? cause.message : '必留组件补回失败，原布局已保留。' }; }
  }, [value]);
  const [editing, setEditing] = useState(false), [library, setLibrary] = useState(false);
  const [widgetDraft, setWidgetDraft] = useState<DesktopWidgetItem | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null), [removeId, setRemoveId] = useState<string | null>(null);
  const [reset, setReset] = useState(false), [error, setError] = useState('');
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [drop, setDrop] = useState<DesktopDrop | null>(null), [width, setWidth] = useState(320);
  const [musicPortal, setMusicPortal] = useState<HTMLElement>();
  const [characters] = useState(readDesktopCharacters);
  const root = useRef<HTMLElement>(null), grid = useRef<HTMLDivElement>(null), scroll = useRef<HTMLDivElement>(null), dock = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null), hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edge = useRef<{ page: DesktopPage; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressClick = useRef(0), currentPage = useRef(page);
  const repairAttempt = useRef<FreeDesktopLayout | undefined>(undefined);
  currentPage.current = page;
  const row = Math.max(70, (width - 30) / 4 + 20);
  const cancelTimers = () => {
    if (hold.current) clearTimeout(hold.current);
    if (edge.current) clearTimeout(edge.current.timer);
    hold.current = null; edge.current = null;
  };
  const cancel = () => { cancelTimers(); gesture.current = null; setDrag(null); setDrop(null); };
  useEffect(() => {
    const node = grid.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(node);
    setMusicPortal(root.current?.closest<HTMLElement>('[data-phone-canvas]') ?? undefined);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const end = () => { if (gesture.current && !gesture.current.active) cancel(); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    const blur = () => cancel();
    window.addEventListener('blur', blur);
    return () => {
      cancelTimers();
      window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    if (!drag) return;
    const timer = window.setInterval(() => {
      const current = gesture.current, pane = scroll.current;
      if (!current || !pane) return;
      const bounds = pane.getBoundingClientRect();
      if (current.lastY < bounds.top + 44) pane.scrollTop -= 14;
      else if (current.lastY > bounds.bottom - 44 && current.lastY < bounds.bottom + 12) pane.scrollTop += 14;
    }, 50);
    return () => window.clearInterval(timer);
  }, [!!drag]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [page]);
  useEffect(() => {
    if (!value || repairError || repairAttempt.current === value ||
      REQUIRED_WIDGET_TYPES.every(type => value.pages.flat().some(item => item.kind === 'widget' && item.widgetType === type))) return;
    repairAttempt.current = value;
    if (!onSave || !onSave(layout)) setError('缺少的必留组件已显示，但保存失败。请检查存储空间后重新进入自由桌面。');
  }, [value, layout, repairError, onSave]);

  const save = (next: FreeDesktopLayout) => {
    if (!onSave || !onSave(next)) { setError('桌面保存失败，原布局已保留。请检查存储空间后重试。'); return false; }
    setError(''); return true;
  };
  const action = (operation: () => FreeDesktopLayout) => {
    try { return save(operation()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '无法修改桌面，原布局已保留。'); return false; }
  };
  const itemName = (id: string) => {
    const item = layout.pages.flat().find(item => item.id === id);
    return item?.kind === 'widget' ? item.settings.title || WIDGET_NAMES[item.widgetType] : ALL_APPS.find(app => `app:${app.id}` === id)?.name ?? '桌面项目';
  };
  const locateDrop = (x: number, y: number): DesktopDrop | null => {
    const dockRect = dock.current?.getBoundingClientRect(), gridRect = grid.current?.getBoundingClientRect();
    if (dockRect && x >= dockRect.left && x <= dockRect.right && y >= dockRect.top && y <= dockRect.bottom) {
      const slots = Array.from(dock.current!.querySelectorAll<HTMLElement>('[data-free-dock-index]'));
      const index = slots.findIndex(slot => { const bounds = slot.getBoundingClientRect(); return x >= bounds.left && x <= bounds.right; });
      return { zone: 'dock', index: index >= 0 ? index : x < (slots[0]?.getBoundingClientRect().left ?? dockRect.left) ? 0 : Math.min(layout.dock.length, 3) };
    }
    const pane = scroll.current?.getBoundingClientRect();
    if (!gridRect || !pane || y < pane.top || y > pane.bottom) return null;
    const item = layout.pages.flat().find(item => item.id === gesture.current?.id);
    return { zone: 'page', page: currentPage.current, x: Math.max(0, Math.min(3, Math.floor((x - gridRect.left) / ((gridRect.width + 10) / 4)))), y: Math.max(0, Math.min(DESKTOP_MAX_ROWS - (item?.h ?? 1), Math.floor((y - gridRect.top) / (row + 10)))) };
  };
  const activate = (current: Gesture) => {
    if (gesture.current !== current) return;
    current.active = true; setEditing(true); suppressClick.current = Date.now() + 500;
    if (current.id) { root.current?.setPointerCapture(current.pointer); setDrag({ id: current.id, x: current.lastX, y: current.lastY }); }
  };
  const down = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element) || !event.currentTarget.contains(event.target) || event.target.closest('[role="dialog"],input,textarea,select,[data-desktop-action],.desktop-page-navigation')) return;
    const item = event.target.closest<HTMLElement>('[data-free-item]'), id = item?.dataset.freeItem ?? null;
    if (!editing && event.target.closest('.free-widget-live button,.free-widget-live [role="button"]')) return;
    if (editing) event.stopPropagation();
    cancelTimers();
    const current: Gesture = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, active: false, moved: false, scrolling: false, scrollTop: scroll.current?.scrollTop ?? 0 };
    gesture.current = current;
    if (editing && id) activate(current);
    else hold.current = setTimeout(() => activate(current), 450);
  };
  const moving = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    current.lastX = event.clientX; current.lastY = event.clientY;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 8) {
      current.moved = true;
      if (hold.current) { clearTimeout(hold.current); hold.current = null; }
    }
    if (!current.active) {
      if (current.id && Math.abs(dy) > Math.abs(dx) * 1.4 && current.moved && scroll.current) {
        current.scrolling = true; scroll.current.scrollTop = current.scrollTop - dy; suppressClick.current = Date.now() + 400;
      }
      return;
    }
    event.stopPropagation();
    if (!current.id) return;
    setDrag({ id: current.id, x: event.clientX, y: event.clientY });
    setDrop(locateDrop(event.clientX, event.clientY));
    const bounds = root.current?.getBoundingClientRect();
    const next: DesktopPage | null = bounds && event.clientX < bounds.left + 28 && currentPage.current === 1 ? 0 : bounds && event.clientX > bounds.right - 28 && currentPage.current === 0 ? 1 : null;
    if (next === null) { if (edge.current) clearTimeout(edge.current.timer); edge.current = null; }
    else if (edge.current?.page !== next) {
      if (edge.current) clearTimeout(edge.current.timer);
      edge.current = { page: next, timer: setTimeout(() => { onPageChange(next); edge.current = null; setDrop(null); }, 650) };
    }
  };
  const up = (event: PointerEvent<HTMLElement>) => {
    if (editing) event.stopPropagation();
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.active || current.scrolling) { event.stopPropagation(); suppressClick.current = Date.now() + 400; }
    if (current.active && current.id && current.moved) {
      const target = locateDrop(event.clientX, event.clientY);
      if (target) action(() => moveDesktopItem(layout, current.id!, target));
      else setError('请把项目放到桌面网格或底栏内。');
    }
    cancel();
    if (root.current?.hasPointerCapture(event.pointerId)) root.current.releasePointerCapture(event.pointerId);
  };
  const openWidget = (type: DesktopWidgetType) => {
    setLibrary(false); setWidgetDraft(newDesktopWidget(type, `widget:${crypto.randomUUID()}`));
  };
  const appButton = (app: AppMetadata) => <button type="button" className={`free-app${appIcons[app.id] ? ' has-custom-icon' : ''}`}
    aria-label={app.name} onClick={() => editing ? setMoveId(`app:${app.id}`) : onOpenApp(app.id)}>
    <span className={`free-app-icon${appIcons[app.id] ? ' home-custom-icon' : ` home-default-icon bg-gradient-to-br ${app.color}`}`}>{appIcons[app.id] ? <img src={appIcons[app.id]} alt="" draggable={false}/> : renderIcon(app.iconName, `free-app-glyph ${app.textColor ?? ''}`)}</span><span>{app.name}</span>
  </button>;
  const style = { '--free-row': `${row}px` } as CSSProperties;
  const rows = Math.min(DESKTOP_MAX_ROWS, Math.max(4, ...layout.pages[page].map(item => item.y + item.h)) + (editing ? 2 : 0));
  const movedItem = layout.pages.flat().find(item => item.id === moveId);
  const dragItem = layout.pages.flat().find(item => item.id === drag?.id);
  const dragApp = ALL_APPS.find(app => `app:${app.id}` === drag?.id);
  const moveToPage = (destination: DesktopPage) => {
    if (!moveId) return;
    action(() => {
      const cell = findFreeCell(layout.pages[destination].filter(item => item.id !== moveId), movedItem?.w ?? 1, movedItem?.h ?? 1);
      return moveDesktopItem(layout, moveId, { zone: 'page', page: destination, x: cell.x, y: cell.y });
    });
  };
  return <main className={`free-desktop${editing ? ' is-editing' : ''}`} aria-label="自由桌面" ref={root} style={style}
    onPointerDown={down} onPointerMove={moving} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={() => { if (gesture.current?.active) cancel(); }}
    onClickCapture={event => { if (event.detail !== 0 && Date.now() < suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}
    onContextMenu={event => { if (!(event.target instanceof Element) || !event.target.closest('input,textarea')) event.preventDefault(); }}>
    <header className="free-toolbar" data-desktop-action>
      {editing ? <><button type="button" onClick={() => setLibrary(true)}><Plus size={16}/>添加组件</button><button type="button" aria-label="恢复自由桌面默认布局" onClick={() => setReset(true)}><RotateCcw size={15}/></button><button type="button" className="free-done" onClick={() => { cancel(); setEditing(false); }}><Check size={15}/>完成</button></> :
        <><span>YOUR LITTLE SPACE</span><button type="button" aria-label="编辑自由桌面" onClick={() => setEditing(true)}><Pencil size={14}/></button></>}
    </header>
    {(error || repairError) && <div role="alert" className="free-error free-desktop-error" data-desktop-action>{error || repairError}{error && <button type="button" aria-label="关闭桌面提示" onClick={() => setError('')}><X size={14}/></button>}</div>}
    {editing && <p className="free-help free-desktop-hint" data-desktop-action>资料卡、音乐和日历各保留一个；多余的可以移除。</p>}
    <div className="free-scroll" ref={scroll}><div className="free-grid" ref={grid} style={{ gridTemplateRows: `repeat(${rows},var(--free-row))` }}>
      {layout.pages[page].map(item => <section key={item.id} data-free-item={item.id} data-item-kind={item.kind}
        className={`free-item free-item-${item.kind}${drag?.id === item.id ? ' is-dragged' : ''}`}
        aria-label={itemName(item.id)} style={{ gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }}>
        {item.kind === 'app' ? appButton(ALL_APPS.find(app => app.id === item.appId)!) : <>
          <div className="free-widget-body" data-widget-template={item.settings.template} inert={editing} style={{ opacity: (item.settings.opacity ?? 100) / 100, '--template-paper': item.settings.background, '--widget-radius': `${item.settings.radius}px`, backgroundColor: item.settings.background, backgroundImage: item.settings.backgroundImage ? `url(${JSON.stringify(item.settings.backgroundImage)})` : undefined, color: item.settings.color, borderRadius: item.settings.radius, fontSize: `calc(${item.settings.fontSize}px * var(--font-scale,1))` } as CSSProperties}>
            <FreeDesktopWidget widget={item} profile={profile} characters={characters} onCalendar={() => onOpenApp('calendar')} onProfile={onProfile} onNotes={onNotes} onInventory={() => onOpenApp('inventory')} musicPortal={musicPortal}/>
          </div>
          {editing && <div className="free-widget-actions" data-desktop-action><button type="button" aria-label={`编辑组件：${itemName(item.id)}`} onClick={() => setWidgetDraft(item)}><Pencil size={13}/></button><button type="button" aria-label={`移动组件：${itemName(item.id)}`} onClick={() => setMoveId(item.id)}><Move size={13}/></button><button type="button" aria-label={`移除组件：${itemName(item.id)}`} disabled={!canRemoveDesktopWidget(layout, item.id)} title={canRemoveDesktopWidget(layout, item.id) ? '移除这一个组件' : '至少保留一个，可以移动或编辑'} onClick={() => setRemoveId(item.id)}><X size={13}/></button></div>}
        </>}
      </section>)}
      {drop?.zone === 'page' && drop.page === page && <div className="free-drop-cell" aria-hidden="true" style={{ gridColumn: `${Math.min(drop.x, 4 - (dragItem?.w ?? 1)) + 1} / span ${dragItem?.w ?? 1}`, gridRow: `${drop.y + 1} / span ${dragItem?.h ?? 1}` }}/>}
    </div></div>
    <nav className="free-dock" aria-label="系统应用" ref={dock}>{Array.from({ length: Math.max(layout.dock.length, editing ? 1 : 0) }, (_, index) => {
      const app = ALL_APPS.find(app => app.id === layout.dock[index]);
      return <div key={index} data-free-dock-index={index} data-free-item={app ? `app:${app.id}` : undefined} className={`free-dock-slot${drop?.zone === 'dock' && drop.index === index ? ' is-drop-target' : ''}`}>{app ? appButton(app) : editing && <span className="free-empty-dock">＋</span>}</div>;
    })}</nav>
    <DesktopPageNavigation page={page} onChange={onPageChange}/>
    {drag && <div className="free-drag-ghost" data-kind={dragItem?.kind ?? 'app'} aria-hidden="true" style={{ left: drag.x - (root.current?.getBoundingClientRect().left ?? 0), top: drag.y - (root.current?.getBoundingClientRect().top ?? 0) }}>
      {dragApp ? <><span className={`free-app-icon${appIcons[dragApp.id] ? ' home-custom-icon' : ` bg-gradient-to-br ${dragApp.color}`}`}>{appIcons[dragApp.id] ? <img src={appIcons[dragApp.id]} alt="" draggable={false}/> : renderIcon(dragApp.iconName, `free-app-glyph ${dragApp.textColor ?? ''}`)}</span><small>{dragApp.name}</small></> : <><span>{itemName(drag.id)}</span><Move size={18}/></>}
    </div>}
    {library && <DesktopOverlay title="小组件收藏夹" onClose={() => setLibrary(false)}><p className="free-help">挑一个喜欢的，可以重复添加。内置造型由本机原创绘制，换图、填字就能用，不需要写代码。</p>
      <h3 className="free-library-heading">内置造型 · 换图即用</h3><div className="free-widget-library free-template-library">{DESKTOP_WIDGET_TEMPLATES.map(template =>
        <button type="button" key={template.id} onClick={() => { setLibrary(false); setWidgetDraft(newDesktopTemplate(template.id, `widget:${crypto.randomUUID()}`)); }}><DesktopTemplateThumbnail template={template.id}/><strong>{template.name}</strong><small>{template.description}</small></button>
      )}</div><h3 className="free-library-heading">基础组件</h3><div className="free-widget-library">{WIDGET_TYPES.map(type => {
      const Icon = widgetIcons[type];
      return <button type="button" key={type} onClick={() => openWidget(type)}><span className={`free-widget-preview free-preview-${type}`}><Icon size={28}/></span><strong>{WIDGET_NAMES[type]}</strong><small>可调整宽高与样式</small></button>;
    })}</div></DesktopOverlay>}
    {widgetDraft && <DesktopWidgetEditor key={widgetDraft.id} widget={widgetDraft} characters={characters} onSave={widget => action(() => putDesktopWidget(layout, page, widget))} onClose={() => setWidgetDraft(null)}/>}
    {moveId && <DesktopOverlay title={`移动${itemName(moveId)}`} onClose={() => setMoveId(null)}><div className="free-move-panel"><p className="free-help">也可以直接拖动；靠近屏幕边缘停留可换页。</p><div className="free-fields-two"><button type="button" onClick={() => moveToPage(0)}>移到第1页</button><button type="button" onClick={() => moveToPage(1)}>移到第2页</button></div>
      {movedItem && <div className="free-fields-two">{([{ label: '左移一格', dx: -1, dy: 0 }, { label: '右移一格', dx: 1, dy: 0 }, { label: '上移一格', dx: 0, dy: -1 }, { label: '下移一格', dx: 0, dy: 1 }]).map(direction => <button type="button" key={direction.label} onClick={() => action(() => moveDesktopItem(layout, moveId, { zone: 'page', page: layout.pages[0].some(item => item.id === moveId) ? 0 : 1, x: movedItem.x + direction.dx, y: movedItem.y + direction.dy }))}>{direction.label}</button>)}</div>}
      {movedItem?.kind !== 'widget' && <fieldset><legend>底栏位置（满时与原 App 对调）</legend><div className="free-fields-two">{[0, 1, 2, 3].map(index => <button type="button" key={index} onClick={() => action(() => moveDesktopItem(layout, moveId, { zone: 'dock', index }))}>位置 {index + 1}</button>)}</div></fieldset>}
      {error && <p role="alert" className="free-error">{error}</p>}
      <button type="button" className="free-primary" onClick={() => setMoveId(null)}>完成移动</button>
    </div></DesktopOverlay>}
    {(removeId || reset) && <DesktopOverlay title={reset ? '恢复默认布局' : '移除小组件'} onClose={() => { setReset(false); setRemoveId(null); }}><div className="free-move-panel"><p>{reset ? '仅重置自由桌面的摆放和组件，不影响原来四套桌面、聊天、日历或音乐。自定义组件内容将从本布局中移除。' : '只移除这一个桌面组件，不会删除日历、音乐、角色或个人资料。'}</p><button type="button" className="free-primary" onClick={() => { if (action(() => reset ? defaultFreeDesktopLayout() : removeDesktopWidget(layout, removeId!))) { setReset(false); setRemoveId(null); } }}>确认{reset ? '恢复默认' : '移除'}</button>{error && <p role="alert" className="free-error">{error}</p>}</div></DesktopOverlay>}
  </main>;
}
