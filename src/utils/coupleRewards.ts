import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';
import { readStorageString, readStoredValue } from './localStorage';
import { setStorageItemsAtomically } from './dbStorage';
import { ALIPAY_STORAGE_KEY, readAlipayData, type PaymentSource } from './alipayData';
import { activeMemoryArchive } from './memoryArchives';
import { giftDateToday, giftMemoryContent } from './giftMemory';

export const COUPLE_REWARDS_KEY = 'yyphone:couple-rewards';
export const COUPLE_REWARDS_EVENT = 'yyphone:couple-rewards';
const SPACES = 'yyphone:couple-spaces';
const CHATS = 'yyphone:wechat-chats';
export type CouponOwner = 'user' | 'char';
export const COUPLE_PRODUCTS = [
  { id: 'kiss', name: '亲亲券', price: 3, icon: 'heart', description: '向对方领取一个亲亲', rule: '给使用者一个符合你们关系、温柔自然的亲亲回应。' },
  { id: 'sleep', name: '哄睡券', price: 5, icon: 'moon', description: '让对方哄自己睡觉', rule: '温柔哄使用者入睡，陪伴并接住当下情绪，不要催促入睡。' },
  { id: 'gift', name: '礼物券', price: 8, icon: 'gift', description: '让对方为自己挑一份礼物', rule: '为使用者认真挑选一份符合喜好的礼物；购买送礼仍须走正常流程，券本身不产生扣款或凭空到账。' },
  { id: 'letter', name: '一封情书券', price: 10, icon: 'mail', description: '收下一封只属于自己的信', rule: '为使用者写一封真诚细腻、贴合你们共同经历的情书，避免套话。' },
  { id: 'emperor', name: '一日小皇帝', price: 15, icon: 'crown', description: '今天，对方要好好哄着自己', rule: '截至今天结束，对方要多哄着使用者，主动关心、迁就和照顾其心情，尊重彼此的界限。' },
  { id: 'peace-bell', name: '和好摇铃', price: 20, icon: 'bell', description: '立刻停战，今日不能再次拉黑', rule: '立即停止吵架和冷战，温和沟通，不再升级矛盾；今天不能再次拉黑。解除拉黑已由系统真实完成，不要继续演绎被拉黑。' },
] as const;
export type CoupleProductId = typeof COUPLE_PRODUCTS[number]['id'];
export const coupleProduct = (id: string) => COUPLE_PRODUCTS.find(p => p.id === id);
/** The person spending the voucher receives the affection; the other person performs it. */
export function couponUseInstructions(id: CoupleProductId, owner: CouponOwner): string {
  const receiver = owner === 'char' ? '角色（你）' : '玩家';
  const performer = owner === 'char' ? '玩家' : '角色（你）';
  const effect = {
    kiss: `${performer}亲吻${receiver}。`,
    sleep: `${performer}哄${receiver}睡觉，${receiver}是被哄睡的一方。`,
    gift: `${performer}为${receiver}挑选并送出礼物，实际送达才算完成。`,
    letter: `${performer}给${receiver}写情书，${receiver}是收信的一方。`,
    emperor: `今天由${performer}哄着、照顾和迁就${receiver}，${receiver}是今日的小皇帝。`,
    'peace-bell': '双方立即停止争吵、恢复联系，今天不能再次拉黑。',
  }[id];
  return `使用者与受益者：${receiver}；履约者：${performer}。${effect}使用者是在向对方提出请求，不是承诺替对方做这件事。`;
}
export interface PointAward { key: string; day: string; kind: 'mood' | 'diary' | 'qa'; at: string }
export interface CouponPurchase { id: string; owner: CouponOwner; productId: CoupleProductId; cost: number; at: string; reason?: string }
export interface CouponUse { id: string; owner: CouponOwner; productId: CoupleProductId; at: string; chatId: string; archiveId: string; note: string; noticeSeen?: boolean; respondedAt?: string; fulfilledAt?: string; fulfillmentMessageId?: string }
export interface CouponGiftTarget { charId: string; useId: string }
export interface CoupleWallet { awards: PointAward[]; purchases: CouponPurchase[]; uses: CouponUse[] }
type WalletMap = Record<string, CoupleWallet>;
type Row = Record<string, any>;
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const emptyWallet = (): CoupleWallet => ({ awards: [], purchases: [], uses: [] });
export const rewardDay = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const validDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && rewardDay(new Date(`${s}T12:00:00`)) === s;
const rawSpaces = () => readStoredValue(SPACES, {}, record) as Record<string, CharacterCoupleSpace>;
const readChats = (): Row[] => readStoredValue(CHATS, [], (v): v is Row[] => Array.isArray(v) && v.every(record));

