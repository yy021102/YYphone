import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeCustomizerApp } from './ThemeCustomizerApp';
import type { BeautySettings } from '../types';
import { DEFAULT_FONT_SETTINGS } from '../utils/fontSettings';
import { portableHomeBeauty } from '../utils/homeAppearance';

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: { getItem: () => null } },
});

const settings: BeautySettings = {
  themeId: 'ocean-dawn',
  wallpaperId: 'dreamy-sky',
  wallpapers: { lockScreen: '', homeScreen: '' },
  appIcons: { wechat: 'icon.png' },
};

function renderSettings(currentSettings: BeautySettings) {
  return renderToStaticMarkup(<ThemeCustomizerApp
    fontSettings={DEFAULT_FONT_SETTINGS} onSaveFontSettings={() => true}
    onBack={() => {}} activeThemeId={currentSettings.themeId} onSelectTheme={() => true}
    activeWallpaperId={currentSettings.wallpaperId} onSelectWallpaper={() => true}
    customWallpapers={currentSettings.wallpapers} onSaveCustomWallpapers={() => true}
    appIcons={currentSettings.appIcons} onSaveAppIcons={() => true}
    onApplyPreset={() => true} currentSettings={currentSettings}
  />);
}

test('transparent icon switch defaults off for legacy settings and reflects saved values', () => {
  for (const [value, checked] of [[undefined, false], [false, false], [true, true]] as const) {
    const html = renderSettings({ ...settings, transparentAppIcons: value });
    const input = html.match(/<input[^>]*aria-label="启用透明底图标"[^>]*>/)?.[0];
    assert.ok(input);
    assert.equal(/\bchecked=""/.test(input), checked);
    assert.match(html, /保存 App 图标/);
  }
});

test('portable beauty presets retain the icon mode and images', () => {
  for (const transparentAppIcons of [false, true]) {
    const exported = JSON.parse(JSON.stringify(portableHomeBeauty({ ...settings, transparentAppIcons })));
    assert.equal(exported.transparentAppIcons, transparentAppIcons);
    assert.deepEqual(exported.appIcons, settings.appIcons);
  }
});
