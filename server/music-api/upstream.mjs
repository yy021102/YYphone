import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const musicCalls = new AsyncLocalStorage();
const originalLog = console.log;
// The SDK logs whole error objects, which can contain account cookies.
console.log = function (...args) {
  if (musicCalls.getStore() === 'startup') return;
  if (musicCalls.getStore() && args[0] === '[ERR]') return;
  originalLog.apply(console, args);
};

// Normal SDK startup: acquire the client encryption configuration and a guest
// session. Never change transport, IP or identity in response to a challenge.
export async function initializeMusicRuntime(api, { directory = tmpdir() } = {}) {
  const deviceFile = join(directory, 'yyphone-music-device.json');
  const keyFile = join(directory, 'xeapi_public_key');
  let previous = {};
  try { previous = JSON.parse(await readFile(deviceFile, 'utf8')); } catch { /* First launch. */ }
  global.deviceId = /^[A-F0-9]{52}$/.test(previous.deviceId || '') ? previous.deviceId : randomBytes(26).toString('hex').toUpperCase();
  await writeFile(deviceFile, JSON.stringify({ deviceId: global.deviceId }), { mode: 0o600 });
  let cachedKey = {};
  try { cachedKey = JSON.parse(await readFile(keyFile, 'utf8')); } catch { /* No previous SDK key. */ }
  const configuration = await api.register_xeapikey({ deviceId: global.deviceId, currentKeyVersion: cachedKey.version || '', timeout: 12000 });
  const key = { ...configuration?.body };
  if (!key.sk && cachedKey.sk) key.sk = cachedKey.sk;
  if (typeof key.sk !== 'string' || !key.sk) throw new Error('Music SDK encryption configuration is unavailable');
  await writeFile(keyFile, JSON.stringify(key), { mode: 0o600 });
  const result = await api.register_anonimous({ cookie: '', timeout: 12000 });
  if (Number(result?.body?.code) !== 200) throw result;
  const allowed = new Set(['MUSIC_A', 'NMTID', '_ntes_nuid', '_ntes_nnid', 'WNMCID', 'WEVNSM']);
  const cookies = (Array.isArray(result.cookie) ? result.cookie : []).flatMap(value => {
    if (typeof value !== 'string') return [];
    const pair = value.split(';', 1)[0];
    const equal = pair.indexOf('=');
    return equal > 0 && allowed.has(pair.slice(0, equal)) ? [pair] : [];
  });
  if (!cookies.some(value => value.startsWith('MUSIC_A=') && value.length > 8)) throw new Error('Music SDK guest session is unavailable');
  // The SDK's guest-registration module sets the device used by later calls.
  await writeFile(deviceFile, JSON.stringify({ deviceId: global.deviceId }), { mode: 0o600 });
  return cookies.join('; ');
}

export function createUpstreamAdapter(api, guestCookie = '', startupError = null) {
  const parameters = params => ({ ...params, cookie: params?.cookie || guestCookie });
  return new Proxy(api, {
    get(target, name) {
      if (startupError && typeof Reflect.get(target, name) === 'function') return async () => { throw startupError; };
      if (name === 'login_qr_check') return params => musicCalls.run(true, async () => {
        // The SDK's QR catch references an out-of-scope variable and hides
        // verification errors. Use the identical endpoint and default options.
        const result = await target.api({ ...parameters(params), uri: '/api/login/qrcode/client/login', data: { key: params.key, type: 3 } });
        return { ...result, body: { ...result.body, cookie: (result.cookie || []).join(';') } };
      });
      const value = Reflect.get(target, name);
      return typeof value === 'function' ? params => musicCalls.run(true, () => value.call(target, parameters(params))) : value;
    },
  });
}

let loading;
let runtimeStatus = { state: 'not-started' };
export const getMusicRuntimeStatus = () => ({ ...runtimeStatus });
export function loadMusicApi() {
  return loading ??= loadInitializedMusicApi();
}
async function loadInitializedMusicApi() {
  runtimeStatus = { state: 'starting' };
  // Never let a host's shared account become the default for other players.
  delete process.env.NETEASE_COOKIE;
  process.env.ENABLE_GENERAL_UNBLOCK = 'false';
  process.env.ENABLE_PROXY = 'false';
  process.env.ENABLE_RANDOM_CN_IP = 'false';
  const api = (await import('@neteasecloudmusicapienhanced/api')).default;
  // The SDK key-registration helper does not apply its query timeout itself.
  const require = createRequire(import.meta.url);
  const sdkRequire = createRequire(require.resolve('@neteasecloudmusicapienhanced/api'));
  const axios = sdkRequire('axios').default;
  axios.defaults.timeout = 12000;
  let guestCookie = '';
  let startupError = null;
  try {
    guestCookie = await musicCalls.run('startup', () => initializeMusicRuntime(api));
    runtimeStatus = { state: 'ready' };
    console.info('[music-startup] ready');
  } catch (error) {
    const code = Number(error?.body?.code ?? error?.status);
    runtimeStatus = { state: code === -462 ? 'verification-required' : 'incomplete', code: Number.isFinite(code) ? code : null };
    console.warn('[music-startup] incomplete', Number.isFinite(code) ? code : 'configuration-or-network');
    if (code === -462) startupError = error;
  }
  return createUpstreamAdapter(api, guestCookie, startupError);
}