export function readCoupleWallets(): WalletMap {
  let value: unknown;
  try { const raw = readStorageString(COUPLE_REWARDS_KEY); value = raw === null ? {} : JSON.parse(raw); }
  catch { throw new Error('积分账本格式异常，未覆盖原有数据。'); }
  if (!record(value)) throw new Error('积分账本格式异常，未覆盖原有数据。');
  for (const w of Object.values(value)) {
    if (!record(w) || !Array.isArray(w.awards) || !Array.isArray(w.purchases) || !Array.isArray(w.uses) ||
      !w.awards.every((a: unknown) => record(a) && typeof a.key === 'string' && typeof a.day === 'string') ||
      !w.purchases.every((p: unknown) => record(p) && typeof p.id === 'string' && ['user', 'char'].includes(p.owner) && !!coupleProduct(p.productId) && Number.isSafeInteger(p.cost) && p.cost >= 3) ||
      !w.uses.every((u: unknown) => record(u) && typeof u.id === 'string' && ['user', 'char'].includes(u.owner) && !!coupleProduct(u.productId) && typeof u.at === 'string')) {
      throw new Error('积分账本格式异常，未覆盖原有数据。');
    }
  }
  return { ...value } as WalletMap;
}
const readWallets = readCoupleWallets;
export const readCoupleWallet = (charId: string): CoupleWallet => readWallets()[charId] ?? emptyWallet();
export const coupleBalance = (wallet: CoupleWallet, owner: CouponOwner) => wallet.awards.length - wallet.purchases.filter(p => p.owner === owner).reduce((n, p) => n + p.cost, 0);
export const couponStock = (wallet: CoupleWallet, owner: CouponOwner, productId: CoupleProductId) =>
  wallet.purchases.filter(p => p.owner === owner && p.productId === productId).length - wallet.uses.filter(u => u.owner === owner && u.productId === productId).length;
export const coupleBlockProtection = (charId: string, now = new Date()) =>
  readCoupleWallet(charId).uses.some(u => u.productId === 'peace-bell' && rewardDay(new Date(u.at)) === rewardDay(now));

/** One award per local calendar date and activity. Editing/deleting never removes an already earned award. */
export function settleWallet(wallet: CoupleWallet, space: CharacterCoupleSpace, now = new Date()): CoupleWallet {
  if (space.bindStatus !== 'bound') return wallet;
  const today = rewardDay(now);
  const keys = new Set(wallet.awards.map(a => a.key));
  const awards = [...wallet.awards];
  const add = (day: string, kind: PointAward['kind']) => {
    const key = `${day}:${kind}`;
    if (!validDay(day) || day > today || keys.has(key)) return;
    keys.add(key); awards.push({ key, day, kind, at: now.toISOString() });
  };
  for (const [day, mood] of Object.entries(space.moods ?? {})) if (mood.userMoodId && mood.charMoodId) add(day, 'mood');
  const diaries = space.diaries ?? [];
  const userDays = new Set(diaries.filter(d => d.author === 'user' && d.content?.trim()).map(d => d.dateStr));
  for (const d of diaries) if (d.author === 'char' && d.content?.trim() && userDays.has(d.dateStr)) add(d.dateStr, 'diary');
  for (const q of space.qaList ?? []) if (q.question?.trim() && q.userAnswer?.trim() && q.charAnswer?.trim()) add(q.dateStr, 'qa');
  return awards.length === wallet.awards.length ? wallet : { ...wallet, awards };
}

