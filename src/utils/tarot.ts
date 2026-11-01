import { readStoredValue, writeStoredValue } from './localStorage';

export type TarotSuit = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
export interface TarotCard {
  id: string;
  name: string;
  english: string;
  suit: TarotSuit;
  rank: number;
  keywords: string;
  upright: string;
  reversed: string;
}
type Meaning = readonly [keywords: string, upright: string, reversed: string];
type Major = readonly [name: string, english: string, ...meaning: Meaning];

const majors: readonly Major[] = [
  ['愚人', 'The Fool', '启程 · 好奇', '给未知留一点空间，用小小的尝试开启新路。', '自由也需要边界，先辨认冲动与真正的愿望。'],
  ['魔术师', 'The Magician', '行动 · 创造', '你已有可以使用的资源，把想法变成一个具体行动。', '检查承诺与行动是否一致，别让漂亮的表达替代实践。'],
  ['女祭司', 'The High Priestess', '直觉 · 静观', '暂时不急着下结论，安静观察自己尚未说出的感受。', '分清直觉与猜测，必要时用真实信息澄清疑问。'],
  ['皇后', 'The Empress', '滋养 · 丰盛', '温柔照顾身体、关系与创造力，让成长拥有舒适的土壤。', '关怀不等于消耗自己，也给自己的需要留位置。'],
  ['皇帝', 'The Emperor', '秩序 · 边界', '清楚的安排与边界，可以让你更安心地向前。', '留意控制欲或僵硬规则，稳定不必以压抑感受为代价。'],
  ['教皇', 'The Hierophant', '传承 · 学习', '借助可靠经验与共同价值，找到适合自己的学习路径。', '允许自己审视旧规则，选择经过思考而非盲从的答案。'],
  ['恋人', 'The Lovers', '连接 · 选择', '让选择贴近你的价值，也给彼此真实表达的机会。', '不同需求值得被看见，别用迎合掩盖尚未谈清的分歧。'],
  ['战车', 'The Chariot', '方向 · 意志', '集中力量朝一个方向行动，节奏比同时追逐许多目标更重要。', '先调整方向和速度，停下来并不意味着失去主动权。'],
  ['力量', 'Strength', '勇气 · 温柔', '温柔而坚定地面对情绪，不必用强硬证明自己的力量。', '疲惫时允许自己寻求支持，自我苛责不能替代恢复。'],
  ['隐者', 'The Hermit', '内省 · 寻路', '留一段独处时间，辨认哪些答案真正来自你自己。', '独处与孤立之间有界线，必要时向信任的人打开一扇门。'],
  ['命运之轮', 'Wheel of Fortune', '变化 · 周期', '接受阶段的变化，把注意力放在你能调整的回应上。', '反复出现的模式值得观察，尝试换一种应对方式。'],
  ['正义', 'Justice', '公平 · 责任', '认真查看事实、约定与后果，做一个对自己也对他人负责的选择。', '检查是否存在偏见或未说清的责任，别急着给人定论。'],
  ['倒吊人', 'The Hanged Man', '暂停 · 换位', '暂停推进，换个角度看同一件事，也许能发现新的理解。', '分辨有意义的等待和耗损自己的拖延，重新确认付出的边界。'],
  ['死神', 'Death', '结束 · 更新', '有些旧阶段需要告别，给新的生活方式腾出空间。此牌不指现实死亡。', '留意对改变的抗拒，试着先放下一件已经不适合的小事。此牌不预示死亡。'],
  ['节制', 'Temperance', '平衡 · 调和', '用适中的节奏协调不同需要，让变化慢慢发生。', '检查是否过度投入或失去平衡，先恢复可持续的步调。'],
  ['恶魔', 'The Devil', '束缚 · 欲望', '辨认让你难以放手的习惯、诱惑或依赖，重新看见选择权。', '你可以逐步松开束缚，从一个可行的小边界开始。'],
  ['高塔', 'The Tower', '震动 · 重建', '当旧认知被打破，先照顾当下，再寻找更诚实的基础。', '留意被回避的问题，温和地修补比一直掩盖更有帮助。'],
  ['星星', 'The Star', '希望 · 修复', '让希望落在日常的小行动里，给自己恢复与重新相信的时间。', '希望暂时微弱也没有关系，先找到一件能让你安心的小事。'],
  ['月亮', 'The Moon', '朦胧 · 感受', '信息尚不完整时，承认不确定；感受可以被倾听，猜测仍需核实。', '迷雾正在被梳理，慢慢分清事实、想象与自己的担忧。'],
  ['太阳', 'The Sun', '明朗 · 喜悦', '珍惜清晰、坦诚与简单的快乐，让真实的自己被看见。', '快乐可能需要一点等待，别用外界的标准衡量所有满足。'],
  ['审判', 'Judgement', '回顾 · 觉醒', '从过去的经历里提炼理解，给自己一次更清醒的重新选择。', '过度自责容易遮住学习的机会，用具体反思替代反复责备。'],
  ['世界', 'The World', '整合 · 完成', '承认已经走过的路，为一个阶段收尾，也为下一步留白。', '看看还缺哪一个小环节，把未完成的事情有意识地收束。'],
];

