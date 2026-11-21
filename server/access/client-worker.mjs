import accessWorker from './worker.mjs';
import { hash, random, cookie, cookies } from './device-session.mjs';
import { sealCodes, openCodes } from './batches.mjs';
import { discordReady } from './discord.mjs';

const failure = (message, status = 400) => Response.json({ error: message }, { status });
const clearFlow = cookie('phone_client_oauth', '', 0, 'Lax');
const extract = (response, name) => response.headers.get('Set-Cookie')?.match(new RegExp(name + '=([a-f0-9]{64})'))?.[1];
const redirect = (target, values = []) => { const response = new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }); for (const value of values) response.headers.append('Set-Cookie', value); return response; };
function cors(response, origin) {
  const result = new Response(response.body, response);
  result.headers.set('Access-Control-Allow-Origin', origin);
  result.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  result.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Phone-Device');
  result.headers.set('Vary', 'Origin');result.headers.set('Cache-Control', 'no-store');
  return result;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    const origin = request.headers.get('Origin');
    const allowed = env.CLIENT_ALLOWED_ORIGIN || 'https://yy021102.github.io';
    const returnUrl = env.CLIENT_RETURN_URL || 'https://yy021102.github.io/YYphone/';
    if (path === '/api/auth/discord/callback' && cookies(request).phone_client_oauth === '1') {
      try {
        const response = await accessWorker.fetch(request, env);
        const token = extract(response, 'phone_session'), device = extract(response, 'phone_device');
        if (token && device && response.headers.get('Location') === '/') {
          const grant = random(), digest = await hash(grant), now = Date.now();
          await env.DB.batch([
            env.DB.prepare('DELETE FROM client_exchanges WHERE expires<=?').bind(now),
            env.DB.prepare('INSERT INTO client_exchanges(hash,device_hash,sealed_session,expires) VALUES(?,?,?,?)').bind(digest, await hash(device), await sealCodes([token], env.ADMIN_TOKEN, 'client-exchange:' + digest), now + 60000)
          ]);
          return redirect(returnUrl + '#yyphone_access=' + grant, [clearFlow, cookie('phone_oauth', '', 0, 'Lax')]);
        }
        const target = new URL(response.headers.get('Location') || '/', url);
        return redirect(returnUrl + '?discord_error=' + encodeURIComponent(target.searchParams.get('discord_error') || 'unavailable'), [clearFlow, cookie('phone_oauth', '', 0, 'Lax')]);
      } catch { return redirect(returnUrl + '?discord_error=unavailable', [clearFlow]); }
    }
    if (!path.startsWith('/api/client/')) return accessWorker.fetch(request, env);
    // A one-time ticket moves OAuth to a top-level first-party context, where
    // state cookies work even when browsers block third-party cookies.
    if (path === '/api/client/discord/authorize' && request.method === 'GET') {
      try {
        const ticket = url.searchParams.get('ticket');
        if (!/^[a-f0-9]{64}$/.test(ticket || '')) return failure('登录请求已过期，请重新登录。');
        const digest = await hash(ticket);
        const row = await env.DB.prepare('DELETE FROM client_oauth_tickets WHERE hash=? AND expires>? RETURNING sealed_device').bind(digest, Date.now()).first();
        if (!row) return failure('登录请求已过期，请重新登录。');
        const device = (await openCodes(row.sealed_device, env.ADMIN_TOKEN, 'client-ticket:' + digest))[0];
        const headers = new Headers(request.headers); headers.set('Sec-Fetch-Site', 'same-origin');
        const started = await accessWorker.fetch(new Request(url.origin + '/api/auth/discord/start', { headers }), env);
        const response = new Response(started.body, started);
        response.headers.append('Set-Cookie', cookie('phone_device', device, 365 * 86400, 'Lax'));
        response.headers.append('Set-Cookie', cookie('phone_client_oauth', '1', 600, 'Lax'));
        return response;
      } catch { return failure('暂时无法启动 Discord 登录，请稍后重试。', 503); }
    }
    if (origin !== allowed) return failure('来源不允许。', 403);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), allowed);
    if (request.method !== 'POST') return cors(failure('请使用 POST。', 405), allowed);
    try {
      const device = request.headers.get('X-Phone-Device');
      if (!/^[a-f0-9]{64}$/.test(device || '')) return cors(failure('设备凭证无效，请刷新后重试。'), allowed);
      const reader = request.body?.getReader();let size = 0;const chunks = [];
      if (!reader) return cors(failure('请求为空。'), allowed);
      for (;;) { const { done, value } = await reader.read();if (done) break;size += value.length;if (size > 4096) { await reader.cancel();return cors(failure('请求过大。', 413), allowed); }chunks.push(value); }
      const bytes = new Uint8Array(size);let offset = 0;for (const chunk of chunks) { bytes.set(chunk, offset);offset += chunk.length; }
      const text = new TextDecoder().decode(bytes);
      const data = JSON.parse(text);
      if (path === '/api/client/discord/start') {
        if (!discordReady(env)) return cors(failure('Discord 登录尚未配置完成。', 503), allowed);
        const ticket = random(), digest = await hash(ticket), now = Date.now();
        const rateKey = 'client-discord:' + await hash(request.headers.get('CF-Connecting-IP') || 'local');
        const rate = await env.DB.prepare('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').bind(rateKey, now + 900000, now, now).first();
        if (rate.count > 15) return cors(failure('尝试过多，请15分钟后重试。', 429), allowed);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM client_oauth_tickets WHERE expires<=?').bind(now),
          env.DB.prepare('INSERT INTO client_oauth_tickets(hash,sealed_device,expires) VALUES(?,?,?)').bind(digest, await sealCodes([device], env.ADMIN_TOKEN, 'client-ticket:' + digest), now + 60000)
        ]);
        return cors(Response.json({ url: url.origin + '/api/client/discord/authorize?ticket=' + ticket }), allowed);
      }
      if (path === '/api/client/exchange') {
        if (!/^[a-f0-9]{64}$/.test(data.grant || '')) return cors(failure('登录凭证无效。'), allowed);
        const digest = await hash(data.grant);
        const row = await env.DB.prepare('DELETE FROM client_exchanges WHERE hash=? AND device_hash=? AND expires>? RETURNING sealed_session').bind(digest, await hash(device), Date.now()).first();
        if (!row) return cors(failure('登录凭证已过期，请重新登录。', 401), allowed);
        const token = (await openCodes(row.sealed_session, env.ADMIN_TOKEN, 'client-exchange:' + digest))[0];
        return cors(Response.json({ ok: true, token }), allowed);
      }
      const action = path.slice('/api/client/'.length);
      if (!['register', 'login', 'me', 'logout'].includes(action)) return cors(failure('接口不存在。', 404), allowed);
      const headers = new Headers({ 'Content-Type': 'application/json', Origin: url.origin });
      const bearer = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (['me', 'logout'].includes(action) && !bearer) return cors(failure('请先登录。', 401), allowed);
      headers.set('Cookie', 'phone_device=' + device + (bearer ? '; phone_session=' + bearer : ''));
      if (request.headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', request.headers.get('CF-Connecting-IP'));
      if (request.headers.has('User-Agent')) headers.set('User-Agent', request.headers.get('User-Agent'));
      const response = await accessWorker.fetch(new Request(url.origin + '/api/auth/' + action, { method: action === 'me' ? 'GET' : 'POST', headers, ...(action === 'me' ? {} : { body: JSON.stringify(data) }) }), env);
      const result = await response.json();
      if (response.ok && ['register', 'login'].includes(action)) result.token = extract(response, 'phone_session');
      return cors(Response.json(result, { status: response.status }), allowed);
    } catch { return cors(failure('服务暂时不可用，请稍后重试。', 503), allowed); }
  }
};
