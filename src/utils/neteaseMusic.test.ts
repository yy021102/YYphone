import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { clearDbStorage, getAllCachedStorageItems } from './dbStorage';
import { readStoredValue, readStorageString, writeStoredValue } from './localStorage';
import { checkMusicQr, clearMusicSession, createMusicQr, musicPlaylists, musicRequest, musicServiceUrl, musicSongUrl, parseMusicSongs, playlistMusic, readMusicService, readMusicSession, saveMusicService, saveMusicSession, searchMusic } from './neteaseMusic';
import { musicPlayer } from './musicPlayer';
import { MusicVerificationError } from './neteaseMusic';
import { isPersonaRecordKey } from './personaStorage';
import { buildListenTogetherContext, isMusicSettings, isMusicTrackList, MUSIC_PLAYBACK_KEY, MUSIC_SETTINGS_KEY, MUSIC_TRACKS_KEY, type MusicTrack } from './musicPlayback';

const local = new Map<string, string>(), session = new Map<string, string>();
const storage = (data: Map<string, string>) => ({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k), clear: () => data.clear(), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size; } });
const target = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(target, { localStorage: storage(local), sessionStorage: storage(session), setTimeout, clearTimeout }) });
class FakeAudio extends EventTarget {
  static current: FakeAudio;
  src = ''; preload = ''; paused = true; ended = false; duration = 60; currentTime = 0;
  constructor() { super(); FakeAudio.current = this; }
  async play() { this.paused = false; this.dispatchEvent(new Event('play')); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); } }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  load() {}
}
Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
const profile = { userId: 123, nickname: '小月亮', avatarUrl: '' };
const tracks = () => readStoredValue<MusicTrack[]>(MUSIC_TRACKS_KEY, [], isMusicTrackList);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(async () => {
  for (const t of tracks()) musicPlayer.removeTrack(t.id);
  clearMusicSession(); local.clear(); session.clear(); await clearDbStorage(); saveMusicService('https://music.invalid');
  musicPlayer.setPlaybackMode('list');
});
afterEach(() => mock.restoreAll());

test('custom song metadata persists and only the current shared song description enters character context', async () => {
  const a = musicPlayer.addUrlTrack('https://audio.invalid/a.mp3', ' 雨后的窗 ', { artists: ' 小月亮 ', mood: ' 轻柔钢琴，安静的陪伴 ' });
  const b = musicPlayer.addUrlTrack('https://audio.invalid/b.mp3', '清晨', { artists: '另一个歌手', mood: '轻快明亮' });
  assert.equal(tracks()[0].artists, '小月亮'); assert.equal(tracks()[0].mood, '轻柔钢琴，安静的陪伴');
  musicPlayer.setCompanion('a'); musicPlayer.setTogetherEnabled(true); musicPlayer.selectTrack(a.id); await tick();
  const context = buildListenTogetherContext(['a'], () => '林渡')!;
  assert.match(context, /小月亮/); assert.match(context, /轻柔钢琴/); assert(!context.includes('轻快明亮')); assert(!context.includes('audio.invalid'));
  assert.equal(buildListenTogetherContext(['b'], () => '别人'), null);
  musicPlayer.updateTrackDetails(a.id, { title: '夜雨', artists: '新歌手', mood: '慢一点，柔和一点' });
  const updated = buildListenTogetherContext(['a'], () => '林渡')!;
  assert.match(updated, /夜雨/); assert.match(updated, /新歌手/); assert.match(updated, /慢一点/); assert(!updated.includes('轻柔钢琴'));
  await musicPlayer.togglePlay(); assert.equal(buildListenTogetherContext(['a'], () => '林渡'), null);
  musicPlayer.selectTrack(b.id); await tick();
  const switched = buildListenTogetherContext(['a'], () => '林渡')!;
  assert.match(switched, /轻快明亮/); assert(!switched.includes('慢一点'));
  musicPlayer.updateTrackDetails(b.id, { title: '清晨', artists: '', mood: '' });
  assert(!buildListenTogetherContext(['a'], () => '林渡')!.includes('轻快明亮'));
});