const ranks = [
  ['王牌', 'Ace'], ['二', 'Two'], ['三', 'Three'], ['四', 'Four'], ['五', 'Five'],
  ['六', 'Six'], ['七', 'Seven'], ['八', 'Eight'], ['九', 'Nine'], ['十', 'Ten'],
  ['侍从', 'Page'], ['骑士', 'Knight'], ['王后', 'Queen'], ['国王', 'King'],
] as const;

const minors: ReadonlyArray<{ suit: Exclude<TarotSuit, 'major'>; name: string; english: string; meanings: readonly Meaning[] }> = [
  { suit: 'wands', name: '权杖', english: 'Wands', meanings: [
    ['灵感 · 起点', '抓住让你眼睛一亮的灵感，先迈出一小步。', '灵感需要酝酿，先找回精力，不必强迫自己立即开始。'],
    ['规划 · 视野', '在熟悉与未知之间比较选择，为想走的路做准备。', '别让反复规划替代行动，缩小目标会更容易出发。'],
    ['拓展 · 等待', '已经付出的努力需要时间，留意新的合作与空间。', '调整期待和计划，等待时也可以检查实际进展。'],
    ['庆祝 · 安定', '珍惜让你有归属感的人与地方，为小成果认真庆祝。', '归属感需要沟通，看看共同生活的节奏是否合适。'],
    ['竞争 · 碰撞', '不同意见可以激发思考，先明确分歧而非急着输赢。', '选择有意义的讨论，也允许自己退出无谓争执。'],
    ['肯定 · 前进', '接住来自他人的认可，同时记得努力本身的价值。', '外界掌声并非唯一标准，重新确认你认可的进步。'],
    ['立场 · 坚持', '守住重要立场，清楚表达自己愿意与不愿意的事。', '不必应战所有压力，把力量留给真正重要的边界。'],
    ['流动 · 讯息', '事情可能进入快节奏，及时表达并做好衔接。', '速度不等于效率，先澄清信息再推进。'],
    ['韧性 · 防备', '承认一路的辛苦，带着经验谨慎守护自己的需要。', '过度防备会令人疲惫，尝试分清眼前的人与过去的经历。'],
    ['负担 · 责任', '查看肩上的责任，分配任务比独自硬撑更可持续。', '允许放下不属于你的负担，开口求助也是一种行动。'],
    ['探索 · 热情', '以好奇心尝试新事物，不急着要求自己成熟完美。', '给热情一点方向，先完成一个小实验。'],
    ['冒险 · 推进', '把热情投入行动，同时为变化留一点余地。', '留意急躁与反复，稳住承诺再向前。'],
    ['自信 · 吸引力', '自在表达你的热情，也鼓励周围的人展现自己。', '把注意力从比较收回，重新建立内在的自信。'],
    ['愿景 · 领导', '用清楚的愿景带领行动，也听见伙伴的真实反馈。', '领导不等于强压自己的节奏，给合作留下空间。'],
  ] },
  { suit: 'cups', name: '圣杯', english: 'Cups', meanings: [
    ['敞开 · 感受', '允许新的情感与温柔进入生活，认真听见自己的心。', '先照顾被压住的感受，不必勉强自己立刻敞开。'],
    ['回应 · 连接', '平等表达与相互倾听，会让连接更真实。', '不把关系当成读心，主动谈谈双方不同的需要。'],
    ['友谊 · 共鸣', '与愿意理解你的人分享快乐，感受支持的力量。', '检查社交是否让你舒适，也给自己保留独处时间。'],
    ['倦怠 · 重新看见', '承认暂时的无感，看看是否有被忽略的选择。', '试着轻轻打开注意力，从一个小机会重新参与生活。'],
    ['失落 · 珍惜', '给失落一点时间，也慢慢看见仍在身边的支持。', '放下不必一直背负的遗憾，允许自己恢复联系。'],
    ['回忆 · 善意', '从温暖的回忆里获得支持，也把善意带回当下。', '过去可以被珍藏，但不必成为判断现在的唯一尺度。'],
    ['想象 · 选择', '愿望很多时，逐一查看现实条件，选一个可以实践的方向。', '把模糊期待变成具体标准，减少被幻想牵着走。'],
    ['离开 · 寻找', '辨认已经无法满足你的状态，探索更贴近内心的方向。', '先确认离开或留下的理由，别让害怕替你决定。'],
    ['满足 · 愿望', '认真享受已有的满足，承认自己的小小愿望。', '外在满足未必填满内心，试着问清真正想要什么。'],
    ['和谐 · 归属', '珍惜共同的幸福，也用日常沟通照顾彼此。', '不必维持完美表象，让不同感受也能被说出来。'],
    ['柔软 · 心意', '用真诚而不夸张的方式表达一份小心意。', '感受尚未成熟时，先理解它，不急着许下承诺。'],
    ['浪漫 · 邀请', '带着善意靠近，也尊重对方回应的节奏。', '让浪漫与实际行动一致，不用想象替代沟通。'],
    ['共情 · 倾听', '温柔理解他人的感受，同时保有自己的边界。', '共情不意味着承担全部情绪，也认真照顾自己。'],
    ['稳定 · 包容', '让感受与理性一起参与回应，保持平静而坦诚。', '压住情绪不等于处理情绪，寻找安全的表达方式。'],
  ] },
  { suit: 'swords', name: '宝剑', english: 'Swords', meanings: [
    ['清晰 · 判断', '把复杂事情说清楚，用事实与诚实建立新的理解。', '先核实信息，再判断；尖锐的语言未必更接近真相。'],
    ['犹疑 · 权衡', '给两难选择一点时间，同时主动寻找缺少的信息。', '回避无法永远替代决定，先明确最重要的标准。'],
    ['心痛 · 直面', '承认受伤的感受，为自己留出处理失落的空间。', '修复可以缓慢发生，不必不断重放伤人的片段。'],
    ['休整 · 恢复', '暂时退出争论与过载，给头脑和身体真正的休息。', '看看是否还没恢复就急着回到忙碌，调整节奏。'],
    ['争执 · 代价', '考虑赢得争论的代价，选择既诚实又保留尊重的回应。', '尝试结束消耗性的较量，修补可以从一句澄清开始。'],
    ['过渡 · 距离', '借助支持离开过度混乱的状态，慢慢走向平稳。', '面对尚未处理的牵挂，为过渡安排一个可行的小步骤。'],
    ['策略 · 隐瞒', '认真看清信息与动机，灵活行动但不牺牲诚实。', '坦白尚未说清的事，避免让隐瞒继续累积压力。'],
    ['受限 · 视角', '分清真实限制与想象中的限制，寻找仍可选择的一步。', '你可以逐渐松开自我限制，先尝试一件可控的小事。'],
    ['担忧 · 反刍', '把担忧写出来并核对事实，必要时向可信的人寻求支持。', '让反复思考停一停，恢复需要休息与具体帮助。'],
    ['终点 · 收束', '为一个难以继续的阶段收尾，先照顾自己再重新开始。', '复原不必一蹴而就，允许自己逐步离开耗损的状态。'],
    ['观察 · 提问', '带着好奇检查信息，多问一句比仓促定论更有价值。', '别让零碎消息变成武断结论，核实后再表达。'],
    ['果断 · 速度', '明确目标后有力行动，也留意回应是否足够周全。', '放慢急于证明自己的节奏，先听完对方的话。'],
    ['独立 · 分辨', '清楚表达判断与界线，理性也可以保留温度。', '留意是否因过去的失望而过度严厉，区分事实与情绪。'],
    ['原则 · 理性', '以一致的原则处理问题，让解释与决定可以被理解。', '原则不应成为压制他人的工具，也检查自己的偏见。'],
  ] },
  { suit: 'pentacles', name: '星币', english: 'Pentacles', meanings: [
    ['机会 · 落地', '留意可以实际培育的小机会，从资源与习惯开始。', '机会需要准备，先检查时间、精力与可用资源。'],
    ['协调 · 弹性', '在多项事务之间调整优先级，为变化留出余裕。', '负荷过重时减少同时进行的事，恢复稳定的安排。'],
    ['协作 · 技艺', '认真打磨能力，让不同专长的人一起完成一件事。', '澄清分工与反馈方式，避免各自努力却方向不同。'],
    ['守护 · 紧握', '重视安全感，也看看你是否握得太紧。', '在可靠边界内适度松手，资源可以服务于生活。'],
    ['匮乏 · 支持', '困难不必独自面对，主动辨认能够提供支持的人与资源。', '逐步重建安全感，从接受一份实际帮助开始。'],
    ['给予 · 平衡', '让给予与接受更平等，也明确帮助的边界。', '检查付出是否附带压力，别用资源换取服从。'],
    ['耐心 · 评估', '回顾长期投入的进展，耐心之外也需要实际评估。', '区分值得等待的成长与不再合适的投入，及时调整。'],
    ['练习 · 专注', '重复的小练习能积累能力，专注于可以改善的细节。', '努力也需要方法，避免只用忙碌衡量自己的价值。'],
    ['自足 · 品质', '珍惜亲手建立的独立与舒适，也允许自己享受成果。', '检查你想追求的生活是否属于自己，而非比较的结果。'],
    ['积累 · 传承', '看见长期关系与资源的支持，为共同生活做稳妥安排。', '传统与资源不能替代沟通，认真谈谈不同的生活期待。'],
    ['学习 · 实践', '带着耐心学习，把一个想法变成可执行的小计划。', '为分散的兴趣挑一个落点，用实践检查它。'],
    ['踏实 · 持续', '坚持稳定可靠的行动，让承诺在日常中落地。', '踏实不等于固守原地，适时调整已经僵化的习惯。'],
    ['照顾 · 安稳', '用实际行动营造舒适，也重视自己的日常需要。', '照顾他人时别忘记休息，不必独自承担所有琐事。'],
    ['成熟 · 建设', '以耐心与责任经营资源，建立可以持续的支持。', '资源不是评价人的唯一尺度，别让占有替代安全感。'],
  ] },
];

