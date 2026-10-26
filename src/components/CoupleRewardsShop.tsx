import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronDown, Crown, Gift, Heart, LoaderCircle, Mail, Moon, ShoppingBag, Sparkles, Ticket } from 'lucide-react';
import { buyCoupleCoupon, COUPLE_PRODUCTS, COUPLE_REWARDS_EVENT, coupleBalance, couponStock, readCoupleWallet, rewardDay, settleCouplePoints, useCoupleCoupon, type CouponOwner } from '../utils/coupleRewards';
import { generateCoupleRewardAction } from '../utils/coupleRewardsAi';

const icons = { bell: Bell, crown: Crown, heart: Heart, gift: Gift, moon: Moon, mail: Mail };
export function CoupleRewardsShop({ charId, charName, userName }: { charId: string; charName: string; userName: string }) {
  const [wallet, setWallet] = useState(() => readCoupleWallet(charId));
  const [owner, setOwner] = useState<CouponOwner>('user');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [choice, setChoice] = useState('');
  const working = useRef(false), mounted = useRef(true), controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => setWallet(readCoupleWallet(charId));
    window.addEventListener(COUPLE_REWARDS_EVENT, refresh);
    void settleCouplePoints().then(refresh).catch(e => { if (mounted.current) setNotice(e instanceof Error ? e.message : '积分结算暂时失败'); });
    return () => { mounted.current = false; controller.current?.abort(); window.removeEventListener(COUPLE_REWARDS_EVENT, refresh); };
  }, [charId]);
  const run = async (key: string, task: () => Promise<string>) => {
    if (working.current) return;
    working.current = true; setBusy(key); setNotice('');
    try { const message = await task(); if (mounted.current) { setWallet(readCoupleWallet(charId)); setNotice(message); } }
    catch (error) { if (mounted.current) setNotice(error instanceof Error ? error.message : '操作失败，请重试'); }
    finally { working.current = false; if (mounted.current) setBusy(''); }
  };
  const inventory = COUPLE_PRODUCTS.filter(p => couponStock(wallet, owner, p.id) > 0);
  const todayAwards = wallet.awards.filter(a => a.day === rewardDay());
  const generate = () => void run('generate', async () => {
    controller.current = new AbortController();
    const result = await generateCoupleRewardAction(charId, { signal: controller.current.signal });
    if (mounted.current) setChoice(result.reason);
    return result.action === 'buy' ? `${charName}兑换了${COUPLE_PRODUCTS.find(p => p.id === result.productId)?.name}` : result.action === 'use' ? '使用卡片已发到聊天' : '';
  });
  return <section className="couple-rewards-shop" aria-label="积分商城">
    <header className="couple-shop-heading"><span><ShoppingBag size={16} strokeWidth={1.6} />心意商店</span><small>把一起的日常，换成偏爱</small></header>
    <div className="couple-point-wallets">
      {(['user', 'char'] as const).map(who => <div key={who} className={`couple-point-wallet is-${who}`}>
        <span>{who === 'user' ? userName : charName}<small>的积分</small></span>
        <strong>{coupleBalance(wallet, who)}<Heart size={13} strokeWidth={1.3} /></strong>
      </div>)}
    </div>
    <details className="couple-point-daily"><summary><span>今天的心意</span><div>{(['mood', 'diary', 'qa'] as const).map((kind, i) => <span key={kind} className={todayAwards.some(a => a.kind === kind) ? 'is-done' : ''}>{todayAwards.some(a => a.kind === kind) && <Check size={9} />}{['心情', '日记', '问答'][i]}</span>)}</div><ChevronDown size={11} /></summary>
      <p>同一天，两个人都填写心情、各写一篇日记、回答同一道问题，每项各得 1 积分，每天最多各得 3 分。已有的完整记录也会计入；修改或删除后再添加，不会重复得分。</p>
      <div className="couple-point-earned">一起攒下 <strong>{wallet.awards.length}</strong> 份心意</div>
    </details>
    <div className="couple-shop-products">
      {COUPLE_PRODUCTS.map(product => { const Icon = icons[product.icon]; return <article key={product.id} className={`couple-shop-ticket ticket-${product.icon}`}>
        <div className="couple-ticket-icon"><Icon size={23} strokeWidth={1.35} /></div>
        <h3>{product.name}</h3><p>{product.description}</p>
        <footer><span><Heart size={10} />{product.price}</span><button type="button" disabled={!!busy || coupleBalance(wallet, 'user') < product.price} aria-label={`兑换${product.name}`} onClick={() => void run(`buy:${product.id}`, async () => {
          await buyCoupleCoupon(charId, 'user', product.id, `user-buy:${crypto.randomUUID()}`); return `${product.name}已放入口袋`;
        })}>{busy === `buy:${product.id}` ? <LoaderCircle size={12} className="animate-spin" /> : '兑换'}</button></footer>
      </article>; })}
    </div>
    <div className="couple-shop-pocket">
      <div className="couple-pocket-heading"><div role="tablist" aria-label="心愿券库存">{(['user', 'char'] as const).map(who => <button type="button" key={who} role="tab" aria-selected={owner === who} onClick={() => setOwner(who)}>{who === 'user' ? '我的口袋' : `${charName}的口袋`}</button>)}</div>
        <button type="button" className="couple-shop-generate" disabled={!!busy} onClick={generate} aria-label="生成角色的兑换或使用决定">{busy === 'generate' ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}生成</button>
      </div>
      {inventory.length ? <div className="couple-pocket-items">{inventory.map(product => { const Icon = icons[product.icon]; return <div key={product.id}><span className={`couple-pocket-icon ticket-${product.icon}`}><Icon size={17} strokeWidth={1.4} /></span><div><strong>{product.name}</strong><small>× {couponStock(wallet, owner, product.id)}</small></div>{owner === 'user' && <button type="button" disabled={!!busy} aria-label={`使用${product.name}`} onClick={() => void run(`use:${product.id}`, async () => {
        await useCoupleCoupon(charId, 'user', product.id, `user-use:${crypto.randomUUID()}`); return '使用卡片已发到聊天';
      })}>{busy === `use:${product.id}` ? <LoaderCircle size={12} className="animate-spin" /> : '使用'}</button>}</div>; })}</div>
        : <div className="couple-pocket-empty"><Ticket size={22} strokeWidth={1.1} /><span>口袋里还没有券</span></div>}
      {choice && <p className="couple-shop-choice"><span>{charName}</span>{choice}</p>}
    </div>
    {notice && <p className="couple-shop-notice" role="status">{notice}</p>}
  </section>;
}