test('play modes persist, single repeat retains the song, and manual skips still change songs', async () => {
  const a = musicPlayer.addUrlTrack('https://audio.invalid/a.mp3', 'A');
  const b = musicPlayer.addUrlTrack('https://audio.invalid/b.mp3', 'B');
  const c = musicPlayer.addUrlTrack('https://audio.invalid/c.mp3', 'C');
  musicPlayer.selectTrack(a.id); await tick();
  musicPlayer.setPlaybackMode('single');
  FakeAudio.current.currentTime = 60;
  FakeAudio.current.dispatchEvent(new Event('ended')); await tick();
  assert.equal(FakeAudio.current.src, a.url);
  assert.equal(FakeAudio.current.currentTime, 0);
  assert.equal(readStoredValue(MUSIC_SETTINGS_KEY, null, isMusicSettings)?.playbackMode, 'single');
  musicPlayer.next(); await tick(); assert.equal(FakeAudio.current.src, b.url);
  musicPlayer.previous(); await tick(); assert.equal(FakeAudio.current.src, a.url);
  musicPlayer.setPlaybackMode('list');
  musicPlayer.previous(); await tick(); assert.equal(FakeAudio.current.src, c.url);
  FakeAudio.current.dispatchEvent(new Event('ended')); await tick(); assert.equal(FakeAudio.current.src, a.url);
  musicPlayer.setPlaybackMode('shuffle');
  for (let i = 0; i < 5; i++) {
    const before = FakeAudio.current.src;
    FakeAudio.current.dispatchEvent(new Event('ended')); await tick();
    assert.notEqual(FakeAudio.current.src, before);
  }
  assert.equal(readStoredValue(MUSIC_SETTINGS_KEY, null, isMusicSettings)?.playbackMode, 'shuffle');
});

test('verification has an official link and profile retry retains the authorized cookie only in memory', async () => {
  let polls = 0, profiles = 0;
  mock.method(globalThis, 'fetch', async (url: any, init: RequestInit) => {
    if (String(url).endsWith('/login/qr/check')) {
      polls++;
      return Response.json({ code: 803, cookie: 'MUSIC_U=pending' });
    }
    assert.equal(JSON.parse(String(init.body)).cookie, 'MUSIC_U=pending');
    profiles++;
    return profiles === 1 ? Response.json({ code: -462, verificationUrl: 'https://st.music.163.com/encrypt-pages?test=1' }, { status: 428 }) : Response.json({ data: { profile } });
  });
  const signal = new AbortController().signal;
  await assert.rejects(checkMusicQr('pending-key', readMusicService(), signal), e => e instanceof MusicVerificationError && e.verificationUrl.startsWith('https://st.music.163.com/'));
  assert.equal(readMusicSession(), null);
  assert(!JSON.stringify(getAllCachedStorageItems()).includes('MUSIC_U'));
  assert(!JSON.stringify([...session]).includes('MUSIC_U'));
  assert.equal(await checkMusicQr('pending-key', readMusicService(), signal), 803);
  assert.equal(polls, 1);
  assert.equal(profiles, 2);
  assert.equal(readMusicSession()?.cookie, 'MUSIC_U=pending');
});

test('verification responses cannot supply an arbitrary navigation link', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ code: -462, verificationUrl: 'https://evil.invalid/' }, { status: 428 }));
  await assert.rejects(musicRequest('/login/qr/check'), e => e instanceof MusicVerificationError && e.verificationUrl === '');
});