let queue: Promise<unknown> = Promise.resolve();
const serialized = <T,>(action: () => Promise<T>): Promise<T> => {
  const task = queue.then(action); queue = task.catch(() => undefined); return task;
};
/** Space import/reset/unbind must share the points queue with purchases and voucher uses. */
export const withCoupleDataWrite = serialized;
const changed = (chat = false) => {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  window.dispatchEvent(new Event(COUPLE_REWARDS_EVENT));
  if (chat) window.dispatchEvent(new Event('yyphone:blocked-interactions'));
};
export const settleCouplePoints = () => serialized(async () => {
  const all = readWallets(); let dirty = false;
  for (const [id, space] of Object.entries(rawSpaces())) {
    const old = all[id] ?? emptyWallet(), next = settleWallet(old, space);
    if (next !== old) { all[id] = next; dirty = true; }
  }
  if (dirty) { await setStorageItemsAtomically({ [COUPLE_REWARDS_KEY]: all }); changed(); }
});

function requiredSpace(charId: string) {
  const space = rawSpaces()[charId];
  if (space?.bindStatus !== 'bound') throw new Error('请先开通情侣空间。');
  return space;
}
export function assertCouponAvailable(charId: string, owner: CouponOwner, productId: string) {
  requiredSpace(charId);
  const product = coupleProduct(productId);
  if (!product || couponStock(readCoupleWallet(charId), owner, product.id) < 1) throw new Error('这张券库存不足，未使用。');
  if (product.id === 'peace-bell' && coupleBlockProtection(charId)) throw new Error('今天已经摇过和好铃了，留到下次吧。');
  if (product.id === 'emperor' && readCoupleWallet(charId).uses.some(u => u.productId === 'emperor' && rewardDay(new Date(u.at)) === rewardDay())) throw new Error('今天的小皇帝已经就位，明天再用吧。');
  return product;
}
export const buyCoupleCoupon = (charId: string, owner: CouponOwner, productId: CoupleProductId, requestId: string, reason = '', expectedSpaceRevision?: string) => serialized(async () => {
  const space = requiredSpace(charId), all = readWallets();
  if (expectedSpaceRevision !== undefined && expectedSpaceRevision !== (space.dataRevision || '')) throw new Error('情侣空间数据已变化，未扣除积分。');
  const wallet = settleWallet(all[charId] ?? emptyWallet(), space);
  if (wallet.purchases.some(p => p.id === requestId)) return wallet;
  const product = coupleProduct(productId);
  if (!product || !requestId) throw new Error('找不到这件商品。');
  if (coupleBalance(wallet, owner) < product.price) throw new Error('积分还不够，再一起攒一点吧。');
  const next = { ...wallet, purchases: [...wallet.purchases, { id: requestId, owner, productId, cost: product.price, at: new Date().toISOString(), reason: reason.trim().slice(0, 160) }] };
  await setStorageItemsAtomically({ [COUPLE_REWARDS_KEY]: { ...all, [charId]: next } }); changed(); return next;
});

