import { AsyncLocalStorage } from 'node:async_hooks';

const musicCalls = new AsyncLocalStorage();
const originalLog = console.log;
// The SDK logs whole error objects, which can contain account cookies.
console.log = function (...args) {
  if (musicCalls.getStore() && args[0] === '[ERR]') return;
  originalLog.apply(console, args);
};

export function createUpstreamAdapter(api) {
  return new Proxy(api, {
    get(target, name) {
      if (name === 'login_qr_check') return params => musicCalls.run(true, async () => {
        // The SDK's QR catch references an out-of-scope variable and hides
        // verification errors. Use the identical endpoint and default options.
        const result = await target.api({ ...params, uri: '/api/login/qrcode/client/login', data: { key: params.key, type: 3 } });
        return { ...result, body: { ...result.body, cookie: (result.cookie || []).join(';') } };
      });
      const value = Reflect.get(target, name);
      return typeof value === 'function' ? params => musicCalls.run(true, () => value.call(target, params)) : value;
    },
  });
}

export async function loadMusicApi() {
  // Never let a host's shared account become the default for other players.
  delete process.env.NETEASE_COOKIE;
  process.env.ENABLE_GENERAL_UNBLOCK = 'false';
  process.env.ENABLE_PROXY = 'false';
  return createUpstreamAdapter((await import('@neteasecloudmusicapienhanced/api')).default);
}
