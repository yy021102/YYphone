import type { XianyuChatThread, XianyuProduct } from '../apps/TaobaoApp';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function xianyuMoney(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) throw new Error('价格需在 0 至 1000000 元之间。');
  return Math.round(value * 100) / 100;
}
export const xianyuReplyInstructions = (isBuyer: boolean) => isBuyer
  ? '只返回 JSON：{"reply":["买家短句"],"buy":false}。reply 为1～5条自然消息；只有决定按当前实际价格拍下并付款才返回 buy:true，询问、议价或已售出时为false。你是买家，无权修改卖家价格；不声称按尚未修改的议价金额成交。'
  : '只返回 JSON：{"reply":["卖家短句"],"priceChange":null}。reply 为1～5条自然消息。你可以同意议价或拒绝，不强制降价。真正同意给买家改价时，priceChange 必须填写改好的实际总价数字，例如 {"reply":["80给你吧","改好了 可以拍了"],"priceChange":80}；仅讨论、询价、拒绝或提出尚待确认的方案时为null。不把原价、差额、运费单独当作新总价。所有价格均为这件商品的总价；商品售出后禁止改价。不要只口头声称改好了却不填写priceChange，不替买家付款。';

export function parseXianyuReply(value: unknown, isBuyer: boolean) {
  if (!record(value)) throw new Error('回复格式无效，请重试。');
  const parts = typeof value.reply === 'string' ? [value.reply] : value.reply;
  if (!Array.isArray(parts) || !parts.length || parts.length > 5 || parts.some(p => typeof p !== 'string' || !p.trim() || p.length > 2000)) throw new Error('回复需要包含有效的聊天消息。');
  const reply = parts.map(p => (p as string).trim());
  if (isBuyer && value.priceChange != null) throw new Error('买家不能替卖家改价。');
  if (isBuyer && typeof value.buy !== 'boolean') throw new Error('买家未返回有效的购买决定，请重试。');
  let price: number | undefined;
  if (!isBuyer && value.priceChange != null) price = xianyuMoney(value.priceChange);
  // Keep a plain verbal promise from silently becoming another ineffective price change.
  if (!isBuyer && price === undefined && /改好(?:了|啦)|已(?:经)?改(?:成|到|为)|给你改(?:成|到|为|了)|改(?:成|到|为)\s*[¥￥]?\s*\d+(?:\.\d+)?\s*(?:元|块)?了/.test(reply.join(' ')) && !/(?:没有|没|未|不|不能|无法|别|不要)\s*(?:给你)?\s*改/.test(reply.join(' '))) throw new Error('卖家提到了改价，但没有返回实际新价格，请重新生成。');
  return { reply, buy: isBuyer && value.buy === true, price };
}

export function applyXianyuPrice(items: XianyuProduct[], threads: XianyuChatThread[], itemId: string, price: number) {
  const amount = xianyuMoney(price), item = items.find(i => i.id === itemId);
  if (!item) throw new Error('商品已下架。');
  if (item.soldToThreadId) throw new Error('已成交的商品不能改价。');
  return { items: items.map(i => i.id === itemId ? { ...i, price: amount } : i), threads: threads.map(t => t.itemId === itemId ? { ...t, itemPrice: amount } : t) };
}

/** Replace only the final peer batch; never roll back a financial transaction. */
export function prepareXianyuReroll(thread: XianyuChatThread, item?: XianyuProduct) {
  if (!item) throw new Error('商品已下架。');
  if (item.soldToThreadId) throw new Error('已成交的对话不能重生成，请使用编辑消息。');
  const last = thread.messages.at(-1);
  if (!last || last.sender !== 'peer') throw new Error('当前没有可重新生成的对方回复。');
  let start = thread.messages.length - 1;
  if (last.batchId) while (start > 0 && thread.messages[start - 1].sender === 'peer' && thread.messages[start - 1].batchId === last.batchId) start--;
  const removed = thread.messages.slice(start), change = removed.find(m => m.priceChange)?.priceChange;
  if (change && item.price !== change.after) throw new Error('这轮回复之后价格已变动，不能回退旧改价；可以编辑消息或继续聊天。');
  return { messages: thread.messages.slice(0, start), price: change?.before ?? item.price };
}
