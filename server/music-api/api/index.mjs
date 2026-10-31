import { createPlatformMusicHandler } from '../platform.mjs';
import { loadMusicApi } from '../upstream.mjs';

let handler;
export default async function music(req, res) {
  handler ??= loadMusicApi().then(api => createPlatformMusicHandler(api, {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  }));
  return (await handler)(req, res);
}
