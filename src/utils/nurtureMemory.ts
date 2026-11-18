import { cardsForDraw, isPityRare } from './nurtureGacha';
import type { Round, Save, Stats, Step } from './nurture';

export type Thread = { id: string; text: string; status: 'open' | 'done'; startedRound: number; updatedRound: number };
export type MemoryEvent = { id: string; kind: string; title: string; detail: string; round: number; createdAt: string };
export type RoundRecap = { summary: string; mood: string; thoughts: string; threads: { id: string; text: string; status: 'open' | 'done'; stepIndexes?: number[] }[]; specialEvents: { title: string; detail: string; stepIndexes: number[] }[] };
export type NurtureMemory = { completedRounds: number; lastRoundId: string; mood: string; thoughts: string; threads: Thread[]; events: MemoryEvent[] };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 1500) => typeof v === 'string' && v.length <= max;
export const emptyMemory = (): NurtureMemory => ({ completedRounds: 0, lastRoundId: '', mood: '', thoughts: '', threads: [], events: [] });
export function validRecap(v: unknown): v is RoundRecap {
  return obj(v) && text(v.summary, 12000) && text(v.mood, 200) && text(v.thoughts) && Array.isArray(v.threads) && v.threads.every(t => obj(t) && text(t.id, 100) && text(t.text) && ['open', 'done'].includes(String(t.status))) && Array.isArray(v.specialEvents) && v.specialEvents.every(e => obj(e) && text(e.title, 120) && text(e.detail) && Array.isArray(e.stepIndexes) && e.stepIndexes.length > 0 && e.stepIndexes.every(i => Number.isInteger(i) && Number(i) >= 0 && Number(i) < 8));
}
export function validMemory(v: unknown): v is NurtureMemory {
  return obj(v) && Number.isInteger(v.completedRounds) && Number(v.completedRounds) >= 0 && text(v.lastRoundId, 100) && text(v.mood, 200) && text(v.thoughts) && Array.isArray(v.threads) && v.threads.every(t => obj(t) && text(t.id, 100) && text(t.text) && ['open', 'done'].includes(String(t.status)) && Number.isInteger(t.startedRound) && Number.isInteger(t.updatedRound)) && Array.isArray(v.events) && v.events.every(e => obj(e) && text(e.id, 200) && text(e.kind, 100) && text(e.title, 120) && text(e.detail) && Number.isInteger(e.round) && text(e.createdAt, 100));
}
export function actionSummary(steps: Step[]) {
  return steps.map((s, i) => `${i + 1}. ${s.action}${s.receipt ? `（结算：${s.receipt}）` : ''}${cardsForDraw(s).length ? `, ${cardsForDraw(s).map(c => `${c.rarity} ${c.name}`).join(", ")}` : ""}`).join('\n').slice(0, 12000);
}
export function makeRecap(value: unknown, steps: Step[], memory: NurtureMemory): RoundRecap {
  const fallback: RoundRecap = { summary: actionSummary(steps), mood: memory.mood, thoughts: steps.at(-1)?.resultThought ?? steps.at(-1)?.thought ?? '', threads: [], specialEvents: [] };
  if (value === undefined) return fallback; // Old endpoints and saves remain readable.
  if (!obj(value) || !text(value.mood, 200) || !text(value.thoughts) || !Array.isArray(value.threads) || !Array.isArray(value.specialEvents) || value.threads.length > 6 || value.specialEvents.length > 2) throw new Error('AI 返回的连续记忆格式无效，本轮未保存。');
  const recap = { ...value, summary: fallback.summary };
  if (!validRecap(recap) || recap.specialEvents.some(e => e.stepIndexes.some(i => i >= steps.length))) throw new Error('AI 返回的事件引用无效，本轮未保存。');
  const known = new Set(memory.threads.map(t => t.id));
  if (recap.threads.some(t => !t.text.trim() || t.id && !known.has(t.id) || t.status === 'done' && !t.id)) throw new Error('AI 返回的未完结事项无效，本轮未保存。');
  const ids = recap.threads.filter(t => t.id).map(t => t.id);
  if (new Set(ids).size !== ids.length) throw new Error('AI 重复更新了同一事项，本轮未保存。');
  const threads = recap.threads.map(t => {
    if (t.stepIndexes !== undefined && (!Array.isArray(t.stepIndexes) || !t.stepIndexes.every(i => Number.isInteger(i) && i >= 0 && i < steps.length))) throw new Error('AI 返回的事项步骤引用无效，本轮未保存。');
    if (t.status === 'done' && !t.stepIndexes?.length) throw new Error('完成事项需要引用本轮实际步骤，本轮未保存。');
    const failed = t.stepIndexes?.some(i => steps[i].receipt?.includes('不足') || steps[i].receipt?.includes('未开放'));
    return { ...t, id: t.id || crypto.randomUUID(), status: failed && t.status === 'done' ? 'open' as const : t.status };
  });
  return { ...recap, threads };
}
export function archiveRound(memory: NurtureMemory, round: Round): NurtureMemory {
  if (memory.lastRoundId === round.id) return memory;
  const number = memory.completedRounds + 1;
  const recap = round.recap ?? makeRecap(undefined, round.steps, memory);
  const events = [...memory.events];
  const add = (kind: string, title: string, detail: string, unique = false) => {
    if (unique && events.some(e => e.kind === kind)) return;
    events.push({ id: `${round.id}:${kind}:${events.length}`, kind, title, detail: detail.slice(0, 1500), round: number, createdAt: round.createdAt });
  };
  if (!memory.completedRounds) add('first-login', '第一次打开你的世界', '从这一轮开始，他的手机里多了一份关于你的日常。', true);
  for (const step of round.steps) {
    for (const card of cardsForDraw(step)) { add('first-card', '第一次抽到你的卡面', `${card.rarity} · ${card.name}`, true); if (isPityRare(card)) add('rare-card', '星愿回应的那一刻', `抽到了 ${card.rarity}「${card.name}」。`); }
    if (step.acquired) add('first-purchase', '第一次为你挑选礼物', step.receipt || step.action, true);
    if (step.sentItemId) add('gift-received', '一份心意送到了', `${step.giftedProduct?.name ?? '礼物'}\n收到的反应：${step.speech}\n角色当时的想法：${step.thought}`);
    if (step.kind === 'date' && step.receipt && !step.receipt.includes('不足')) add('first-date', '第一次赴约', step.receipt, true);
    if (step.kind === 'event') add('limited-event', '一起参加的限定时光', `${round.eventTitle || '限时活动'} · ${step.action}`);
  }
  for (const event of recap.specialEvents) add('emotion', event.title, `${event.detail}\n当时的操作：${event.stepIndexes.map(i => round.steps[i]?.action).filter(Boolean).join('；')}`);
  const threads = memory.threads.map(t => ({ ...t }));
  for (const update of recap.threads) {
    const index = threads.findIndex(t => t.id === update.id);
    if (index >= 0) threads[index] = { ...threads[index], ...update, updatedRound: number };
    else if (update.status === 'open') threads.push({ ...update, startedRound: number, updatedRound: number });
  }
  const resultThoughts = round.steps.flatMap(s => s.resultThought ? [`${s.kind === 'recharge' ? '充值后' : '抽卡后'}：${s.resultThought}`] : []).join('\n');
  const thoughts = resultThoughts ? `${recap.thoughts}\n${resultThoughts}`.slice(-1500) : recap.thoughts;
  return { completedRounds: number, lastRoundId: round.id, mood: recap.mood, thoughts, threads, events };
}
export function memoryFor(save: Pick<Save, 'memory' | 'rounds'>): NurtureMemory {
  if (save.memory) return save.memory;
  return [...save.rounds].reverse().filter(r => r.cursor === r.steps.length).reduce(archiveRound, emptyMemory());
}
export function relationshipStage(completedRounds: number, stats: Stats) {
  if (completedRounds === 0) return { id: 'first', label: '初次相遇', guidance: '这是第一次打开游戏，没有过去的陪伴、约定或熟悉的操作。要有新鲜、好奇和试探的探索感，先认识界面与眼前的你，不装作熟悉，也不急于产生隔屏遗憾。' };
  if (completedRounds < 4) return { id: 'explore', label: '慢慢熟悉', guidance: '仍在探索游戏，记住上一轮的尝试与心情，逐渐找到照顾你的方式；不要突然表现成多年相伴。' };
  if (completedRounds >= 12 && stats.affection >= 60) return { id: 'attached', label: '隔屏牵挂', guidance: '已有一段持续陪伴，可在具体触碰、约会或回忆中偶尔感到屏幕的距离：想真正摸到你、想让照顾抵达现实。由人设和当下情绪决定表达方式，可克制、玩笑或短暂失神。不必每轮出现，不照抄固定台词，不升级为知道策划后台或现实中真正接触。心情低落时可以犹疑，不能只按轮数强制深情。' };
  return { id: 'familiar', label: '习惯有你', guidance: '开始形成自己的游戏习惯，呼应过往特殊事件与未完结事项，让关心落实在行动里。可偶尔对虚拟触碰产生微妙停顿，但不强制煽情；亲密度较低时保持相应距离。' };
}
export function memoryContext(save: Save) {
  const memory = memoryFor(save);
  const previous = save.rounds.find(r => r.cursor === r.steps.length);
  return { completedRounds: memory.completedRounds, stage: relationshipStage(memory.completedRounds, save.pending?.stats ?? save.stats),
    previousRound: previous ? { number: previous.number ?? memory.completedRounds, openingThought: previous.openingThought, before: previous.before, after: previous.after, summary: previous.recap?.summary ?? actionSummary(previous.steps), mood: previous.recap?.mood ?? memory.mood, thoughts: previous.id === memory.lastRoundId ? memory.thoughts : previous.recap?.thoughts ?? previous.steps.at(-1)?.resultThought ?? previous.steps.at(-1)?.thought } : null,
    playerMood: memory.mood, playerThoughts: memory.thoughts, unfinished: memory.threads.filter(t => t.status === 'open'),
    milestones: memory.events.filter(e => e.kind.startsWith('first-')), recentSpecialEvents: memory.events.filter(e => !e.kind.startsWith('first-')).slice(-16) };
}
export const MEMORY_RULES = '每轮必须承接continuity：上一轮结算数值、行动摘要、角色自己的心情想法、未完结事项和特殊事件。当前stats是本轮起始数值，previousRound.after是上轮实际结算，若不同则以当前stats为准。结算回执优先于角色意图，未购买或未成行的事情不能当作已经完成。第一轮没有共同回忆，要有新鲜探索感。按stage.guidance自然发展，不固定复读“如果能真正触碰你就好了”，不必每轮都感伤。未完结事项仅在有实际后续时推进，不能遗忘或凭空解决。JSON顶层除steps外增加memory:{mood:"角色本轮结束时的心情",thoughts:"角色留下的第一人称想法",threads:[{id:"延续旧事项用原id，新事项用空字符串",text:"角色想做但尚未完成的具体事项",status:"open/done",stepIndexes:[0]}],specialEvents:[{title:"值得记住的情绪转折",detail:"仅角色自身的感受和实际操作",stepIndexes:[0]}]}。threads只填写本轮新增或有进展的事项，最多6条；未提及的旧事项自动保留。specialEvents最多2条，允许为空，引用本轮从0开始的步骤；普通重复照顾不算特殊事件。不要预言抽卡结果或记录未发生的行为，不替user编造发言、心情、承诺或回应。';