export const useCoupleCoupon = (charId: string, owner: CouponOwner, productId: CoupleProductId, requestId: string,
  options: { note?: string; expectedChatId?: string; expectedArchiveId?: string; expectedBlockedSince?: string; expectedSpaceRevision?: string } = {}) => serialized(async () => {
  const space = requiredSpace(charId); const all = readWallets(), wallet = all[charId] ?? emptyWallet();
  if (options.expectedSpaceRevision !== undefined && options.expectedSpaceRevision !== (space.dataRevision || '')) throw new Error('情侣空间数据已变化，未使用这张券。');
  const existing = wallet.uses.find(u => u.id === requestId);
  if (existing) return existing;
  const product = assertCouponAvailable(charId, owner, productId);
  if (!requestId) throw new Error('使用请求无效。');
  const chats = readChats();
  const chat = chats.find(c => c.type === 'direct' && c.participantIds?.length === 1 && c.participantIds[0] === charId);
  if (!chat || !Array.isArray(chat.messages)) throw new Error('找不到你们的微信对话，请先发起聊天。');
  if ((options.expectedChatId && options.expectedChatId !== chat.id) ||
    (options.expectedArchiveId !== undefined && options.expectedArchiveId !== (chat.activeArchiveId ?? '')) ||
    (options.expectedBlockedSince !== undefined && (!chat.blocked || chat.blockedSince !== options.expectedBlockedSince))) throw new Error('聊天状态已变化，未使用这张券。');
  if (chat.blocked && productId !== 'peace-bell') throw new Error('对方仍在黑名单中，暂时不能使用这张券。');
  if (productId === 'peace-bell' && coupleBlockProtection(charId)) throw new Error('今天已经摇过和好铃了，留到下次吧。');
  if (productId === 'emperor' && wallet.uses.some(u => u.productId === 'emperor' && rewardDay(new Date(u.at)) === rewardDay())) throw new Error('今天的小皇帝已经就位，明天再用吧。');
  const at = new Date().toISOString();
  const use: CouponUse = { id: requestId, owner, productId, at, chatId: chat.id, archiveId: chat.activeArchiveId ?? '', note: (options.note ?? '').trim().slice(0, 200) };
  const message = { id: `coupon:${requestId}`, senderId: owner === 'user' ? 'user' : charId, kind: 'couple-coupon',
    couponUseId: requestId, couponProductId: productId,
    text: `${owner === 'user' ? '我' : '对方'}使用了${product.name}`, title: product.name,
    content: use.note || product.description, aiContext: `【情侣空间券已真实使用，库存已扣除】${couponUseInstructions(productId, owner)}${product.rule}`, createdAt: at };
  const restored = productId === 'peace-bell' ? { blocked: false, blockedNextAt: undefined, blockedBacklogGeneratedAt: at, blockedBacklogRetryAt: undefined } : {};
  const values: Record<string, unknown> = {
    [COUPLE_REWARDS_KEY]: { ...all, [charId]: { ...wallet, uses: [...wallet.uses, use] } },
    [CHATS]: chats.map(c => c.id === chat.id ? { ...c, ...restored, coupleCouponRevision: requestId, messages: [...c.messages, message], updatedAt: at } : c),
  };
  if (productId === 'peace-bell') {
    const interactions = readStoredValue('yyphone:blocked-contacts', [], (v): v is Row[] => Array.isArray(v) && v.every(record));
    values['yyphone:blocked-contacts'] = interactions.map(i => i.chatId === chat.id && i.status === 'pending'
      ? { ...i, status: i.type === 'friend-request' ? 'accepted' : 'drawer' } : i);
  }
  await setStorageItemsAtomically(values); changed(true); return use;
});

export const unseenCoupleBell = () => Object.entries(readWallets()).flatMap(([charId, w]) => w.uses
  .filter(u => u.productId === 'peace-bell' && u.owner === 'char' && !u.noticeSeen).map(use => ({ charId, use })))[0];
export const acknowledgeCoupleBell = (charId: string, id: string) => serialized(async () => {
  const all = readWallets(), wallet = all[charId]; if (!wallet) return;
  await setStorageItemsAtomically({ [COUPLE_REWARDS_KEY]: { ...all, [charId]: { ...wallet, uses: wallet.uses.map(u => u.id === id ? { ...u, noticeSeen: true } : u) } } }); changed();
});
export const acknowledgeCouponRequests = (charId: string, ids: string[]) => serialized(async () => {
  const all = readWallets(), wallet = all[charId]; if (!wallet || !ids.length) return;
  await setStorageItemsAtomically({ [COUPLE_REWARDS_KEY]: { ...all, [charId]: { ...wallet, uses: wallet.uses.map(u => ids.includes(u.id) && !['letter', 'gift'].includes(u.productId) ? { ...u, respondedAt: new Date().toISOString() } : u) } } }); changed();
});

