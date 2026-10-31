export interface EncounterRound { userWord: string; characterWord: string }
export interface EncounterResult { id: string; actorId: string; actorName: string; userName: string; rounds: EncounterRound[]; matched: boolean }
export interface EncounterAiInput { actorId: string; history: EncounterRound[]; signal: AbortSignal }
export const cleanEncounterWord = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('请写下一个词语。');
  const word = value.trim().replace(/^[「『“"‘']|[」』”"’']$/g, '').trim();
  if (!word || [...word].length > 20 || !/[\p{L}\p{N}]/u.test(word) || /[\r\n,，、;；|｜/\\]/.test(word)) throw new Error('每轮写一个词语，最多 20 个字，不要填写多个答案。');
  return word;
};
const normalize = (word: string) => cleanEncounterWord(word).normalize('NFKC').replace(/\s/g, '').toLocaleLowerCase();
export const encounterMatches = (a: string, b: string) => normalize(a) === normalize(b);

/** The caller supplies only already revealed rounds. There is no current player word in this API. */
export const encounterTask = (history: readonly EncounterRound[]) => {
  const publicHistory = history.slice(-8).map(({ userWord, characterWord }) => ({ userWord, characterWord }));
  return history.length
    ? `这是第 ${history.length + 1} 轮。上一轮公开的两个词是：${JSON.stringify(publicHistory.at(-1))}。请从这两个词共同联想出一个新的词语，不是只接其中一个词，也不是猜测玩家当前写了什么。优先选择你自然会想到、与两者都有关的交集，不刻意绕远，不为了戏剧性躲开容易重合的答案。近期公开记录：${JSON.stringify(publicHistory)}。本轮玩家的词尚未公开，你无法看到。只返回 JSON：{"word":"一个词语"}。不写解释、台词、心声或多个备选。`
    : '这是第一轮，双方各自自由选一个词，尚未交换答案。根据你的性格、兴趣或当下自然想到的事物，独立写下一个简洁词语。不预设或猜测玩家会写什么，不强制选择浪漫词汇。只返回 JSON：{"word":"一个词语"}。不写解释、台词、心声或多个备选。';
};

export const encounterDetail = (result: EncounterResult) => [
  `同词相遇 · ${result.matched ? `第 ${result.rounds.length} 轮相遇` : '本局结束'}`,
  `${result.userName} × ${result.actorName}`,
  ...result.rounds.map((round, i) => `第 ${i + 1} 轮｜${result.userName}：${round.userWord}｜${result.actorName}：${round.characterWord}`),
  '这是双方各自保密选词、揭晓后再共同联想的手机小游戏记录，不是真实世界发生的事件。',
].join('\n');
export function isEncounterResult(value: unknown): value is EncounterResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as EncounterResult;
  if (![r.id, r.actorId, r.actorName, r.userName].every(v => typeof v === 'string') || typeof r.matched !== 'boolean' || !Array.isArray(r.rounds) || !r.rounds.length) return false;
  try { return r.rounds.every(round => !!round && typeof round === 'object' && cleanEncounterWord(round.userWord) && cleanEncounterWord(round.characterWord)) && r.matched === encounterMatches(r.rounds.at(-1)!.userWord, r.rounds.at(-1)!.characterWord); } catch { return false; }
}
