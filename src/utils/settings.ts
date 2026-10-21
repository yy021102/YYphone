import { readStoredValue, writeStoredValue } from './localStorage';
import { clearDbStorage, removeCachedStorageItem } from './dbStorage';

export const SETTINGS_KEYS = {
  userProfile: 'pocketos:user-profile',
  beauty: 'yyphone:beauty-settings',
  font: 'yyphone:font-settings',
  chatRuntime: 'yyphone:chat-runtime',
  lock: 'yyphone:lock-settings',
  statusBarVisible: 'yyphone:show-status-bar',
  followSystemDark: 'yyphone:follow-system-dark',
  voiceModel: 'yyphone:voice-model',
  imageGeneration: 'yyphone:image-generation',
  apiPresets: 'yyphone:api-presets',
  activeApiPreset: 'yyphone:active-api-preset',
  apiConfigExpanded: 'yyphone:api-config-expanded',
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
  removeCachedStorageItem(key);
}

export async function resetAllSettings(): Promise<void> {
  await clearDbStorage();
  window.sessionStorage.clear();
}
