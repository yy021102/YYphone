import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { LAUNCHER_ICONS, LAUNCHER_ICON_KEY, isLauncherIcon, launcherIconPaths, preserveLauncherIconOnImport } from './launcherIcons';
import { isPersonaRecordKey } from './personaStorage';

test('launcher choices are device-wide and preserve GitHub Pages base paths', () => {
  assert.equal(isPersonaRecordKey('yyphone:launcher-icon'), false);
  assert.equal(isLauncherIcon('claw'), true); assert.equal(isLauncherIcon('javascript:alert(1)'), false);
  assert.equal(launcherIconPaths('ndsl', '/YYphone/').image, '/YYphone/app-icon-options/ndsl/icon-512.png');
  assert.equal(launcherIconPaths('slot', '/').apple, '/app-icon-options/slot/icon-180.png');
});

test('restoring a pre-change backup preserves the icon chosen for this device and leaves backup data unchanged', () => {
  const backup = { [LAUNCHER_ICON_KEY]: JSON.stringify('default'), chats: 'saved chats' };
  const restored = preserveLauncherIconOnImport(backup, 'claw');
  assert.equal(restored[LAUNCHER_ICON_KEY], JSON.stringify('claw'));
  assert.equal(restored.chats, backup.chats);
  assert.equal(backup[LAUNCHER_ICON_KEY], JSON.stringify('default'));
  assert.deepEqual(preserveLauncherIconOnImport(backup, null), backup);
});

test('each preset has correctly sized images and the same app identity on root and repository hosting', async () => {
  for (const icon of LAUNCHER_ICONS) {
    const folder = new URL(`../../public/app-icon-options/${icon.id}/`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', folder), 'utf8'));
    for (const size of [180, 192, 512]) {
      const data = await readFile(new URL(`icon-${size}.png`, folder));
      assert.equal(data.readUInt32BE(16), size); assert.equal(data.readUInt32BE(20), size);
    }
    for (const base of ['https://phone.invalid/', 'https://phone.invalid/YYphone/']) {
      const url = new URL(launcherIconPaths(icon.id, new URL(base).pathname).manifest, base);
      assert.equal(new URL(manifest.id, url).href, base);
      assert.equal(new URL(manifest.scope, url).href, base);
      assert.equal(new URL(manifest.start_url, url).searchParams.get('launcher'), icon.id);
      for (const image of manifest.icons) assert(new URL(image.src, url).href.startsWith(base));
    }
  }
});
