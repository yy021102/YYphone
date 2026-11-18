import { rechargeQuote } from './nurtureRecharge';
import { readStorageString, writeStoredValue } from './localStorage';
import { requestConfiguredAiText } from './aiApi';
import { parseAiJson } from './aiResponse';
import { readAnthologyAuthors } from './anthology';
import { readNurtureIdentity, ownedProducts, validOwnedProduct, productContext, type OwnedProduct } from './nurtureInventory';
import { BODY_PARTS, emptyPortrait, initialWallet, validPortrait, validWallet, touchTargets, selectRoundTouches, type Portrait, type Wallet, type BodyPart } from './nurtureGame';
import { MEMORY_RULES, archiveRound, makeRecap, memoryContext, memoryFor, validMemory, validRecap, type NurtureMemory, type RoundRecap } from './nurtureMemory';
import { defaultDesign, withoutStarterContent, emptyDelta, validDesign, validateDesign, validProduct, type GameDesign, type GameProduct } from './nurtureDesign';
import { cardsForDraw, isPityRare, prepareDrawSequence, srPityFromCollection } from './nurtureGacha';
import { defaultPool, poolContext, validPool, type PoolCampaign } from './nurturePool';

export const STAT_LABELS = { mood: '心情', energy: '体力', affection: '亲密', growth: '成长' };
export type Stats = Record<keyof typeof STAT_LABELS, number>;
export type Card = { id: string; name: string; rarity: string; weight: number; image: string; description: string; artType?: 'text' | 'image'; artText?: string; pityEligible?: boolean; limited?: boolean; releasedAt?: string };
export type Event = { title: string; description: string; enabled: boolean; endsAt: string };
export type Plan = { stats: Stats; speech: string; cards: Card[]; event: Event; pool?: PoolCampaign };
export type Step = { action: string; thought: string; speech: string; delta: Stats; draw: boolean; card?: Card; kind?: string; target?: BodyPart; itemId?: string; wallet?: Wallet; acquired?: string; receipt?: string; drawCount?: 1 | 10; drawnCards?: Card[]; resultThought?: string; paymentThought?: string; rechargeYuan?: number; rechargeGems?: number; rechargeRate?: number; coinReward?: number; drawResultIds?: string[]; pityAfter?: number; srPityAfter?: number; purchasedItem?: OwnedProduct; sentItemId?: string; statusNote?: string; giftedProduct?: GameProduct };
export type Round = { id: string; createdAt: string; steps: Step[]; cursor: number; before: Stats; after: Stats; number?: number; recap?: RoundRecap; eventTitle?: string; openingThought?: string; poolRevision?: string };
export type Save = { version: 1; stats: Stats; cards: Card[]; event: Event; collection: Card[]; rounds: Round[]; pending?: Plan; portrait?: Portrait; wallet?: Wallet; inventory?: string[]; memory?: NurtureMemory; design?: GameDesign; pity?: number; srPity?: number; items?: OwnedProduct[]; pool?: PoolCampaign; starterContentCleared?: boolean };
const keys = Object.keys(STAT_LABELS) as (keyof Stats)[];
const BRIEF_THOUGHT_RULES = '\n心理活动用于逐条播放，务必简短：thought、openingThought、paymentThought、resultThought 每段只写1～2个短句，建议20～45个中文字，围绕眼前这次具体操作与反应；不要写长篇分析、背景复述或重复抒情。memory.thoughts也用简短句子概括留存的心情。此要求只针对AI生成的心理活动，绝不能缩写、截断、改写用户预设的留言、触碰发言或收礼反应。';
const ROUND_TOUCH_RULES = '\n本轮touchTargets已经由程序随机抽选，数量最多3个。必须为列表中的每个位置分别安排恰好1个kind=touch的步骤，target逐一匹配；禁止重复触碰同一位置或触碰列表外位置。列表为空时不触碰。先在openingThought中写打开游戏的心声，再将这些触碰放在steps开头，全部触碰结束后才安排其他可选游戏操作。每次触碰的thought必须写角色在触碰该具体部位、读到该部位reply原文之后的第一人称心理活动：结合位置、触碰动作、这句具体发言、人设、当前关系阶段与前轮记忆写出独立反应，不能套用相同的泛泛独白，不能只写触碰前的期待。角色此时只读到了预设reply，不得补写、改写或揣测user的新发言。speech仍返回空字符串，程序将原样填入对应reply。';
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: Record<string, unknown>, names: string[]) => names.every(k => typeof v[k] === 'string');
export const validStats = (v: unknown): v is Stats => obj(v) && keys.every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 100);
const validDelta = (v: unknown, limit = Infinity): v is Stats => obj(v) && keys.every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && Math.abs(v[k]) <= limit);
const validCard = (v: unknown): v is Card => obj(v) && strings(v, ['id', 'name', 'rarity', 'image', 'description']) && !!v.id && !!v.name && !!v.rarity && typeof v.weight === 'number' && Number.isFinite(v.weight) && v.weight >= 0 && (v.artType === undefined || v.artType === 'text' || v.artType === 'image') && (v.artText === undefined || typeof v.artText === 'string') && (v.pityEligible === undefined || typeof v.pityEligible === 'boolean') && (v.limited === undefined || typeof v.limited === 'boolean') && (v.releasedAt === undefined || typeof v.releasedAt === 'string' && Number.isFinite(Date.parse(v.releasedAt)));
const validEvent = (v: unknown): v is Event => obj(v) && strings(v, ['title', 'description', 'endsAt']) && typeof v.enabled === 'boolean';
export function validatePlan(v: unknown): asserts v is Plan {
  if (obj(v) && v.pool !== undefined && !validPool(v.pool)) throw new Error('请检查卡池名称和开放期限，结束时间应晚于开始时间。');
  if (!obj(v) || !validStats(v.stats) || typeof v.speech !== 'string' || !Array.isArray(v.cards) || !v.cards.every(validCard) || new Set(v.cards.map(c => c.id)).size !== v.cards.length || !obj(v.event) || !strings(v.event, ['title', 'description', 'endsAt']) || typeof v.event.enabled !== 'boolean') throw new Error('请检查数值（0～100）、卡面和活动设置。');
  if (v.cards.length && !v.cards.some(c => c.weight > 0)) throw new Error('卡池至少需要一张卡的概率权重大于 0。');
  if (v.event.enabled && (!String(v.event.title).trim() || !Number.isFinite(Date.parse(String(v.event.endsAt))) || Date.parse(String(v.event.endsAt)) <= Date.now())) throw new Error('开启活动需要标题和未来的结束时间。');
}
export function newSave(): Save {
  return { version: 1, portrait: emptyPortrait(), wallet: initialWallet(), inventory: [], stats: emptyDelta(), starterContentCleared: true, cards: [], event: { title: '', description: '', endsAt: '', enabled: false }, collection: [], rounds: [], pity: 0, srPity: 0 };
}
const starterCards = new Map([['first', '初见的微光'], ['afternoon', '只属于你的午后'], ['promise', '星夜约定']]);
const withoutStarterCards = (cards: Card[]) => cards.filter(c => starterCards.get(c.id) !== c.name);
export const saveKey = (actorId: string, userId: string) => `yyphone:nurture:${encodeURIComponent(userId || 'default')}:${encodeURIComponent(actorId)}`;
export function readSave(key: string): Save {
  const raw = readStorageString(key);
  if (!raw) return newSave();
  try {
    const v = JSON.parse(raw);
    if (!obj(v) || v.version !== 1 || !validStats(v.stats) || !Array.isArray(v.cards) || !v.cards.every(validCard) || !validEvent(v.event) || !Array.isArray(v.collection) || !v.collection.every(validCard) || !Array.isArray(v.rounds)) throw new Error();
    if (v.pending !== undefined && (!obj(v.pending) || !validStats(v.pending.stats) || typeof v.pending.speech !== 'string' || !Array.isArray(v.pending.cards) || !v.pending.cards.every(validCard) || !validEvent(v.pending.event))) throw new Error();
    // Validate stored steps before resuming automatic playback.
    for (const r of v.rounds) {
      if (!obj(r) || !strings(r, ['id', 'createdAt']) || !validStats(r.before) || !validStats(r.after) || !Array.isArray(r.steps) || !Number.isInteger(r.cursor) || Number(r.cursor) < 0 || Number(r.cursor) > r.steps.length) throw new Error();
      if (r.openingThought !== undefined && (typeof r.openingThought !== 'string' || r.openingThought.length > 1500) || r.poolRevision !== undefined && typeof r.poolRevision !== 'string') throw new Error();
      if (r.recap !== undefined && !validRecap(r.recap) || r.number !== undefined && (!Number.isInteger(r.number) || Number(r.number) < 1) || r.eventTitle !== undefined && typeof r.eventTitle !== 'string') throw new Error();
      for (const s of r.steps) if (!obj(s) || !strings(s, ['action', 'thought', 'speech']) || !validDelta(s.delta, 15) || typeof s.draw !== 'boolean' || (s.card !== undefined && !validCard(s.card))) throw new Error();
      for (const s of r.steps) {
        if (s.purchasedItem !== undefined && !validOwnedProduct(s.purchasedItem) || s.giftedProduct !== undefined && !validProduct(s.giftedProduct) || s.sentItemId !== undefined && typeof s.sentItemId !== 'string') throw new Error();
        if (s.drawCount !== undefined && s.drawCount !== 1 && s.drawCount !== 10 || s.drawnCards !== undefined && (!Array.isArray(s.drawnCards) || ![1, 10].includes(s.drawnCards.length) || !s.drawnCards.every(validCard)) || s.resultThought !== undefined && typeof s.resultThought !== 'string') throw new Error();
        if (s.pityAfter !== undefined && (!Number.isInteger(s.pityAfter) || Number(s.pityAfter) < 0 || Number(s.pityAfter) >= 60)) throw new Error();
        if (s.srPityAfter !== undefined && (!Number.isInteger(s.srPityAfter) || Number(s.srPityAfter) < 0 || Number(s.srPityAfter) >= 20)) throw new Error();
        if (s.paymentThought !== undefined && (typeof s.paymentThought !== 'string' || s.paymentThought.length > 1500)) throw new Error();
        if (s.rechargeYuan !== undefined && (typeof s.rechargeYuan !== 'number' || !Number.isFinite(s.rechargeYuan) || s.rechargeYuan <= 0) || s.rechargeGems !== undefined && (!Number.isSafeInteger(s.rechargeGems) || Number(s.rechargeGems) < 1) || s.rechargeRate !== undefined && (typeof s.rechargeRate !== 'number' || !Number.isFinite(s.rechargeRate) || s.rechargeRate <= 0)) throw new Error();
        if (s.statusNote !== undefined && (typeof s.statusNote !== 'string' || s.statusNote.length > 3000)) throw new Error();
        if (Array.isArray(s.drawnCards) && s.drawCount !== undefined && s.drawnCards.length !== s.drawCount) throw new Error();
        if (s.wallet !== undefined && !validWallet(s.wallet) || s.target !== undefined && !BODY_PARTS.includes(s.target) || s.acquired !== undefined && typeof s.acquired !== 'string' || s.receipt !== undefined && typeof s.receipt !== 'string') throw new Error();
      }
    }
    if (v.portrait !== undefined && !validPortrait(v.portrait) || v.wallet !== undefined && !validWallet(v.wallet) || v.inventory !== undefined && (!Array.isArray(v.inventory) || !v.inventory.every(id => typeof id === 'string'))) throw new Error();
    if (v.memory !== undefined && !validMemory(v.memory)) throw new Error();
    if (v.pity !== undefined && (!Number.isInteger(v.pity) || Number(v.pity) < 0 || Number(v.pity) >= 60)) throw new Error();
    if (v.srPity !== undefined && (!Number.isInteger(v.srPity) || Number(v.srPity) < 0 || Number(v.srPity) >= 20)) throw new Error();
    if (v.design !== undefined && !validDesign(v.design)) throw new Error();
    if (v.pool !== undefined && !validPool(v.pool) || obj(v.pending) && v.pending.pool !== undefined && !validPool(v.pending.pool)) throw new Error();
    if (v.items !== undefined && (!Array.isArray(v.items) || !v.items.every(validOwnedProduct) || new Set(v.items.map(i => i.id)).size !== v.items.length)) throw new Error();
    let save = { ...v, srPity: v.srPity ?? srPityFromCollection(v.collection as Card[]), portrait: v.portrait ?? emptyPortrait(), wallet: v.wallet ?? initialWallet(), inventory: v.inventory ?? [] } as Save;
    const needsCleanup = !save.starterContentCleared;
    if (needsCleanup) {
      const cleanStats = (stats: Stats) => stats.mood === 70 && stats.energy === 80 && stats.affection === 20 && stats.growth === 10 ? emptyDelta() : stats;
      save = { ...save, starterContentCleared: true, stats: cleanStats(save.stats), design: save.design ? withoutStarterContent(save.design) : undefined,
        pending: save.pending ? { ...save.pending, stats: cleanStats(save.pending.stats) } : undefined };
    }
    const cards = withoutStarterCards(save.cards);
    const pending = save.pending ? { ...save.pending, cards: withoutStarterCards(save.pending.cards), speech: '' } : undefined;
    if (needsCleanup || !!save.pending?.speech || cards.length !== save.cards.length || pending?.cards.length !== save.pending?.cards.length) {
      const migrated = { ...save, cards, pending }; persistSave(key, migrated); return migrated;
    }
    return save;
  } catch { throw new Error('养成存档无法读取，原数据已保留。请先在系统设置导出备份。'); }
}
export function persistSave(key: string, save: Save) { writeStoredValue(key, save); }
export type ResetMode = 'all' | 'restart';
export function resetGameData(actorId: string, userId: string, mode: ResetMode = 'all'): Save {
  let save = newSave();
  if (mode === 'restart') {
    const previous = readSave(saveKey(actorId, userId)), plan = previous.pending;
    save = { ...save, design: previous.design, portrait: previous.portrait,
      cards: plan?.cards ?? previous.cards, pool: plan?.pool ?? previous.pool, event: plan?.event ?? previous.event };
  }
  persistSave(saveKey(actorId, userId), save);
  return save;
}
export function pickCard(cards: Card[], random = Math.random): Card | undefined {
  const total = cards.reduce((n, c) => n + c.weight, 0);
  if (!(total > 0)) return undefined;
  let point = random() * total;
  return cards.find(c => { point -= c.weight; return point < 0; }) ?? cards.filter(c => c.weight > 0).at(-1);
}
export function advance(save: Save): Save {
  const round = save.rounds[0];
  if (!round || round.cursor >= round.steps.length) return save;
  const step = round.steps[round.cursor];
  const stats = Object.fromEntries(keys.map(k => [k, Math.max(0, Math.min(100, save.stats[k] + step.delta[k]))])) as Stats;
  const completed = { ...round, cursor: round.cursor + 1 };
  let items = ownedProducts(save);
  if (step.purchasedItem && !items.some(i => i.id === step.purchasedItem!.id)) items = [...items, step.purchasedItem];
  if (step.acquired && !step.purchasedItem) {
    const id = `legacy-step-${round.id}-${round.cursor}`;
    if (!items.some(i => i.id === id)) items = [...items, { id, product: ownedProducts({ ...save, items: undefined, inventory: [step.acquired] })[0].product, acquiredAt: round.createdAt, status: 'owned' }];
  }
  if (step.sentItemId) items = items.map(i => i.id === step.sentItemId ? { ...i, status: 'sent', sentAt: round.createdAt } : i);
  return { ...save, items, stats, pity: step.pityAfter ?? save.pity ?? 0, srPity: step.srPityAfter ?? (cardsForDraw(step).length ? srPityFromCollection([...save.collection, ...cardsForDraw(step)]) : save.srPity ?? srPityFromCollection(save.collection)), wallet: step.wallet ?? save.wallet, inventory: items.filter(i => i.status === 'owned').map(i => i.product.id), collection: [...save.collection, ...cardsForDraw(step)],
    memory: completed.cursor === completed.steps.length ? archiveRound(memoryFor(save), completed) : save.memory,
    rounds: [completed, ...save.rounds.slice(1)] };
}
export async function generateRound(save: Save, actorId: string, signal: AbortSignal): Promise<Save> {
  if (save.rounds[0] && save.rounds[0].cursor < save.rounds[0].steps.length) throw new Error('请先看完当前一轮，再开始下一轮。');
  const actor = readAnthologyAuthors().find(a => a.id === actorId);
  if (!actor) throw new Error('请先在微信中添加角色。');
  const user = readNurtureIdentity();
  const design = save.design ?? defaultDesign(user.name);
  validateDesign(design);
  const plan: Plan = save.pending ? { ...save.pending, speech: '' } : { stats: save.stats, speech: '', cards: save.cards, event: save.event };
  const campaign = poolContext(plan, save);
  const event = null;
  const portrait = save.portrait ?? emptyPortrait();
  const availableTargets = touchTargets(portrait);
  const selectedTargets = selectRoundTouches(portrait);
  const continuity = memoryContext(save), memory = memoryFor(save);
  const drawAvailable = campaign.status === 'open' && plan.cards.some(c => c.weight > 0 && isPityRare(c));
  const preparedDraws = prepareDrawSequence(drawAvailable ? plan.cards : [], save.pity ?? 0, pickCard, 80, save.srPity ?? srPityFromCollection(save.collection));
  const drawSequence = preparedDraws.cards;
  const raw = await requestConfiguredAiText(
    '你在模拟角色手机里的养成游戏。角色是玩家，user是游戏中被养成的对象。用户只观看角色玩。保持角色人设，只写角色的具体操作与第一人称内心独白。禁止替user编造任何发言、对白或引语，包括在action和thought中间接编造user说过的话。speech字段始终返回空字符串，user的发言完全由程序使用用户预设的原文填入。角色不知道任何策划后台或操控；输入的状态和发言是游戏自然呈现的现状。角色只知道touchTargets列出的可触碰部位，绝不能猜测、提及或触碰列表之外的部位；列表为空时不能安排任何触碰。只依据当前角色自己的存档，不引入其他角色。生成完整一轮4～8步，可包含照顾、训练、互动、活动和抽卡。抽卡结果由程序按概率决定，不要在文字中预告卡名或稀有度；draw=true时独白仅写抽卡前的期待。数值变化每项每步-15～15。只返回JSON：{"steps":[{"action":"操作","thought":"角色内心独白","speech":"","delta":{"mood":0,"energy":0,"affection":0,"growth":0},"draw":false}]}'+ '\n' + MEMORY_RULES + ROUND_TOUCH_RULES + '\nFor draw steps, choose drawCount:1 or drawCount:10 autonomously. Ten pulls cost 10 times game.drawCost; there is a 60-pull pity guarantee already applied to drawSequence; a pity-eligible rare card resets its counter. There is no discount. This is the only API request for the entire round. drawSequence is a pre-rolled server-side sequence of card IDs. Consume from the start in order across successful draw steps, exactly 1 or 10 IDs per draw; failed unaffordable draws consume none. Return drawResultIds matching those IDs and resultThought responding to the actual mapped cards in pool. thought is the before-draw anticipation; resultThought is the after-reveal reaction. Do not select, skip, reorder or reroll results. Characters cannot foresee results or base earlier decisions on unrevealed outcomes. Generate all steps, both thoughts and memory together; nothing will be generated during playback.' + '\nGame description and hero settings are game content known to the player. Use only the supplied editable shop, schedules and dates. Draw prices come from game.drawCost. For each recharge independently choose rechargeYuan (yuan amount, positive, at most two decimal places) based on personality, budget, item prices and current gem balance. There is no fixed recharge package. Gems received are floor(rechargeYuan * game.gemsPerYuan), at least one gem. Never invent removed items or activities. A recharge step plays a simulated checkout with order confirmation, payment processing and success. In this same response include thought for opening checkout, paymentThought for confirming the virtual payment, and resultThought for gems arriving. Base these three inner monologues on the character, budget, game items and continuity, and never invent user speech. The checkout price is your chosen rechargeYuan; game.gemsPerYuan is the only conversion rate. Return rechargeYuan on each kind:recharge step. All money here is fictional. R cards are the ordinary common tier, often drawn repeatedly. Duplicate R cards are normal, not a rare success, limited win or surprise every time. Keep every duplicate in the collection, react naturally and briefly to ordinary repeats, and reserve major excitement for genuinely rare or personally meaningful outcomes. Never alter the actual configured odds. If game.drawAvailable is false, the pool is not ready or closed: choose other activities instead of drawing. No extra request will run during playback. The status page contains the exact user-authored game.statusNote. When nonblank, after the initial sampled touches include a kind:status step opening that page. Its thought must respond to the actual note and prior memories; do not rewrite the note or fabricate new user dialogue. Reading status does not alter user stats. Return top-level openingThought for the character opening this app before any actions. The first steps must be all sampled touches, one per position, with individual thoughts; only then choose optional activities. Read campaign status, isNew, release dates, limited flags and ownedCount before deciding about draws. Newly released pools may excite this character or motivate saving gems. Having obtained the limited cards usually lowers revisiting priority, but favorite duplicates, personality and abundant gems can justify returning. Do not force draws, spending or every activity each round. Upcoming or ended pools cannot be drawn; keep existing collections and pity. Every chosen action needs its own thought. Limited-time events are unavailable; never choose kind:event. Every successful card pulled gives 30 coins (a single draw gives 30; ten draws give 300), including all rarities and duplicates. Earn coinReward from a configured schedule only after it is successfully completed; do not invent coin rewards. Only use the supplied player persona, global world books and this game save. Do not import WeChat chats, outside memories, relationships or other apps. Buying (kind:shop) puts the item in inventory and does not give it to user yet. A later kind:gift step sends one owned item, with itemId equal to its product id or instanceId. You may buy and gift in the same round in that order. Only gift items with a nonempty preset reaction. Write the character thought responding to that exact reaction; speech stays empty because the program fills it. Never invent user responses or send the same instance twice.' + '\nR is common, SR is the intermediate tier, and SSR is the finest and rarest standard tier with the most elaborate card art and special scenes. A separate 20-pull guarantee gives at least SR: SR or SSR resets this counter; an SR never resets the 60-pull rare counter. If both guarantees are due, the 60-pull rare guarantee wins and resets both counters. Results are already enforced by drawSequence. React to SSR as especially precious while keeping ordinary SR and duplicate R reactions proportionate. Do not invent art details or user dialogue absent from the configured card.' + BRIEF_THOUGHT_RULES,
    JSON.stringify({ continuity, campaign, game: { drawAvailable, statusNote: design.statusNote ?? '', description: design.description, drawCost: design.drawCost, gemsPerYuan: design.gemsPerYuan ?? 10, drawCoinReward: 30 }, player: { id: actor.id, name: actor.name, persona: actor.persona }, raised: design.hero, stats: plan.stats, pity: { count: save.pity ?? 0, limit: 60, srCount: save.srPity ?? srPityFromCollection(save.collection), srLimit: 20 }, drawSequence: drawSequence.map(c => c.id), pool: plan.cards.map(c => ({ id: c.id, name: c.name, rarity: c.rarity, pityEligible: isPityRare(c), weight: c.weight, description: c.description, artText: c.artText })), event, owned: save.collection.map(c => c.name), lastRound: save.rounds[0]?.steps.filter(s => s.kind !== 'touch' || availableTargets.some(t => t.target === s.target)).map(s => ({ action: s.action, thought: s.thought, resultThought: s.resultThought, statusNote: s.statusNote, kind: s.kind, target: s.target })),
      gameRules: `游戏的背景与玩法以game.description为准，游戏内人物介绍以raised为准，角色仍是玩家、user仍是被养成对象。每步增加kind字段：daily/touch/status/draw/shop/recharge/gift/schedule/date。触碰只能选择touchTargets中的部位，target填中文部位名。围绕预设回应写角色操作与内心，不能替user发言，speech始终留空。列表之外的部位对角色不可见，不可猜测或触碰。只能从本轮提供的商品、日程、约会列表中选择itemId，已删除的条目不可使用；列表为空就安排其他玩法。抽卡消耗${design.drawCost}星钻；\u5145\u503c\u91d1\u989d\u7531\u89d2\u8272\u81ea\u884c\u9009\u62e9\uff0crechargeYuan \u586b\u5143\u6570\uff08\u6700\u591a\u4e24\u4f4d\u5c0f\u6570\uff09\uff0c1 \u5143 = ${design.gemsPerYuan ?? 10} \u661f\u94bb\uff0c\u5230\u8d26\u661f\u94bb\u53d6\u6574\u3002日程和约会的实际费用与数值变化按列表结算。余额不足先考虑充值或其他操作。不必每轮遍历全部功能。`,
      touchTargets: selectedTargets, wallet: save.wallet ?? initialWallet(), inventory: ownedProducts(save).filter(i => i.status === 'owned').map(i => ({ instanceId: i.id, ...productContext(i.product) })), shop: design.shop.map(productContext), schedules: design.schedules, dates: design.dates }),
    { json: true, signal, maxTokens: 5600, includeGlobalWorldBooks: true });
  signal.throwIfAborted();
  const parsed: unknown = parseAiJson(raw);
  if (obj(parsed) && parsed.openingThought !== undefined && (typeof parsed.openingThought !== 'string' || !parsed.openingThought.trim() || parsed.openingThought.length > 1500)) throw new Error("\u6253\u5f00\u6e38\u620f\u65f6\u7684\u5fc3\u58f0\u683c\u5f0f\u4e0d\u5b8c\u6574\u3002");
  if (!obj(parsed) || !Array.isArray(parsed.steps) || parsed.steps.length < 4 || parsed.steps.length > 8) throw new Error('AI 返回的操作格式不完整，请重新生成。');
  const steps: Step[] = parsed.steps.map(s => {
    if (!obj(s) || !strings(s, ['action', 'thought', 'speech']) || !String(s.action).trim() || !String(s.thought).trim() || typeof s.draw !== 'boolean' || !validDelta(s.delta, 15)) throw new Error('AI 返回的操作或数值无效，请重新生成。');
    const kind = typeof s.kind === 'string' ? s.kind : s.draw ? 'draw' : 'daily';
    if (!['daily', 'touch', 'draw', 'shop', 'recharge', 'gift', 'status', 'schedule', 'date'].includes(kind)) throw new Error('AI 返回了未知游戏操作，请重新生成。');
    if (s.draw && kind !== 'draw') throw new Error('AI 返回了冲突的游戏操作，请重新生成。');
    if (s.drawCount !== undefined && s.drawCount !== 1 && s.drawCount !== 10) throw new Error('抽卡次数只能是单抽或十连，本轮未保存。');
    const target = BODY_PARTS.find(k => k === s.target);
    if (kind === 'touch' && (!target || !availableTargets.some(t => t.target === target))) throw new Error('AI 选择的部位尚未定位或未填写触碰发言，本轮未保存，请重新生成。');
    if (kind === 'touch' && !selectedTargets.some(t => t.target === target)) throw new Error('AI 触碰了本轮未随机选中的部位，本轮未保存，请重新生成。');
    return { action: String(s.action).slice(0, 800), thought: String(s.thought).slice(0, 1200), speech: target && kind === 'touch' ? portrait.replies[target]! : '', delta: s.delta as Stats, draw: s.draw || kind === 'draw', kind, ...(kind === 'touch' ? { target } : {}), drawCount: s.draw || kind === 'draw' ? s.drawCount === 10 ? 10 : 1 : undefined, rechargeYuan: kind === 'recharge' ? s.rechargeYuan as number : undefined, paymentThought: typeof s.paymentThought === 'string' ? s.paymentThought.slice(0, 1500) : undefined, resultThought: typeof s.resultThought === 'string' ? s.resultThought : undefined, drawResultIds: Array.isArray(s.drawResultIds) ? s.drawResultIds : undefined, itemId: typeof s.itemId === 'string' ? s.itemId : undefined };
  });
  const touches = steps.filter(s => s.kind === 'touch');
  if (touches.length !== selectedTargets.length || new Set(touches.map(s => s.target)).size !== selectedTargets.length) throw new Error(`本轮需要分别触碰 ${selectedTargets.length} 个随机位置，AI 返回的次数或位置不符，本轮未保存，请重新生成。`);
  if (new Set(touches.map(s => s.thought.trim())).size !== touches.length) throw new Error('每次触碰都需要独立的心理活动，AI 返回了重复独白，本轮未保存，请重新生成。');
  if (steps.slice(0, selectedTargets.length).some(s => s.kind !== 'touch')) throw new Error('本轮应先完成立绘触碰，再进行其他活动，本轮未保存。');
  if (design.statusNote?.trim() && !steps.some(s => s.kind === 'status')) throw new Error('角色本轮尚未安排查看状态页留言，本轮未保存，请重新生成。');
  let wallet = { ...(save.wallet ?? initialWallet()) };
  let drawCursor = 0;
  const items = structuredClone(ownedProducts(save));
  for (const step of steps) {
    if (step.kind === 'status') { step.statusNote = design.statusNote ?? ''; step.delta = { mood: 0, energy: 0, affection: 0, growth: 0 }; }
    if (step.kind === 'recharge') { const quote = rechargeQuote(step.rechargeYuan!, design.gemsPerYuan ?? 10); step.rechargeGems = quote.gems; step.rechargeRate = design.gemsPerYuan ?? 10; step.delta = emptyDelta(); wallet.gems += quote.gems; wallet.recharged += quote.gems; step.receipt = `充值 ${quote.yuan.toFixed(2)} 元 · 星钻 +${quote.gems}`; }
    if (step.kind === 'shop') {
      step.delta = { mood: 0, energy: 0, affection: 0, growth: 0 };
      const item = design.shop.find(i => i.id === step.itemId);
      if (!item) throw new Error('AI 选择的商品不存在，请重新生成。');
      if (wallet[item.currency] >= item.price) { wallet[item.currency] -= item.price; step.acquired = item.id; step.purchasedItem = { id: crypto.randomUUID(), product: structuredClone(item), status: 'owned', acquiredAt: new Date().toISOString() }; items.push(step.purchasedItem); step.receipt = `购入「${item.name}」 · ${item.currency === 'gems' ? '星钻' : '金币'} -${item.price}`; }
      else { step.receipt = '余额不足，本次未购买'; step.delta = { mood: 0, energy: 0, affection: 0, growth: 0 }; }
    }
    if (step.kind === 'gift') {
      const index = items.findIndex(i => i.status === 'owned' && (i.id === step.itemId || i.product.id === step.itemId));
      if (index < 0) throw new Error('角色送出的物品不在物品栏或已经送出，本轮未保存。');
      const item = items[index];
      if (!item.product.reaction?.trim()) throw new Error(`「${item.product.name}」还没有收到后的反应，本轮未保存。`);
      step.sentItemId = item.id; step.giftedProduct = structuredClone(item.product);
      step.speech = item.product.reaction;
      step.delta = item.product.effectsEnabled && item.product.effects ? { ...item.product.effects } : { mood: 0, energy: 0, affection: 0, growth: 0 };
      step.receipt = `送出「${item.product.name}」 · 已收到`;
      items[index] = { ...item, status: 'sent' };
    }
    if (step.kind === 'schedule' || step.kind === 'date') {
      const item = (step.kind === 'schedule' ? design.schedules : design.dates).find(i => i.id === step.itemId);
      if (!item) throw new Error('AI 选择的活动不存在，请重新生成。');
      const price = 'price' in item ? Number(item.price) : 0;
      if (wallet.coins >= price) { wallet.coins -= price; step.coinReward = step.kind === 'schedule' ? item.coinReward ?? 0 : 0; wallet.coins += step.coinReward; step.delta = { ...item.delta }; step.receipt = `${item.name}${price ? ` · 金币 -${price}` : ''}${step.coinReward ? ` · 金币 +${step.coinReward}` : ''}`; }
      else { step.receipt = '金币不足，本次活动未进行'; step.delta = { mood: 0, energy: 0, affection: 0, growth: 0 }; }
    }
    if (step.kind === 'event' && !event) throw new Error('AI 选择了未开放的限时活动，请重新生成。');
    if (step.draw) {
      const cost = design.drawCost * (step.drawCount ?? 1);
      if (wallet.gems >= cost && drawSequence.length) {
        const cards = drawSequence.slice(drawCursor, drawCursor + (step.drawCount ?? 1));
        if (!step.resultThought?.trim() || step.resultThought.length > 1500 || !Array.isArray(step.drawResultIds) || step.drawResultIds.length !== cards.length || step.drawResultIds.some((id, i) => id !== cards[i].id)) throw new Error('AI 返回的抽卡结果或揭晓后心声不完整，本轮未保存，请重新生成。');
        drawCursor += cards.length; step.pityAfter = preparedDraws.counters[drawCursor - 1]; step.srPityAfter = preparedDraws.srCounters[drawCursor - 1];
        step.coinReward = cards.length * 30; wallet.coins += step.coinReward;
        wallet.gems -= cost; step.drawnCards = cards; step.card = cards[0]; step.receipt = `${step.drawCount === 10 ? '十连召唤' : '单次召唤'} · 星钻 -${cost} · 金币 +${step.coinReward}`;
      }
      else { step.draw = false; step.receipt = '星钻不足或卡池未开放，本次未抽卡'; }
    }
    step.wallet = { ...wallet };
  }
  const before = plan.stats;
  const after = steps.reduce((stats, s) => Object.fromEntries(keys.map(k => [k, Math.max(0, Math.min(100, stats[k] + s.delta[k]))])) as Stats, before);
  const recap = makeRecap(parsed.memory, steps, memory);
  return { ...save, items: ownedProducts(save), design: structuredClone(design), memory, pool: plan.pool ?? save.pool ?? defaultPool(), stats: before, cards: plan.cards, event: plan.event, pending: undefined,
    rounds: [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), number: memory.completedRounds + 1, openingThought: typeof parsed.openingThought === 'string' ? parsed.openingThought : steps[0]?.thought, poolRevision: campaign.updatedAt, recap,  steps, cursor: 0, before, after }, ...save.rounds].slice(0, 100) };
}
