import type { AppId, DesktopActivityId } from '../types';

export type DesktopPage = 0 | 1;
export const isDesktopActivity = (id: AppId | null | undefined): id is DesktopActivityId =>
  id === 'text-adventure' || id === 'time-capsule' || id === 'divination' || id === 'little-sip' || id === 'character-perspective';

export function desktopPageAfterSwipe(page: DesktopPage, dx: number, dy: number): DesktopPage {
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return page;
  return dx < 0 ? 1 : 0;
}
