import type { Round, Save } from './nurture';
import { actionSummary, memoryFor, validMemory, validRecap, type NurtureMemory } from './nurtureMemory';

function editable(save: Save) {
  if (save.rounds.some(r => r.cursor < r.steps.length)) throw new Error('请等本轮播放完成后再修改记录。');
}
export function changeMemoryRecords(save: Save, update: (memory: NurtureMemory) => NurtureMemory): Save {
  editable(save);
  const memory = update(structuredClone(memoryFor(save)));
  if (!validMemory(memory)) throw new Error('记录内容过长或格式不正确。');
  const rounds = save.rounds.map(r => r.id === memory.lastRoundId && r.recap ? { ...r, recap: { ...r.recap, mood: memory.mood, thoughts: memory.thoughts } } : r);
  return { ...save, memory, rounds };
}
export function editRoundRecord(save: Save, id: string, draft: Round): Save {
  editable(save);
  const original = save.rounds.find(r => r.id === id);
  if (!original || original.steps.length !== draft.steps.length) throw new Error('找不到该轮记录。');
  const fields = ['action', 'thought', 'speech', 'resultThought', 'paymentThought', 'statusNote'] as const;
  if (draft.steps.some(s => fields.some(k => s[k] !== undefined && (typeof s[k] !== 'string' || s[k]!.length > (k === 'statusNote' ? 3000 : 1500)))) || (draft.openingThought?.length ?? 0) > 1500) throw new Error('每段记录请控制在 1500 字以内，状态留言最多 3000 字。');
  if (!draft.recap || !validRecap(draft.recap)) throw new Error('回顾内容过长或格式不正确。');
  // Editing history never replays purchases, rewards or stat changes.
  const round = { ...original, openingThought: draft.openingThought, recap: structuredClone(draft.recap), steps: original.steps.map((s, i) => ({ ...s, ...Object.fromEntries(fields.map(k => [k, draft.steps[i][k]])) })) };
  const memory = structuredClone(memoryFor(save));
  if (memory.lastRoundId === id) { memory.mood = round.recap.mood; memory.thoughts = round.recap.thoughts; }
  return { ...save, memory, rounds: save.rounds.map(r => r.id === id ? round : r) };
}
export function draftRoundRecord(round: Round): Round {
  return structuredClone({ ...round, recap: round.recap ?? { summary: actionSummary(round.steps), mood: '', thoughts: '', threads: [], specialEvents: [] } });
}
export function deleteRoundRecord(save: Save, id: string): Save {
  editable(save);
  const round = save.rounds.find(r => r.id === id);
  if (!round) return save;
  const memory = structuredClone(memoryFor(save)), rounds = save.rounds.filter(r => r.id !== id);
  const number = round.number ?? save.rounds.length - save.rounds.indexOf(round);
  memory.events = memory.events.filter(e => !e.id.startsWith(`${id}:`));
  memory.threads = memory.threads.filter(t => t.startedRound !== number && t.updatedRound !== number);
  if (memory.lastRoundId === id) {
    memory.lastRoundId = rounds[0]?.id ?? '';
    memory.mood = rounds[0]?.recap?.mood ?? '';
    memory.thoughts = rounds[0]?.recap?.thoughts ?? rounds[0]?.steps.at(-1)?.thought ?? '';
  }
  return { ...save, rounds, memory };
}
