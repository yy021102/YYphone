export async function loadMusicApi() {
  // Never let a host's shared account become the default for other players.
  delete process.env.NETEASE_COOKIE;
  process.env.ENABLE_GENERAL_UNBLOCK = 'false';
  process.env.ENABLE_PROXY = 'false';
  return (await import('@neteasecloudmusicapienhanced/api')).default;
}
