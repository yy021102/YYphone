import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Save } from '../utils/nurture';
import { defaultDesign, validateDesign, DEFAULT_NURTURE_COLORS, type GameDesign, type NurtureColors } from '../utils/nurtureDesign';
import { emptyPortrait, validateTouchReplies, type Portrait } from '../utils/nurtureGame';
import { NurturePortraitEditor } from './NurturePortraitEditor';

export function NurtureSettings({ save, userName, onSave, onClose, onReset, actorName }: { save: Save; userName: string; onSave: (design: GameDesign, portrait: Portrait) => void; onClose: () => void; onReset?: () => void; actorName?: string }) {
  const [design, setDesign] = useState(() => structuredClone(save.design ?? defaultDesign(userName)));
  const [portrait, setPortrait] = useState(() => structuredClone(save.portrait ?? emptyPortrait()));
  const [uploading, setUploading] = useState(false), [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  return <div className="nurture-planner" role="dialog" aria-modal="true" aria-label="策划设置"><header><button onClick={onClose} aria-label="关闭策划设置"><ArrowLeft size={20}/></button><h2>策划设置</h2><span>仅你可编辑</span></header>
    <form noValidate onSubmit={e => { e.preventDefault(); if (uploading) return; try { validateDesign(design); validateTouchReplies(portrait); onSave(design, portrait); } catch(e) { setError(e instanceof Error ? e.message : '保存失败'); } }}>
      <p className="nurture-hint">角色会读到游戏描述和游戏内人物介绍，并把它们当作正常游戏内容。卡池、数值、日程、商城、约会和活动，请从主页面对应按钮进入编辑。</p>
      <details className="nurture-editor-fold" open><summary>游戏描述</summary><div><label>这是什么游戏<textarea required maxLength={6000} value={design.description} onChange={e => setDesign(d => ({ ...d, description: e.target.value }))} placeholder="默认是养成游戏，也可以写游戏背景、玩法和氛围。"/></label><p className="nurture-hint">角色会根据这里的介绍理解游戏；玩家仍是角色，你仍是游戏里被养成的对象。</p></div></details>
      <details className="nurture-editor-fold"><summary>游戏里的我 · {design.hero.nickname || design.hero.name}</summary><div><label>名字<input required maxLength={100} value={design.hero.name} onChange={e => setDesign(d => ({ ...d, hero: { ...d.hero, name: e.target.value } }))}/></label><label>昵称<input maxLength={100} value={design.hero.nickname} onChange={e => setDesign(d => ({ ...d, hero: { ...d.hero, nickname: e.target.value } }))}/></label><label>人物设定与介绍<textarea maxLength={6000} value={design.hero.setting} onChange={e => setDesign(d => ({ ...d, hero: { ...d.hero, setting: e.target.value } }))} placeholder="身份、性格、背景、喜好……这些设定会提供给角色。"/></label></div></details>
      <details className="nurture-editor-fold"><summary>立绘、部位定位与触碰发言</summary><div><NurturePortraitEditor value={portrait} onChange={setPortrait} onBusy={setUploading}/></div></details>
      <details className="nurture-editor-fold"><summary>按钮与文字颜色</summary><div><div className="nurture-color-fields">{([['buttonColor', '按钮背景'], ['buttonTextColor', '按钮文字与图标'], ['textColor', '页面文字']] as [keyof NurtureColors, string][]).map(([key, label]) => <label key={key}>{label}<input type="color" value={(design.colors ?? DEFAULT_NURTURE_COLORS)[key]} onChange={e => setDesign(d => ({ ...d, colors: { ...(d.colors ?? DEFAULT_NURTURE_COLORS), [key]: e.target.value } }))}/></label>)}</div><div className="nurture-color-preview" style={{ color: (design.colors ?? DEFAULT_NURTURE_COLORS).textColor }}><p>文字颜色预览</p><span style={{ background: (design.colors ?? DEFAULT_NURTURE_COLORS).buttonColor, color: (design.colors ?? DEFAULT_NURTURE_COLORS).buttonTextColor }}>✧ 抽卡</span></div><button type="button" onClick={() => setDesign(d => ({ ...d, colors: undefined }))}>恢复默认颜色</button></div></details>
    {onReset && <details className="nurture-editor-fold" onToggle={e => { if (!e.currentTarget.open) setConfirmReset(false); }}><summary>数据管理</summary><div className="nurture-reset-data"><h3>重新开始游戏</h3><p>清空{actorName ? `「${actorName}」` : '当前角色'}的全部养成存档，包括数值、卡册、物品、卡池、活动、日志、记忆、立绘及游戏设置。其他角色和共享预设保留。此操作无法撤销。</p>{confirmReset ? <><p role="alert">确认清除当前角色的游戏数据并重新开始？</p><button type="button" disabled={uploading} onClick={onReset}>确认清除数据</button><button type="button" onClick={() => setConfirmReset(false)}>取消</button></> : <button type="button" disabled={uploading} onClick={() => setConfirmReset(true)}>清除当前角色游戏数据</button>}</div></details>}
      {error && <p role="alert" className="nurture-error">{error}</p>}<button type="submit" className="nurture-save" disabled={uploading}>{uploading ? '正在处理立绘…' : '保存设置'}</button>
    </form>
  </div>;
}