export function coupleRewardContext(charId: string, archiveId?: string): { text: string; pendingIds: string[] } {
  if (rawSpaces()[charId]?.bindStatus !== 'bound') return { text: '', pendingIds: [] };
  const wallet = readCoupleWallet(charId), today = rewardDay();
  const inventory = COUPLE_PRODUCTS.filter(p => couponStock(wallet, 'char', p.id) > 0).map(p => `${p.id}（${p.name}）×${couponStock(wallet, 'char', p.id)}`);
  const pending = wallet.uses.filter(u => u.owner === 'user' && !u.respondedAt && !u.fulfilledAt && (archiveId === undefined || u.archiveId === archiveId) &&
    (!['peace-bell', 'emperor'].includes(u.productId) || rewardDay(new Date(u.at)) === today)).slice(-8);
  const dayEffects = wallet.uses.filter(u => ['peace-bell', 'emperor'].includes(u.productId) && rewardDay(new Date(u.at)) === today);
  if (!inventory.length && !pending.length && !dayEffects.length) return { text: '', pendingIds: [] };
  return { text: ['【情侣空间积分与心愿券】',
    '所有心愿券都是让另一方为使用者行动：你用券时，你享受玩家为你做的事；玩家用券时，由你为玩家做。不要把使用者和履约者弄反。',
    `你自己的库存：${inventory.join('；') || '暂无'}。库存属于角色，不能使用玩家的券，也不能凭空制造或重复使用。`,
    ...COUPLE_PRODUCTS.filter(p => couponStock(wallet, 'char', p.id) > 0).map(p => `${p.name}：${couponUseInstructions(p.id, 'char')}`),
    inventory.length ? '普通私聊时可根据人设、剧情主动使用一张已有券，在JSON顶层返回 "coupleCouponUse":"商品id"；不使用时省略。每轮最多一张，系统会验证库存并发出使用卡片。不要仅在正文声称已经用券。重生成、预览、群聊与通话不能使用。和好铃或皇帝券当天已生效时不可再次使用。' : '',
    ...pending.map(u => `玩家已使用${coupleProduct(u.productId)?.name}，请在本轮自然回应：${u.productId === 'letter' ? '情书会通过独立信封寄出，不要把普通回复当作已经寄信，也不要重复写信。' : u.productId === 'gift' ? '礼物需在淘宝选购并真实送达后才算完成，不要仅凭口头承诺宣称已履约。' : coupleProduct(u.productId)?.rule}${u.note ? ` 附言：${u.note}` : ''}`),
    ...dayEffects.map(u => `今日生效：${coupleProduct(u.productId)?.name}。${couponUseInstructions(u.productId, u.owner)}${coupleProduct(u.productId)?.rule}`),
  ].filter(Boolean).join('\n'), pendingIds: pending.map(u => u.id) };
}

export const findCouponUse = (charId: string, useId: string) => readCoupleWallet(charId).uses.find(u => u.id === useId);
export const pendingCharacterLetters = () => Object.entries(readWallets()).flatMap(([charId, w]) => w.uses
  .filter(u => u.productId === 'letter' && u.owner === 'user' && !u.fulfilledAt).map(use => ({ charId, use })));