export const TAROT_DECK: readonly TarotCard[] = [
  ...majors.map(([name, english, keywords, upright, reversed], rank) => ({
    id: `major-${rank}`, name, english, suit: 'major' as const, rank, keywords, upright, reversed,
  })),
  ...minors.flatMap(({ suit, name, english, meanings }) => meanings.map(([keywords, upright, reversed], index) => ({
    id: `${suit}-${index + 1}`, name: `${name}${ranks[index][0]}`, english: `${ranks[index][1]} of ${english}`,
    suit, rank: index + 1, keywords, upright, reversed,
  }))),
];

export const TAROT_SPREADS = [
  { id: 'daily', name: '今日一张', english: 'A daily whisper', description: '给今天一点提醒，轻轻看看此刻的自己。', positions: ['今日提醒'], question: '今天我可以留意什么？' },
  { id: 'focus', name: '想问一件事', english: 'A little clarity', description: '三张牌，聊聊现状、卡住的地方和建议。', positions: ['现状', '阻碍', '建议'], question: '关于此刻在意的事，我可以怎样理解和行动？' },
  { id: 'relationship', name: '看看我们的关系', english: 'Between two hearts', description: '三张牌，观察我、对方与相处方式；不是读心。', positions: ['我的感受', '对方的象征视角', '我们的相处'], question: '我可以怎样理解和照顾这段关系？' },
  { id: 'insight', name: '深入看看一件事', english: 'A deeper reflection', description: '五张牌，多看看背后的影响，再整理建议与可探索的方向。', positions: ['现状', '阻碍', '背后影响', '建议', '可探索的方向'], question: '关于这件事，还有哪些影响值得留意，我可以怎样尝试？' },
] as const;
export type TarotSpreadId = typeof TAROT_SPREADS[number]['id'];
export type TarotReader = { mode: 'oracle' } | { mode: 'character'; actorId: string; actorName: string };
export interface TarotDrawnCard { cardId: string; reversed: boolean; position: string }
export interface TarotInterpretation {
  id: string;
  reader: TarotReader;
  status: 'pending' | 'done' | 'error';
  text: string;
  error?: string;
  createdAt: string;
}
export interface TarotRecord {
  id: string;
  createdAt: string;
  userName: string;
  question: string;
  spreadId: TarotSpreadId;
  includeReversed: boolean;
  cards: TarotDrawnCard[];
  interpretations: TarotInterpretation[];
}
export type TarotInterpretInput = { record: TarotRecord; reader: TarotReader; signal: AbortSignal };
export const TAROT_RECORDS_KEY = 'yyphone:tarot-records';

