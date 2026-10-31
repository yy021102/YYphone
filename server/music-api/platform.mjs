import { createMusicHandler } from './server.mjs';

export function createPlatformMusicHandler(api, options) {
  const handler = createMusicHandler(api, options);
  return async (req, res) => {
    // The rewrite carries the public path explicitly across the platform adapter.
    const path = req.query?.musicPath ?? new URL(req.url, 'http://localhost').searchParams.get('musicPath');
    if (typeof path === 'string') req.url = `/${path.replace(/^\/+/, '')}`;
    return handler(req, res);
  };
}