function fulfillmentTarget(charId: string, useId: string, productId: 'letter' | 'gift', expectedSpaceRevision?: string) {
  const space = requiredSpace(charId);
  if (expectedSpaceRevision !== undefined && expectedSpaceRevision !== (space.dataRevision || '')) throw new Error('情侣空间数据已变化，请重新收取。');
  const all = readWallets(), wallet = all[charId], use = wallet?.uses.find(u => u.id === useId);
  if (!use || use.productId !== productId) throw new Error('找不到这张券的使用记录。');
  const chats = readChats(), chat = chats.find(c => c.id === use.chatId && c.type === 'direct' && c.participantIds?.length === 1 && c.participantIds[0] === charId);
  if (!chat || chat.blocked || (chat.activeArchiveId ?? '') !== use.archiveId) throw new Error('请回到用券时的聊天存档，并确认双方仍是好友。');
  return { all, wallet, use, chats, chat };
}
function fulfillmentValues(target: ReturnType<typeof fulfillmentTarget>, charId: string, message: Row) {
  const { all, wallet, use, chats, chat } = target;
  const at = message.createdAt as string;
  return {
    [COUPLE_REWARDS_KEY]: { ...all, [charId]: { ...wallet, uses: wallet.uses.map(u => u.id === use.id ? { ...u, fulfilledAt: at, respondedAt: at, fulfillmentMessageId: message.id } : u) } },
    [CHATS]: chats.map(c => c.id !== chat.id ? c : { ...c, coupleCouponRevision: `fulfill:${use.id}`, updatedAt: at,
      messages: [...c.messages.map((m: Row) => m.id === `coupon:${use.id}` || m.couponUseId === use.id && m.kind === 'couple-coupon'
        ? { ...m, couponCompletedAt: at, couponFulfillmentId: message.id, aiContext: `这张情侣空间券已经完成，履约内容见消息${message.id}，不要重复执行。` } : m), message],
    }),
  } as Record<string, unknown>;
}
const characterName = (id: string) => readStoredValue('pocketos:wechat-contacts', [], (v): v is Row[] => Array.isArray(v)).find(c => c.id === id)?.name ?? '对方';
const playerName = () => {
  const personas = readStoredValue('pocketos:personas', {}, record);
  const p = Array.isArray(personas.profiles) ? personas.profiles.find((v: Row) => v.id === personas.activeProfileId) : undefined;
  return p?.nickname || p?.name || '我';
};
export const fulfillCoupleLetter = (charId: string, useId: string, writer: CouponOwner, letter: { title: string; body: string }, expectedSpaceRevision?: string) => serialized(async () => {
  const target = fulfillmentTarget(charId, useId, 'letter', expectedSpaceRevision);
  if (writer === target.use.owner) throw new Error('情书应由收到请求的另一方来写。');
  if (target.use.fulfilledAt) return target.use.fulfillmentMessageId!;
  const body = letter.body.trim();
  if (!body || Array.from(body).length > 2000) throw new Error('请写下情书正文，最多 2000 字。');
  const message = { id: `letter:${useId}`, senderId: writer === 'user' ? 'user' : charId, kind: 'couple-letter',
    text: '寄来了一封情书', title: letter.title.trim().slice(0, 50) || '给你的一封信', content: body,
    couponUseId: useId, letterFromName: writer === 'user' ? playerName() : characterName(charId),
    letterToName: writer === 'user' ? characterName(charId) : playerName(), createdAt: new Date().toISOString(),
    aiContext: '情书已经真实寄出，内容见正文。情侣空间情书券已完成，不要重复寄送。',
  };
  await setStorageItemsAtomically(fulfillmentValues(target, charId, message)); changed(true); return message.id;
});

