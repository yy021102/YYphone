import { discordReady } from './discord.mjs';
export async function checkDiscordConfiguration(env) {
  const configured = discordReady(env);
  const info = { configured, client_id: env.DISCORD_CLIENT_ID || '', guild_id: env.DISCORD_GUILD_ID || '', redirect_uri: env.DISCORD_REDIRECT_URI || '' };
  if (!configured) return { ...info, credentials_valid: false, reason: 'missing_configuration' };
  const authorization = 'Basic ' + btoa(env.DISCORD_CLIENT_ID + ':' + env.DISCORD_CLIENT_SECRET);
  const call = env.DISCORD_FETCH || fetch;
  try {
    const response = await call('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'identify' }).toString(), signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ...info, credentials_valid: false, discord_status: response.status, reason: ['invalid_client', 'invalid_scope', 'unauthorized_client', 'invalid_request'].includes(data.error) ? data.error : 'discord_rejected' };
    if (typeof data.access_token !== 'string') return { ...info, credentials_valid: false, reason: 'invalid_response' };
    // This temporary app-owner token is only a configuration probe, never a login.
    await call('https://discord.com/api/oauth2/token/revoke', {
      method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: data.access_token, token_type_hint: 'access_token' }).toString(), signal: AbortSignal.timeout(10000)
    }).catch(() => {});
    return { ...info, credentials_valid: true, discord_status: response.status };
  } catch { return { ...info, credentials_valid: false, reason: 'discord_unreachable' }; }
}
