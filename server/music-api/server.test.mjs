import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMusicServer } from './server.mjs';
import { createPlatformMusicHandler } from './platform.mjs';
import http from 'node:http';
import { createUpstreamAdapter, initializeMusicRuntime } from './upstream.mjs';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function runtimeDirectory(work) {
  const directory = await mkdtemp(join(tmpdir(), 'yyphone-music-startup-'));
  try { await work(directory); }
  finally {
    for (const file of ['yyphone-music-device.json', 'xeapi_public_key']) await unlink(join(directory, file)).catch(() => {});
    await rmdir(directory);
  }
}

test('startup initializes SDK encryption before guest login, keeps guest state, and never shares a personal account', async () => {
  await runtimeDirectory(async directory => {
    await writeFile(join(directory, 'xeapi_public_key'), JSON.stringify({ version: 'old', sk: 'existing-client-key' }));
    const calls = [];
    const guest = await initializeMusicRuntime({
      register_xeapikey: async params => { calls.push('configuration'); assert.equal(params.currentKeyVersion, 'old'); assert.match(params.deviceId, /^[A-F0-9]{52}$/); return { body: { version: 'new' } }; },
      register_anonimous: async params => {
        calls.push('guest'); assert.equal(params.cookie, '');
        assert.equal(JSON.parse(await readFile(join(directory, 'xeapi_public_key'), 'utf8')).sk, 'existing-client-key');
        return { body: { code: 200 }, cookie: ['MUSIC_A=guest; Max-Age=3600', 'NMTID=guest-device; Path=/', 'MUSIC_U=must-not-share', 'MUSIC_R=must-not-share'] };
      },
    }, { directory });
    assert.deepEqual(calls, ['configuration', 'guest']);
    assert.equal(guest, 'MUSIC_A=guest; NMTID=guest-device');
    const seen = [];
    const adapter = createUpstreamAdapter({ login_status: async params => { seen.push(params.cookie); return { body: { code: 200 } }; } }, guest);
    await adapter.login_status({ cookie: '' }); await adapter.login_status({ cookie: 'MUSIC_U=my-account' }); await adapter.login_status({ cookie: '' });
    assert.deepEqual(seen, [guest, 'MUSIC_U=my-account', guest]);
  });
});

test('startup errors do not trigger guest retries or change transport after a verification challenge', async () => {
  await runtimeDirectory(async directory => {
    const challenge = { body: { code: -462 } };
    let calls = 0;
    await assert.rejects(initializeMusicRuntime({ register_xeapikey: async () => { calls++; throw challenge; }, register_anonimous: async () => assert.fail('must not continue initialization after challenge') }, { directory }), error => error === challenge);
    const adapter = createUpstreamAdapter({ login_qr_key: async () => assert.fail('must not make another upstream request after startup challenge') }, '', challenge);
    await assert.rejects(adapter.login_qr_key({ cookie: '' }), error => error === challenge);
    assert.equal(calls, 1);
  });
});

test('QR adapter preserves original verification errors instead of SDK ReferenceError', async () => {
  const error = { status: 400, body: { code: -462, data: { url: 'https://st.music.163.com/encrypt-pages?test=1' } } };
  const api = createUpstreamAdapter({ api: async params => {
    assert.equal(params.uri, '/api/login/qrcode/client/login');
    assert.deepEqual(params.data, { key: 'qr-key', type: 3 });
    assert.equal(params.cookie, '');
    throw error;
  } });
  await assert.rejects(api.login_qr_check({ key: 'qr-key', cookie: '' }), e => e === error);
  const success = createUpstreamAdapter({ api: async () => ({ body: { code: 803 }, cookie: ['MUSIC_U=test', 'other=test'] }) });
  assert.equal((await success.login_qr_check({ key: 'qr-key' })).body.cookie, 'MUSIC_U=test;other=test');
});

test('verification errors are explicit, sanitized and link only to official verification', async () => {
  for (const url of ['https://st.music.163.com/encrypt-pages?test=1', 'https://evil.invalid/', 'javascript:alert(1)']) {
    await service({ login_qr_check: async () => { throw { body: { code: -462, cookie: 'secret', data: { url } } }; } }, async post => {
      const response = await post('/login/qr/check', { key: 'qr-key' });
      assert.equal(response.status, 428);
      const data = await response.json();
      assert.equal(data.code, -462);
      assert.equal(data.verificationUrl, url.includes('st.music.163.com') ? url : '');
      assert(!JSON.stringify(data).includes('secret'));
    });
  }
});

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
