import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const base = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const choices = [
  ['default', '初见', 'pwa-512x512.png'], ['claw', '抓娃娃机', 'app-icon-sources/claw.png'],
  ['slot', '老虎机', 'app-icon-sources/slot.png'], ['ndsl', 'NDSL', 'app-icon-sources/ndsl.png'],
  ['mist-garden', '雾色花园', 'app-icon-sources/mist-garden.png'],
  ['sunlit-sea', '晴海', 'app-icon-sources/sunlit-sea.png'],
  ['pastel-yy', '晕染', 'app-icon-sources/pastel-yy.png'],
  ['ascii-lily', '百合by小野', '百合by小野.jpg'],
  ['silent-manuscript', '缄默手稿', 'app-icon-sources/silent-manuscript.png'],
];
for (const [id, name, source] of choices) {
  const directory = join(root, 'app-icon-options', id);
  await mkdir(directory, { recursive: true });
  for (const size of [180, 192, 512]) await sharp(join(root, source)).rotate().resize(size, size, { fit: 'contain', background: '#fff7fb' }).png().toFile(join(directory, `icon-${size}.png`));
  const manifest = { ...base, id: '../../', start_url: `../../?launcher=${id}`, scope: '../../', icons: [192, 512].map(size => ({ src: `./icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) };
  await writeFile(join(directory, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Created launcher icon preset: ${id}`);
}
