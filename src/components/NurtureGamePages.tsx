import { NurtureCollection } from './NurtureCollection';
import { useState } from 'react';
import { Gem, Gift, Heart, Package } from 'lucide-react';
import { STAT_LABELS, type Save, type Stats } from '../utils/nurture';
import { defaultDesign } from '../utils/nurtureDesign';
import { initialWallet } from '../utils/nurtureGame';
import { ownedProducts } from '../utils/nurtureInventory';
import { rechargeQuote } from '../utils/nurtureRecharge';
import { NurtureStatusNote } from './NurtureStatusNote';
import { NurturePoolBanner } from './NurturePoolBanner';

export function NurtureGamePages({ panel, save, userName, onNavigate }: { panel: string; save: Save; userName: string; onNavigate: (panel: string) => void }) {
  const [notice, setNotice] = useState('');
  const [amount, setAmount] = useState('6');
  const design = save.design ?? defaultDesign(userName), wallet = save.wallet ?? initialWallet();
  let gems = 0;
  try { gems = rechargeQuote(Number(amount), design.gemsPerYuan ?? 10).gems; } catch { /* Invalid partial input cannot be submitted. */ }
  const preview = () => setNotice('预览模式，不执行操作，也不消耗货币。');
  return <section className="nurture-game-view" aria-label="游戏内容页面">
    {panel === 'stats' && <><h3>{userName}的状态</h3><div className="nurture-stats">{(Object.keys(STAT_LABELS) as (keyof Stats)[]).map(k => <div key={k}><span>{STAT_LABELS[k]} <b>{save.stats[k]}</b></span><meter min={0} max={100} value={save.stats[k]}/></div>)}</div><NurtureStatusNote text={design.statusNote}/></>}
    {panel === 'draw' && <NurturePoolBanner save={save} userName={userName} onDraw={preview}/>}
    {panel === 'shop' && <><div className="nurture-recharge"><Gem/><div><h3>星钻补给</h3><p>现有 {wallet.gems} 星钻 · {wallet.coins} 金币</p><small>1 元 = {design.gemsPerYuan ?? 10} 星钻</small><button type="button" onClick={() => onNavigate('recharge')}>充值</button></div></div>{design.shop.map(p => <article key={p.id} className="nurture-offer">{p.image ? <img src={p.image} alt={p.name}/> : <Gift/>}<div><small>{p.type}</small><h3>{p.name}</h3><p>{p.description}</p><button type="button" onClick={preview}>购买 · {p.price} {p.currency === 'gems' ? '星钻' : '金币'}</button></div></article>)}</>}
    {panel === 'recharge' && <div className="nurture-checkout"><header><small>掌心养成 · 游戏中心</small><h3>星钻充值</h3><p>1 元 = {design.gemsPerYuan ?? 10} 星钻</p></header><label>充值金额（元）<input type="number" min={0.01} step={0.01} value={amount} onChange={e => setAmount(e.target.value)}/></label><p>到账 {gems} 星钻</p><p className="nurture-hint">支付方式：零钱</p><button type="button" className="nurture-confirm-payment" disabled={!gems} onClick={preview}>确认支付 ¥{gems ? Number(amount).toFixed(2) : '—'}</button></div>}
    {(panel === 'schedule' || panel === 'date') && <><div className="nurture-banner"><Heart size={30}/><h3>{panel === 'date' ? '把时间留给彼此' : '今天，也要好好长大'}</h3></div>{(panel === 'schedule' ? design.schedules : design.dates).map(a => <article className="nurture-offer" key={a.id}><div><h3>{a.name}</h3><p>{a.description}</p><div className="nurture-deltas">{panel === 'schedule' && !!a.coinReward && <span>{'\u91d1\u5e01'} +{a.coinReward}</span>}{(Object.keys(STAT_LABELS) as (keyof Stats)[]).map(k => a.delta[k] !== 0 && <span key={k}>{STAT_LABELS[k]} {a.delta[k] > 0 ? '+' : ''}{a.delta[k]}</span>)}</div><button type="button" onClick={preview}>{panel === 'date' ? '赴约' : '安排'} · {a.price} 金币</button></div></article>)}</>}
    {panel === 'cards' && <NurtureCollection cards={save.collection}/>}
    {panel === 'inventory' && <><h3>物品栏</h3>{ownedProducts(save).map(item => <article className="nurture-offer" key={item.id}>{item.product.image ? <img src={item.product.image} alt={item.product.name}/> : <Package/>}<div><h3>{item.product.name}</h3><p>{item.product.description}</p>{item.status === 'owned' ? <button type="button" onClick={preview}>送出</button> : <small>已送出</small>}</div></article>)}{!ownedProducts(save).length && <p className="nurture-hint">暂未购买物品。</p>}</>}
    {notice && <p className="nurture-preview-notice" role="status">{notice}</p>}
  </section>;
}
