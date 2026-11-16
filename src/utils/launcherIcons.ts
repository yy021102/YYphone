import { readStoredValue, writeStoredValue } from './localStorage';

export const LAUNCHER_ICON_KEY = 'yyphone:launcher-icon';
export const DEFAULT_LAUNCHER_ICON = 'pastel-yy';
export const LAUNCHER_ICON_CATEGORIES = ['初始', '画板', '游戏机', '哥特'] as const;
export const LAUNCHER_ICONS = [
  { id: 'mist-garden', name: '雾色花园', category: '画板' },
  { id: 'sunlit-sea', name: '晴海', category: '画板' },
  { id: 'default', name: '初见', category: '初始' }, { id: 'claw', name: '抓娃娃机', category: '游戏机' },
  { id: 'pastel-yy', name: '晴染', category: '初始' },
  { id: 'slot', name: '老虎机', category: '游戏机' }, { id: 'ndsl', name: 'NDSL', category: '游戏机' },
  { id: 'gothic-rose', name: '蔷薇圣窗', category: '哥特' },
  { id: 'silent-manuscript', name: '缄默手稿', category: '哥特' },
] as const;
export type LauncherIconId = typeof LAUNCHER_ICONS[number]['id'];
export const isLauncherIcon = (value: unknown): value is LauncherIconId => LAUNCHER_ICONS.some(icon => icon.id === value);
export const readLauncherIcon = () => readStoredValue<LauncherIconId>(LAUNCHER_ICON_KEY, DEFAULT_LAUNCHER_ICON, isLauncherIcon);
export function preserveLauncherIconOnImport(data: Record<string, string>, current = readStoredValue<LauncherIconId | null>(LAUNCHER_ICON_KEY, null, (value): value is LauncherIconId | null => value === null || isLauncherIcon(value))) {
  return current === null ? data : { ...data, [LAUNCHER_ICON_KEY]: JSON.stringify(current) };
}
export function launcherIconPaths(id: LauncherIconId, base = import.meta.env?.BASE_URL || '/') {
  const root = `${base.replace(/\/?$/, '/')}app-icon-options/${id}/`;
  return { image: `${root}icon-512.png`, apple: `${root}icon-180.png`, manifest: `${root}manifest.webmanifest` };
}
export function applyLauncherIcon(id: LauncherIconId) {
  if (!isLauncherIcon(id)) throw new Error('请选择已有的桌面图标。');
  if (typeof document === 'undefined') return;
  const paths = launcherIconPaths(id);
  const update = (rel: string, href: string, type?: string) => {
    const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`));
    if (!links.length) { const link = document.createElement('link'); link.rel = rel; document.head.append(link); links.push(link); }
    for (const link of links) { link.href = href; if (type) link.type = type; }
  };
  update('manifest', paths.manifest);
  update('apple-touch-icon', paths.apple);
  update('icon', paths.image, 'image/png');
}
export function saveLauncherIcon(id: LauncherIconId) {
  if (!isLauncherIcon(id)) throw new Error('请选择已有的桌面图标。');
  writeStoredValue(LAUNCHER_ICON_KEY, id); applyLauncherIcon(id);
}
export function restoreLauncherIcon() {
  const requested = new URLSearchParams(window.location.search).get('launcher');
  if (isLauncherIcon(requested)) saveLauncherIcon(requested);
  else applyLauncherIcon(readLauncherIcon());
}
