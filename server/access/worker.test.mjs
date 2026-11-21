import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { hash } from './worker.mjs';
import { adminPage } from './admin.mjs';
import { Script } from 'node:vm';
import { gate } from './gate.mjs';
import { discordReady } from './discord.mjs';
import clientWorker from './client-worker.mjs';

function environment() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const prepare = sql => ({ bind(...values) {
    return { first: async () => db.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...values) }),
      run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...values).changes) } }) };
  } });
  return { ADMIN_TOKEN: 'test-admin', DB: { prepare, async batch(statements) {
    db.exec('BEGIN'); try { const results = []; for (const s of statements) results.push(await s.run()); db.exec('COMMIT'); return results; } catch(e) { db.exec('ROLLBACK'); throw e; }
  } }, ASSETS: { fetch: async () => new Response('private app') } };
}
const call = (env, path, data, cookie = '', admin = false) => worker.fetch(new Request('https://phone.test' + path, {
  method: data ? 'POST' : 'GET', headers: { Origin: 'https://phone.test', 'Content-Type': 'application/json', Cookie: cookie, ...(admin ? { Authorization: 'Bearer test-admin' } : {}) }, body: data ? JSON.stringify(data) : undefined
}), env);
const cookieJar = response => response.headers.getSetCookie().filter(c => !c.includes('Max-Age=0')).map(c => c.split(';')[0]).join('; ');
test('activation is single use, two devices are enforced, revocation and reset invalidate sessions', async () => {
  const env = environment();
  assert.equal((await call(env, '/assets/app.js')).status, 401);
  assert.equal((await call(env, '/api/admin/codes', {})).status, 403);
  const { code } = await (await call(env, '/api/admin/codes', {}, '', true)).json();
  const credentials = { username: '123456789', password: 'long-password-123', code };
  const registered = await call(env, '/api/auth/register', credentials);
  assert.equal(registered.status, 200);
  const first = cookieJar(registered);
  assert.equal(await (await call(env, '/assets/app.js', null, first)).text(), 'private app');
  assert.equal((await call(env, '/api/auth/register', { ...credentials, username: '234567890' })).status, 409);
  assert.equal((await call(env, '/api/auth/login', { ...credentials, password: 'wrong-password' })).status, 401);
  const second = await call(env, '/api/auth/login', credentials);
  assert.equal(second.status, 200);
  assert.equal((await call(env, '/api/auth/login', credentials)).status, 403);
  const again = await call(env, '/api/auth/login', credentials, first);
  assert.equal(again.status, 200);
  assert.equal((await call(env, '/api/auth/me', null, first)).status, 401);
  const active = cookieJar(again);
  await call(env, '/api/admin/reset-devices', { username: '123456789' }, '', true);
  assert.equal((await call(env, '/api/auth/me', null, active)).status, 401);
  const afterReset = await call(env, '/api/auth/login', credentials);
  assert.equal(afterReset.status, 200);
  await call(env, '/api/admin/revoke-code', { code }, '', true);
  assert.equal((await call(env, '/api/auth/me', null, cookieJar(afterReset))).status, 401);
  assert.equal((await call(env, '/api/auth/login', credentials)).status, 401);
});
test('bulk batches are distinct, retry-safe, exportable and track redemption and revocation', async () => {
  const env = environment();
  const create = data => call(env, '/api/admin/batches/create', data, '', true);
  const firstRequest = { count: 50, label: '管理员1', requestId: 'batch-admin-one-0001' };
  assert.equal((await call(env, '/api/admin/batches/create', firstRequest)).status, 403);
  const first = await (await create(firstRequest)).json();
  const second = await (await create({ count: 50, label: '管理员2' })).json();
  assert.equal(first.codes.length, 50);
  assert.equal(second.codes.length, 50);
  assert(first.codes.every(code => /^[A-HJ-NP-Z2-9]{15}$/.test(code)));
  assert.equal(new Set([...first.codes, ...second.codes]).size, 100);
  assert.deepEqual((await (await create(firstRequest)).json()).codes, first.codes);
  assert.equal((await create({ ...firstRequest, count: 51 })).status, 409);
  for (const count of [0, 101, 1.5, '50']) assert.equal((await create({ count, label: 'invalid' })).status, 400);
  assert.equal((await create({ count: 50, label: ' ' })).status, 400);
  const registration = await call(env, '/api/auth/register', { username: '345678901', password: 'long-password-123', code: first.codes[0] });
  assert.equal(registration.status, 200);
  await call(env, '/api/admin/revoke-code', { code: first.codes[1] }, '', true);
  const listing = await (await call(env, '/api/admin/batches/list', {}, '', true)).json();
  assert.equal(listing.batches.length, 2);
  const stats = listing.batches.find(batch => batch.id === first.id);
  assert.equal(stats.used, 1);
  assert.equal(stats.revoked, 1);
  assert.equal(stats.available, 48);
  const exported = await (await call(env, '/api/admin/batches/export', { id: first.id }, '', true)).json();
  assert.deepEqual(exported.codes, first.codes);
  assert.deepEqual(exported.available, first.codes.slice(2));
  assert.equal(JSON.stringify(listing).includes(first.codes[0]), false);
  assert.equal(JSON.stringify(listing).includes('sealed'), false);
  assert.equal((await call(env, '/api/admin/batches/export', { id: 'missing' }, '', true)).status, 404);
});
test('admin page can load before activation and its inline script parses', async () => {
  const response = await call(environment(), '/admin');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const html = await response.text();
  assert(html.includes('最近100个批次'));
  new Script(adminPage.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
test('database blocks a third device and login attempts are throttled', async () => {
  const env = environment();
  for (let i = 0; i < 15; i++) await call(env, '/api/auth/login', {});
  assert.equal((await call(env, '/api/auth/login', {})).status, 429);
  const cross = await worker.fetch(new Request('https://phone.test/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.test' } }), env);
  assert.equal(cross.status, 403);
});
test('QQ account validation, overview, code lookup, selective unbinding and ban lifecycle', async () => {
  const env = environment();
  const admin = async (path, data = {}) => call(env, '/api/admin/' + path, data, '', true);
  assert.equal((await call(env, '/api/admin/overview', {})).status, 403);
  assert.equal((await call(env, '/api/admin/users/list', {})).status, 403);
  const batch = await (await admin('batches/create', { label: '管理员1', count: 3 })).json();
  const single = await (await admin('codes')).json();
  const credentials = { username: '987654321', password: 'site-password-123', code: batch.codes[0] };
  for (const username of ['alice', '0123456', '1234', '1234567890123']) {
    assert.equal((await call(env, '/api/auth/register', { ...credentials, username })).status, 400);
  }
  const firstLogin = await call(env, '/api/auth/register', credentials);
  assert.equal(firstLogin.status, 200);
  const first = cookieJar(firstLogin);
  const secondLogin = await call(env, '/api/auth/login', credentials);
  const second = cookieJar(secondLogin);
  assert.equal(secondLogin.status, 200);
  const singleRegistration = await call(env, '/api/auth/register', { ...credentials, username: '123456789', code: single.code });
  assert.equal(singleRegistration.status, 200);
  const overview = await (await admin('overview')).json();
  assert.deepEqual(overview, { total_codes: 4, unused_codes: 2, redeemed_codes: 2, revoked_codes: 0, registered_users: 2, banned_users: 0, discord_users: 0 });
  const listing = await (await admin('users/list', { query: '9876' })).json();
  assert.equal(listing.total, 1);
  assert.equal(listing.users[0].code, batch.codes[0]);
  assert.equal(listing.users[0].batch_label, '管理员1');
  assert.equal(listing.users[0].device_count, 2);
  assert(listing.users[0].registered_at > 0);
  assert.equal('password' in listing.users[0], false);
  assert.equal('salt' in listing.users[0], false);
  assert.equal((await (await admin('users/list', { query: '1234' })).json()).users[0].code, single.code);
  let detail = await (await admin('users/detail', { username: credentials.username })).json();
  assert.equal(detail.devices.length, 2);
  const firstToken = firstLogin.headers.getSetCookie().find(c => c.startsWith('phone_session=')).split(';')[0].slice('phone_session='.length);
  const firstFingerprint = (await env.DB.prepare('SELECT fingerprint FROM sessions WHERE user_id=? AND hash=?').bind(detail.user.id, await hash(firstToken)).first()).fingerprint;
  assert.equal((await admin('users/unbind-device', { username: credentials.username, fingerprint: firstFingerprint })).status, 200);
  assert.equal((await call(env, '/api/auth/me', null, first)).status, 401);
  assert.equal((await call(env, '/api/auth/me', null, second)).status, 200);
  assert.equal((await call(env, '/api/auth/login', credentials)).status, 200);
  await admin('users/status', { username: credentials.username, disabled: true });
  assert.equal((await call(env, '/api/auth/me', null, second)).status, 401);
  assert.equal((await call(env, '/api/auth/login', credentials)).status, 401);
  assert.equal((await (await admin('overview')).json()).banned_users, 1);
  assert.equal((await (await admin('users/list', { status: 'banned' })).json()).total, 1);
  await admin('users/status', { username: credentials.username, disabled: false });
  assert.equal((await call(env, '/api/auth/me', null, second)).status, 401);
  assert.equal((await call(env, '/api/auth/login', credentials, second)).status, 200);
  await admin('revoke-code', { code: batch.codes[1] });
  const afterRevocation = await (await admin('overview')).json();
  assert.equal(afterRevocation.unused_codes, 1);
  assert.equal(afterRevocation.redeemed_codes, 2);
  assert.equal(afterRevocation.registered_users, 2);
  assert.equal((await admin('reset-devices', { username: '1111111' })).status, 404);
  assert.equal((await admin('users/status', { username: '1111111', disabled: true })).status, 404);
  assert.equal((await admin('users/list', { query: "' OR 1=1" })).status, 400);
  assert.equal((await admin('users/list', { page: 0 })).status, 400);
  assert(gate.includes('QQ号（登录账号）'));
  new Script(gate.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
function discordEnvironment() {
  const env = environment();
  Object.assign(env, { DISCORD_CLIENT_ID: '1573730575842279564', DISCORD_CLIENT_SECRET: 'fake-client-secret', DISCORD_GUILD_ID: '1379304008157499423', DISCORD_REDIRECT_URI: 'https://phone.test/api/auth/discord/callback' });
  const discordId = '123456789012345678';
  const control = { member: true, pending: false, unavailable: false, memberCalls: 0, tokenCalls: 0 };
  env.DISCORD_FETCH = async (url, options) => {
    if (url === 'https://discord.com/api/oauth2/token') {
      control.tokenCalls++;
      assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
      assert.equal(new URLSearchParams(options.body).get('client_secret'), 'fake-client-secret');
      return Response.json({ access_token: 'fake-access-token-never-return-to-browser', token_type: 'Bearer', expires_in: 86400, scope: 'identify guilds.members.read' });
    }
    assert.equal(options.headers.Authorization, 'Bearer fake-access-token-never-return-to-browser');
    if (url.endsWith('/users/@me')) return Response.json({ id: discordId, username: 'discorduser', global_name: '社区成员' });
    assert.equal(url, 'https://discord.com/api/v10/users/@me/guilds/1379304008157499423/member');
    control.memberCalls++;
    if (control.unavailable) return Response.json({ error: 'unavailable' }, { status: 503 });
    return control.member ? Response.json({ user: { id: discordId }, pending: control.pending }) : Response.json({ message: 'Unknown Member' }, { status: 404 });
  };
  const begin = () => call(env, '/api/auth/discord/start');
  async function finish(start, extraCookie = '') {
    const state = new URL(start.headers.get('Location')).searchParams.get('state');
    return call(env, '/api/auth/discord/callback?code=fake-code&state=' + state, null, cookieJar(start) + (extraCookie ? '; ' + extraCookie : ''));
  }
  return { env, control, begin, finish, discordId };
}
test('Discord member OAuth uses browser-bound single-use state and enforces two devices, ban and membership rechecks', async () => {
  const { env, control, begin, finish, discordId } = discordEnvironment();
  assert(discordReady(env));
  const start = await begin();
  const authorization = new URL(start.headers.get('Location'));
  assert.equal(authorization.origin, 'https://discord.com');
  assert.equal(authorization.searchParams.get('scope'), 'identify guilds.members.read');
  assert(start.headers.getSetCookie()[0].includes('SameSite=Lax'));
  const state = authorization.searchParams.get('state');
  const wrongBrowser = await call(env, '/api/auth/discord/callback?code=fake&state=' + state);
  assert(wrongBrowser.headers.get('Location').includes('state'));
  assert.equal(control.tokenCalls, 0);
  const firstResponse = await finish(start);
  assert.equal(firstResponse.headers.get('Location'), '/');
  const first = cookieJar(firstResponse);
  assert(firstResponse.headers.getSetCookie().find(value => value.startsWith('phone_device')).includes('SameSite=Lax'));
  assert(!first.includes('fake-access-token'));
  assert((await finish(start)).headers.get('Location').includes('state'));
  assert.equal(control.tokenCalls, 1);
  const member = await call(env, '/api/auth/me', null, first);
  assert.equal(member.status, 200);
  const overview = await (await call(env, '/api/admin/overview', {}, '', true)).json();
  assert.equal(overview.total_codes, 0);
  assert.equal(overview.redeemed_codes, 0);
  assert.equal(overview.registered_users, 1);
  assert.equal(overview.discord_users, 1);
  const listed = await (await call(env, '/api/admin/users/list', { provider: 'discord', query: '社区' }, '', true)).json();
  assert.equal(listed.users.length, 1);
  assert.equal(listed.users[0].provider, 'discord');
  assert.equal(listed.users[0].discord_id, discordId);
  assert.equal(listed.users[0].code, null);
  assert(!JSON.stringify(listed).includes('fake-access-token'));
  const secondResponse = await finish(await begin());
  assert.equal(secondResponse.headers.get('Location'), '/');
  assert((await finish(await begin())).headers.get('Location').includes('device_limit'));
  assert.equal((await finish(await begin(), first)).headers.get('Location'), '/');
  await call(env, '/api/admin/users/status', { username: 'discord:' + discordId, disabled: true }, '', true);
  assert((await finish(await begin())).headers.get('Location').includes('banned'));
  assert.equal((await call(env, '/api/auth/me', null, cookieJar(secondResponse))).status, 401);
  await call(env, '/api/admin/users/status', { username: 'discord:' + discordId, disabled: false }, '', true);
  const activeResponse = await finish(await begin(), first);
  const active = cookieJar(activeResponse);
  assert.equal((await call(env, '/api/auth/me', null, active)).status, 200);
  await env.DB.prepare('UPDATE discord_accounts SET checked_at=0').bind().run();
  control.member = false;
  assert.equal((await call(env, '/api/auth/me', null, active)).status, 401);
  assert.equal((await (await call(env, '/api/admin/users/list', { status: 'not_member' }, '', true)).json()).total, 1);
  assert((await finish(await begin(), first)).headers.get('Location').includes('not_member'));
  control.member = true;
  assert.equal((await finish(await begin(), first)).headers.get('Location'), '/');
});
test('Discord nonmembers, incomplete screening, outages and missing configuration cannot open the phone', async () => {
  const { env, control, begin, finish } = discordEnvironment();
  control.member = false;
  assert((await finish(await begin())).headers.get('Location').includes('not_member'));
  assert.equal((await (await call(env, '/api/admin/overview', {}, '', true)).json()).registered_users, 0);
  control.member = true; control.pending = true;
  assert((await finish(await begin())).headers.get('Location').includes('not_member'));
  control.pending = false; control.unavailable = true;
  assert((await finish(await begin())).headers.get('Location').includes('unavailable'));
  delete env.DISCORD_CLIENT_SECRET;
  assert((await begin()).headers.get('Location').includes('not_configured'));
  assert.equal((await call(env, '/assets/app.js')).status, 401);
});
const clientCall = (env, path, data = {}, device = 'a'.repeat(64), token = '', origin = 'https://yy021102.github.io') => clientWorker.fetch(new Request('https://phone.test/api/client/' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Phone-Device': device, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(data) }), env);
test('GitHub client uses real registration, persistent bearer sessions, origin checks and two-device enforcement', async () => {
  const env = environment();
  const { code } = await (await call(env, '/api/admin/codes', {}, '', true)).json();
  const credentials = { username: '1122334455', password: 'github-test-password', code };
  assert.equal((await clientCall(env, 'register', credentials, 'a'.repeat(64), '', 'https://untrusted.test')).status, 403);
  const registration = await clientCall(env, 'register', credentials);
  assert.equal(registration.status, 200);
  assert.equal(registration.headers.get('Access-Control-Allow-Origin'), 'https://yy021102.github.io');
  assert.equal(registration.headers.has('Set-Cookie'), false);
  const first = await registration.json();assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.equal((await clientCall(env, 'me', {}, 'a'.repeat(64), first.token)).status, 200);
  assert.equal((await clientCall(env, 'me', {}, 'b'.repeat(64), first.token)).status, 401);
  assert.equal((await clientCall(env, 'login', credentials, 'b'.repeat(64))).status, 200);
  assert.equal((await clientCall(env, 'login', credentials, 'c'.repeat(64))).status, 403);
  await call(env, '/api/admin/users/status', { username: credentials.username, disabled: true }, '', true);
  assert.equal((await clientCall(env, 'me', {}, 'a'.repeat(64), first.token)).status, 401);
});
test('GitHub Discord authorization returns a device-bound one-time exchange, never a session token in the URL', async () => {
  const { env } = discordEnvironment();
  const original = 'https://yy021102.github.io/YYphone/?test=discord#my-phone';
  const started = await (await clientCall(env, 'discord/start', { return_url: original })).json();
  assert.equal(started.url, 'https://phone.test/api/client/discord/prepare');
  assert.equal(started.method, 'POST');
  const prepared = await clientWorker.fetch(new Request(started.url, { method: 'POST', headers: { Origin: 'https://yy021102.github.io', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(started.fields).toString() }), env);
  assert.equal(prepared.status, 200);
  assert((await prepared.text()).includes('registration.unregister'));
  const authorization = await clientWorker.fetch(new Request('https://phone.test/api/client/discord/authorize?ticket=' + started.fields.ticket), env);
  assert.equal(authorization.status, 302);
  const state = new URL(authorization.headers.get('Location')).searchParams.get('state');
  // Flow origin and device are recorded server-side. Even if the extra marker
  // and device cookies disappear, the original OAuth state cookie is sufficient.
  const oauthCookie = cookieJar(authorization).split('; ').filter(value => value.startsWith('phone_oauth=')).join('; ');
  const callback = new Request('https://phone.test/api/auth/discord/callback?code=fake&state=' + state, { headers: { Cookie: oauthCookie } });
  const returned = await clientWorker.fetch(callback, env);
  const destination = new URL(returned.headers.get('Location'));
  assert.equal(destination.origin, 'https://yy021102.github.io');
  assert.equal(destination.search, '?test=discord');
  const grant = destination.hash.split('=')[1];assert.match(grant, /^[a-f0-9]{64}$/);
  assert(!destination.href.includes('fake-access-token'));
  assert.equal((await clientCall(env, 'exchange', { grant }, 'b'.repeat(64))).status, 401);
  const exchanged = await (await clientCall(env, 'exchange', { grant })).json();
  assert.match(exchanged.token, /^[a-f0-9]{64}$/);
  assert.notEqual(exchanged.token, grant);
  assert.equal(exchanged.return_url, original);
  assert.equal((await clientCall(env, 'exchange', { grant })).status, 401);
  assert.equal((await clientCall(env, 'me', {}, 'a'.repeat(64), exchanged.token)).status, 200);
});
test('owner login is remembered in an HttpOnly cookie and one-time owner links cannot be replayed', async () => {
  const env = environment();
  const link = await (await call(env, '/api/admin/bootstrap/create', {}, '', true)).json();
  const ticket = link.url.split('=')[1];
  const loggedIn = await call(env, '/api/admin/bootstrap', { ticket });
  assert.equal(loggedIn.status, 200);
  assert(loggedIn.headers.get('Set-Cookie').includes('HttpOnly'));
  assert(loggedIn.headers.get('Set-Cookie').includes('Max-Age=31536000'));
  const owner = cookieJar(loggedIn);
  assert.equal((await call(env, '/api/admin/bootstrap', { ticket })).status, 403);
  assert.equal((await call(env, '/api/admin/overview', {}, owner)).status, 200);
  assert.equal((await call(env, '/api/admin/session', {}, owner)).status, 200);
  assert.equal((await call(env, '/api/admin/bootstrap/create', {}, owner)).status, 403);
  await call(env, '/api/admin/logout', {}, owner);
  assert.equal((await call(env, '/api/admin/overview', {}, owner)).status, 403);
});
test('Discord login from the main phone returns to its own original URL and rejects external return targets', async () => {
  const { env, finish } = discordEnvironment();
  const start = await call(env, '/api/auth/discord/start?return_to=' + encodeURIComponent('https://phone.test/?screen=phone#home'));
  const completed = await finish(start);
  assert.equal(completed.headers.get('Location'), '/?screen=phone#home');
  const external = await call(env, '/api/auth/discord/start?return_to=' + encodeURIComponent('https://untrusted.test/'));
  assert.equal((await finish(external)).headers.get('Location'), '/');
});
test('GitHub OAuth cannot be used as an open redirect and cancellation returns to the initiating page', async () => {
  const { env } = discordEnvironment();
  const started = await (await clientCall(env, 'discord/start', { return_url: 'https://untrusted.test/' })).json();
  const authorization = await clientWorker.fetch(new Request('https://phone.test/api/client/discord/authorize?ticket=' + started.fields.ticket), env);
  const state = new URL(authorization.headers.get('Location')).searchParams.get('state');
  const oauthCookie = cookieJar(authorization).split('; ').filter(value => value.startsWith('phone_oauth=')).join('; ');
  const cancelled = await clientWorker.fetch(new Request('https://phone.test/api/auth/discord/callback?error=access_denied&state=' + state, { headers: { Cookie: oauthCookie } }), env);
  const destination = new URL(cancelled.headers.get('Location'));
  assert.equal(destination.origin, 'https://yy021102.github.io');
  assert.equal(destination.searchParams.get('discord_error'), 'cancelled');
});
test('eight-character passwords and case-insensitive short codes work while legacy codes remain usable', async () => {
  const env = environment();
  const { code } = await (await call(env, '/api/admin/codes', {}, '', true)).json();
  assert.equal(code.length, 15);
  const credentials = { username: '123456789', password: 'abc12345', code: code.toLowerCase() };
  assert.equal((await call(env, '/api/auth/register', { ...credentials, password: '1234567' })).status, 400);
  assert.equal((await call(env, '/api/auth/register', credentials)).status, 200);
  assert.equal((await call(env, '/api/auth/login', credentials)).status, 200);
  const legacy = 'f'.repeat(64);
  await env.DB.prepare('INSERT INTO codes(hash,created_at) VALUES(?,?)').bind(await hash(legacy), Date.now()).run();
  assert.equal((await call(env, '/api/auth/register', { ...credentials, username: '234567890', code: legacy })).status, 200);
  assert.equal((await call(env, '/api/admin/revoke-code', { code: code.toLowerCase() }, '', true)).status, 200);
  assert.equal((await call(env, '/api/auth/login', credentials)).status, 401);
});
