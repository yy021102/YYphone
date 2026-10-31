interface ReplyMessage {
  id: string; senderId: string; kind?: string; replyBatchId?: string; thought?: string;
  amount?: string; paymentStatus?: string;
  packetClaims?: Array<{ recipientId: string; amount: string; claimed: boolean }>;
}
type Settlements = Readonly<Record<string, 'received' | 'returned'>>;

export function regeneratedReplyBatch(messages: readonly ReplyMessage[]): readonly ReplyMessage[] {
  const last = messages.at(-1);
  if (!last || last.senderId === 'user' || last.kind === 'context-note' || (last.senderId === 'narrator' && !last.replyBatchId)) return [];
  return last.replyBatchId ? messages.filter(message => message.replyBatchId === last.replyBatchId) : [last];
}

/** Completed payments are facts, not replaceable dialogue. Legacy unlabelled payments may already be credited. */
export function settledReplyPaymentIds(messages: readonly ReplyMessage[], settlements: Settlements = {}): Set<string> {
  return new Set(regeneratedReplyBatch(messages).filter(message =>
    message.senderId !== 'user' && (message.kind === 'transfer' || message.kind === 'red-packet') &&
    (message.paymentStatus !== 'pending' || !!settlements[message.id] || message.packetClaims?.some(claim => claim.claimed))
  ).map(message => message.id));
}

/** Match exactly the turn that will be replaced, including its images, narration and thoughts. */
export function regeneratedReplyIds(messages: readonly ReplyMessage[], settlements: Settlements = {}): Set<string> {
  const protectedIds = settledReplyPaymentIds(messages, settlements);
  return new Set(regeneratedReplyBatch(messages).filter(message => !protectedIds.has(message.id)).map(message => message.id));
}

/** Keep settled cards, but never carry the abandoned turn's hidden thoughts into the new reply. */
export function regenerationMessages<T extends ReplyMessage>(messages: readonly T[], settlements: Settlements = {}): T[] {
  const excluded = regeneratedReplyIds(messages, settlements);
  const protectedIds = settledReplyPaymentIds(messages, settlements);
  return messages.filter(message => !excluded.has(message.id)).map(message => protectedIds.has(message.id)
    ? { ...message, thought: undefined, paymentStatus: settlements[message.id] ?? message.paymentStatus } : message);
}

/** Join retained cards to the replacement turn so repeated rerolls keep the same settlement protection. */
export function retainSettledReplyPayment<T extends ReplyMessage>(message: T, protectedIds: ReadonlySet<string>, replyBatchId: string, settlements: Settlements = {}): T {
  return protectedIds.has(message.id) ? { ...message, replyBatchId, thought: undefined, paymentStatus: settlements[message.id] ?? message.paymentStatus } : message;
}

/** Recheck before replacing a pending card: another tab may have received it while the model was running. */
export function regenerationPaymentStamp(messages: readonly ReplyMessage[], batchIds: ReadonlySet<string>, settlements: Settlements = {}): string {
  return JSON.stringify(messages.filter(m => batchIds.has(m.id) && (m.kind === 'transfer' || m.kind === 'red-packet')).map(m =>
    [m.id, m.kind, m.senderId, m.amount, m.paymentStatus, settlements[m.id], m.packetClaims?.map(c => [c.recipientId, c.amount, c.claimed])]
  ));
}

export function canGenerateChatPayment(observer: boolean, regenerate: boolean, settledPaymentCount = 0): boolean {
  return !observer && (!regenerate || settledPaymentCount === 0);
}

export function chatPaymentGenerationInstructions(observer: boolean, regenerate: boolean, settledPaymentCount = 0): string {
  if (observer) return '本对话为旁观群聊，不能生成发给玩家的红包或转账。';
  if (!canGenerateChatPayment(observer, regenerate, settledPaymentCount)) return '本轮对话中保留了已收款、退还或已有人领取的收付记录，它们已经实际发生。只能改写其余发言，不为同一请求新建红包或转账，也不重复入账；是否关心或提及依照当前对话，不把系统规则说成角色的台词。';
  return '红包、转账可依照人设和当前对话自然决定是否发送，不强制发送。发出时为待领取或待收款，只有玩家确认才加入虚拟余额，玩家也可退还待收转账。只根据本轮提供的实际聊天记录判断发生过什么，不凭空声称已经发过或付过钱。';
}
