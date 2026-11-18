import { useState } from 'react';
import { Package, Gift } from 'lucide-react';
import type { Save, Step, Stats } from '../utils/nurture';
import { STAT_LABELS } from '../utils/nurture';
import { ownedProducts } from '../utils/nurtureInventory';
import { NurtureTap } from './NurtureTouchEffects';

export function NurtureInventory({ save }: { save: Save }) {
  const [filter, setFilter] = useState<'owned' | 'sent'>('owned');
  const items = ownedProducts(save), visible = items.filter(i => i.status === filter);
  return <section><h2 className="nurture-section-title">物品栏</h2><nav className="nurture-tabs">{(['owned', 'sent'] as const).map(s => <button type="button" key={s} aria-pressed={s === filter} onClick={() => setFilter(s)}>{s === 'owned' ? '待送出' : '已送出'} {items.filter(i => i.status === s).length}</button>)}</nav>{!visible.length && <p className="nurture-hint">{filter === 'owned' ? '角色购买的衣服和道具会放在这里，之后由角色决定何时送出。' : '送出后的物品和收到反应会留在这里。'}</p>}<div className="nurture-inventory-grid">{visible.map(item => <article className="nurture-inventory-item" key={item.id}>{item.product.image ? <img src={item.product.image} alt={item.product.name}/> : <div className="nurture-inventory-art"><Package size={35}/></div>}<div><small>{item.product.type} · {item.status === 'owned' ? '待送出' : '已送出'}</small><h3>{item.product.name}</h3><p>{item.product.description}</p><details><summary>{item.status === 'owned' ? '预设收到反应' : '收到时的反应'}</summary><p>{item.product.reaction || '旧物品未设置收到反应，角色不会送出。'}</p><ProductEffects product={item.product}/></details></div></article>)}</div></section>;
}
export function NurtureGiftPlayback({ step, actorName }: { step: Step; actorName: string }) {
  const product = step.giftedProduct;
  if (!product) return null;
  return <section className="nurture-gift-playback"><Gift size={28}/><h3>{actorName}送出了「{product.name}」</h3><div className="nurture-gift-box">{product.image ? <img src={product.image} alt={product.name}/> : <Package size={65}/>}<NurtureTap delayed/></div><small>收到后的反应</small><p className="nurture-gift-reaction">{step.speech}</p><ProductEffects product={product}/><blockquote>「{step.thought}」</blockquote></section>;
}
function ProductEffects({ product }: { product: import('../utils/nurtureDesign').GameProduct }) {
  if (!product.effectsEnabled || !product.effects) return null;
  return <div className="nurture-deltas">{(Object.keys(STAT_LABELS) as (keyof Stats)[]).map(k => product.effects![k] !== 0 && <span key={k}>{STAT_LABELS[k]} {product.effects![k] > 0 ? '+' : ''}{product.effects![k]}</span>)}</div>;
}
