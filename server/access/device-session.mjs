const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export const cookies = request => Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(part => part.trim().split('=')));
export const cookie = (name, value, age, sameSite = 'Strict') => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${age}`;
export async function createSession(request, env, userId, registered = false, expires = Date.now() + 7 * 86400000) {
  const now = Date.now(), old = cookies(request).phone_device;
  const device = /^[a-f0-9]{64}$/.test(old || '') ? old : random();
  const fingerprint = await hash(device), token = random(), agent = request.headers.get('User-Agent') || '';
  const platform = /iPhone|iPad/i.test(agent) ? 'iOS' : /Android/i.test(agent) ? 'Android' : /Windows/i.test(agent) ? 'Windows' : /Mac/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : '未知系统';
  const browser = /Edg/i.test(agent) ? 'Edge' : /MicroMessenger/i.test(agent) ? '微信' : /Chrome|CriOS/i.test(agent) ? 'Chrome' : /Firefox|FxiOS/i.test(agent) ? 'Firefox' : /Safari/i.test(agent) ? 'Safari' : '浏览器';
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO devices(user_id,fingerprint,created_at) VALUES(?,?,?)').bind(userId, fingerprint, now),
    env.DB.prepare('INSERT INTO user_metadata(user_id,registered_at,last_login) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_login=excluded.last_login').bind(userId, registered ? now : null, now),
    env.DB.prepare('INSERT INTO device_info(user_id,fingerprint,label,last_login) VALUES(?,?,?,?) ON CONFLICT(user_id,fingerprint) DO UPDATE SET label=excluded.label,last_login=excluded.last_login').bind(userId, fingerprint, platform + ' · ' + browser, now),
    env.DB.prepare('DELETE FROM sessions WHERE (user_id=? AND fingerprint=?) OR expires<=?').bind(userId, fingerprint, now),
    env.DB.prepare('INSERT INTO sessions(hash,user_id,fingerprint,expires) VALUES(?,?,?,?)').bind(await hash(token), userId, fingerprint, expires)
  ]);
  // Lax lets the first redirect after Discord OAuth carry the new login cookie.
  // Mutating routes also require an exact same-origin Origin header.
  return [cookie('phone_device', device, 365 * 86400, 'Lax'), cookie('phone_session', token, Math.max(0, Math.floor((expires - now) / 1000)), 'Lax')];
}
