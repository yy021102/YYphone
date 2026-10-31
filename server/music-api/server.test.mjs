import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMusicServer } from './server.mjs';
import { createPlatformMusicHandler } from './platform.mjs';
import http from 'node:http';

async function service(api, work) {
  const server = createMusicServer(api, { allowedOrigins: ['https://phone.invalid'] });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body = {}, origin = 'https://phone.invalid') => fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try { await work(post, base); } finally { await new Promise(r => server.close(r)); }
}
test('isolates per-request credentials, emits no shared cookies, enforces CORS and disables response caching', async () => {
  const calls = [];
  await service({ login_status: async p => { calls.push(p.cookie); return { body: { data: { profile: { nickname: p.cookie } } }, cookie: ['must-not-be-forwarded'] }; } }, async (post, base) => {
    const [a, b] = await Promise.all([post('/login/status', { cookie: 'account-a' }), post('/login/status', { cookie: 'account-b' })]);
    assert.equal((await a.json()).data.profile.nickname, 'account-a'); assert.equal((await b.json()).data.profile.nickname, 'account-b'); assert.deepEqual(calls.sort(), ['account-a', 'account-b']);
    assert.equal(a.headers.get('set-cookie'), null); assert.equal(a.headers.get('cache-control'), 'no-store'); assert.equal(a.headers.get('access-control-allow-origin'), 'https://phone.invalid');
    const denied = await post('/login/status', {}, 'https://other.invalid'); assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(base + '/login/status', { method: 'OPTIONS', headers: { Origin: 'https://phone.invalid' } }); assert.equal(preflight.status, 204);
    assert.equal((await fetch(base + '/health')).status, 200);
  });
});
test('only required read-only routes and parameters can reach upstream; song permissions cannot be overridden', async () => {
  let seen;
  await service({ song_url_v1: async p => { seen = p; return { body: { code: 200, data: [] } }; } }, async post => {
    const r = await post('/song/url/v1', { id: 7, cookie: 'mine', unblock: 'true', level: 'hires', proxy: 'https://evil.invalid', domain: 'evil', headers: { Cookie: 'someone-else' } });
    assert.equal(r.status, 200); assert.deepEqual(seen, { id: 7, cookie: 'mine', level: 'standard', unblock: 'false', timeout: 12000 });
    assert.equal((await post('/playlist/delete', { id: 1 })).status, 404);
    assert.equal((await post('/song/url/v1', { id: 'not-a-song' })).status, 400);
    assert.equal((await post('/login/status', { cookie: 'x'.repeat(40000) })).status, 413);
  });
});
test('does not echo upstream exception credentials and preserves login expiration without storing a global account', async () => {
  await service({ login_status: async () => { throw { status: 301, body: { code: 301, cookie: 'private-secret' } }; }, login_qr_key: async () => { throw new Error('private-secret'); } }, async post => {
    const expired = await post('/login/status'); assert.equal(expired.status, 401); assert.deepEqual(await expired.json(), { code: 301 });
    const failed = await post('/login/qr/key'); assert.equal(failed.status, 502); assert(!(await failed.text()).includes('private-secret'));
  });
});

test('serverless adapter handles rewritten paths and pre-parsed JSON bodies without losing per-account credentials', async () => {
  const handler = createPlatformMusicHandler({ login_status: async p => ({ body: { data: { profile: { nickname: p.cookie } } } }) }, { allowedOrigins: ['https://phone.invalid'] });
  const server = http.createServer(async (req, res) => {
    const data = []; for await (const chunk of req) data.push(chunk);
    req.body = JSON.parse(Buffer.concat(data).toString());
    req.query = { musicPath: 'login/status' };
    req.url = '/api/index?musicPath=login/status';
    await handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const post = body => fetch(`http://127.0.0.1:${server.address().port}/login/status`, { method: 'POST', headers: { Origin: 'https://phone.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const response = await post({ cookie: 'this-account-only' });
    assert.equal(response.status, 200); assert.equal((await response.json()).data.profile.nickname, 'this-account-only');
    assert.equal((await post({ cookie: 'x'.repeat(40000) })).status, 413);
    assert.equal((await post([])).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
