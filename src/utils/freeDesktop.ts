import type { AppId } from '../types';
import { ALL_APPS, DOCK_APPS, MAIN_GRID_APPS, SECOND_PAGE_APPS } from '../data/mockData';
import type { DesktopPage } from './desktopNavigation';

export const WIDGET_TYPES = ['clock', 'calendar', 'photo', 'text', 'countdown', 'character', 'music', 'profile'] as const;
export type DesktopWidgetType = typeof WIDGET_TYPES[number];
export const REQUIRED_WIDGET_TYPES = ['profile', 'music', 'calendar'] as const;
export const WIDGET_NAMES: Record<DesktopWidgetType, string> = {
  clock: '时钟／日期', calendar: '日历', photo: '照片／轮播相册', text: '自由文字／便签',
  countdown: '纪念日／倒数日', character: '角色头像／双人合照', music: '音乐播放器', profile: '个人资料卡',
};
export const DESKTOP_WIDGET_TEMPLATES = [
  { id: 'heart', widgetType: 'photo', name: '心动相框', description: '一张照片，收藏一小格心动', w: 2, h: 2 },
  { id: 'bow', widgetType: 'photo', name: '蝴蝶结拍立得', description: '系一枚蝴蝶结，写一句喜欢的话', w: 2, h: 2 },
  { id: 'ticket', widgetType: 'character', name: '双人纪念票', description: '两张头像，两个人的小小纪念', w: 4, h: 2 },
  { id: 'vinyl', widgetType: 'music', name: '慢慢听唱片', description: '换上封面，让喜欢的歌慢慢转', w: 4, h: 2 },
  { id: 'cloud', widgetType: 'clock', name: '云朵时钟', description: '让时间停靠在软绵绵的云上', w: 2, h: 2 },
] as const;
export type DesktopWidgetTemplate = typeof DESKTOP_WIDGET_TEMPLATES[number]['id'];
export interface DesktopWidgetSettings {
  title: string; text: string; images: string[]; background: string; color: string;
  radius: number; fontSize: number; date: string; characterIds: string[]; includePlayer?: boolean; interval: number; backgroundImage?: string;
  template?: DesktopWidgetTemplate; personNames?: string[];
  vinylColor?: string; vinylOpacity?: number;
  opacity?: number;
}
interface Cell { x: number; y: number; w: number; h: number }
export interface DesktopAppItem extends Cell { id: string; kind: 'app'; appId: AppId }
export interface DesktopWidgetItem extends Cell { id: string; kind: 'widget'; widgetType: DesktopWidgetType; settings: DesktopWidgetSettings }
export type FreeDesktopItem = DesktopAppItem | DesktopWidgetItem;
export interface FreeDesktopLayout { version: 1; pages: [FreeDesktopItem[], FreeDesktopItem[]]; dock: AppId[] }
export type DesktopDrop = { zone: 'page'; page: DesktopPage; x: number; y: number } | { zone: 'dock'; index: number };
export const DESKTOP_COLUMNS = 4;
export const DESKTOP_MAX_ROWS = 40;
export const MAX_DESKTOP_WIDGETS = 32;

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const appId = (value: unknown): value is AppId => ALL_APPS.some(app => app.id === value);
export const isWidgetImage = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 1_500_000 && /^(https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(value);
const color = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const dateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
};
export const overlaps = (a: Cell, b: Cell) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const minimumWidgetSize = (type: DesktopWidgetType, template?: DesktopWidgetTemplate) =>
  template || ['calendar', 'music', 'profile'].includes(type) ? { w: 2, h: 2 } : { w: 1, h: 1 };

