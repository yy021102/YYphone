import { messageTranslation, type ChatLanguage, type ChatTranslation } from './chatLanguage';

export interface CallReplyPart {
  text: string;
  kind?: string;
  chatTranslation?: ChatTranslation;
}

export interface NormalizedCallReplyPart {
  text: string;
  kind: 'text' | 'narration';
  chatTranslation?: ChatTranslation;
}

export const normalizeCallReplyParts = (
  parts: CallReplyPart[],
  mode: 'voice' | 'video',
  language?: ChatLanguage
): NormalizedCallReplyPart[] => {
  const speechParts = parts.filter((part) => part.kind !== 'narration' && part.text.trim());
  const speech = speechParts
    .map((part) => part.text.trim())
    .join(' ');
  if (!speech) return [];

  const translatedParts = speechParts.map(part => messageTranslation(part));
  const translationLanguage = language ?? translatedParts.find(part => part)?.language;
  const clippedSpeech = speech.slice(0, 4000);
  const fullSpeech = translationLanguage || /[。！？.!?…]$/.test(clippedSpeech) ? clippedSpeech : `${clippedSpeech}。`;
  const normalized: NormalizedCallReplyPart[] = [{ text: fullSpeech, kind: 'text' }];
  if (translationLanguage) {
    if (speech.length > 4000) {
      throw new Error('通话台词过长，无法完整配对译文，请缩短台词后重试。');
    }
    const translated = speechParts.map((part, index) => {
      const translation = translatedParts[index];
      if (translation && translation.language === translationLanguage) return translation.text.trim();
      if (!/[\p{L}\p{N}]/u.test(part.text)) return part.text.trim();
      throw new Error('通话台词缺少对应语言的完整译文，请重新生成。');
    });
    if (translatedParts.some(Boolean)) normalized[0].chatTranslation = {
      language: translationLanguage, text: translated.join(' '), sourceText: fullSpeech,
    };
  }
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
