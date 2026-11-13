import type { AppId, DesktopActivityId } from '../types';

export type DesktopPage = 0 | 1;
export const isDesktopActivity = (id: AppId | null | undefined): id is DesktopActivityId =>
  id === 'text-adventure' || id === 'time-capsule' || id === 'divination' || id === 'little-sip' || id === 'character-perspective' || id === 'kitchen';

export function desktopPageAfterSwipe(page: DesktopPage, dx: number, dy: number, width?: number, duration?: number): DesktopPage {
  const threshold = width ? Math.max(48, Math.min(96, width * .22)) : 48;
  const flick = duration !== undefined && duration > 0 && duration < 240 && Math.abs(dx) >= 24 && Math.abs(dx) / duration > .45;
  if ((!flick && Math.abs(dx) < threshold) || Math.abs(dx) < Math.abs(dy) * 1.4) return page;
  return dx < 0 ? 1 : 0;
}
