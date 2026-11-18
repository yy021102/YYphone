import type { Round, Step } from './nurture';

/** -1 is opening narration. Unsettled future actions are never available to review. */
export function playbackReviewStep(round: Round, index: number): Step | undefined {
  if (!Number.isInteger(index) || index < -1 || index >= round.cursor) return undefined;
  if (index === -1) return { kind: 'open', action: '打开掌心养成', thought: round.openingThought ?? '', speech: '', draw: false, delta: { mood: 0, energy: 0, affection: 0, growth: 0 } };
  return structuredClone(round.steps[index]);
}
