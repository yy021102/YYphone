import React, { useEffect, useRef, useState } from 'react';
import { Cake, ChevronDown } from 'lucide-react';
import {
  BIRTHDAY_CHANGE, nextBirthday, localBirthdayDate, prepareBirthdayLetter, readBirthdayCharacters,
  readBirthdayLetters, readBirthdaySettings, saveBirthdaySettings, validBirthday, type BirthdaySettings as Settings,
} from '../utils/birthday';

export const BIRTHDAY_PREVIEW_EVENT = 'yyphone:birthday-preview';
export interface BirthdayPreviewRequest { settings: Settings; date: string; preview: boolean }

export function BirthdaySettings() {
  const [draft, setDraft] = useState(readBirthdaySettings);
  const [characters] = useState(readBirthdayCharacters);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener(BIRTHDAY_CHANGE, refresh);
    return () => { alive.current = false; controller.current?.abort(); window.removeEventListener(BIRTHDAY_CHANGE, refresh); };
  }, []);
  const targetDate = nextBirthday(draft.monthDay) || localBirthdayDate();
  const prepared = readBirthdayLetters(targetDate, draft);
  void revision;
  const update = (patch: Partial<Settings>) => { setDraft(v => ({ ...v, ...patch })); setNotice(''); };
  const [month, day] = draft.monthDay.split('-');
  const setDate = (m: string, d: string) => {
    const lastDay = new Date(2000, Number(m), 0).getDate();
    update({ monthDay: `${m}-${String(Math.min(Number(d), lastDay)).padStart(2, '0')}` });
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try { await saveBirthdaySettings(draft); if (alive.current) setNotice('生日已记好。'); }
    catch (err) { if (alive.current) setNotice(err instanceof Error ? err.message : '保存失败，请重试。'); }
    finally { if (alive.current) setBusy(false); }
  };
  const prepare = async () => {
    if (busy) return;
    if (!validBirthday(draft.monthDay)) { setNotice('先选好生日，再准备来信吧。'); return; }
    const selected = characters.filter(c => draft.characterIds.includes(c.id));
    if (!selected.length) { setNotice('选一位想收到来信的角色吧。'); return; }
    const task = new AbortController(); controller.current = task;
    setBusy(true); setNotice('');
    try {
      await saveBirthdaySettings(draft);
      const failures: string[] = [];
      for (const character of selected) {
        if (task.signal.aborted) break;
        if (alive.current) setNotice(`正在等${character.name}把心意写进信里…`);
        try { await prepareBirthdayLetter(character.id, targetDate, task.signal); }
        catch (err) {
          if (task.signal.aborted) break;
          failures.push(`${character.name}：${err instanceof Error ? err.message : '来信未能送达'}`);
        }
      }
      if (alive.current && !task.signal.aborted) setNotice(failures.length ? failures.join('\n') : '来信已封好，生日那天见。');
    } catch (err) { if (alive.current) setNotice(err instanceof Error ? err.message : '暂时没有准备好，请重试。'); }
    finally { if (alive.current) setBusy(false); }
  };
  const show = async (preview: boolean) => {
    if (busy) return;
    if (!preview) {
      try { await saveBirthdaySettings(draft); }
      catch (err) { setNotice(err instanceof Error ? err.message : '请先保存生日设置。'); return; }
    }
    if (alive.current) window.dispatchEvent(new CustomEvent<BirthdayPreviewRequest>(BIRTHDAY_PREVIEW_EVENT, { detail: { settings: draft, date: targetDate, preview } }));
  };
  return <details className="birthday-settings group">
    <summary><span className="birthday-settings-icon"><Cake size={21}/></span><span className="birthday-settings-title"><strong>生日开屏</strong><small>今天，有人在等你</small></span><ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180"/></summary>
    <fieldset disabled={busy} className="birthday-settings-content min-w-0">
      <label className="birthday-setting-row"><span>开启生日仪式<small>生日当天，第一次回到桌面时出现</small></span><input className="birthday-switch" type="checkbox" checked={draft.enabled} onChange={e => update({ enabled: e.target.checked })}/></label>
      <div className="birthday-setting-row"><span>我的生日</span><div className="birthday-date-fields">
        <select aria-label="生日月份" value={month || ''} onChange={e => setDate(e.target.value, day || '01')}><option value="" disabled>月份</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{i + 1} 月</option>)}</select>
        <select aria-label="生日日期" value={day || ''} onChange={e => setDate(month || '01', e.target.value)}><option value="" disabled>日期</option>{Array.from({ length: month ? new Date(2000, Number(month), 0).getDate() : 31 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{i + 1} 日</option>)}</select>
      </div></div>
      {draft.monthDay === '02-29' && <p>平年在 2 月 28 日庆祝。</p>}
      <div className="birthday-setting-row"><span>想收到谁的来信</span><small>{prepared.length ? '来信已备好' : ''}</small></div>
      <div className="birthday-role-list">{characters.map(character => <button type="button" key={character.id} aria-pressed={draft.characterIds.includes(character.id)}
        onClick={() => update({ characterIds: draft.characterIds.includes(character.id) ? draft.characterIds.filter(id => id !== character.id) : [...draft.characterIds, character.id] })}>
        {character.avatarUrl && <img src={character.avatarUrl} alt=""/>}<span>{character.name}</span></button>)}</div>
      {!characters.length && <p>添加角色后，就可以在这里邀请对方写信。</p>}
      <label className="birthday-setting-row"><span>音乐盒</span><input type="checkbox" className="birthday-switch" checked={draft.music} onChange={e => update({ music: e.target.checked })}/></label>
      <label className="birthday-setting-row"><span>提前准备来信<small>生日前一周，打开桌面时用聊天 API 准备并保存在本机</small></span><input type="checkbox" className="birthday-switch" checked={draft.autoPrepare} onChange={e => update({ autoPrepare: e.target.checked })}/></label>
      <div className="birthday-settings-actions"><button type="button" onClick={() => void save()}>保存</button><button type="button" onClick={() => void show(true)}>预览</button><button type="button" onClick={() => void prepare()}>准备来信</button></div>
      {prepared.length > 0 && <button type="button" className="birthday-text-button" onClick={() => void show(false)}>重看生日仪式</button>}
      <p>来信参考当前存档的近期相处与关联记忆。珍藏或带回聊天，由你拆信后决定。</p>
    </fieldset>
    {notice && <p className="birthday-notice px-4 pb-3 whitespace-pre-line" role="status">{notice}</p>}
  </details>;
}
