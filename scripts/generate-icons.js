import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const sourceImagePath = path.join(publicDir, 'tubiao.jpg');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const sourceImage = fs.readFileSync(sourceImagePath);

async function generate() {
  console.log('Generating PNG icons from tubiao.jpg...');

  // 192x192
  await sharp(sourceImage)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 512x512
  await sharp(sourceImage)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // apple-touch-icon.png (180x180)
  await sharp(sourceImage)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // maskable 512x512 (with 12% padding)
  await sharp(sourceImage)
    .resize(400, 400)
    .extend({
      top: 56,
      bottom: 56,
      left: 56,
      right: 56,
      background: '#DFF1FA',
    })
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
