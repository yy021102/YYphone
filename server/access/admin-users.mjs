import { openCodes } from './batches.mjs';
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

async function includeCodes(users, env, hash) {
  const batches = new Map();
  for (const user of users) {
    user.code = null;
    if (user.provider === 'discord') { delete user.code_hash; continue; }
    if (user.batch_id) {
      if (!batches.has(user.batch_id)) {
        const batch = await env.DB.prepare('SELECT sealed FROM code_batches WHERE id=?').bind(user.batch_id).first();
        const codes = await openCodes(batch.sealed, env.ADMIN_TOKEN, user.batch_id);
        batches.set(user.batch_id, new Map(await Promise.all(codes.map(async code => [await hash(code), code]))));
      }
      user.code = batches.get(user.batch_id).get(user.code_hash) || null;
    } else {
      const secret = await env.DB.prepare('SELECT sealed FROM code_secrets WHERE hash=?').bind(user.code_hash).first();
      if (secret) user.code = (await openCodes(secret.sealed, env.ADMIN_TOKEN, user.code_hash))[0];
    }
    delete user.code_hash;
  }
  return users;
}
const userSelect = `SELECT u.id,u.username,u.disabled,u.code_hash,c.revoked,m.registered_at,m.last_login,bc.batch_id,b.label AS batch_label,
  CASE WHEN da.user_id IS NULL THEN 'qq' ELSE 'discord' END AS provider,da.discord_id,da.display_name,da.member AS discord_member,da.checked_at AS member_checked_at,
  (SELECT COUNT(*) FROM devices d WHERE d.user_id=u.id) AS device_count
  FROM users u JOIN codes c ON c.hash=u.code_hash LEFT JOIN user_metadata m ON m.user_id=u.id
  LEFT JOIN batch_codes bc ON bc.hash=u.code_hash LEFT JOIN code_batches b ON b.id=bc.batch_id LEFT JOIN discord_accounts da ON da.user_id=u.id`;

export async function userAdmin(path, data, env, hash) {
  if (path === '/api/admin/overview') {
    const codes = await env.DB.prepare(`SELECT COUNT(*) AS total_codes,
      COALESCE(SUM(CASE WHEN u.id IS NULL AND c.revoked=0 THEN 1 ELSE 0 END),0) AS unused_codes,
      COUNT(u.id) AS redeemed_codes,
      COALESCE(SUM(CASE WHEN c.revoked=1 THEN 1 ELSE 0 END),0) AS revoked_codes
      FROM codes c LEFT JOIN users u ON u.code_hash=c.hash WHERE c.hash NOT LIKE 'discord:%'`).bind().first();
    const users = await env.DB.prepare(`SELECT COUNT(*) AS registered_users,
      COALESCE(SUM(CASE WHEN disabled=1 THEN 1 ELSE 0 END),0) AS banned_users,
      (SELECT COUNT(*) FROM discord_accounts) AS discord_users FROM users`).bind().first();
    return json({ ...codes, ...users });
  }
  if (path === '/api/admin/users/list') {
    const query = typeof data.query === 'string' ? data.query.trim() : '';
    const status = data.status || 'all', page = data.page ?? 1, provider = data.provider || 'all';
    if (!/^[\p{L}\p{N} ._:-]{0,80}$/u.test(query) || !['all', 'active', 'banned', 'revoked', 'not_member'].includes(status) || !['all','qq','discord'].includes(provider) || !Number.isInteger(page) || page < 1 || page > 100000) return json({ error: '请检查账号筛选或页码。' }, 400);
    const where = " WHERE (instr(u.username,?)>0 OR instr(lower(COALESCE(da.display_name,'')),lower(?))>0)" + ({ all: '', active: ' AND u.disabled=0 AND c.revoked=0 AND (da.user_id IS NULL OR da.member=1)', banned: ' AND u.disabled=1', revoked: ' AND c.revoked=1', not_member: ' AND da.member=0' }[status]) + ({all:'',qq:' AND da.user_id IS NULL',discord:' AND da.user_id IS NOT NULL'}[provider]);
    const total = await env.DB.prepare('SELECT COUNT(*) AS count FROM users u JOIN codes c ON c.hash=u.code_hash LEFT JOIN discord_accounts da ON da.user_id=u.id' + where).bind(query,query).first();
    const result = await env.DB.prepare(userSelect + where + ' ORDER BY m.registered_at DESC,u.id DESC LIMIT 25 OFFSET ?').bind(query,query, (page - 1) * 25).all();
    return json({ users: await includeCodes(result.results, env, hash), total: total.count, page, page_size: 25 });
  }
  if (path === '/api/admin/users/detail' && typeof data.username === 'string') {
    const user = await env.DB.prepare(userSelect + ' WHERE u.username=?').bind(data.username.trim()).first();
    if (!user) return json({ error: '未找到这个账号对应的用户。' }, 404);
    const devices = await env.DB.prepare('SELECT d.fingerprint,d.created_at,i.label,i.last_login FROM devices d LEFT JOIN device_info i ON i.user_id=d.user_id AND i.fingerprint=d.fingerprint WHERE d.user_id=? ORDER BY d.created_at').bind(user.id).all();
    return json({ user: (await includeCodes([user], env, hash))[0], devices: devices.results });
  }
  if (path === '/api/admin/users/status' && typeof data.username === 'string' && typeof data.disabled === 'boolean') {
    const user = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(data.username.trim()).first();
    if (!user) return json({ error: '用户不存在。' }, 404);
    const statements = [env.DB.prepare('UPDATE users SET disabled=? WHERE id=?').bind(data.disabled ? 1 : 0, user.id)];
    // Ban invalidates sessions permanently; unbanning requires a fresh login.
    if (data.disabled) statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id));
    await env.DB.batch(statements);
    return json({ ok: true });
  }
  if (path === '/api/admin/users/unbind-device' && typeof data.username === 'string' && typeof data.fingerprint === 'string') {
    const result = await env.DB.prepare('DELETE FROM devices WHERE user_id=(SELECT id FROM users WHERE username=?) AND fingerprint=?').bind(data.username.trim(), data.fingerprint).run();
    return result.meta.changes ? json({ ok: true }) : json({ error: '设备不存在或已解绑。' }, 404);
  }
  return null;
}
