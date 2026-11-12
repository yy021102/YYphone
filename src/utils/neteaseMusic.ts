import { readStoredValue, writeStoredValue } from './localStorage';

const CONFIG_KEY = 'yyphone:netease-music';
const removedPublicService = (address: string) => address.trim().replace(/\/+$/, '').toLowerCase() === 'https://zm.wwoyun.cn';
export function defaultMusicService(): string {
  const address = import.meta.env?.VITE_NETEASE_API_URL?.trim() || '';
  return address && !removedPublicService(address) ? musicServiceUrl(address) : '';
}
const SESSION_KEY = 'yyphone:netease-session';
export const NETEASE_SESSION_EVENT = 'yyphone:netease-session-change';
export interface NeteaseProfile { userId: number; nickname: string; avatarUrl: string }
export interface NeteaseSong { id: number; name: string; artists: string; cover: string; duration: number }
export interface NeteasePlaylist { id: number; name: string; cover: string; count: number }
interface MusicSession { endpoint: string; cookie: string; profile: NeteaseProfile }
let volatileSession: MusicSession | null = null;
let pendingLogin: { key: string; endpoint: string; cookie: string } | null = null;
export class MusicVerificationError extends Error {
  constructor(public verificationUrl: string) {
    super('网易云要求额外安全验证。请完成验证后，点击继续确认登录。');
    this.name = 'MusicVerificationError';
  }
}
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export function musicServiceUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error('请填写音乐服务的 HTTP(S) 地址。'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('音乐服务地址需为 HTTP(S) 地址，不要附带密码、参数或锚点。');
  }
  if (typeof location !== 'undefined' && location.protocol === 'https:' && url.protocol !== 'https:') {
    throw new Error('当前网页使用 HTTPS，音乐服务也需要使用 HTTPS。');
  }
  return url.href.replace(/\/+$/, '');
}
export function readMusicService(): string {
  const config = readStoredValue(CONFIG_KEY, { endpoint: '' }, (v): v is { endpoint: string } => record(v) && typeof v.endpoint === 'string');
  const raw = [config.endpoint, import.meta.env?.VITE_NETEASE_API_URL?.trim() || ''].find(address => address.trim() && !removedPublicService(address)) || '';
  try { return raw ? musicServiceUrl(raw) : ''; } catch { return raw.trim(); }
}
// Only an explicit personal override belongs in an editable address field.
export function readCustomMusicService(): string {
  const endpoint = readMusicService();
  return endpoint === defaultMusicService() ? '' : endpoint;
}
export function saveMusicService(raw: string) {
  const fallback = defaultMusicService();
  const custom = raw.trim() ? musicServiceUrl(raw) : '';
  if (removedPublicService(custom)) throw new Error('已不再使用此前的公共服务，请填写自建音乐服务地址。');
  const endpoint = custom || fallback;
  if (endpoint !== readMusicService()) clearMusicSession();
  // Saving the displayed default unchanged must still follow future author defaults.
  writeStoredValue(CONFIG_KEY, { endpoint: custom === fallback ? '' : custom });
  return endpoint;
}
export function readMusicSession(): MusicSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (record(data) && typeof data.cookie === 'string' && data.cookie && data.endpoint === readMusicService() && parseProfile(data.profile)) return data as MusicSession;
    }
  } catch { /* Restricted storage: keep this tab's session in memory. */ }
  return volatileSession?.endpoint === readMusicService() ? volatileSession : null;
}
function parseProfile(value: unknown): NeteaseProfile | null {
  if (!record(value) || !Number.isSafeInteger(value.userId) || value.userId <= 0) return null;
  return { userId: value.userId, nickname: typeof value.nickname === 'string' ? value.nickname : '网易云用户', avatarUrl: safeImage(value.avatarUrl) };
}
export function saveMusicSession(endpoint: string, cookie: string, profile: NeteaseProfile) {
  if (endpoint !== readMusicService() || !cookie.trim()) throw new Error('音乐服务已切换，请重新登录。');
  volatileSession = { endpoint, cookie, profile };
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(volatileSession)); } catch { /* Memory fallback. */ }
  window.dispatchEvent(new Event(NETEASE_SESSION_EVENT));
}
export function clearMusicSession() {
  volatileSession = null;
  pendingLogin = null;
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* No session storage. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NETEASE_SESSION_EVENT));
}
// Credentials stay in POST bodies and tab-local sessionStorage, outside device backups / AI context.
export async function musicRequest(path: string, params: Record<string, unknown> = {}, options: { endpoint?: string; cookie?: string; signal?: AbortSignal } = {}): Promise<Record<string, any>> {
  const endpoint = musicServiceUrl(options.endpoint ?? readMusicService());
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(`${endpoint}${path}`, {
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, cookie: options.cookie ?? (readMusicSession()?.endpoint === endpoint ? readMusicSession()?.cookie : '') ?? '', timestamp: Date.now(), noCookie: true }),
    });
    if (response.status === 301 || response.status === 401) throw new Error('网易云登录已失效，请重新扫码。');
    if (response.status === 428) {
      const body = await response.json().catch(() => null);
      let link = '';
      try {
        const url = new URL(body?.verificationUrl);
        if (url.protocol === 'https:' && ['st.music.163.com', 'music.163.com'].includes(url.hostname) && !url.username && !url.password) link = url.href;
      } catch { /* Only official HTTPS verification links are shown. */ }
      if (body?.code === -462) throw new MusicVerificationError(link);
    }
    if (!response.ok) throw new Error(`音乐服务连接失败（HTTP ${response.status}）。`);
    const data: unknown = await response.json();
    if (!record(data)) throw new Error('音乐服务返回了无效数据。');
    if (data.code === 301 || data.code === 401) throw new Error('网易云登录已失效，请重新扫码。');
    if (data.code !== undefined && ![200, 800, 801, 802, 803].includes(Number(data.code))) throw new Error('音乐服务暂时无法完成请求，请稍后再试。');
    return data;
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('已取消', 'AbortError');
    if (controller.signal.aborted) throw new Error('音乐服务响应超时，请稍后重试。');
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('无法连接音乐服务，请检查地址、服务是否启动及跨域设置。');
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export async function createMusicQr(signal: AbortSignal) {
  pendingLogin = null;
  const endpoint = musicServiceUrl(readMusicService());
  const keyResult = await musicRequest('/login/qr/key', {}, { endpoint, cookie: '', signal });
  const key = keyResult.data?.unikey;
  if (typeof key !== 'string' || !key) throw new Error('音乐服务没有返回有效的登录二维码。');
  const result = await musicRequest('/login/qr/create', { key, qrimg: true, platform: 'web' }, { endpoint, cookie: '', signal });
  const image = result.data?.qrimg;
  if (typeof image !== 'string' || !/^data:image\/png;base64,[a-z\d+/=]+$/i.test(image)) throw new Error('音乐服务返回的二维码图片无效。');
  return { key, image, endpoint };
}
export async function checkMusicQr(key: string, endpoint: string, signal: AbortSignal) {
  const previous = pendingLogin?.key === key && pendingLogin.endpoint === endpoint ? pendingLogin : null;
  const result = previous ? { code: 803, cookie: previous.cookie } : await musicRequest('/login/qr/check', { key }, { endpoint, cookie: '', signal });
  const code = Number(result.code);
  if (![800, 801, 802, 803].includes(code)) throw new Error('无法确认扫码状态，请刷新二维码。');
  if (code === 803) {
    if (typeof result.cookie !== 'string' || !result.cookie) throw new Error('登录凭证未返回，请刷新二维码重试。');
    if (!signal.aborted && endpoint === readMusicService()) pendingLogin = { key, endpoint, cookie: result.cookie };
    const status = await musicRequest('/login/status', {}, { endpoint, cookie: result.cookie, signal });
    const profile = parseProfile(status.data?.profile ?? status.profile);
    if (!profile) throw new Error('未能取得网易云账号信息，请重新扫码。');
    if (!signal.aborted) { saveMusicSession(endpoint, result.cookie, profile); pendingLogin = null; }
  }
  return code;
}
export async function musicProfile(signal: AbortSignal) {
  if (!readMusicSession()) return null;
  const result = await musicRequest('/login/status', {}, { signal });
  return parseProfile(result.data?.profile ?? result.profile);
}
export async function musicPlaylists(offset: number, signal: AbortSignal) {
  const session = readMusicSession();
  if (!session) throw new Error('请先登录网易云。');
  const result = await musicRequest('/user/playlist', { uid: session.profile.userId, offset, limit: 30 }, { signal });
  if (!Array.isArray(result.playlist)) throw new Error('未能读取歌单，请刷新重试。');
  const items: NeteasePlaylist[] = result.playlist.flatMap((p: unknown) => record(p) && validId(p.id) ? [{ id: p.id, name: String(p.name ?? '未命名歌单'), cover: safeImage(p.coverImgUrl), count: Math.max(0, Number(p.trackCount) || 0) }] : []);
  return { items, more: result.more === true || (result.more === undefined && items.length === 30) };
}
const validId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;
const safeImage = (url: unknown): string => typeof url === 'string' && /^https?:\/\//i.test(url) ? url.replace(/^http:/i, 'https:') : '';
export function parseMusicSongs(raw: unknown): NeteaseSong[] {
  return Array.isArray(raw) ? raw.flatMap(s => record(s) && validId(s.id) ? [{ id: s.id, name: String(s.name ?? '未命名歌曲'),
    artists: (Array.isArray(s.ar ?? s.artists) ? (s.ar ?? s.artists) : []).map((a: any) => typeof a?.name === 'string' ? a.name : '').filter(Boolean).join(' / '),
    cover: safeImage(s.al?.picUrl ?? s.album?.picUrl), duration: Math.max(0, Number(s.dt ?? s.duration) || 0) / 1000 }] : []) : [];
}
export async function playlistMusic(id: number, offset: number, signal: AbortSignal) {
  const result = await musicRequest('/playlist/track/all', { id, offset, limit: 50 }, { signal });
  if (!Array.isArray(result.songs)) throw new Error('未能读取歌单歌曲，请重试。');
  return parseMusicSongs(result.songs);
}
export async function searchMusic(keywords: string, offset: number, signal: AbortSignal) {
  const result = await musicRequest('/cloudsearch', { keywords: keywords.trim(), type: 1, limit: 30, offset }, { signal });
  if (!record(result.result)) throw new Error('未能取得搜索结果，请重试。');
  const items = parseMusicSongs(result.result.songs);
  return { items, more: offset + items.length < Number(result.result.songCount || 0) };
}
export async function musicSongUrl(id: number, signal: AbortSignal) {
  const result = await musicRequest('/song/url/v1', { id, level: 'standard', unblock: 'false' }, { signal });
  const song = Array.isArray(result.data) ? result.data.find((s: any) => Number(s?.id) === id) : null;
  if (!song?.url || (Number.isFinite(Number(song.code)) && Number(song.code) !== 200)) throw new Error('这首歌暂时无法播放，可能受账号权限或版权限制。');
  // The normal account playback endpoint may return a preview. Do not present it as a full track.
  if (song.freeTrialInfo && song.freeTrialInfo !== 'null') throw new Error('这首歌当前仅提供试听，请在网易云确认账号的播放权限。');
  let url: URL;
  try { url = new URL(song.url); } catch { throw new Error('音乐服务没有返回有效的播放地址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('音乐服务返回的播放地址无效。');
  if (url.protocol === 'http:') url.protocol = 'https:';
  return url.href;
}
