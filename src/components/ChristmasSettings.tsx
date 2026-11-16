import { useState } from 'react';
import { CHRISTMAS_OPEN, readChristmasEnabled, readChristmasYears, setChristmasEnabled } from '../utils/christmas';
import { canOpenChristmas, unlockChristmasDebug } from '../utils/christmasAccess';
export function ChristmasSettings() {
  const [enabled, setEnabled] = useState(readChristmasEnabled), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(canOpenChristmas), [password, setPassword] = useState('');
  const years = readChristmasYears();
  const open = (phase: 'wish' | 'gifts', preview: boolean, year = new Date().getFullYear()) => window.dispatchEvent(new CustomEvent(CHRISTMAS_OPEN, { detail: { year, phase, preview } }));
  return <details className="birthday-settings"><summary><span className="birthday-settings-icon">❄</span><span className="birthday-settings-title"><strong>圣诞开屏</strong><small>{allowed ? '雪夜小屋 · 两份心意' : '圣诞节见'}</small></span></summary><div className="birthday-settings-content">
    {!allowed ? <form className="christmas-password" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { if (await unlockChristmasDebug(password)) { setAllowed(true); setPassword(''); } else setError('口令不正确。'); } catch { setError('暂时无法验证，请重试。'); } finally { setBusy(false); } }}><label>提前预览口令<input type="password" aria-label="圣诞预览口令" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} maxLength={100}/></label><button type="submit" disabled={busy}>{busy ? '验证中…' : '打开'}</button></form> : <>
    <label className="birthday-setting-row"><span>圣诞节来小屋<small>平安夜寄愿望，圣诞节拆礼物</small></span><input type="checkbox" aria-label="开启圣诞开屏" checked={enabled} disabled={busy} onChange={async e => { const next = e.target.checked; setBusy(true); try { await setChristmasEnabled(next); setEnabled(next); } catch { setError('设置未保存，请重试。'); } finally { setBusy(false); } }}/></label>
    <div className="birthday-settings-actions"><button type="button" onClick={() => open('wish', true)}>预览愿望单</button><button type="button" onClick={() => open('gifts', true)}>预览圣诞夜</button></div>
    {Object.keys(years).sort().reverse().map(y => <button type="button" key={y} onClick={() => open(new Date() >= new Date(Number(y), 11, 25) ? 'gifts' : 'wish', false, Number(y))}>{y} · {new Date() >= new Date(Number(y), 11, 25) ? '重看圣诞礼物' : '查看我的愿望'}</button>)}
    </>}{error && <p role="alert">{error}</p>}
  </div></details>;
}