function isWidgetSettings(value: unknown): value is DesktopWidgetSettings {
  return record(value) && typeof value.title === 'string' && value.title.length <= 80 &&
    typeof value.text === 'string' && value.text.length <= 4000 &&
    Array.isArray(value.images) && value.images.length <= 12 && value.images.every(isWidgetImage) &&
    (value.backgroundImage === undefined || value.backgroundImage === '' || isWidgetImage(value.backgroundImage)) &&
    (value.template === undefined || DESKTOP_WIDGET_TEMPLATES.some(template => template.id === value.template)) &&
    (value.personNames === undefined || (Array.isArray(value.personNames) && value.personNames.length <= 2 && value.personNames.every(name => typeof name === 'string' && name.length <= 80))) &&
    (value.vinylColor === undefined || color(value.vinylColor)) &&
    (value.vinylOpacity === undefined || integer(value.vinylOpacity, 0, 100)) &&
    (value.opacity === undefined || integer(value.opacity, 0, 100)) &&
    color(value.background) && color(value.color) && integer(value.radius, 0, 48) &&
    integer(value.fontSize, 10, 64) && (value.date === '' || dateKey(value.date)) &&
    (value.includePlayer === undefined || typeof value.includePlayer === 'boolean') &&
    Array.isArray(value.characterIds) && value.characterIds.length <= (value.includePlayer ? 1 : 2) && new Set(value.characterIds).size === value.characterIds.length && value.characterIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) &&
    integer(value.interval, 3, 60);
}
function isItem(value: unknown): value is FreeDesktopItem {
  if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 200 ||
    !integer(value.x, 0, 3) || !integer(value.y, 0, DESKTOP_MAX_ROWS - 1) ||
    !integer(value.w, 1, 4) || !integer(value.h, 1, 6) || value.x + value.w > 4 || value.y + value.h > DESKTOP_MAX_ROWS) return false;
  if (value.kind === 'app') return appId(value.appId) && value.id === `app:${value.appId}` && value.w === 1 && value.h === 1;
  if (value.kind !== 'widget' || !WIDGET_TYPES.some(type => type === value.widgetType) || !isWidgetSettings(value.settings)) return false;
  const settings = value.settings;
  if (settings.template && !DESKTOP_WIDGET_TEMPLATES.some(template => template.id === settings.template && template.widgetType === value.widgetType)) return false;
  const min = minimumWidgetSize(value.widgetType as DesktopWidgetType, settings.template);
  return value.w >= min.w && value.h >= min.h;
}
export function isFreeDesktopLayout(value: unknown): value is FreeDesktopLayout {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.pages) || value.pages.length !== 2 ||
    !value.pages.every(page => Array.isArray(page) && page.length <= ALL_APPS.length + MAX_DESKTOP_WIDGETS && page.every(isItem)) ||
    !Array.isArray(value.dock) || value.dock.length > 4 || !value.dock.every(appId)) return false;
  const pages = value.pages as FreeDesktopItem[][];
  const items = pages.flat(), ids = items.map(item => item.id);
  const apps = [...value.dock, ...items.flatMap(item => item.kind === 'app' ? [item.appId] : [])];
  return new Set(ids).size === ids.length && new Set(apps).size === apps.length &&
    DESKTOP_COLUMNS * DESKTOP_MAX_ROWS * 2 - items.reduce((area, item) => area + item.w * item.h, 0) >= ALL_APPS.length - apps.length &&
    items.filter(item => item.kind === 'widget').length <= MAX_DESKTOP_WIDGETS &&
    pages.every(page => page.every((item, index) => !page.slice(index + 1).some(other => overlaps(item, other))));
}

