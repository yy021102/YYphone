import { gate } from './gate.mjs';
import { adminPage } from './admin.mjs';
import { sealCodes, openCodes } from './batches.mjs';
import { userAdmin } from './admin-users.mjs';
import { createSession } from './device-session.mjs';
import { discordRoute, discordReady, discordSessionAllowed } from './discord.mjs';

const encoder = new TextEncoder();
const hex = b => Array.from(new Uint8Array(b), n => n.toString(16).padStart(2, '0')).join('');
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async s => hex(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256));
}
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const cookies = request => Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(x => x.trim().split('=')));
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('请发送 JSON');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('请求为空');
  let size = 0, chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); throw new Error('请求过大'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('请求格式错误');
  return data;
}
async function session(request, env) {
  const c = cookies(request);
  if (!/^[a-f0-9]{64}$/.test(c.phone_session || '') || !/^[a-f0-9]{64}$/.test(c.phone_device || '')) return null;
  const user = await env.DB.prepare('SELECT s.user_id, u.username, s.fingerprint FROM sessions s JOIN users u ON u.id=s.user_id JOIN codes c ON c.hash=u.code_hash JOIN devices d ON d.user_id=s.user_id AND d.fingerprint=s.fingerprint WHERE s.hash=? AND s.fingerprint=? AND s.expires>? AND u.disabled=0 AND c.revoked=0').bind(await hash(c.phone_session), await hash(c.phone_device), Date.now()).first();
  if (user?.username.startsWith('discord:') && !await discordSessionAllowed(env, user.user_id)) return null;
  return user;
}
export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (e) {
      if (String(e.message).includes('DEVICE_LIMIT')) return json({ error: '账号已绑定两个设备，请联系作者处理换机。' }, 403);
      if (String(e.message).includes('UNIQUE constraint failed: users.username')) return json({ error: '这个QQ号已注册，请直接登录。' }, 409);
      return json({ error: '操作未完成，请检查输入或稍后重试。' }, 400);
    }
  }
};
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path === '/admin' || path === '/admin/') return new Response(adminPage, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'"
  } });
  // Replace the previous public PWA worker; retain IndexedDB and user data.
  if (path === '/sw.js') return new Response(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).map(key=>caches.delete(key)));await self.registration.unregister();for(const client of await self.clients.matchAll({type:'window'}))await client.navigate(client.url);})()));`, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' } });
  if (request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin) return json({ error: '来源不允许' }, 403);
  }
  const discordResponse = await discordRoute(request, env);
  if (discordResponse) return discordResponse;
  if (path.startsWith('/api/admin/')) {
    if (!env.ADMIN_TOKEN || !request.headers.get('Authorization')?.startsWith('Bearer ') || await hash(request.headers.get('Authorization').slice(7)) !== await hash(env.ADMIN_TOKEN)) return json({ error: '无权限' }, 403);
    if (request.method !== 'POST') return json({ error: '请使用 POST' }, 405);
    const data = await body(request);
    const usersResponse = await userAdmin(path, data, env, hash);
    if (usersResponse) return usersResponse;
    if (path === '/api/admin/batches/create') {
      const count = data.count ?? 50, label = typeof data.label === 'string' ? data.label.trim() : '';
      if (!Number.isInteger(count) || count < 1 || count > 100 || !label || label.length > 80 || (data.requestId !== undefined && (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)))) return json({ error: '请填写批次备注（最多80字）和1–100之间的整数数量。' }, 400);
      const id = data.requestId || random();
      const existing = await env.DB.prepare('SELECT * FROM code_batches WHERE id=?').bind(id).first();
      if (existing) {
        if (existing.label !== label || existing.count !== count) return json({ error: '重复请求的批次信息不一致，请刷新批次列表。' }, 409);
        return json({ id, label, codes: await openCodes(existing.sealed, env.ADMIN_TOKEN, id) });
      }
      const codes = Array.from({ length: count }, random), now = Date.now();
      const statements = [env.DB.prepare('INSERT INTO code_batches(id,label,count,created_at,sealed) VALUES(?,?,?,?,?)').bind(id, label, count, now, await sealCodes(codes, env.ADMIN_TOKEN, id))];
      const digests = await Promise.all(codes.map(hash));
      // Keep each statement under D1's bind limit and the batch query count small.
      for (let offset = 0; offset < digests.length; offset += 25) {
        const group = digests.slice(offset, offset + 25);
        const placeholders = group.map(() => '(?,?)').join(',');
        statements.push(env.DB.prepare('INSERT INTO codes(hash,created_at) VALUES' + placeholders).bind(...group.flatMap(digest => [digest, now])));
        statements.push(env.DB.prepare('INSERT INTO batch_codes(hash,batch_id) VALUES' + placeholders).bind(...group.flatMap(digest => [digest, id])));
      }
      await env.DB.batch(statements);
      return json({ id, label, codes });
    }
    if (path === '/api/admin/batches/list') {
      const result = await env.DB.prepare('SELECT b.id,b.label,b.count,b.created_at,COUNT(u.id) AS used,SUM(CASE WHEN c.revoked=1 THEN 1 ELSE 0 END) AS revoked,SUM(CASE WHEN c.revoked=0 AND u.id IS NULL THEN 1 ELSE 0 END) AS available FROM code_batches b JOIN batch_codes bc ON bc.batch_id=b.id JOIN codes c ON c.hash=bc.hash LEFT JOIN users u ON u.code_hash=c.hash GROUP BY b.id ORDER BY b.created_at DESC,b.id DESC LIMIT 100').bind().all();
      return json({ batches: result.results });
    }
    if (path === '/api/admin/batches/export' && typeof data.id === 'string') {
      const batch = await env.DB.prepare('SELECT * FROM code_batches WHERE id=?').bind(data.id).first();
      if (!batch) return json({ error: '批次不存在' }, 404);
      const codes = await openCodes(batch.sealed, env.ADMIN_TOKEN, batch.id);
      const result = await env.DB.prepare('SELECT c.hash,c.revoked,u.username FROM batch_codes bc JOIN codes c ON c.hash=bc.hash LEFT JOIN users u ON u.code_hash=c.hash WHERE bc.batch_id=?').bind(batch.id).all();
      const statuses = new Map(result.results.map(row => [row.hash, row]));
      const available = [];
      for (const code of codes) { const status = statuses.get(await hash(code)); if (status && !status.revoked && !status.username) available.push(code); }
      return json({ id: batch.id, label: batch.label, codes, available });
    }
    if (path === '/api/admin/codes') {
      const code = random();
      const digest = await hash(code);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO codes(hash,created_at) VALUES(?,?)').bind(digest, Date.now()),
        env.DB.prepare('INSERT INTO code_secrets(hash,sealed) VALUES(?,?)').bind(digest, await sealCodes([code], env.ADMIN_TOKEN, digest))
      ]);
      return json({ code });
    }
    if (path === '/api/admin/revoke-code' && typeof data.code === 'string') {
      const result = await env.DB.prepare('UPDATE codes SET revoked=1 WHERE hash=?').bind(await hash(data.code.trim())).run();
      return result.meta.changes ? json({ ok: true }) : json({ error: '激活码不存在。' }, 404);
    }
    if (path === '/api/admin/reset-devices' && typeof data.username === 'string') {
      const user = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(data.username.trim()).first();
      if (!user) return json({ error: '用户不存在。' }, 404);
      await env.DB.prepare('DELETE FROM devices WHERE user_id=?').bind(user.id).run();
      return json({ ok: true });
    }
    return json({ error: '接口不存在' }, 404);
  }
  if (path === '/api/auth/register' || path === '/api/auth/login') {
    if (request.method !== 'POST') return json({ error: '请使用 POST' }, 405);
    const key = await hash(request.headers.get('CF-Connecting-IP') || 'local');
    const now = Date.now();
    const rate = await env.DB.prepare('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').bind(key, now + 900000, now, now).first();
    if (rate.count > 15) return json({ error: '尝试过多，请15分钟后重试。' }, 429);
    const data = await body(request);
    const username = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
    if (!/^[1-9][0-9]{4,11}$/.test(username) || typeof data.password !== 'string' || data.password.length < 10 || data.password.length > 128) return json({ error: '请使用QQ号作为登录账号（5–12位数字，不以0开头）；本站密码需10–128位，请勿填写QQ密码。' }, 400);
    let user;
    if (path.endsWith('/register')) {
      if (typeof data.code !== 'string' || !/^[a-f0-9]{64}$/.test(data.code.trim())) return json({ error: '激活码无效' }, 400);
      const salt = random(), id = random();
      const result = await env.DB.prepare('INSERT INTO users(id,username,password,salt,code_hash) SELECT ?,?,?,?,hash FROM codes WHERE hash=? AND revoked=0 AND NOT EXISTS(SELECT 1 FROM users WHERE code_hash=codes.hash)').bind(id, username, await passwordHash(data.password, salt), salt, await hash(data.code.trim())).run();
      if (!result.meta.changes) return json({ error: '激活码无效或已使用' }, 409);
      user = { id };
    } else {
      user = await env.DB.prepare('SELECT u.* FROM users u JOIN codes c ON c.hash=u.code_hash WHERE u.username=? AND u.disabled=0 AND c.revoked=0').bind(username).first();
      const derived = await passwordHash(data.password, user?.salt || 'invalid-account-padding');
      if (!user || derived !== user.password) return json({ error: '账号、密码或授权状态不正确' }, 401);
    }
    const values = await createSession(request, env, user.id, path.endsWith('/register'));
    const response = json({ ok: true });
    for (const value of values) response.headers.append('Set-Cookie', value);
    return response;
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE hash=?').bind(await hash(cookies(request).phone_session || '')).run();
    const response = json({ ok: true }); response.headers.append('Set-Cookie', cookie('phone_session', '', 0)); return response;
  }
  const user = await session(request, env);
  if (path === '/api/auth/me') return user ? json({ username: user.username }) : json({ error: '请登录' }, 401);
  if (path.startsWith('/api/')) return json({ error: '接口不存在' }, 404);
  if (!user) {
    if (request.mode === 'navigate' || path === '/') return new Response(discordReady(env) ? gate.replace('id="discordLogin" hidden', 'id="discordLogin"') : gate, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'" } });
    return json({ error: '请先登录激活' }, 401);
  }
  const asset = await env.ASSETS.fetch(request);
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
