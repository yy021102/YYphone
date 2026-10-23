export interface CallReplyPart {
  text: string;
  kind?: string;
}

export interface NormalizedCallReplyPart {
  text: string;
  kind: 'text' | 'narration';
}

export const normalizeCallReplyParts = (
  parts: CallReplyPart[],
  mode: 'voice' | 'video'
): NormalizedCallReplyPart[] => {
  const speech = parts
    .filter((part) => part.kind !== 'narration')
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 4000);
  if (!speech) return [];

  const normalized: NormalizedCallReplyPart[] = [{ text: speech, kind: 'text' }];
  if (mode === 'video') {
    const narration = parts
      .filter((part) => part.kind === 'narration')
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 120);
    if (narration) normalized.push({ text: narration, kind: 'narration' });
  }
  return normalized;
};
