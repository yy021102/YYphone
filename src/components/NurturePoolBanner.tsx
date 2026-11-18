import { useState } from 'react';
import { ChevronLeft, ChevronRight, Gem, Sparkles } from 'lucide-react';
import type { Save } from '../utils/nurture';
import { defaultDesign } from '../utils/nurtureDesign';
import { defaultPool, poolStatus } from '../utils/nurturePool';
import { initialWallet } from '../utils/nurtureGame';
import { isPityRare, srPityFromCollection } from '../utils/nurtureGacha';
import { NurtureCardArt } from './NurtureCardArt';

export function NurturePoolBanner({ save, userName, onDraw }: { save: Save; userName: string; onDraw: () => void }) {
  const [selectedId, setSelectedId] = useState('');
  const design = save.design ?? defaultDesign(userName), pool = save.pool ?? defaultPool();
  const wallet = save.wallet ?? initialWallet(), status = poolStatus(pool);
  const rare = save.cards.filter(c => c.weight > 0 && isPityRare(c)).sort((a, b) => Number(!!b.limited) - Number(!!a.limited) || String(b.releasedAt ?? '').localeCompare(String(a.releasedAt ?? '')));
  const selected = rare.find(c => c.id === selectedId) ?? rare[0], index = selected ? rare.indexOf(selected) : 0;
  const total = save.cards.reduce((n, c) => n + c.weight, 0), pity = save.pity ?? 0;
  return <section className="nurture-pool-banner" aria-label="稀有卡面展示">
    <header className="nurture-pool-heading"><div><small>{selected?.limited ? 'LIMITED EDITION' : 'RARE COLLECTION'}</small><h3>{pool.name}</h3></div><span><Gem size={13}/>{wallet.gems}</span></header>
    <div className="nurture-pool-period">{status === 'upcoming' ? `开放于 ${new Date(pool.startsAt).toLocaleString('zh-CN')}` : status === 'ended' ? '本期召唤已结束' : pool.endsAt ? `开放至 ${new Date(pool.endsAt).toLocaleString('zh-CN')}` : '常驻召唤 · 长期开放'}</div>
    {selected ? <><article key={selected.id} className="nurture-pool-feature"><div className="nurture-pool-feature-art"><NurtureCardArt card={selected}/></div><span className="nurture-pool-rarity">{selected.rarity}{selected.limited && <small>限定</small>}</span><div className="nurture-pool-feature-title"><small>✦ A MOMENT TO KEEP ✦</small><h2>{selected.name}</h2><p>{selected.description}</p></div>{rare.length > 1 && <><button type="button" className="nurture-pool-prev" aria-label="上一张稀有卡" onClick={() => setSelectedId(rare[(index + rare.length - 1) % rare.length].id)}><ChevronLeft size={22}/></button><button type="button" className="nurture-pool-next" aria-label="下一张稀有卡" onClick={() => setSelectedId(rare[(index + 1) % rare.length].id)}><ChevronRight size={22}/></button></>}</article><div className="nurture-pool-selection">{rare.length > 1 && rare.map((c, i) => <button type="button" key={c.id} aria-label={`展示稀有卡 ${c.name}`} aria-pressed={c.id === selected.id} onClick={() => setSelectedId(c.id)}>{String(i + 1).padStart(2, '0')}</button>)}<small>{selected.rarity} · 基础概率 {total ? (selected.weight / total * 100).toFixed(2) : '0'}%</small></div></> : <div className="nurture-pool-empty"><Sparkles size={38}/><p>稀有卡面即将登场</p></div>}
    <div className="nurture-pool-pity"><span>保底进度 <b>{pity}/60</b></span><small>最多再抽 {60 - pity} 次必得保底稀有</small><meter min={0} max={60} value={pity}/></div>
    <div className="nurture-pool-pity"><span>SR 保底 <b>{save.srPity ?? srPityFromCollection(save.collection)}/20</b></span><small>20 抽内必得 SR 或以上 · SR 不重置 60 抽保底</small><meter min={0} max={20} value={save.srPity ?? srPityFromCollection(save.collection)}/></div>
    <div className="nurture-pool-draw-actions"><button type="button" disabled={status !== 'open' || !rare.length || !total || wallet.gems < design.drawCost} onClick={onDraw}><Sparkles size={15}/>单抽<span><Gem size={11}/>{design.drawCost}</span></button><button type="button" disabled={status !== 'open' || !rare.length || !total || wallet.gems < design.drawCost * 10} onClick={onDraw}><Sparkles size={17}/>十连<span><Gem size={11}/>{design.drawCost * 10}</span></button></div>
  </section>;
}
