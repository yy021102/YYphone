import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readFontFile, readFontSettings, MAX_FONT_BYTES } from './fontSettings';
import { SETTINGS_KEYS } from './settings';

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
