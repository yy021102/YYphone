import { readAlipayData, writeAlipayData } from './alipayData';
import { readStoredValue, writeStoredValue } from './localStorage';
import type { PokerGame } from './zhaJinHua';

const PROGRESS_KEY = 'yyphone:wechat:zha-jin-hua';
const isGame = (value: unknown): value is PokerGame => {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<PokerGame>;
  return typeof game.id === 'string' && Number.isSafeInteger(game.buyIn) &&
    Array.isArray(game.seats) && game.seats.length === 3 &&
    game.seats.every(seat => seat && typeof seat.id === 'string' && typeof seat.chips === 'number' && Array.isArray(seat.cards)) &&
    typeof game.pot === 'number' && typeof game.turn === 'number' && Array.isArray(game.log);
};
export const readPokerProgress = () => readStoredValue(PROGRESS_KEY, null as PokerGame | null, (value): value is PokerGame | null => value === null || isGame(value));
export const writePokerProgress = (game: PokerGame | null) => writeStoredValue(PROGRESS_KEY, game);

export function pokerLedger(gameId: string, phase: 'buy-in' | 'payout', amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('筹码金额无效');
  const data = readAlipayData();
  const id = `${gameId}-${phase}`;
  if (data.ledgerList.some(item => item.id === id)) return data.balance;
  if (phase === 'buy-in' && data.balance < amount) throw new Error(`支付宝余额不足，当前余额 ¥${data.balance.toFixed(2)}`);
  const change = phase === 'buy-in' ? -amount : amount;
  const now = new Date();
  const next = Math.round((data.balance + change) * 100) / 100;
  writeAlipayData({
    ...data, balance: next,
    ledgerList: [{
      id, title: phase === 'buy-in' ? '微信游戏 · 炸金花买入' : '微信游戏 · 炸金花结算',
      amount, isExpense: phase === 'buy-in',
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      category: '游戏',
    }, ...data.ledgerList],
  });
  window.dispatchEvent(new Event('yyphone:finance-change'));
  return next;
}