test('no public fallback is contacted; custom services and clearing configuration isolate previous login', async () => {
  await clearDbStorage();
  assert.equal(readMusicService(), '');
  writeStoredValue('yyphone:netease-music', { endpoint: 'https://zm.wwoyun.cn/' });
  assert.equal(readMusicService(), '', 'old public configuration must not keep contacting the retired default');
  assert.throws(() => saveMusicService('https://zm.wwoyun.cn'), /自建/);
  assert.equal(isPersonaRecordKey('yyphone:netease-music'), false);
  assert.equal(saveMusicService(''), '');
  assert.deepEqual(JSON.parse(readStorageString('yyphone:netease-music')!), { endpoint: '' });
  saveMusicService('https://previous.invalid');
  saveMusicSession(readMusicService(), 'previous-session', profile);
  assert.equal(saveMusicService('https://own.invalid/api/'), 'https://own.invalid/api');
  assert.equal(readMusicService(), 'https://own.invalid/api'); assert.equal(readMusicSession(), null);
  saveMusicSession(readMusicService(), 'own-session', profile);
  assert.equal(saveMusicService(''), '');
  assert.equal(readMusicSession(), null); assert.deepEqual(JSON.parse(readStorageString('yyphone:netease-music')!), { endpoint: '' });
  let called = false;
  mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    called = true; assert.equal(String(url), 'https://new.invalid/login/qr/key');
    assert.equal(JSON.parse(String(init.body)).cookie, '', 'previous service cookie cannot reach another host');
    return Response.json({ code: 200, data: { unikey: 'anonymous-key' } });
  });
  await assert.rejects(musicRequest('/login/qr/key'), /填写/); assert.equal(called, false);
  saveMusicService('https://new.invalid');
  await musicRequest('/login/qr/key'); assert(called);
});

test('service normalization and tab-only credentials keep login out of device backup and clear it when service changes', () => {
  assert.equal(musicServiceUrl(' https://music.invalid/api/// '), 'https://music.invalid/api');
  for (const bad of ['music.invalid', 'javascript:alert(1)', 'https://user:pass@music.invalid', 'https://music.invalid?cookie=secret']) assert.throws(() => musicServiceUrl(bad));
  saveMusicSession(readMusicService(), 'MUSIC_U=private', profile);
  assert.equal(readMusicSession()?.profile.nickname, '小月亮');
  assert(!JSON.stringify(getAllCachedStorageItems()).includes('MUSIC_U'));
  assert(!JSON.stringify([...local]).includes('MUSIC_U'));
  assert(JSON.stringify([...session]).includes('MUSIC_U'));
  saveMusicService('https://other.invalid'); assert.equal(readMusicSession(), null);
});

test('real QR response shapes pass through waiting, scanned and authorized, with explicit POST cookie and no credential URLs', async () => {
  const codes = [801, 802, 803]; let checks = 0;
  mock.method(globalThis, 'fetch', async (raw: any, init: RequestInit) => {
    const url = new URL(raw), body = JSON.parse(String(init.body));
    assert.equal(init.method, 'POST'); assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store'); assert.equal(url.search, ''); assert.equal(body.noCookie, true);
    if (url.pathname === '/login/qr/key') return Response.json({ code: 200, data: { unikey: 'qr-key' } });
    if (url.pathname === '/login/qr/create') { assert.equal(body.platform, 'web'); return Response.json({ code: 200, data: { qrimg: 'data:image/png;base64,YQ==' } }); }
    if (url.pathname === '/login/qr/check') { assert.equal(body.cookie, ''); return Response.json({ code: codes[checks++], cookie: checks === 3 ? 'MUSIC_U=account' : '' }); }
    assert.equal(url.pathname, '/login/status'); assert.equal(body.cookie, 'MUSIC_U=account'); return Response.json({ data: { code: 200, profile } });
  });
  const signal = new AbortController().signal, qr = await createMusicQr(signal);
  assert.equal(qr.key, 'qr-key');
  assert.equal(await checkMusicQr(qr.key, qr.endpoint, signal), 801); assert.equal(readMusicSession(), null);
  assert.equal(await checkMusicQr(qr.key, qr.endpoint, signal), 802); assert.equal(readMusicSession(), null);
  assert.equal(await checkMusicQr(qr.key, qr.endpoint, signal), 803); assert.equal(readMusicSession()?.cookie, 'MUSIC_U=account');
});

