import { useEffect, useRef, useState } from 'react';
import { CHRISTMAS_CHANGE, CHRISTMAS_OPEN, christmasDue, prepareChristmasGift, readChristmasEnabled, readChristmasYears, readChristmasUnlocked, saveChristmasWish, unlockChristmasTheme, updateChristmasYear, type ChristmasGift } from '../utils/christmas';
import { readBirthdayCharacters } from '../utils/birthday';
import './christmas.css';
import { canOpenChristmas, readChristmasDebugAccess } from '../utils/christmasAccess';

type Scene = { year: number; phase: 'wish' | 'gifts'; preview: boolean };
export function ChristmasRuntime({ unlocked, atHome, blocked, onOpenBeauty }: { unlocked: boolean; atHome: boolean; blocked: boolean; onOpenBeauty: () => void }) {
  const [scene, setScene] = useState<Scene | null>(null), [tick, setTick] = useState(0);
  const state = useRef({ unlocked, blocked }); state.current = { unlocked, blocked };
  const shown = useRef(new Set<string>());
  useEffect(() => {
    const refresh = () => setTick(v => v+1);
    const open = (e: Event) => { if (state.current.unlocked && !state.current.blocked && canOpenChristmas()) { const detail = (e as CustomEvent<Scene>).detail; if (detail) setScene(detail); } };
    const timer = setInterval(refresh, 30000);
    window.addEventListener(CHRISTMAS_CHANGE, refresh); window.addEventListener(CHRISTMAS_OPEN, open); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener(CHRISTMAS_CHANGE, refresh); window.removeEventListener(CHRISTMAS_OPEN, open); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    if (!unlocked || !atHome || blocked || scene || !canOpenChristmas() || !readChristmasEnabled() || document.visibilityState === 'hidden') return;
    const due = christmasDue(readChristmasYears());
    if (!due || shown.current.has(`${due.year}:${due.phase}`)) return;
    shown.current.add(`${due.year}:${due.phase}`); setScene({ ...due, preview: false });
  }, [unlocked, atHome, blocked, scene, tick]);
  if (!scene || !unlocked || blocked) return null;
  return <ChristmasScene key={`${scene.year}:${scene.phase}:${scene.preview}`} {...scene} onClose={() => setScene(null)} onBeauty={() => { setScene(null); onOpenBeauty(); }}/>;
}

