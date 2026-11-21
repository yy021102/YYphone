import clientWorker from './client-worker.mjs';
export default {
  async fetch(request, env) {
    // Preserve the currently published phone while GitHub tests new versions.
    if (new URL(request.url).pathname === '/sw.js' && request.method === 'GET') {
      const headers = new Headers(request.headers);headers.delete('If-None-Match');headers.delete('If-Modified-Since');
      request = new Request(request, { headers });
    }
    const response = await clientWorker.fetch(request, { ...env, API_ONLY: 'true', LEGACY_ASSET_ORIGIN: 'https://6de26fb7.yyphone.pages.dev' });
    if (new URL(request.url).pathname === '/sw.js' && request.method === 'GET' && response.ok) {
      const source = await response.text();
      const patched = source.replace(/new (\w+)\.NavigationRoute\((\w+\.createHandlerBoundToURL\("index\.html"\))\)/, 'new $1.NavigationRoute($2,{denylist:[/^\\/api\\//]})');
      const headers = new Headers(response.headers);headers.delete('Content-Length');headers.delete('Content-Encoding');headers.delete('ETag');headers.delete('Last-Modified');headers.set('Cache-Control', 'no-cache');
      return new Response(patched, { status: response.status, headers });
    }
    return response;
  }
};
