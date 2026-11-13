import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const base = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const choices = [
  ['default', '默认', 'pwa-512x512.png'], ['claw', '抓娃娃机', '抓娃娃机.jpg'],
  ['slot', '老虎机', '老虎机.jpg'], ['ndsl', 'NDSL', 'ndsl.jpg'],
];
for (const [id, name, source] of choices) {
  const directory = join(root, 'app-icon-options', id);
  await mkdir(directory, { recursive: true });
  for (const size of [180, 192, 512]) await sharp(join(root, source)).rotate().resize(size, size, { fit: 'contain', background: '#fff7fb' }).png().toFile(join(directory, `icon-${size}.png`));
  const manifest = { ...base, id: '../../', start_url: `../../?launcher=${id}`, scope: '../../', icons: [192, 512].map(size => ({ src: `./icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) };
  await writeFile(join(directory, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Created launcher icon preset: ${id}`);
}