function ChristmasScene({ year, phase, preview, onClose, onBeauty }: Scene & { onClose: () => void; onBeauty: () => void }) {
  const saved = readChristmasYears()[year], characters = readBirthdayCharacters();
  const [text, setText] = useState(preview ? '' : saved?.wish?.text ?? ''), [characterId, setCharacterId] = useState(preview ? '' : saved?.wish?.characterId ?? '');
  const [panel, setPanel] = useState<'wish' | 'role' | 'creator' | null>(phase === 'wish' ? 'wish' : null);
  const [sent, setSent] = useState(false), [lit, setLit] = useState(false), [dog, setDog] = useState(false);
  const [gift, setGift] = useState<ChristmasGift | null>(preview ? null : saved?.gift ?? null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [reward, setReward] = useState(readChristmasUnlocked), [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const generate = async () => {
    if (controller.current || gift || preview || !saved?.wish) return;
    const active = new AbortController(); controller.current = active; setBusy(true); setError('');
    try { setGift(await prepareChristmasGift(year, active.signal)); }
    catch (e) { if (!active.signal.aborted) setError(e instanceof Error ? e.message : '礼物还没准备好，请重试。'); }
    finally { if (controller.current === active) { controller.current = null; setBusy(false); } }
  };
  useEffect(() => { if (phase === 'gifts' && !preview && saved?.wish && !gift) void generate(); }, []);
  const close = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try { if (!preview) await updateChristmasYear(year, phase === 'wish' ? { eveSeen: true } : gift || !saved?.wish ? { giftSeen: true } : {}); onClose(); }
    catch { setError('进度暂时没有保存，请重试。'); setSaving(false); }
  };
  const send = async () => {
    if (saving) return;
    if (!text.trim() || !characterId) { setError('写下愿望，再选一位收信人吧。'); return; }
    setSaving(true); setError('');
    try { if (!preview) await saveChristmasWish(year, { text, characterId }); setSent(true); setPanel(null); }
    catch (e) { setError(e instanceof Error ? e.message : '愿望未寄出，请重试。'); }
    finally { setSaving(false); }
  };
  const redeem = async () => {
    if (saving || preview) return;
    setSaving(true); setError('');
    try { await unlockChristmasTheme(); setReward(true); }
    catch { setError('礼物暂时没有收好，请重试。'); }
    finally { setSaving(false); }
  };
  const seeTheme = async () => {
    if (saving) return;
    setSaving(true);
    try { await updateChristmasYear(year, gift || !saved?.wish ? { giftSeen: true } : {}); onBeauty(); }
    catch { setError('进度未保存，请重试。'); setSaving(false); }
  };
  return <section className={`christmas-scene${lit ? ' is-lit' : ''}`} role="dialog" aria-modal="true" aria-label={preview ? '圣诞开屏预览' : '圣诞小屋'}>
    <div className="christmas-art"><img src={`${import.meta.env.BASE_URL}openings/christmas.webp`} alt="雪夜的小屋、圣诞树与雪橇上的两份礼物"/>
      <button className="christmas-hotspot christmas-tree" aria-label="点亮圣诞树" onClick={() => setLit(v => !v)}><span className="christmas-star">✧</span></button>
      <button className="christmas-hotspot christmas-door" aria-label="敲敲小屋的门" onClick={() => setDog(v => !v)}>{dog && <span className="christmas-dog">🐶</span>}</button>
      <button className="christmas-hotspot christmas-role-gift" aria-label="拆开角色的礼物" onClick={() => { setPanel(phase === 'wish' ? 'wish' : 'role'); setError(''); }}><i/></button>
      <button className="christmas-hotspot christmas-creator-gift" aria-label="拆开歪歪的赠礼" onClick={() => { setPanel('creator'); setError(''); }}><i/></button>
    </div>
    <div className="christmas-snow" aria-hidden="true">{Array.from({length:22},(_,i) => <i key={i} style={{left:`${(i*47)%100}%`,animationDelay:`${-i*.8}s`,animationDuration:`${9+i%6}s`}}/>)}</div>
    <header className="christmas-top"><span>{preview ? '提前看看 · 不保存' : phase === 'wish' ? '平安夜' : '圣诞快乐'}</span><button type="button" disabled={saving} onClick={() => void close()}>进入小手机 →</button></header>
    {!panel && <p className="christmas-caption">{sent ? '愿望已寄出，圣诞节见。' : phase === 'wish' ? '小屋替你保管一个愿望' : '雪橇上，有两份留给你的礼物'}</p>}
    {panel && <div className="christmas-sheet-backdrop" onClick={e => { if (e.target === e.currentTarget) setPanel(null); }}><section className={`christmas-scroll christmas-${panel}`} aria-label={panel === 'wish' ? '圣诞愿望单' : panel === 'role' ? '角色的圣诞礼物' : '歪歪的赠礼'}>
      <button type="button" className="christmas-sheet-close" aria-label="收起卷轴" onClick={() => setPanel(null)}>×</button>
      <small>{panel === 'wish' ? 'CHRISTMAS WISHES' : 'A LITTLE GIFT FOR YOU'}</small>
      <h1>{panel === 'wish' ? '寄往圣诞夜' : panel === 'creator' ? '歪歪的赠礼' : gift?.name ?? '一份还未拆开的心意'}</h1>
      {panel === 'wish' ? <><label>我的愿望<textarea aria-label="圣诞愿望" maxLength={3000} rows={5} value={text} onChange={e => setText(e.target.value)} disabled={saving}/></label><label>想寄给谁<select aria-label="圣诞收信角色" value={characterId} disabled={saving} onChange={e => setCharacterId(e.target.value)}><option value="">选择收信人</option>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="christmas-action" disabled={saving} onClick={() => void send()}>{saving ? '正在寄出…' : '寄出愿望'}</button></> : panel === 'role' ? <>
        {preview ? <><p>一件认真挑选的小礼物，和一封属于你们的圣诞祝福。</p><p>正式拆开时，会由你指定的角色回应愿望。</p></> : gift ? <><p className="christmas-gift-description">{gift.description}</p><div className="christmas-letter">{gift.blessing}</div><footer>—— {gift.characterName}</footer></> : <><p>{busy ? '屋里的灯还亮着，TA正在准备你的礼物…' : saved?.wish ? '礼物还在小屋里。' : '今年没有寄出愿望，也可以拆开歪歪留给你的那份礼物。'}</p>{saved?.wish && !busy && <button className="christmas-action" onClick={() => void generate()}>准备礼物</button>}{busy && <button type="button" onClick={() => { controller.current?.abort(); controller.current = null; setBusy(false); }}>暂停准备</button>}</>}
      </> : <><div className="christmas-theme-swatch">✧<span>雪夜来信</span><small>奶白 · 雾蓝 · 冬日灯火</small></div><p>送你一座亮着灯的小屋，和一整套圣诞桌面。</p>{preview ? <p>圣诞节拆开这份礼物，就能带走它。</p> : phase === 'wish' ? <p>等到圣诞节，再一起拆开吧。</p> : <button className="christmas-action" disabled={saving} onClick={() => reward ? void seeTheme() : void redeem()}>{reward ? '去美化看看' : '收下这份礼物'}</button>}</>}
      {preview && readChristmasDebugAccess() && panel === 'creator' && <button type="button" className="christmas-action" onClick={onBeauty}>试用圣诞主题</button>}
      {preview && <p className="christmas-preview-note">预览不会调用 API、保存愿望或解锁赠礼</p>}
      {error && <p role="alert" className="christmas-error">{error}</p>}
    </section></div>}
    {!panel && error && <p role="alert" className="christmas-caption">{error}</p>}
  </section>;
}