function availableCell(items: FreeDesktopItem[], w: number, h: number): Cell | undefined {
  for (let y = 0; y <= DESKTOP_MAX_ROWS - h; y++) {
    for (let x = 0; x <= 4 - w; x++) {
      const cell = { x, y, w, h };
      if (!items.some(item => overlaps(item, cell))) return cell;
    }
  }
  return undefined;
}
export function findFreeCell(items: FreeDesktopItem[], w: number, h: number): Cell {
  const cell = availableCell(items, w, h);
  if (!cell) throw new Error('这一页已经放满了，请移除一些组件或换到另一页。');
  return cell;
}
function arrangeAround(items: FreeDesktopItem[], anchor: FreeDesktopItem): FreeDesktopItem[] {
  const placed = [anchor];
  for (const item of items.filter(item => item.id !== anchor.id)) {
    placed.push(placed.some(other => overlaps(item, other)) ? { ...item, ...findFreeCell(placed, item.w, item.h) } : item);
  }
  return placed;
}
const clone = (layout: FreeDesktopLayout): FreeDesktopLayout => ({ ...layout, pages: [layout.pages[0].map(item => ({ ...item })), layout.pages[1].map(item => ({ ...item }))], dock: [...layout.dock] });
const appItem = (id: AppId, cell: Cell): DesktopAppItem => ({ id: `app:${id}`, kind: 'app', appId: id, x: cell.x, y: cell.y, w: cell.w, h: cell.h });
export function completeFreeDesktopLayout(layout: FreeDesktopLayout): FreeDesktopLayout {
  const next = clone(layout);
  const present = new Set([...next.dock, ...next.pages.flat().flatMap(item => item.kind === 'app' ? [item.appId] : [])]);
  for (const app of ALL_APPS.filter(app => !present.has(app.id))) {
    const page = next.pages[1].reduce((area, item) => area + item.w * item.h, 0) < DESKTOP_COLUMNS * DESKTOP_MAX_ROWS ? 1 : 0;
    next.pages[page].push(appItem(app.id, findFreeCell(next.pages[page], 1, 1)));
  }
  for (const type of REQUIRED_WIDGET_TYPES) {
    if (next.pages.flat().some(item => item.kind === 'widget' && item.widgetType === type)) continue;
    if (next.pages.flat().filter(item => item.kind === 'widget').length >= MAX_DESKTOP_WIDGETS) {
      throw new Error('资料卡、音乐和日历需要各保留一个。请先移除多余组件，再重新进入自由桌面以补回缺少的组件。');
    }
    let id = `widget:default-${type}`, suffix = 0;
    while (next.pages.flat().some(item => item.id === id)) id = `widget:restored-${type}:${++suffix}`;
    const widget = newDesktopWidget(type, id);
    const sizes = [widget, minimumWidgetSize(type)];
    const placement = sizes.flatMap(size => ([0, 1] as const).flatMap(page => {
      const cell = availableCell(next.pages[page], size.w, size.h);
      return cell ? [{ page, cell }] : [];
    }))[0];
    if (!placement) throw new Error('桌面空间不足，暂时无法补回必留组件。请缩小或移除多余组件，再重新进入自由桌面。');
    next.pages[placement.page].push({ ...widget, ...placement.cell });
  }
  return next;
}
export function newDesktopWidget(type: DesktopWidgetType, id: string): DesktopWidgetItem {
  const wide = type === 'profile';
  return { id, kind: 'widget', widgetType: type, x: 0, y: 0, w: wide ? 4 : 2, h: 2,
    settings: { title: type === 'text' ? '写给今天' : type === 'countdown' ? '值得期待的那天' : '',
      text: type === 'text' ? '慢慢来，喜欢的生活正在发生。' : '', images: [], background: '#f5f2ee', color: '#587589',
      radius: 24, fontSize: 18, date: '', characterIds: [], includePlayer: false, interval: 8 } };
}
export function newDesktopTemplate(templateId: DesktopWidgetTemplate, id: string): DesktopWidgetItem {
  const template = DESKTOP_WIDGET_TEMPLATES.find(template => template.id === templateId)!;
  const widget = newDesktopWidget(template.widgetType, id);
  return { ...widget, w: template.w, h: template.h, settings: { ...widget.settings, template: template.id,
    title: template.id === 'ticket' ? '只属于我们的纪念' : template.id === 'cloud' ? '今天也慢慢来' : template.id === 'vinyl' ? '慢慢听' : '把喜欢收藏',
    text: template.id === 'ticket' ? '两个人，一张通往日常的车票。' : template.id === 'vinyl' ? '为这一刻留一首歌。' : template.id === 'bow' ? '平凡的日子，也值得被记录。' : '',
    background: template.id === 'cloud' ? '#f0f5fa' : '#fff8f4', color: '#887184',
    includePlayer: template.id === 'ticket', personNames: ['', ''] } };
}
export function defaultFreeDesktopLayout(): FreeDesktopLayout {
  const profile = newDesktopWidget('profile', 'widget:default-profile');
  const music = { ...newDesktopWidget('music', 'widget:default-music'), y: 2 };
  const calendar = { ...newDesktopWidget('calendar', 'widget:default-calendar'), x: 2, y: 2 };
  return { version: 1, pages: [
    [profile, music, calendar, ...MAIN_GRID_APPS.map((app, index) => appItem(app.id, { x: index % 4, y: 4 + Math.floor(index / 4), w: 1, h: 1 }))],
    SECOND_PAGE_APPS.map((app, index) => appItem(app.id, { x: index % 4, y: Math.floor(index / 4), w: 1, h: 1 })),
  ], dock: DOCK_APPS.map(app => app.id) };
}
export function moveDesktopItem(layout: FreeDesktopLayout, id: string, drop: DesktopDrop): FreeDesktopLayout {
  const next = clone(layout);
  const sourcePage = next.pages.findIndex(page => page.some(item => item.id === id));
  const source = sourcePage >= 0 ? next.pages[sourcePage as DesktopPage].find(item => item.id === id) : undefined;
  const dockIndex = next.dock.findIndex(app => `app:${app}` === id);
  if (!source && dockIndex < 0) throw new Error('这个桌面项目已不存在，请重新选择。');
  if (drop.zone === 'dock') {
    if (!integer(drop.index, 0, 3)) throw new Error('底栏位置无效。');
    if (source?.kind === 'widget') throw new Error('小组件只能放在桌面，不能放进底栏。');
    if (dockIndex >= 0) {
      const [app] = next.dock.splice(dockIndex, 1);
      next.dock.splice(Math.min(drop.index, next.dock.length), 0, app);
    } else if (source?.kind === 'app') {
      next.pages[sourcePage as DesktopPage] = next.pages[sourcePage as DesktopPage].filter(item => item.id !== id);
      if (next.dock.length < 4) next.dock.splice(Math.min(drop.index, next.dock.length), 0, source.appId);
      else {
        const displaced = next.dock[drop.index];
        next.dock[drop.index] = source.appId;
        next.pages[sourcePage as DesktopPage].push(appItem(displaced, source));
      }
    }
  } else {
    const item = source ?? appItem(next.dock[dockIndex], { x: 0, y: 0, w: 1, h: 1 });
    if (!integer(drop.page, 0, 1) || !integer(drop.x, 0, 3) || !integer(drop.y, 0, DESKTOP_MAX_ROWS - item.h)) throw new Error('桌面位置无效。');
    if (sourcePage >= 0) next.pages[sourcePage as DesktopPage] = next.pages[sourcePage as DesktopPage].filter(other => other.id !== id);
    else next.dock.splice(dockIndex, 1);
    const anchor = { ...item, x: Math.min(drop.x, 4 - item.w), y: drop.y };
    const target = next.pages[drop.page].find(other => other.kind === 'app' && other.x === anchor.x && other.y === anchor.y);
    if (source?.kind === 'app' && target?.kind === 'app') {
      next.pages[drop.page] = next.pages[drop.page].filter(other => other.id !== target.id);
      next.pages[sourcePage as DesktopPage].push({ ...target, x: source.x, y: source.y });
    }
    next.pages[drop.page] = arrangeAround(next.pages[drop.page], anchor);
  }
  if (!isFreeDesktopLayout(next)) throw new Error('无法完成这次移动，原布局已保留。');
  return next;
}
export function putDesktopWidget(layout: FreeDesktopLayout, page: DesktopPage, widget: DesktopWidgetItem): FreeDesktopLayout {
  const next = clone(layout);
  const existing = next.pages.flat().find(item => item.id === widget.id);
  if (existing && existing.kind !== 'widget') throw new Error('不能用组件覆盖 App。');
  if (existing?.kind === 'widget' && existing.widgetType !== widget.widgetType) throw new Error('不能更改现有组件的类型，请添加一个新组件。');
  if (!existing && next.pages.flat().filter(item => item.kind === 'widget').length >= MAX_DESKTOP_WIDGETS) throw new Error('最多可添加 32 个小组件。');
  if (existing && !next.pages[page].some(item => item.id === widget.id)) throw new Error('组件所在页面已变化，请重新打开编辑。');
  const others = next.pages[page].filter(item => item.id !== widget.id);
  const cell = existing ? { x: Math.min(widget.x, 4 - widget.w), y: Math.min(widget.y, DESKTOP_MAX_ROWS - widget.h), w: widget.w, h: widget.h } : findFreeCell(others, widget.w, widget.h);
  next.pages[page] = arrangeAround(others, { ...widget, ...cell });
  if (!isFreeDesktopLayout(next)) throw new Error('组件设置无效，原布局已保留。');
  return next;
}
export function removeDesktopWidget(layout: FreeDesktopLayout, id: string): FreeDesktopLayout {
  const widget = layout.pages.flat().find(item => item.id === id && item.kind === 'widget');
  if (!widget || widget.kind !== 'widget') throw new Error('这个小组件已不存在。');
  if (!canRemoveDesktopWidget(layout, id)) throw new Error(`${WIDGET_NAMES[widget.widgetType]}至少需要保留一个，可以移动或编辑它。`);
  const next = clone(layout);
  next.pages = [next.pages[0].filter(item => item.id !== id), next.pages[1].filter(item => item.id !== id)];
  return next;
}
export function canRemoveDesktopWidget(layout: FreeDesktopLayout, id: string): boolean {
  const widgets = layout.pages.flat().filter(item => item.kind === 'widget');
  const widget = widgets.find(item => item.id === id);
  return !!widget && (!REQUIRED_WIDGET_TYPES.some(type => type === widget.widgetType) ||
    widgets.filter(item => item.widgetType === widget.widgetType).length > 1);
}
