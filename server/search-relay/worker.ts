/** Deploy separately from the static phone app. Do not log request bodies or headers. */
export type RelayEnv = { RELAY_TOKEN: string; ALLOWED_ORIGINS?: string; ALLOWED_HOSTS?: string };
const defaultHosts = ['mcp.tavily.com', 'api.tavily.com', 'api.exa.ai', 'api.bochaai.com', 'api.bocha.cn'];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (value: string | undefined) => value?.split(',').map(v => v.trim()).filter(Boolean) || [];

export default {
  async fetch(request: Request, env: RelayEnv): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const origins = list(env.ALLOWED_ORIGINS);
    const allowedOrigin = !!origin && (!origins.length || origins.includes(origin));
    const cors = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version, X-YYphone-Relay-Error',
      ...(allowedOrigin ? { 'Access-Control-Allow-Origin': origin } : {}),
    });
    const error = (status: number, message: string) => {
      const headers = new Headers(cors); headers.set('Content-Type', 'application/json'); headers.set('X-YYphone-Relay-Error', '1');
      return new Response(JSON.stringify({ error: message }), { status, headers });
    };
    if (origin && !allowedOrigin) return error(403, 'Origin is not allowed');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return error(405, 'Use POST');
    if (!env.RELAY_TOKEN) return error(503, 'Relay token is not configured');
    if (request.headers.get('Authorization') !== `Bearer ${env.RELAY_TOKEN}`) return error(401, 'Invalid relay token');
    let input: unknown;
    try {
      const reader = request.body?.getReader(); if (!reader) return error(400, 'Missing request');
      let raw = '', bytes = 0; const decoder = new TextDecoder();
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength; if (bytes > 262144) return error(413, 'Request too large');
          raw += decoder.decode(chunk.value, { stream: true });
        }
        input = JSON.parse(raw + decoder.decode());
      } finally { await reader.cancel().catch(() => {}); }
    } catch { return error(400, 'Invalid request JSON'); }
    if (!object(input) || typeof input.url !== 'string' || !['GET', 'POST', 'DELETE'].includes(String(input.method)) || !object(input.headers) || Object.values(input.headers).some(v => typeof v !== 'string') || input.body !== undefined && typeof input.body !== 'string') return error(400, 'Invalid relay parameters');
    let target: URL;
    try { target = new URL(input.url); } catch { return error(400, 'Invalid target URL'); }
    const hosts = new Set([...defaultHosts, ...list(env.ALLOWED_HOSTS).map(v => v.toLowerCase())]);
    if (target.protocol !== 'https:' || target.username || target.password || target.port && target.port !== '443' || !hosts.has(target.hostname.toLowerCase())) return error(403, 'Target host is not allowed');
    try {
      const upstreamHeaders = new Headers(input.headers as Record<string, string>);
      for (const name of [...upstreamHeaders.keys()]) if (/^(?:host|cookie|origin|referer|content-length|connection|accept-encoding|forwarded|x-forwarded-.*|sec-.*|proxy-.*)$/i.test(name)) upstreamHeaders.delete(name);
      const response = await fetch(target.href, { method: String(input.method), headers: upstreamHeaders,
        ...(input.method === 'POST' && typeof input.body === 'string' ? { body: input.body } : {}), redirect: 'manual', signal: AbortSignal.timeout(30000) });
      // Keep API credentials on the exact requested origin; redirects must be fixed in the service URL.
      if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); return error(502, 'Use the final service URL without redirects'); }
      for (const name of ['Content-Type', 'Mcp-Session-Id', 'MCP-Protocol-Version', 'Retry-After']) {
        const value = response.headers.get(name); if (value) cors.set(name, value);
      }
      // Pass SSE through as a stream and expose the session header to the browser.
      return new Response(response.body, { status: response.status, headers: cors });
    } catch { return error(502, 'Upstream connection failed'); }
  },
};
