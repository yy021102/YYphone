import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadMusicApi } from './upstream.mjs';

const routes = {
  '/login/qr/key': ['login_qr_key', []],
  '/login/qr/create': ['login_qr_create', ['key', 'qrimg', 'platform']],
  '/login/qr/check': ['login_qr_check', ['key']],
  '/login/status': ['login_status', []],
  '/user/playlist': ['user_playlist', ['uid', 'offset', 'limit']],
  '/playlist/track/all': ['playlist_track_all', ['id', 'offset', 'limit']],
  '/cloudsearch': ['cloudsearch', ['keywords', 'offset', 'limit']],
  '/song/url/v1': ['song_url_v1', ['id']],
};

// A small allowlisted adapter: no shared account, upstream response cache or cookie headers.
export function createMusicHandler(api, { allowedOrigins = [], allowNoOrigin = false } = {}) {
  const limits = new Map();
  return async (req, res) => {
    const origin = req.headers.origin;
    const allowed = origin ? allowedOrigins.includes(origin) : allowNoOrigin;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (origin && allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    const send = (status, body) => { if (!res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); } };
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/health' && req.method === 'GET') return send(200, { code: 200, service: 'yyphone-music' });
    if (!allowed) return send(403, { code: 403, message: '来源未获允许，请配置 ALLOWED_ORIGINS。' });
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (!routes[pathname]) return send(404, { code: 404 });
    if (req.method !== 'POST') return send(405, { code: 405, message: '请使用 POST。' });
    if (!String(req.headers['content-type']).startsWith('application/json')) return send(415, { code: 415 });
    const ip = req.socket.remoteAddress || 'local';
    const now = Date.now();
    for (const [key, value] of limits) if (now - value.at > 60000) limits.delete(key);
    const rate = limits.get(ip) || { at: now, count: 0 };
    rate.count++; limits.set(ip, rate);
    if (rate.count > 180) return send(429, { code: 429 });
    try {
      let body;
      // Vercel supplies a parsed body; a standalone Node server supplies a stream.
      try {
        body = req.body;
        if (body !== undefined) {
          const raw = typeof body === 'string' || Buffer.isBuffer(body) ? body.toString() : JSON.stringify(body);
          if (Buffer.byteLength(raw) > 32768) return send(413, { code: 413 });
          body = JSON.parse(raw);
        } else {
          const chunks = []; let bytes = 0;
          for await (const chunk of req) { bytes += chunk.length; if (bytes > 32768) { send(413, { code: 413 }); req.resume(); return; } chunks.push(chunk); }
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        }
      } catch { return send(400, { code: 400 }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { code: 400 });
      const [method, fields] = routes[pathname];
      const params = { cookie: typeof body.cookie === 'string' ? body.cookie : '', timeout: 12000 };
      for (const field of fields) if (['string', 'number', 'boolean'].includes(typeof body[field])) params[field] = body[field];
      if (fields.includes('id') && !/^\d{1,18}$/.test(String(params.id))) return send(400, { code: 400 });
      if (fields.includes('uid') && !/^\d{1,18}$/.test(String(params.uid))) return send(400, { code: 400 });
      if (fields.includes('key') && (typeof params.key !== 'string' || !params.key || params.key.length > 256)) return send(400, { code: 400 });
      if (fields.includes('limit')) params.limit = Math.max(1, Math.min(100, Math.trunc(Number(params.limit) || 30)));
      if (fields.includes('offset')) params.offset = Math.max(0, Math.trunc(Number(params.offset) || 0));
      if (pathname === '/login/qr/create') { params.qrimg = true; params.platform = 'web'; }
      if (pathname === '/cloudsearch') { params.type = 1; params.keywords = String(params.keywords || '').trim().slice(0, 200); if (!params.keywords) return send(400, { code: 400 }); }
      if (pathname === '/song/url/v1') { params.level = 'standard'; params.unblock = 'false'; }
      const result = await api[method](params);
      if (!result?.body || typeof result.body !== 'object') return send(502, { code: 502 });
      // login_qr_check returns the new session in its JSON body; never set browser cookies.
      send(200, result.body);
    } catch (error) {
      const code = Number(error?.body?.code ?? error?.status);
      if ([301, 401, 429].includes(code)) send(code === 301 ? 401 : code, { code });
      else send(502, { code: 502, message: '音乐服务暂时无法连接网易云，请稍后重试。' });
    }
  };
}
export const createMusicServer = (api, options) => http.createServer(createMusicHandler(api, options));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const api = await loadMusicApi();
  const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean);
  const server = createMusicServer(api, { allowedOrigins: origins });
  server.requestTimeout = 20000;
  server.headersTimeout = 15000;
  server.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => console.log('音乐服务已启动。允许的网页来源：', origins.join(', ')));
}
