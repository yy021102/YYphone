import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown, ListMusic, LoaderCircle, LogOut, Music2, Play, Plus, QrCode, RefreshCw, Search, Settings2, X } from 'lucide-react';
import { checkMusicQr, clearMusicSession, createMusicQr, musicPlaylists, musicProfile, musicRequest, playlistMusic, readMusicService, readMusicSession, saveMusicService, searchMusic, type NeteasePlaylist, type NeteaseSong } from '../utils/neteaseMusic';
import { musicPlayer } from '../utils/musicPlayer';
import { MusicVerificationError } from '../utils/neteaseMusic';

const errorText = (e: unknown) => e instanceof Error ? e.message : '音乐服务暂时不可用。';
export const NeteaseMusicPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [endpoint, setEndpoint] = useState(readMusicService);
  const [draft, setDraft] = useState(readMusicService);
  const [profile, setProfile] = useState(() => readMusicSession()?.profile ?? null);
  const [configOpen, setConfigOpen] = useState(() => !readMusicService());
  const [qr, setQr] = useState<Awaited<ReturnType<typeof createMusicQr>> | null>(null);
  const [qrStatus, setQrStatus] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [loginAttempt, setLoginAttempt] = useState(0);
  const [view, setView] = useState<'playlists' | 'search'>('playlists');
  const [playlists, setPlaylists] = useState<NeteasePlaylist[]>([]);
  const [selected, setSelected] = useState<NeteasePlaylist | null>(null);
  const [songs, setSongs] = useState<NeteaseSong[]>([]);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const qrController = useRef<AbortController | null>(null);
  const browseController = useRef<AbortController | null>(null);
  const testController = useRef<AbortController | null>(null);
  const profileController = useRef<AbortController | null>(null);

  useEffect(() => () => { qrController.current?.abort(); browseController.current?.abort(); testController.current?.abort(); profileController.current?.abort(); }, []);
  useEffect(() => {
    if (!expanded || !profile) return;
    const controller = new AbortController(); profileController.current = controller;
    void musicProfile(controller.signal).then(p => {
      if (controller.signal.aborted) return;
      if (p) setProfile(p);
      else { clearMusicSession(); setProfile(null); setError('网易云登录已失效，请重新扫码。'); }
    }).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [expanded, endpoint]);

  useEffect(() => {
    if (!qr || !expanded) return;
    const controller = new AbortController(); qrController.current = controller;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    async function poll() {
      if (controller.signal.aborted) return;
      if (Date.now() - started > 180000) { setQrStatus('请刷新二维码后继续'); return; }
      if (document.hidden) { timer = setTimeout(poll, 3000); return; }
      try {
        const code = await checkMusicQr(qr!.key, qr!.endpoint, controller.signal);
        if (controller.signal.aborted) return;
        if (code === 800) { setQrStatus('二维码已过期，请刷新'); return; }
        if (code === 803) {
          setProfile(readMusicSession()?.profile ?? null); setQr(null); setQrStatus(''); setConfigOpen(false); setError(''); return;
        }
        setQrStatus(code === 802 ? '已扫码，请在网易云确认登录' : '用网易云音乐 App 扫码');
        timer = setTimeout(poll, 3000);
      } catch (e) { if (!controller.signal.aborted) { setError(errorText(e)); setVerificationUrl(e instanceof MusicVerificationError ? e.verificationUrl : ''); setQrStatus(e instanceof MusicVerificationError ? '等待网易云安全验证' : '登录确认中断，可以重试'); } }
    }
    timer = setTimeout(poll, 1800);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [qr, expanded, loginAttempt]);

  async function load(kind: 'playlists' | 'playlist' | 'search', append = false, target = selected, keywords = searched) {
    browseController.current?.abort();
    const controller = new AbortController(); browseController.current = controller;
    setBusy(true); setError(''); setNotice('');
    try {
      if (kind === 'playlists') {
        const result = await musicPlaylists(append ? playlists.length : 0, controller.signal);
        if (!controller.signal.aborted) { setPlaylists(old => append ? [...old, ...result.items] : result.items); setMore(result.more); }
      } else if (kind === 'playlist' && target) {
        const result = await playlistMusic(target.id, append ? songs.length : 0, controller.signal);
        if (!controller.signal.aborted) { setSongs(old => append ? [...old, ...result] : result); setMore((append ? songs.length : 0) + result.length < target.count && result.length > 0); }
      } else if (kind === 'search' && keywords.trim()) {
        const result = await searchMusic(keywords, append ? songs.length : 0, controller.signal);
        if (!controller.signal.aborted) { setSongs(old => append ? [...old, ...result.items] : result.items); setMore(result.more); }
      }
    } catch (e) { if (!controller.signal.aborted) setError(errorText(e)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  useEffect(() => {
    if (expanded && endpoint && profile && view === 'playlists' && !selected) void load('playlists');
  }, [expanded, endpoint, profile?.userId, view, selected?.id]);

  async function startLogin() {
    setVerificationUrl('');
    qrController.current?.abort(); profileController.current?.abort(); setQr(null); setError(''); setNotice('');
    if (!endpoint) { setConfigOpen(true); setError('请先设置音乐服务地址。'); return; }
    const controller = new AbortController(); qrController.current = controller;
    setQrBusy(true); setQrStatus('正在准备二维码…');
    try { const result = await createMusicQr(controller.signal); if (!controller.signal.aborted) { setQr(result); setQrStatus('用网易云音乐 App 扫码'); } }
    catch (e) { if (!controller.signal.aborted) { setError(errorText(e)); setQrStatus(''); } }
    finally { if (!controller.signal.aborted) setQrBusy(false); }
  }
  async function connect(address = draft) {
    setVerificationUrl('');
    testController.current?.abort(); qrController.current?.abort(); browseController.current?.abort(); profileController.current?.abort();
    const controller = new AbortController(); testController.current = controller;
    setTestBusy(true); setError(''); setNotice(''); setQr(null); setQrBusy(false); setBusy(false);
    try {
      const previous = readMusicService();
      const next = saveMusicService(address); setEndpoint(next); setDraft(next); setProfile(readMusicSession()?.profile ?? null);
      if (next !== previous) { setSongs([]); setPlaylists([]); setSelected(null); setMore(false); setSearched(''); }
      if (!next) { setConfigOpen(true); setNotice('请先填写你部署的音乐服务地址。'); return; }
      const result = await musicRequest('/login/qr/key', {}, { endpoint: next, cookie: '', signal: controller.signal });
      if (typeof result.data?.unikey !== 'string' || !result.data.unikey) throw new Error('这个地址没有提供兼容的网易云音乐接口。');
      if (!controller.signal.aborted) { setNotice('连接成功，可以扫码登录。'); setConfigOpen(false); }
    } catch (e) { if (!controller.signal.aborted) setError(errorText(e)); }
    finally { if (!controller.signal.aborted) setTestBusy(false); }
  }
  function logout() {
    qrController.current?.abort(); browseController.current?.abort(); profileController.current?.abort();
    clearMusicSession(); setProfile(null); setQr(null); setQrBusy(false); setBusy(false); setSelected(null); setPlaylists([]); setSongs([]); setSearched(''); setError(''); setNotice('已退出网易云。');
  }
  function switchView(next: 'playlists' | 'search') {
    if (next === view && !selected) return;
    browseController.current?.abort(); setBusy(false); setView(next); setSelected(null); setSongs([]); setMore(false); setSearched(''); setError(''); setNotice('');
  }
  function add(songsToAdd: NeteaseSong[], play = false) {
    const tracks = musicPlayer.addNeteaseTracks(songsToAdd);
    if (play && tracks[0]) musicPlayer.selectTrack(tracks[0].id);
    else setNotice('已加入播放列表。');
  }
  return <section className="netease-music">
    <button className="nm-heading" type="button" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); if (expanded) { qrController.current?.abort(); browseController.current?.abort(); setQr(null); setQrBusy(false); setBusy(false); } }}>
      <span className="nm-mark"><Music2 size={17} /></span><span><strong>网易云音乐</strong><small>{profile ? profile.nickname : '把喜欢的歌，放进一起听'}</small></span><ChevronDown size={16} className={expanded ? 'nm-chevron-open' : ''} />
    </button>
    {expanded && <div className="nm-body">
      <div className="nm-account">
        <span>{profile ? <><span className="nm-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <Music2 size={16} />}</span><strong>{profile.nickname}</strong></> : <><QrCode size={16} /><strong>连接你的音乐收藏</strong></>}</span>
        <button type="button" aria-label="音乐服务设置" aria-expanded={configOpen} onClick={() => setConfigOpen(!configOpen)}><Settings2 size={16} /></button>
        {profile && <button type="button" aria-label="退出网易云" onClick={logout}><LogOut size={16} /></button>}
      </div>
      {configOpen && <div className="nm-config">
        <label htmlFor="netease-endpoint">音乐服务地址</label>
        <input id="netease-endpoint" type="url" autoComplete="off" value={draft} placeholder="https://你的音乐服务地址" onChange={e => setDraft(e.target.value)} />
        <button type="button" className="nm-primary" disabled={testBusy} onClick={() => void connect()}>{testBusy ? <LoaderCircle size={14} className="nm-spin" /> : <RefreshCw size={14} />}保存并测试</button>
        <button type="button" className="nm-primary" disabled={testBusy} onClick={() => void connect('')}>恢复默认服务</button>
        <p>可以填写自己部署的兼容 NeteaseCloudMusicApi 服务地址，与聊天 API 分开。</p>
      </div>}
      {!profile && <div className="nm-login">
        {qr && <><img className="nm-qr" src={qr.image} alt="网易云音乐登录二维码" /><p role="status">{qrStatus}</p><small>手机上可截图，再从网易云扫一扫的相册识别。</small></>}
        <div className="nm-login-actions"><button type="button" className="nm-primary" disabled={qrBusy || testBusy} onClick={() => void startLogin()}>{qrBusy ? <LoaderCircle size={15} className="nm-spin" /> : <QrCode size={15} />}{qrBusy ? '正在准备…' : qr ? '刷新二维码' : '扫码登录'}</button>
          {qr && <button type="button" aria-label="取消扫码" onClick={() => { qrController.current?.abort(); setQr(null); setQrStatus(''); }}><X size={16} /></button>}
        </div>
        <small>登录仅保留在当前浏览器会话，不随整机数据导出。</small>
      </div>}
      {endpoint && <>
        <div className="nm-tabs" role="tablist" aria-label="网易云音乐内容">
          <button type="button" role="tab" aria-selected={view === 'playlists'} onClick={() => switchView('playlists')}><ListMusic size={14} />我的歌单</button>
          <button type="button" role="tab" aria-selected={view === 'search'} onClick={() => switchView('search')}><Search size={14} />搜索歌曲</button>
        </div>
        {view === 'search' && <form className="nm-search" onSubmit={e => { e.preventDefault(); if (!query.trim()) return; setSearched(query.trim()); setSongs([]); setMore(false); void load('search', false, null, query.trim()); }}><input aria-label="搜索网易云歌曲" placeholder="歌曲、歌手" value={query} onChange={e => setQuery(e.target.value)} /><button type="submit" aria-label="搜索" disabled={busy || !query.trim()}><Search size={16} /></button></form>}
        {view === 'playlists' && selected && <div className="nm-list-title"><button type="button" onClick={() => { setSelected(null); setSongs([]); }}><ChevronLeft size={14} />歌单</button><strong>{selected.name}</strong></div>}
        <div className="nm-library" aria-label={view === 'search' ? '搜索结果' : selected ? '歌单歌曲' : '我的歌单'}>
          {view === 'playlists' && !profile && <p className="nm-empty">登录后，喜欢的歌和收藏的歌单会在这里。</p>}
          {view === 'playlists' && profile && !selected && playlists.map(p => <button className="nm-playlist" type="button" key={p.id} onClick={() => { setSelected(p); setSongs([]); setMore(false); void load('playlist', false, p); }}><span className="nm-cover">{p.cover ? <img src={p.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <ListMusic size={20} />}</span><span><strong>{p.name}</strong><small>{p.count} 首</small></span><ChevronLeft size={14} className="nm-forward" /></button>)}
          {(view === 'search' || selected) && songs.map((s, i) => <div className="nm-song" key={`${s.id}-${i}`}><button type="button" className="nm-song-play" aria-label={`播放 ${s.name}`} onClick={() => add([s], true)}><span className="nm-cover">{s.cover ? <img src={s.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Play size={15} />}</span><span><strong>{s.name}</strong><small>{s.artists || '未知歌手'}</small></span></button><button type="button" aria-label={`添加 ${s.name}`} onClick={() => add([s])}><Plus size={17} /></button></div>)}
          {!busy && !error && ((view === 'search' && searched && !songs.length) || (selected && !songs.length) || (view === 'playlists' && profile && !selected && !playlists.length)) && <p className="nm-empty">{view === 'search' ? '没有找到这首歌，换个关键词试试。' : '这里还没有歌曲。'}</p>}
        </div>
        {busy && <p className="nm-loading" role="status"><LoaderCircle size={15} className="nm-spin" />正在读取…</p>}
        {more && !busy && <button className="nm-more" type="button" onClick={() => void load(view === 'search' ? 'search' : selected ? 'playlist' : 'playlists', true)}>加载更多</button>}
        {selected && songs.length > 0 && <button className="nm-add-all" type="button" onClick={() => add(songs)}><Plus size={14} />加入已加载的歌曲</button>}
      </>}
      {error && <div className="nm-error" role="alert"><span>{error}</span>{verificationUrl && <a href={verificationUrl} target="_blank" rel="noopener noreferrer">完成网易云验证</a>}{qr && <button type="button" onClick={() => { setError(''); setVerificationUrl(''); setQrStatus('正在确认登录…'); setLoginAttempt(n => n + 1); }}>继续确认登录</button>}{!qr && endpoint && <button type="button" disabled={busy} onClick={() => { if (view === 'playlists' && profile) void load(selected ? 'playlist' : 'playlists'); else if (searched) void load('search'); else void startLogin(); }}>重试</button>}</div>}
      {notice && <p className="nm-notice" role="status">{notice}</p>}
    </div>}
  </section>;
};
