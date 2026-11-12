import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readFontFile, readFontSettings, MAX_FONT_BYTES } from './fontSettings';
import { SETTINGS_KEYS } from './settings';
import { createFontPreset, FONT_PRESETS_KEY, isFontPresetList, readFontPresets } from './fontPresets';
import { personaStorageKey } from './personaStorage';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
beforeEach(async () => { await clearDbStorage(); });

test('font imports use actual file signatures and persist a reloadable local font source', async () => {
  for (const [signature, extension] of [['\x00\x01\x00\x00', 'ttf'], ['OTTO', 'otf'], ['wOFF', 'woff'], ['wOF2', 'woff2']]) {
    const file = new File([Uint8Array.from([...signature].map(char => char.charCodeAt(0)))], `字体.${extension}`);
    const imported = await readFontFile(file); assert(imported.dataUrl.startsWith(`data:font/${extension};base64,`));
    await setStorageItemsAtomically({ [SETTINGS_KEYS.font]: { family: 'system', scale: 1, file: imported } });
    assert.deepEqual(readFontSettings().file, imported);
  }
});

test('font imports reject empty, oversized or renamed non-font files before changing settings', async () => {
  await assert.rejects(readFontFile(new File(['not a font'], 'broken.ttf')), /字体/);
  await assert.rejects(readFontFile(new File([], 'empty.ttf')), /不能为空/);
  await assert.rejects(readFontFile(new File(['font'], 'wrong.txt')), /请选择/);
  await assert.rejects(readFontFile({ name: 'big.ttf', size: MAX_FONT_BYTES + 1 } as File), /30 MB/);
  assert.equal(readFontSettings().file, undefined);
});

test('font presets snapshot file, URL, family and size and survive switching and deletion', async () => {
  const imported = await readFontFile(new File([Uint8Array.of(0, 1, 0, 0)], '本地.ttf'));
  const settings = { family: 'rounded' as const, scale: 1.15, file: imported };
  const local = createFontPreset(' 本地圆体 ', settings, []);
  imported.name = '已修改.ttf';
  assert.equal(local.settings.file?.name, '本地.ttf');
  const online = createFontPreset('链接字体', { family: 'serif', scale: .9, url: 'https://example.com/font.woff2' }, [local]);
  await setStorageItemsAtomically({ [FONT_PRESETS_KEY]: [local, online] });
  assert.deepEqual(readFontPresets(), [local, online]);
  for (const preset of readFontPresets()) {
    await setStorageItemsAtomically({ [SETTINGS_KEYS.font]: preset.settings });
    assert.deepEqual(readFontSettings(), preset.settings);
  }
  await setStorageItemsAtomically({ [FONT_PRESETS_KEY]: [local] });
  assert.deepEqual(readFontSettings(), online.settings, 'deleting a library entry does not remove active font');
  assert.equal(personaStorageKey(FONT_PRESETS_KEY, 'other-user'), FONT_PRESETS_KEY, 'font library stays shared across personas');
});

test('invalid or duplicate font presets cannot be saved', () => {
  const preset = createFontPreset('默认', { family: 'system', scale: 1 }, []);
  assert.throws(() => createFontPreset('默认', preset.settings, [preset]), /同名/);
  assert.throws(() => createFontPreset('  ', preset.settings, []), /名称/);
  assert.throws(() => createFontPreset('大字', { family: 'system', scale: 9 }, []), /设置无效/);
  assert.equal(isFontPresetList([{ ...preset, settings: { family: 'system', scale: 1, file: { name: 'fake', dataUrl: 'javascript:alert(1)' } } }]), false);
  assert.equal(isFontPresetList([preset, preset]), false);
});
