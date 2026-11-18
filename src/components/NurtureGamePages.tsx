import { useState } from 'react';
import { Gem, Gift, Heart, Package, Sparkles } from 'lucide-react';
import { STAT_LABELS, type Save, type Stats } from '../utils/nurture';
import { defaultDesign } from '../utils/nurtureDesign';
import { initialWallet } from '../utils/nurtureGame';
import { ownedProducts } from '../utils/nurtureInventory';
import { rechargePrice } from '../utils/nurtureRecharge';
import { NurtureCardArt } from './NurtureCardArt';
import { NurtureStatusNote } from './NurtureStatusNote';
import { NurturePoolBanner } from './NurturePoolBanner';

export function NurtureGamePages({ panel, save, userName, onNavigate }: { panel: string; save: Save; userName: string; onNavigate: (panel: string) => void }) {
  const [notice, setNotice] = useState('');
  const design = save.design ?? defaultDesign(userName), wallet = save.wallet ?? initialWallet();
  const eventOpen = save.event.enabled && Date.parse(save.event.endsAt) > Date.now();
  const preview = () => setNotice('预览模式，不执行操作，也不消耗货币。');
  return <section className="nurture-game-view" aria-label="游戏内容页面">
    {panel === 'stats' && <><h3>{userName}的状态</h3><div className="nurture-stats">{(Object.keys(STAT_LABELS) as (keyof Stats)[]).map(k => <div key={k}><span>{STAT_LABELS[k]} <b>{save.stats[k]}</b></span><meter min={0} max={100} value={save.stats[k]}/></div>)}</div><NurtureStatusNote text={design.statusNote}/></>}
    {panel === 'draw' && <NurturePoolBanner save={save} userName={userName} onDraw={preview}/>}
    {panel === 'shop' && <><div className="nurture-recharge"><Gem/><div><h3>星钻补给</h3><p>现有 {wallet.gems} 星钻 · {wallet.coins} 金币</p><button type="button" onClick={() => onNavigate('recharge')}>充值 {design.rechargeGems} 星钻 · ¥{rechargePrice(design.rechargeGems)}</button></div></div>{design.shop.map(p => <article key={p.id} className="nurture-offer">{p.image ? <img src={p.image} alt={p.name}/> : <Gift/>}<div><small>{p.type}</small><h3>{p.name}</h3><p>{p.description}</p><button type="button" onClick={preview}>购买 · {p.price} {p.currency === 'gems' ? '星钻' : '金币'}</button></div></article>)}</>}
    {panel === 'recharge' && <div className="nurture-checkout"><div className="nurture-checkout-label">游戏模拟 · 不会真实扣款</div><header><small>掌心养成 · 游戏中心</small><h3>确认充值订单</h3><div className="nurture-payment-amount">¥<strong>{rechargePrice(design.rechargeGems)}</strong></div></header><p className="nurture-hint">充值商品：{design.rechargeGems} 星钻</p><p className="nurture-hint">支付方式：零钱（模拟）</p><button type="button" className="nurture-confirm-payment" onClick={preview}>确认支付 ¥{rechargePrice(design.rechargeGems)}</button></div>}
    {(panel === 'schedule' || panel === 'date') && <><div className="nurture-banner"><Heart size={30}/><h3>{panel === 'date' ? '把时间留给彼此' : '今天，也要好好长大'}</h3></div>{(panel === 'schedule' ? design.schedules : design.dates).map(a => <article className="nurture-offer" key={a.id}><div><h3>{a.name}</h3><p>{a.description}</p><div className="nurture-deltas">{(Object.keys(STAT_LABELS) as (keyof Stats)[]).map(k => a.delta[k] !== 0 && <span key={k}>{STAT_LABELS[k]} {a.delta[k] > 0 ? '+' : ''}{a.delta[k]}</span>)}</div><button type="button" onClick={preview}>{panel === 'date' ? '赴约' : '安排'} · {a.price} 金币</button></div></article>)}</>}
    {panel === 'event' && <div className="nurture-banner"><Sparkles size={30}/><h3>{eventOpen ? save.event.title : '敬请期待'}</h3>{eventOpen && <><p>{save.event.description}</p><small>截止 {new Date(save.event.endsAt).toLocaleString('zh-CN')}</small><div className="nurture-game-actions"><button type="button" onClick={preview}>参与活动</button></div></>}</div>}
    {panel === 'cards' && <><h3>我的卡册 · {save.collection.length}</h3><div className="nurture-card-grid">{save.collection.map((c, i) => <article className="nurture-card" key={i}><NurtureCardArt card={c}/><strong>{c.name}</strong><small>{c.rarity}</small></article>)}</div>{!save.collection.length && <p className="nurture-hint">暂未收藏卡面。</p>}</>}
    {panel === 'inventory' && <><h3>物品栏</h3>{ownedProducts(save).map(item => <article className="nurture-offer" key={item.id}>{item.product.image ? <img src={item.product.image} alt={item.product.name}/> : <Package/>}<div><h3>{item.product.name}</h3><p>{item.product.description}</p>{item.status === 'owned' ? <button type="button" onClick={preview}>送出</button> : <small>已送出</small>}</div></article>)}{!ownedProducts(save).length && <p className="nurture-hint">暂未购买物品。</p>}</>}
    {notice && <p className="nurture-preview-notice" role="status">{notice}</p>}
  </section>;
}
