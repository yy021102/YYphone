export const RECHARGE_PLAYBACK_MS = 16000;
export const rechargePrice = (gems: number, gemsPerYuan = 10) => (gems / gemsPerYuan).toFixed(2);
export function rechargeQuote(yuan: number, gemsPerYuan: number) {
  if (!Number.isFinite(yuan) || yuan <= 0 || yuan > 1000000 || Math.abs(yuan * 100 - Math.round(yuan * 100)) > 0.000001) throw new Error('角色充值金额应为正数，最多两位小数。');
  if (!Number.isFinite(gemsPerYuan) || gemsPerYuan <= 0 || gemsPerYuan > 1000000) throw new Error('请设置有效的充值汇率。');
  const gems = Math.floor(yuan * gemsPerYuan + 0.00000001);
  if (gems < 1) throw new Error('这次充值不足兑换 1 星钻，请增加金额或调整汇率。');
  return { yuan, gems };
}
