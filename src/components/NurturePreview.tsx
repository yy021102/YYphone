import { useState } from 'react';
import { X } from 'lucide-react';
import type { Save } from '../utils/nurture';
import { currentPlan } from '../utils/nurtureDesign';
import { NurtureStage } from './NurtureStage';
import { NurtureGamePages } from './NurtureGamePages';

export function NurturePreview({ save, actorName, userName, onClose }: { save: Save; actorName: string; userName: string; onClose: () => void }) {
  const [snapshot] = useState(() => { const plan = currentPlan(save); return { ...structuredClone(save), stats: plan.stats, cards: plan.cards, event: plan.event, pool: plan.pool }; });
  const [tab, setTab] = useState('home');
  return <div className="nurture-preview" role="dialog" aria-modal="true" aria-label="游戏页面预览"><header><div><strong>游戏页面预览</strong><small>{actorName}的游戏 · 不修改存档</small></div><button type="button" aria-label="关闭预览" onClick={onClose}><X size={20}/></button></header>
    <nav className="nurture-tabs">{[['home', '陪伴'], ['cards', '卡册'], ['inventory', '物品栏']].map(([id, label]) => <button type="button" key={id} aria-current={id === tab ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}</nav>
    <div className="nurture-preview-scroll">{tab === 'home' ? <NurtureStage save={snapshot} userName={userName} actorName={actorName} busy={false} playing={false} viewOnly onSettings={() => {}}/> : <NurtureGamePages key={tab} panel={tab} save={snapshot} userName={userName} onNavigate={setTab}/>}</div>
  </div>;
}
