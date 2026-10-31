// Optional live check. Requests an anonymous QR only; does not log in or print its contents.
import { createRequire } from 'node:module';
import { createMusicServer } from './server.mjs';
const require = createRequire(import.meta.url);
const api = require('@neteasecloudmusicapienhanced/api');
const origin = 'https://music-smoke.invalid';
const server = createMusicServer(api, { allowedOrigins: [origin] });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
try {
  async function post(path, params = {}) {
    const response = await fetch(url + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  const result = await post('/login/qr/key');
  if (!result.data?.unikey) throw new Error('QR key unavailable');
  const image = await post('/login/qr/create', { key: result.data.unikey });
  if (!image.data?.qrimg?.startsWith('data:image/png;base64,')) throw new Error('QR image unavailable');
  console.log('PASS live anonymous QR key and QR image through the local music adapter.');
} catch {
  console.error('Live QR check failed: confirm outbound connectivity to NetEase and retry. No account was used.');
  process.exitCode = 1;
} finally { await new Promise(resolve => server.close(resolve)); }