test('canceling authorization or changing service cannot save a late login', async () => {
  let complete: (v: Response) => void;
  mock.method(globalThis, 'fetch', async (url: any) => String(url).endsWith('/login/qr/check') ? Response.json({ code: 803, cookie: 'private' }) : new Promise<Response>(r => { complete = r; }));
  const controller = new AbortController(); const pending = checkMusicQr('key', readMusicService(), controller.signal);
  await tick(); controller.abort(); complete!(Response.json({ data: { profile } }));
  await pending; assert.equal(readMusicSession(), null);
  assert.throws(() => saveMusicSession('https://old.invalid', 'private', profile), /服务已切换/);
});

test('playlists, songs and search paginate and normalize actual service structures', async () => {
  saveMusicSession(readMusicService(), 'private-cookie', profile);
  mock.method(globalThis, 'fetch', async (url: any, init: RequestInit) => {
    const b = JSON.parse(String(init.body)); assert.equal(b.cookie, 'private-cookie');
    if (String(url).endsWith('/user/playlist')) { assert.equal(b.offset, 30); assert.equal(b.uid, 123); return Response.json({ code: 200, more: true, playlist: [{ id: 1, name: '月亮歌单', coverImgUrl: 'http://p1.music.126.net/a.jpg', trackCount: 80 }] }); }
    if (String(url).endsWith('/playlist/track/all')) { assert.equal(b.id, 1); assert.equal(b.offset, 50); return Response.json({ code: 200, songs: [{ id: 7, name: '夜航', ar: [{ name: '歌手' }], al: { picUrl: 'https://p1.music.126.net/a.jpg' }, dt: 180000 }] }); }
    assert.equal(b.keywords, '夜航'); assert.equal(b.offset, 0); return Response.json({ code: 200, result: { songCount: 80, songs: [{ id: 7, name: '夜航', artists: [{ name: '歌手' }], duration: 180000 }] } });
  });
  const signal = new AbortController().signal;
  const p = await musicPlaylists(30, signal); assert.equal(p.items[0].cover, 'https://p1.music.126.net/a.jpg'); assert.equal(p.more, true);
  const s = await playlistMusic(1, 50, signal); assert.equal(s[0].artists, '歌手'); assert.equal(s[0].duration, 180);
  const search = await searchMusic(' 夜航 ', 0, signal); assert.equal(search.more, true); assert.equal(search.items[0].id, 7);
  assert.deepEqual(parseMusicSongs([{ id: -1 }, { id: 'bad' }, null]), []);
});

test('normal-account song URLs respect unavailable and preview restrictions and do not enable unlocking', async () => {
  let item: any = { id: 7, url: 'http://m7.music.126.net/song.mp3', code: 200 };
  mock.method(globalThis, 'fetch', async (_: any, init: RequestInit) => {
    const b = JSON.parse(String(init.body)); assert.equal(b.unblock, 'false'); assert.equal(b.level, 'standard');
    return Response.json({ code: 200, data: [item] });
  });
  const signal = new AbortController().signal;
  assert.equal(await musicSongUrl(7, signal), 'https://m7.music.126.net/song.mp3');
  item = { ...item, freeTrialInfo: { start: 0, end: 30 } }; await assert.rejects(musicSongUrl(7, signal), /仅提供试听/);
  item = { id: 7, url: null, code: 404 }; await assert.rejects(musicSongUrl(7, signal), /无法播放/);
  item = { id: 7, url: 'javascript:alert(1)', code: 200 }; await assert.rejects(musicSongUrl(7, signal), /地址无效/);
});

