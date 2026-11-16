export const CHRISTMAS_ACCESS_CHANGE = 'yyphone:christmas-access-change';
const SESSION_KEY = 'yyphone:christmas-preview-access';
const PASSWORD_HASH = '277375b99e186c72ac38ac47b03199038342fe0389be8765476fa2be0c5b5649';
let granted = false;
export const christmasReleased = (now = new Date()) => now >= new Date(2026, 11, 24);
export function readChristmasDebugAccess() {
  try { return granted || window.sessionStorage.getItem(SESSION_KEY) === 'granted'; } catch { return granted; }
}
export const canOpenChristmas = (now = new Date()) => christmasReleased(now) || readChristmasDebugAccess();
export async function unlockChristmasDebug(password: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
  if (hash !== PASSWORD_HASH) return false;
  granted = true;
  try { window.sessionStorage.setItem(SESSION_KEY, 'granted'); } catch { /* Keep access for this page when session storage is unavailable. */ }
  window.dispatchEvent(new Event(CHRISTMAS_ACCESS_CHANGE)); return true;
}