export function tarotCard(id: string): TarotCard {
  const card = TAROT_DECK.find(item => item.id === id);
  if (!card) throw new Error('找不到这张塔罗牌。');
  return card;
}
export function tarotSpread(id: TarotSpreadId) {
  const spread = TAROT_SPREADS.find(item => item.id === id);
  if (!spread) throw new Error('不支持这个牌阵。');
  return spread;
}
export function tarotRandomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new Error('抽牌随机数范围无效。');
  const limit = Math.floor(0x100000000 / max) * max;
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % max;
}
function randomIndex(max: number, random: (max: number) => number) {
  const value = random(max);
  if (!Number.isInteger(value) || value < 0 || value >= max) throw new Error('抽牌随机数不在有效范围内。');
  return value;
}
export function shuffleTarotDeck(random: (max: number) => number = tarotRandomInt): TarotCard[] {
  const deck = [...TAROT_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const target = randomIndex(i + 1, random);
    [deck[i], deck[target]] = [deck[target], deck[i]];
  }
  return deck;
}
export function makeTarotDraw(cardId: string, position: string, includeReversed: boolean, random: (max: number) => number = tarotRandomInt): TarotDrawnCard {
  tarotCard(cardId);
  if (!position.trim()) throw new Error('这张牌缺少牌位。');
  return { cardId, position, reversed: includeReversed && randomIndex(2, random) === 1 };
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isReader = (value: unknown): value is TarotReader => object(value) &&
  (value.mode === 'oracle' || value.mode === 'character' && text(value.actorId, 200) && text(value.actorName, 100));
export function isTarotRecord(value: unknown): value is TarotRecord {
  if (!object(value) || !text(value.id, 200) || !date(value.createdAt) || !text(value.userName, 100) ||
      !text(value.question, 300) || typeof value.includeReversed !== 'boolean' || !Array.isArray(value.cards) || !Array.isArray(value.interpretations)) return false;
  const spread = TAROT_SPREADS.find(item => item.id === value.spreadId);
  if (!spread || value.cards.length !== spread.positions.length) return false;
  const ids = new Set<string>();
  for (const [index, card] of value.cards.entries()) {
    if (!object(card) || typeof card.cardId !== 'string' || !TAROT_DECK.some(item => item.id === card.cardId) ||
        typeof card.reversed !== 'boolean' || !value.includeReversed && card.reversed || card.position !== spread.positions[index] || ids.has(card.cardId)) return false;
    ids.add(card.cardId);
  }
  const attemptIds = new Set<string>();
  return value.interpretations.every(attempt => {
    if (!object(attempt) || !text(attempt.id, 200) || attemptIds.has(attempt.id) || !isReader(attempt.reader) || !date(attempt.createdAt) ||
        typeof attempt.text !== 'string' || attempt.text.length > 12000 || !['pending', 'done', 'error'].includes(String(attempt.status)) ||
        attempt.error !== undefined && (typeof attempt.error !== 'string' || attempt.error.length > 1000) ||
        attempt.status === 'done' && !attempt.text.trim() || attempt.status === 'error' && !text(attempt.error, 1000)) return false;
    attemptIds.add(attempt.id);
    return true;
  });
}
export function createTarotRecord(input: { spreadId: TarotSpreadId; question: string; userName: string; includeReversed: boolean; cards: TarotDrawnCard[] }): TarotRecord {
  const record: TarotRecord = {
    id: `tarot-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), userName: input.userName,
    question: input.question.trim() || tarotSpread(input.spreadId).question, spreadId: input.spreadId,
    includeReversed: input.includeReversed, cards: input.cards.map(card => ({ ...card })), interpretations: [],
  };
  if (!isTarotRecord(record)) throw new Error('抽牌记录不完整或包含重复牌，请重新铺牌。');
  return record;
}
const listeners = new Set<() => void>();
export const subscribeTarot = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const loadTarotRecords = () => readStoredValue(TAROT_RECORDS_KEY, [] as TarotRecord[],
  (value): value is TarotRecord[] => Array.isArray(value) && value.every(isTarotRecord));
export function saveTarotRecords(records: TarotRecord[]) {
  if (!records.every(isTarotRecord) || new Set(records.map(record => record.id)).size !== records.length) throw new Error('不能保存无效的塔罗记录。');
  writeStoredValue(TAROT_RECORDS_KEY, records);
  listeners.forEach(listener => listener());
}
export function patchTarotRecord(id: string, patch: (record: TarotRecord) => TarotRecord) {
  const records = loadTarotRecords();
  if (!records.some(record => record.id === id)) throw new Error('这条塔罗记录已不存在，无法保存解读。');
  saveTarotRecords(records.map(record => record.id === id ? patch(record) : record));
}
export function recoverTarotInterpretations(records: TarotRecord[]): TarotRecord[] {
  return records.map(record => ({ ...record, interpretations: record.interpretations.map(attempt => attempt.status === 'pending'
    ? { ...attempt, status: 'error' as const, error: '上次解读被中断。重新解读需要再调用 1 次 AI。' } : attempt) }));
}
export function tarotContext(record: TarotRecord): string {
  if (!isTarotRecord(record)) throw new Error('无法解读无效的塔罗记录。');
  return [
    `牌阵：${tarotSpread(record.spreadId).name}`, `提问者：${record.userName}`, `想问的事：${record.question}`,
    ...record.cards.map((draw, index) => { const card = tarotCard(draw.cardId); return `${index + 1}. ${draw.position}：${card.name}（${card.english}）· ${draw.reversed ? '逆位' : '正位'}\n主题：${card.keywords}\n内置参考：${draw.reversed ? card.reversed : card.upright}`; }),
  ].join('\n\n');
}
export function tarotShareText(record: TarotRecord): string {
  return [
    'ARCANA · 塔罗手记', tarotContext(record),
    ...record.interpretations.filter(attempt => attempt.status === 'done').map(attempt =>
      `${attempt.reader.mode === 'oracle' ? 'AI 占卜师' : attempt.reader.actorName}的解读：\n${attempt.text}`),
    '塔罗仅用于娱乐与自我探索，不是未来预测，也不能替代现实沟通或专业建议。',
  ].join('\n\n');
}