test('connection errors do not echo upstream secrets and expired sessions are recognizable', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('private-cookie', { status: 502 }));
  await assert.rejects(musicRequest('/login/status'), e => e instanceof Error && /HTTP 502/.test(e.message) && !e.message.includes('private-cookie'));
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => new Response('private-cookie', { status: 401 }));
  await assert.rejects(musicRequest('/login/status'), /重新扫码/);
  mock.restoreAll(); mock.method(globalThis, 'fetch', async () => new Response('<html>private-cookie</html>'));
  await assert.rejects(musicRequest('/login/status'), /跨域设置/);
});

test('rapid switching ignores stale song responses, keeps provider metadata and logs no cookies in listening context', async () => {
  saveMusicSession(readMusicService(), 'MUSIC_U=DO_NOT_INJECT', profile);
  const pending = new Map<number, (v: Response) => void>();
  mock.method(globalThis, 'fetch', async (_: any, init: RequestInit) => {
    const b = JSON.parse(String(init.body)); return new Promise<Response>(r => pending.set(b.id, r));
  });
  const [a, b] = musicPlayer.addNeteaseTracks([{ id: 1, name: '夜航', artists: '歌手一', cover: '', duration: 60 }, { id: 2, name: '月光', artists: '歌手二', cover: '', duration: 60 }]);
  musicPlayer.addNeteaseTracks([{ id: 1, name: '夜航', artists: '', cover: '', duration: 60 }]); assert.equal(tracks().length, 2);
  assert(tracks().every(t => !t.url && t.source === 'netease'));
  musicPlayer.selectTrack(a.id); await tick(); musicPlayer.selectTrack(b.id); await tick();
  pending.get(2)!(Response.json({ code: 200, data: [{ id: 2, code: 200, url: 'https://audio.invalid/two.mp3' }] })); await tick();
  pending.get(1)!(Response.json({ code: 200, data: [{ id: 1, code: 200, url: 'https://audio.invalid/one.mp3' }] })); await tick();
  assert.equal(FakeAudio.current.src, 'https://audio.invalid/two.mp3');
  musicPlayer.setCompanion('a'); musicPlayer.setTogetherEnabled(true);
  const context = buildListenTogetherContext(['a'], () => '林渡')!;
  assert.match(context, /月光/); assert(!context.includes('MUSIC_U')); assert(!context.includes('audio.invalid'));
  assert.equal(buildListenTogetherContext(['b'], () => '别人'), null);
  clearMusicSession(); assert.equal(FakeAudio.current.paused, true); assert.equal(FakeAudio.current.src, '');
  assert.equal(readStoredValue(MUSIC_PLAYBACK_KEY, { isPlaying: true }, (v): v is { isPlaying: boolean } => !!v).isPlaying, false);
});

test('local URL tracks still play, and deleting a remote track cancels its pending playback', async () => {
  const localTrack = musicPlayer.addUrlTrack('https://audio.invalid/local.mp3', '本地链接');
  musicPlayer.selectTrack(localTrack.id); await tick(); assert.equal(FakeAudio.current.src, 'https://audio.invalid/local.mp3');
  let finish: (v: Response) => void;
  mock.method(globalThis, 'fetch', async () => new Promise<Response>(r => { finish = r; }));
  const [track] = musicPlayer.addNeteaseTracks([{ id: 8, name: '等待', artists: '', cover: '', duration: 60 }]);
  musicPlayer.selectTrack(track.id); await tick(); musicPlayer.removeTrack(track.id);
  finish!(Response.json({ code: 200, data: [{ id: 8, url: 'https://audio.invalid/removed.mp3', code: 200 }] })); await tick();
  assert.equal(FakeAudio.current.paused, true); assert.notEqual(FakeAudio.current.src, 'https://audio.invalid/removed.mp3');
  assert.equal(tracks().length, 1); assert.equal(tracks()[0].source, 'url');
});
