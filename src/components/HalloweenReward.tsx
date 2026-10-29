import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Ghost } from 'lucide-react';
import { HALLOWEEN_CHANGE, readHalloweenReward, redeemHalloweenTheme } from '../utils/halloween';

export function HalloweenReward({ settling = false, onOpenBeauty }: { settling?: boolean; onOpenBeauty?: () => void }) {
  const [reward, setReward] = useState(readHalloweenReward);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    const refresh = () => setReward(readHalloweenReward());
    window.addEventListener(HALLOWEEN_CHANGE, refresh);
    return () => window.removeEventListener(HALLOWEEN_CHANGE, refresh);
  }, []);
  const redeem = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { setReward(await redeemHalloweenTheme()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '暂时没能兑换，请重试。'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="hw-reward">
    <div className="hw-reward-heading"><span className="hw-reward-art" aria-hidden="true"><i>☾</i><Ghost size={24} strokeWidth={1.3}/><b>✦</b></span><span><strong>南瓜夜宴</strong><small>万圣节限定 · 主页美化</small></span>{reward.unlocked && <Check size={16}/>}</div>
    {reward.unlocked ? <><p>已收入内置美化，随时可以换上。</p>{onOpenBeauty && <button type="button" onClick={onOpenBeauty}>去美化看看 <ArrowRight size={14}/></button>}</> : <><p>{settling ? '正在收好今晚的糖……' : `糖袋里有 ${reward.candies} 颗 · 可跨局累计`}</p><button type="button" disabled={settling || busy || reward.candies < 3} onClick={() => void redeem()}>{busy ? '正在兑换…' : '3 颗糖 · 兑换主题'}</button></>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
