export type ChannelMedia = { kind: 'image' | 'video' | 'voice' | 'transfer'; text: string; url?: string; amount?: number; accepted?: boolean; id?: string };
export const isChannelMedia = (v: unknown): v is ChannelMedia => {
  if (!v || typeof v !== 'object') return false;
  const m = v as ChannelMedia;
  return ['image', 'video', 'voice', 'transfer'].includes(m.kind) && typeof m.text === 'string' &&
    (m.url === undefined || typeof m.url === 'string' && /^(https?:\/\/|data:image\/)/i.test(m.url)) &&
    (m.amount === undefined || Number.isFinite(m.amount) && m.amount > 0 && m.amount <= 200000 && Math.abs(Math.round(m.amount * 100) - m.amount * 100) < 0.000001) &&
    (m.accepted === undefined || typeof m.accepted === 'boolean') && (m.id === undefined || typeof m.id === 'string');
};
export const channelVisibleText = (s: string) => s.replace(/<(think|thinking|thought)>[\s\S]*?<\/\1>/gi, '').replace(/【心声】[^\n]*/g, '').trim();
export function parseChannelMessages(result: unknown): Array<{ text: string; media?: ChannelMedia }> {
  const r = result as { messages?: unknown[]; text?: string };
  const values = Array.isArray(r?.messages) ? r.messages : typeof r?.text === 'string' ? r.text.split(/\n+/) : [];
  const messages = values.slice(0, 8).flatMap(v => {
    if (typeof v === 'string') { const text = channelVisibleText(v); return text ? [{ text: text.slice(0, 2000) }] : []; }
    if (!v || typeof v !== 'object') return [];
    const m = v as Record<string, unknown>;
    if (m.kind === 'thought' || m.kind === 'thinking' || m.kind === '心声') return [];
    const text = typeof m.text === 'string' ? channelVisibleText(m.text).slice(0, 2000) : '';
    if (!text) return [];
    // AI may describe media, but cannot fabricate a real image URL or a settled transfer.
    const media = { kind: m.kind, text, ...(m.kind === 'transfer' ? { amount: m.amount, id: crypto.randomUUID() } : {}) };
    return [{ text, ...(isChannelMedia(media) && (media.kind !== 'transfer' || media.amount) ? { media } : {}) }];
  });
  if (!messages.length) throw new Error('返回消息为空，请重试。');
  return messages;
}
