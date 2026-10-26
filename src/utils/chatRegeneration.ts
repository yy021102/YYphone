interface ReplyMessage { id: string; senderId: string; kind?: string; replyBatchId?: string }

/** Match exactly the turn that will be replaced, including its images, narration and thoughts. */
export function regeneratedReplyIds(messages: readonly ReplyMessage[]): Set<string> {
  const last = messages.at(-1);
  if (!last || last.senderId === 'user' || last.kind === 'context-note' || (last.senderId === 'narrator' && !last.replyBatchId)) return new Set();
  return new Set((last.replyBatchId ? messages.filter(message => message.replyBatchId === last.replyBatchId) : [last]).map(message => message.id));
}