/** The product, recipient, payment and delivery are committed together. Opening/cancelling never completes a voucher. */
export const fulfillCoupleGift = (request: CouponGiftTarget, productId: string, payment: PaymentSource = { type: 'balance' }, expectedPrice?: number) => serialized(async () => {
  const target = fulfillmentTarget(request.charId, request.useId, 'gift');
  if (target.use.fulfilledAt) return { messageId: target.use.fulfillmentMessageId!, alreadyCompleted: true };
  const products = readStoredValue('yyphone:taobao-market-products', [], (v): v is Row[] => Array.isArray(v));
  const product = products.find(p => p.id === productId && p.category === 'shopping');
  if (!product || typeof product.title !== 'string' || !product.title.trim()) throw new Error('这件淘宝商品已不存在，请重新选择。');
  const cents = Math.round(Number(product.price) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('商品价格无效，未支付。');
  if (expectedPrice !== undefined && Math.round(expectedPrice * 100) !== cents) throw new Error('商品价格已变化，请重新确认后再下单。');
  const amount = cents / 100, at = new Date().toISOString(), toCharacter = target.use.owner === 'char';
  const message = { id: `coupon-gift:${request.useId}`, senderId: toCharacter ? 'user' : request.charId, kind: 'order',
    text: `送出礼物「${product.title}」`, title: product.title, content: String(product.desc ?? '').slice(0, 300),
    amount: amount.toFixed(2), imageUrl: product.imageUrl, productEmoji: product.emoji || '🎁', orderCategory: 'shopping', orderMode: 'gift',
    recipientId: toCharacter ? request.charId : 'user', source: '淘宝 · 礼物券已完成', couponUseId: request.useId,
    aiContext: `情侣空间礼物券已完成：${toCharacter ? '玩家送给角色' : '角色送给玩家'}「${product.title}」，已送达。`, createdAt: at };
  const values = fulfillmentValues(target, request.charId, message);
  if (toCharacter) {
    const account = readAlipayData();
    const card = payment.type === 'intimate' ? account.intimateCards.find(c => c.charId === payment.charId) : undefined;
    if (payment.type === 'intimate' && !card) throw new Error('所选亲密付不可用，未支付。');
    if (card ? cents > Math.round((card.monthlyLimit - card.usedAmount) * 100) : cents > Math.round(account.balance * 100)) throw new Error(card ? '亲密付额度不足，礼物券尚未完成。' : '余额不足，礼物券尚未完成。');
    values[ALIPAY_STORAGE_KEY] = { ...account, balance: card ? account.balance : (Math.round(account.balance * 100) - cents) / 100,
      intimateCards: card ? account.intimateCards.map(c => c.id === card.id ? { ...c, usedAmount: (Math.round(c.usedAmount * 100) + cents) / 100 } : c) : account.intimateCards };
  } else {
    const inventory = readStoredValue('yyphone:inventory', { items: [], backfilled: false }, (v): v is { items: Row[]; backfilled: boolean } => record(v) && Array.isArray(v.items));
    values['yyphone:inventory'] = { ...inventory, items: [...inventory.items, { id: `inv-msg-${message.id}`, kind: 'gift', recipientId: 'user', title: product.title,
      desc: product.desc ?? '', emoji: product.emoji || '🎁', imageUrl: product.imageUrl, price: amount, fromCharId: request.charId,
      fromCharName: characterName(request.charId), shop: '淘宝', sourceMessageId: message.id, acquiredAt: at }] };
  }
  const gift = { name: product.title.slice(0, 100), direction: toCharacter ? 'player-to-character' as const : 'character-to-player' as const,
    date: giftDateToday(), scene: '在淘宝选购并送达，兑现情侣空间礼物券。', sourceKey: message.id };
  const memories = readStoredValue('yyphone:memory-items', [], (v): v is Row[] => Array.isArray(v));
  values['yyphone:memory-items'] = [...memories, { id: `memory:${message.id}`, charId: request.charId, archiveKey: activeMemoryArchive(request.charId),
    content: giftMemoryContent(gift), category: 'item', importance: 3, pinned: false, createdAt: at, updatedAt: at, recallCount: 0, source: 'chat', gift }];
  await setStorageItemsAtomically(values); changed(true);
  window.dispatchEvent(new Event('yyphone:finance-change'));
  return { messageId: message.id, alreadyCompleted: false };
});
