import { readStoredValue, writeStoredValue } from './localStorage';

export const LAUNCHER_ICON_KEY = 'yyphone:launcher-icon';
export const LAUNCHER_ICONS = [
  { id: 'default', name: '默认' }, { id: 'claw', name: '抓娃娃机' },
  { id: 'slot', name: '老虎机' }, { id: 'ndsl', name: 'NDSL' },
] as const;
export type LauncherIconId = typeof LAUNCHER_ICONS[number]['id'];
export const isLauncherIcon = (value: unknown): value is LauncherIconId => LAUNCHER_ICONS.some(icon => icon.id === value);
export const readLauncherIcon = () => readStoredValue<LauncherIconId>(LAUNCHER_ICON_KEY, 'default', isLauncherIcon);
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
  // Preserve the original manifest for the default installation.
  update('manifest', id === 'default' ? `${import.meta.env?.BASE_URL || '/'}manifest.json` : paths.manifest);
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
