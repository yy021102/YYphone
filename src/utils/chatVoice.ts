const VOICE_KIND = /^(?:voice|audio|voice[-_ ]message|语音(?:消息)?)$/i;

/** Only explicit voice markers count; ordinary mentions of voice remain ordinary text. */
export function voiceMessageText(text: string): string | null {
  const source = text.trim();
  const tag = source.match(/^<(?:voice|audio)\b[^>]*>([\s\S]+)<\/(?:voice|audio)>$/i);
  if (tag) return tag[1].trim() || null;
  const whole = source.match(/^(?:【|\[|（|\()\s*(?:语音(?:消息|转写|转文字)?|voice|audio)(?:\s*[(（]?\d+\s*(?:秒|s|["″])?[)）]?)?\s*[：:]\s*([\s\S]+?)(?:】|\]|）|\))$/i);
  if (whole) return whole[1].trim() || null;
  const prefix = /^(?:(?:【|\[|（|\()\s*(?:语音(?:消息|转写|转文字)?|voice|audio)(?:\s*[(（]?\d+\s*(?:秒|s|["″])?[)）]?)?\s*(?:】|\]|）|\))\s*[：:]?|(?:语音(?:消息|转写|转文字)?|voice|audio)\s*[：:])\s*/i;
  const stripped = source.replace(prefix, '').trim();
  return stripped !== source ? stripped || null : null;
}

export function normalizeChatVoicePart(part: unknown): unknown {
  if (typeof part === 'string') {
    const voice = voiceMessageText(part);
    return voice ? { kind: 'voice', text: voice } : part;
  }
  if (!part || typeof part !== 'object' || Array.isArray(part)) return part;
  const entry = part as Record<string, unknown>;
  const kind = entry.kind ?? entry.type ?? entry.messageType;
  const explicitVoice = typeof kind === 'string' && VOICE_KIND.test(kind.trim());
  const body = [entry.text, entry.content, ...(explicitVoice ? [entry.transcript, entry.voiceText] : [])]
    .find((value): value is string => typeof value === 'string' && !!value.trim()) ?? '';
  const marked = (!kind || kind === 'text' || explicitVoice) && body ? voiceMessageText(body) : null;
  return explicitVoice || marked ? { ...entry, kind: 'voice', text: marked || body.trim() } : part;
}
