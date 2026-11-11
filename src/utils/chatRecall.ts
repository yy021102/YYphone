export interface RecallSnapshot {
  kind: string; text: string; imageUrl?: string; title?: string; content?: string; source?: string; stickerId?: string;
}
export interface ChatRecall { at: string; seenBy: string[]; original: RecallSnapshot }
export interface RecallMessage {
  id: string; senderId: string; text: string; kind?: string; createdAt: string;
  recall?: ChatRecall; aiSeenBy?: string[]; imageUrl?: string; title?: string; content?: string; source?: string; stickerId?: string;
}
const KINDS = new Set(['text', 'image', 'voice', 'sticker', 'location', 'link']);
export const canRecallMessage = (message: RecallMessage) => message.senderId !== 'narrator' && !message.recall && KINDS.has(message.kind ?? 'text') && !['group-private', '反查手机代发'].includes(message.source ?? '');
export function validChatRecall(value: unknown): value is ChatRecall {
  if (!value || typeof value !== 'object') return false;
  const r = value as ChatRecall;
  return typeof r.at === 'string' && Array.isArray(r.seenBy) && r.seenBy.every(id => typeof id === 'string') &&
    !!r.original && KINDS.has(r.original.kind) && typeof r.original.text === 'string' &&
    ['imageUrl', 'title', 'content', 'source', 'stickerId'].every(key => r.original[key as keyof RecallSnapshot] === undefined || typeof r.original[key as keyof RecallSnapshot] === 'string');
}
export function recallMessage<T extends RecallMessage>(message: T, participants: string[], history: readonly RecallMessage[] = [], random = Math.random): T {
  if (!canRecallMessage(message)) throw new Error('这条消息不能撤回。');
  const seen = new Set(message.aiSeenBy ?? []);
  seen.add(message.senderId);
  for (const id of participants) {
    // Replies already made after this message are evidence it was available to that speaker.
    const replied = history.some(item => item.senderId === id && item.kind !== 'recalled' && Date.parse(item.createdAt) > Date.parse(message.createdAt));
    if (replied || seen.has(id) || random() < 0.5) seen.add(id);
  }
  const original: RecallSnapshot = { kind: message.kind ?? 'text', text: message.text };
  for (const key of ['imageUrl', 'title', 'content', 'source', 'stickerId'] as const) if (message[key]) original[key] = message[key];
  if ('imageDescription' in message && message.imageDescription && typeof message.imageDescription === 'object' && 'text' in message.imageDescription && typeof message.imageDescription.text === 'string') original.content = message.imageDescription.text;
  // Retain only timeline identity, not attachment/quote/thought fields that another reader could leak.
  const result = { id: message.id, senderId: message.senderId, createdAt: message.createdAt, kind: 'recalled', text: '',
    recall: { at: new Date().toISOString(), seenBy: [...seen], original } };
  for (const key of ['replyBatchId'] as const) if (key in message) Object.assign(result, { [key]: message[key as keyof T] });
  return result as T;
}
export function recallContext(message: RecallMessage, viewerIds: readonly string[]): string {
  if (!validChatRecall(message.recall)) return '[一条消息已撤回，原内容不可见]';
  const r = message.recall;
  const allowed = viewerIds.filter(id => id === message.senderId || r.seenBy.includes(id));
  const denied = viewerIds.filter(id => !allowed.includes(id));
  const status = `[${message.senderId === 'user' ? '玩家' : `成员 ${message.senderId}`}撤回了一条消息]`;
  if (!allowed.length) return `${status} 你没有看到撤回前的内容，不能猜中、引用或回应其具体内容；可以自然询问，也可以不追问。`;
  return [status,
    `仅这些角色看到了原内容或是原作者：${allowed.join('、')}。${denied.length ? `这些角色没有看到：${denied.join('、')}，不得知道或引用原文，除非其他人在之后明确告知。` : ''}`,
    `可知原内容：${JSON.stringify({ kind: r.original.kind, text: r.original.text, title: r.original.title, content: r.original.content, source: r.original.source, stickerId: r.original.stickerId })}`,
    '这是已经撤回的旧消息，不是新发言。原作者记得自己撤回了什么，但不要每轮反复提起。',
  ].join('\n');
}
export function recallTimeline<T extends RecallMessage>(messages: T[], ids: ReadonlySet<string>, participants: string[], random = Math.random): T[] {
  const updated = messages.map(message => ids.has(message.id) && canRecallMessage(message) ? recallMessage(message, participants, messages, random) : message);
  return updated.map(message => {
    const quote = 'replyTo' in message ? message.replyTo : undefined;
    return quote && typeof quote === 'object' && 'id' in quote && typeof quote.id === 'string' && ids.has(quote.id)
      ? { ...message, replyTo: { ...quote, text: '[原消息已撤回]' } } : message;
  });
}
export function characterRecallInstructions(messages: readonly RecallMessage[], enabled: boolean, actorIds: readonly string[]): string {
  if (!enabled) return '本轮未开放角色撤回消息，禁止 recallActions。';
  const candidates = messages.filter(message => actorIds.includes(message.senderId) && canRecallMessage(message)).slice(-30);
  return ['【可选撤回】按人设和当下情境自行判断，可以不撤回；不要为了使用功能而每轮撤回。可以因打错、发错、犹豫或说漏嘴等自然原因撤回自己的普通消息，不替玩家或其他成员撤回。',
    '撤回以前发出的消息，顶层返回 recallActions:[{"messageId":"获准的原消息ID","speakerId":"原作者ID"}]，最多三条。只能从下方名单选择。',
    '也可让本轮的一条普通 reply 消息发出后撤回：在该消息对象中添加 recall:true，仍正常填写正文、speakerId 与心声。不要把撤回通知写成台词，不伪造已经撤回。金钱、邀请等功能卡片不能撤回。',
    `可撤回的本人旧消息：${JSON.stringify(candidates.map(message => ({ messageId: message.id, speakerId: message.senderId, kind: message.kind ?? 'text', text: message.text.slice(0, 300) })))}`,
  ].join('\n');
}
export function parseRecallActions(value: unknown, messages: readonly RecallMessage[], enabled: boolean, actors: readonly string[]): string[] {
  if (value === undefined || Array.isArray(value) && value.length === 0) return [];
  if (!enabled || !Array.isArray(value) || value.length > 3) throw new Error('本轮撤回消息操作未获准或格式无效。');
  const ids: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('撤回消息格式无效。');
    const action = item as { messageId?: unknown; speakerId?: unknown };
    const target = messages.filter(message => actors.includes(message.senderId) && canRecallMessage(message)).slice(-30).find(message => message.id === action.messageId);
    if (!target || !canRecallMessage(target) || target.senderId !== action.speakerId || !actors.includes(target.senderId)) throw new Error('角色只能撤回自己获准的普通消息。');
    if (!ids.includes(target.id)) ids.push(target.id);
  }
  return ids;
}
