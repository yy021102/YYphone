import { hash, random, cookie, cookies } from './device-session.mjs';
const duration = 365 * 86400000;
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function login(env) {
  const token = random(), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires<=?').bind(now),
    env.DB.prepare('INSERT INTO admin_sessions(hash,expires) VALUES(?,?)').bind(await hash(token), now + duration)
  ]);
  const response = json({ ok: true });response.headers.append('Set-Cookie', cookie('phone_admin', token, duration / 1000));return response;
}
export async function adminAuth(request, env, path, data) {
  if (path === '/api/admin/bootstrap') {
    if (!/^[a-f0-9]{64}$/.test(data.ticket || '')) return json({ error: '登录链接无效。' }, 403);
    const row = await env.DB.prepare('DELETE FROM admin_bootstrap WHERE hash=? AND expires>? RETURNING hash').bind(await hash(data.ticket), Date.now()).first();
    return row ? login(env) : json({ error: '登录链接已使用或过期。' }, 403);
  }
  const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  const root = !!env.ADMIN_TOKEN && !!bearer && await hash(bearer) === await hash(env.ADMIN_TOKEN);
  const token = cookies(request).phone_admin;
  const remembered = /^[a-f0-9]{64}$/.test(token || '') && await env.DB.prepare('SELECT hash FROM admin_sessions WHERE hash=? AND expires>?').bind(await hash(token), Date.now()).first();
  if (!root && !remembered) return json({ error: '请先登录管理后台。' }, 403);
  if (path === '/api/admin/login') return login(env);
  if (path === '/api/admin/session') return json({ ok: true });
  if (path === '/api/admin/logout') {
    if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE hash=?').bind(await hash(token)).run();
    const response = json({ ok: true });response.headers.append('Set-Cookie', cookie('phone_admin', '', 0));return response;
  }
  if (path === '/api/admin/bootstrap/create') {
    // Creating a new owner login link still requires the master secret.
    if (!root) return json({ error: '此操作需要作者管理凭证。' }, 403);
    const ticket = random(), now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM admin_bootstrap WHERE expires<=?').bind(now),
      env.DB.prepare('INSERT INTO admin_bootstrap(hash,expires) VALUES(?,?)').bind(await hash(ticket), now + 30 * 60000)
    ]);
    return json({ url: new URL('/admin', request.url).href + '#owner-login=' + ticket });
  }
  return null;
}
