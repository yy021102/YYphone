import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker';

afterEach(() => mock.restoreAll());
const env = { RELAY_TOKEN: 'relay-secret', ALLOWED_ORIGINS: 'https://phone.example' };
const request = (input: unknown, token = 'relay-secret') => new Request('https://relay.example', { method: 'POST', headers: { Origin: 'https://phone.example', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
const input = () => ({ url: 'https://mcp.tavily.com/mcp/', method: 'POST', headers: { Authorization: 'Bearer service-key', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' });

test('relay preflight works and rejects unauthenticated or disallowed requests before upstream access', async () => {
  let calls = 0; mock.method(globalThis, 'fetch', async () => { calls++; return new Response('unused'); });
  const preflight = await worker.fetch(new Request('https://relay.example', { method: 'OPTIONS', headers: { Origin: 'https://phone.example' } }), env);
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://phone.example');
  assert.equal((await worker.fetch(request(input(), 'wrong'), env)).status, 401);
  assert.equal((await worker.fetch(request(input()), { ...env, RELAY_TOKEN: '' })).status, 503);
  assert.equal((await worker.fetch(request(input()), { ...env, ALLOWED_ORIGINS: 'https://other.example' })).status, 403);
  for (const url of ['http://mcp.tavily.com/mcp/', 'https://127.0.0.1/', 'https://mcp.tavily.com.evil.example/', 'https://user:pass@mcp.tavily.com/mcp/', 'https://mcp.tavily.com:8443/mcp/']) {
    assert.equal((await worker.fetch(request({ ...input(), url }), env)).status, 403);
  }
  assert.equal(calls, 0);
});

test('relay preserves service auth, JSON bodies and session headers without forwarding browser cookies or its own token', async () => {
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    assert.equal(url, 'https://mcp.tavily.com/mcp/'); assert.equal(init?.method, 'POST'); assert.equal(init?.body, input().body);
    const headers = new Headers(init?.headers); assert.equal(headers.get('Authorization'), 'Bearer service-key');
    assert.equal(headers.get('Mcp-Session-Id'), 'session-one');
    for (const name of ['Cookie', 'Origin', 'Host', 'Referer', 'X-Forwarded-For', 'Proxy-Authorization']) assert.equal(headers.get(name), null);
    assert(!JSON.stringify(Object.fromEntries(headers)).includes('relay-secret'));
    return new Response('{"result":{"tools":[]}}', { headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'session-two', 'Set-Cookie': 'not-forwarded' } });
  });
  const result = await worker.fetch(request({ ...input(), headers: { ...input().headers, 'Mcp-Session-Id': 'session-one', Cookie: 'private-cookie', Origin: 'https://phone.example', Host: 'fake.example', Referer: 'private-page', 'X-Forwarded-For': '127.0.0.1', 'Proxy-Authorization': 'bad' } }), env);
  assert.equal(result.status, 200); assert.equal(result.headers.get('Mcp-Session-Id'), 'session-two'); assert.equal(result.headers.get('Set-Cookie'), null);
  assert(result.headers.get('Access-Control-Expose-Headers')?.includes('Mcp-Session-Id')); assert.equal(await result.text(), '{"result":{"tools":[]}}');
});

test('relay streams SSE without waiting for the upstream stream to close', async () => {
  const encoder = new TextEncoder(); let cancelled = false;
  mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode('data: {"id":1,"result":{}}\n\n')); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const result = await worker.fetch(request(input()), env);
  assert.equal(result.headers.get('Content-Type'), 'text/event-stream');
  const reader = result.body!.getReader(); const chunk = await reader.read(); assert.match(new TextDecoder().decode(chunk.value), /data:/); await reader.cancel(); assert(cancelled);
});

test('relay reports transport errors separately from upstream authentication errors and refuses redirects', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('Unauthorized', { status: 401 }));
  const upstream = await worker.fetch(request(input()), env); assert.equal(upstream.status, 401); assert.equal(upstream.headers.get('X-YYphone-Relay-Error'), null);
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => { throw new TypeError('network details with service-key'); });
  const unavailable = await worker.fetch(request(input()), env); assert.equal(unavailable.status, 502); assert.equal(unavailable.headers.get('X-YYphone-Relay-Error'), '1'); assert(!(await unavailable.text()).includes('service-key'));
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example/' } }));
  assert.equal((await worker.fetch(request(input()), env)).status, 502);
});

test('relay supports custom allowlisted HTTPS hosts, DELETE and GET, but rejects malformed or oversized envelopes', async () => {
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => { assert.equal(init?.method, 'DELETE'); assert.equal(init?.body, undefined); return new Response(null, { status: 204 }); });
  assert.equal((await worker.fetch(request({ ...input(), url: 'https://custom.example/mcp', method: 'DELETE' }), { ...env, ALLOWED_HOSTS: 'custom.example' })).status, 204);
  assert.equal((await worker.fetch(request({ ...input(), method: 'PATCH' }), env)).status, 400);
  assert.equal((await worker.fetch(request({ ...input(), headers: { x: 3 } }), env)).status, 400);
  assert.equal((await worker.fetch(request({ ...input(), body: 'x'.repeat(300000) }), env)).status, 413);
});
