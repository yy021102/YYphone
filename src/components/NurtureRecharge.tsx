import { useEffect, useState } from 'react';
import { CheckCircle2, Gem, Loader2, LockKeyhole, Wallet } from 'lucide-react';
import type { Step } from '../utils/nurture';
import { rechargePrice } from '../utils/nurtureRecharge';
import { NurtureTap } from './NurtureTouchEffects';

export function NurtureRecharge({ step, actorName, gems, orderId }: { step: Step; actorName: string; gems: number; orderId: string }) {
  const [phase, setPhase] = useState<'confirm' | 'processing' | 'success'>('confirm');
  useEffect(() => {
    setPhase('confirm');
    const timers = [window.setTimeout(() => setPhase('processing'), 1700), window.setTimeout(() => setPhase('success'), 3600)];
    return () => timers.forEach(window.clearTimeout);
  }, [step]);
  return <section className={`nurture-checkout is-${phase}`} aria-label="模拟充值收银台"><div className="nurture-checkout-label"><LockKeyhole size={13}/>游戏模拟 · 不会真实扣款</div>
    <header><small>掌心养成 · 游戏中心</small><h3>{phase === 'confirm' ? '确认充值订单' : phase === 'processing' ? '支付处理中' : '充值成功'}</h3><div className="nurture-payment-amount">¥<strong>{rechargePrice(gems)}</strong></div></header>
    {phase === 'success' ? <div className="nurture-payment-success" role="status"><CheckCircle2 size={48}/><strong>星钻已到账</strong><span><Gem size={17}/>+{gems} 星钻</span></div> : <><dl className="nurture-order-details"><div><dt>充值商品</dt><dd>{gems} 星钻</dd></div><div><dt>游戏玩家</dt><dd>{actorName}</dd></div><div><dt>订单编号</dt><dd>{orderId}</dd></div><div><dt>支付方式</dt><dd><Wallet size={15}/>零钱（模拟）</dd></div></dl>{phase === 'processing' ? <div className="nurture-payment-loading" role="status"><Loader2 className="animate-spin" size={30}/><span>正在确认支付…</span></div> : <button className="nurture-confirm-payment" disabled><LockKeyhole size={15}/>确认支付 ¥{rechargePrice(gems)}<NurtureTap delayed/></button>}</>}
    <aside className="nurture-payment-thought" aria-live="polite"><small>{actorName} · {phase === 'confirm' ? '打开收银台时' : phase === 'processing' ? '确认支付时' : '到账后的心声'}</small><blockquote>{phase === 'confirm' ? step.thought : phase === 'processing' ? step.paymentThought || step.thought : step.resultThought || step.thought}</blockquote></aside>
  </section>;
}
