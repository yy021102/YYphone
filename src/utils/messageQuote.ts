type QuoteMessage = { id: string; senderId: string; text: string; kind?: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Accept common structured spellings, but only attach quotes to real messages. */
export function readMessageQuote(part: Record<string, unknown>): string | undefined {
  const raw = part.quote ?? part.replyTo ?? part.quoteText ?? part.quotedText ?? part.reference;
  if (typeof raw === 'string') return raw.trim().slice(0, 1000) || undefined;
  if (record(raw)) {
    for (const key of ['text', 'content', 'quote', 'id', 'messageId']) {
      if (typeof raw[key] === 'string' && raw[key].trim()) return raw[key].trim().slice(0, 1000);
    }
  }
  return undefined;
}
const normalize = (text: string) => text.normalize('NFKC').replace(/[\p{P}\s]/gu, '');
export function findQuotedMessage<T extends QuoteMessage>(messages: readonly T[], quote?: string): T | undefined {
  if (!quote) return undefined;
  const candidates = [...messages].reverse().filter(item => item.senderId !== 'narrator' && !['pat', 'context-note'].includes(item.kind ?? '') && item.text.trim());
  const exact = candidates.find(item => item.id === quote || item.text === quote);
  if (exact) return exact;
  const direct = candidates.find(item => item.text.includes(quote));
  if (direct) return direct;
  const needle = normalize(quote);
  if (needle.length < 4) return undefined;
  // Require one unambiguous match when the model changes punctuation or line breaks.
  const matches = candidates.filter(item => {
    const text = normalize(item.text);
    return text.length >= 4 && (text.includes(needle) || needle.includes(text));
  });
  return matches.length === 1 ? matches[0] : undefined;
}
