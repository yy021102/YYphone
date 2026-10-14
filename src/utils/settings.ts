import { readStoredValue, writeStoredValue } from './localStorage';

export const SETTINGS_KEYS = {
  userProfile: 'pocketos:user-profile',
  beauty: 'yyphone:beauty-settings',
  lock: 'yyphone:lock-settings',
  statusBarVisible: 'yyphone:show-status-bar',
  apiPresets: 'yyphone:api-presets',
  activeApiPreset: 'yyphone:active-api-preset',
  beautyPresets: 'yyphone:beauty-presets',
  personas: 'pocketos:personas',
  chatAppearance: 'yyphone:chat-appearance',
  chatContextPresets: 'yyphone:chat-context-presets',
  taobaoThemePresets: 'yyphone:taobao-theme-presets',
  taobaoActivePresetId: 'yyphone:taobao-active-preset-id',
  taobaoCurrentTheme: 'yyphone:taobao-current-theme',
} as const;

export function readSetting<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T
): T {
  return readStoredValue(key, fallback, isValid);
}

export function saveSetting<T>(key: string, value: T): void {
  writeStoredValue(key, value);
}

export function removeSetting(key: string): void {
  window.localStorage.removeItem(key);
}

export function resetAllSettings(): void {
  window.localStorage.clear();
  window.sessionStorage.clear();
}
