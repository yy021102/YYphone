import { hash, random, cookie, cookies, createSession } from './device-session.mjs';
import { sealCodes, openCodes } from './batches.mjs';
const API = 'https://discord.com/api/v10';
export const discordReady = env => /^[0-9]{17,20}$/.test(env.DISCORD_CLIENT_ID || '') && /^[0-9]{17,20}$/.test(env.DISCORD_GUILD_ID || '') && !!env.DISCORD_CLIENT_SECRET && !!env.ADMIN_TOKEN && /^https:\/\//.test(env.DISCORD_REDIRECT_URI || '');
const call = (env, url, options) => (env.DISCORD_FETCH || fetch)(url, { ...options, signal: AbortSignal.timeout(10000) });
const redirect = (target, extra = []) => { const response = new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }); for (const value of extra) response.headers.append('Set-Cookie', value); return response; };
const failure = (reason, target = '/') => { const url = new URL(target, 'https://local.invalid');url.searchParams.set('discord_error', reason);return redirect(url.pathname + url.search + url.hash, [cookie('phone_oauth', '', 0, 'Lax')]); };
function localReturn(value, origin) {
  try { const url = new URL(value);if (url.origin === origin && !url.username && !url.password && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/admin')) { url.searchParams.delete('discord_error');return url.pathname + url.search + url.hash; } } catch { /* Default to this site's root. */ }
  return '/';
}
export async function guildMember(env, token, expectedId) {
  const response = await call(env, `${API}/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, { headers: { Authorization: 'Bearer ' + token } });
  if (response.status === 404 || response.status === 403 || response.status === 401) return false;
  if (!response.ok) throw new Error('Discord membership service unavailable');
  const member = await response.json();
  // Members still completing server membership screening are not admitted yet.
  return member && typeof member === 'object' && typeof member.user?.id === 'string' && (!expectedId || member.user.id === expectedId) && !member.pending;
}
export async function discordSessionAllowed(env, userId) {
  if (!discordReady(env)) return false;
  const account = await env.DB.prepare('SELECT * FROM discord_accounts WHERE user_id=?').bind(userId).first();
  const now = Date.now();
  if (!account || account.guild_id !== env.DISCORD_GUILD_ID || !account.member || account.token_expires <= now) return false;
  if (account.checked_at > now - 15 * 60000) return true;
  const token = (await openCodes(account.sealed_token, env.ADMIN_TOKEN, 'discord-token:' + account.discord_id))[0];
  if (!await guildMember(env, token, account.discord_id)) {
    await env.DB.batch([
      env.DB.prepare('UPDATE discord_accounts SET member=0,checked_at=? WHERE user_id=?').bind(now, userId),
      env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId)
    ]);
    return false;
  }
  await env.DB.prepare('UPDATE discord_accounts SET checked_at=? WHERE user_id=?').bind(now, userId).run();
  return true;
}
export async function discordRoute(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (!path.startsWith('/api/auth/discord/')) return null;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!discordReady(env)) return failure('not_configured');
  // Bind OAuth to the configured production origin; preview aliases cannot mint sessions.
  if (new URL(env.DISCORD_REDIRECT_URI).origin !== url.origin) return failure('wrong_origin');
  if (path === '/api/auth/discord/start') {
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return failure('state');
    const state = random(), browser = random(), now = Date.now();
    const target = localReturn(url.searchParams.get('return_to') || request.headers.get('Referer'), url.origin);
    const rateKey = 'discord:' + await hash(request.headers.get('CF-Connecting-IP') || 'local');
    const rate = await env.DB.prepare('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').bind(rateKey, now + 900000, now, now).first();
    if (rate.count > 15) return new Response('Discord 登录尝试过多，请15分钟后重试。', { status: 429, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
    await env.DB.batch([
      env.DB.prepare('DELETE FROM oauth_states WHERE expires<=?').bind(now),
      env.DB.prepare('INSERT INTO oauth_states(hash,browser_hash,expires) VALUES(?,?,?)').bind(await hash(state), await hash(browser), now + 10 * 60000),
      env.DB.prepare('DELETE FROM oauth_return_targets WHERE expires<=?').bind(now),
      env.DB.prepare('INSERT INTO oauth_return_targets(state_hash,return_url,expires) VALUES(?,?,?)').bind(await hash(state), target, now + 10 * 60000)
    ]);
    const authorize = new URL('https://discord.com/oauth2/authorize');
    authorize.search = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, response_type: 'code', redirect_uri: env.DISCORD_REDIRECT_URI, scope: 'identify guilds.members.read', state }).toString();
    return redirect(authorize.href, [cookie('phone_oauth', browser, 600, 'Lax')]);
  }
  if (path !== '/api/auth/discord/callback') return new Response('Not found', { status: 404 });
  const state = url.searchParams.get('state'), browser = cookies(request).phone_oauth;
  const savedTarget = /^[a-f0-9]{64}$/.test(state || '') ? await env.DB.prepare('SELECT return_url FROM oauth_return_targets WHERE state_hash=? AND expires>?').bind(await hash(state), Date.now()).first() : null;
  const returnTo = savedTarget?.return_url || '/';
  const fail = reason => failure(reason, returnTo);
  if (!/^[a-f0-9]{64}$/.test(state || '') || !/^[a-f0-9]{64}$/.test(browser || '')) return fail('state');
  const verified = await env.DB.prepare('DELETE FROM oauth_states WHERE hash=? AND browser_hash=? AND expires>? RETURNING hash').bind(await hash(state), await hash(browser), Date.now()).first();
  if (!verified) return fail('state');
  if (url.searchParams.has('error')) return fail('cancelled');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) return fail('authorization');
  try {
    const response = await call(env, 'https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: env.DISCORD_REDIRECT_URI }).toString() });
    if (!response.ok) return fail('authorization');
    const token = await response.json(), scopes = (token.scope || '').split(' ');
    if (typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in) || token.expires_in <= 0 || !scopes.includes('identify') || !scopes.includes('guilds.members.read')) return fail('authorization');
    const profileResponse = await call(env, API + '/users/@me', { headers: { Authorization: 'Bearer ' + token.access_token } });
    if (!profileResponse.ok) return fail('authorization');
    const profile = await profileResponse.json();
    if (!/^[0-9]{17,20}$/.test(profile.id || '') || profile.bot) return fail('authorization');
    if (!await guildMember(env, token.access_token, profile.id)) return fail('not_member');
    const username = 'discord:' + profile.id, grant = username, now = Date.now();
    const expires = now + Math.min(token.expires_in * 1000, 7 * 86400000);
    const sealed = await sealCodes([token.access_token], env.ADMIN_TOKEN, 'discord-token:' + profile.id);
    // Internal membership grants are excluded from activation-code totals and exports.
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO codes(hash,created_at) VALUES(?,?)').bind(grant, now),
      env.DB.prepare('INSERT OR IGNORE INTO users(id,username,password,salt,code_hash) VALUES(?,?,?,?,?)').bind(random(), username, random(), random(), grant)
    ]);
    const user = await env.DB.prepare('SELECT id,disabled FROM users WHERE username=?').bind(username).first();
    if (!user || user.disabled) return fail('banned');
    await env.DB.prepare('INSERT INTO discord_accounts(user_id,discord_id,display_name,guild_id,sealed_token,token_expires,checked_at,member) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,guild_id=excluded.guild_id,sealed_token=excluded.sealed_token,token_expires=excluded.token_expires,checked_at=excluded.checked_at,member=1').bind(user.id, profile.id, String(profile.global_name || profile.username || profile.id).slice(0,80), env.DISCORD_GUILD_ID, sealed, expires, now).run();
    const metadata = await env.DB.prepare('SELECT registered_at FROM user_metadata WHERE user_id=?').bind(user.id).first();
    const sessionCookies = await createSession(request, env, user.id, !metadata, expires);
    return redirect(returnTo, [...sessionCookies, cookie('phone_oauth', '', 0, 'Lax')]);
  } catch (error) {
    return fail(String(error.message).includes('DEVICE_LIMIT') ? 'device_limit' : 'unavailable');
  }
}
