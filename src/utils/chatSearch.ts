export interface SearchMessage { id: string; text: string; senderId?: string; senderName?: string; createdAt: string; kind?: string; source?: string }
export interface SearchConversation { id: string; targetId: string; type: 'chat' | 'alias'; title: string; avatarUrl?: string; messages: SearchMessage[] }
export interface ChatSearchResult { conversation: SearchConversation; hits: Array<{ message: SearchMessage; occurrences: number }>; occurrences: number }

export function keywordOccurrences(text: string, query: string): number {
  const word = query.trim().toLowerCase();
  if (!word) return 0;
  const value = text.toLowerCase(); let count = 0, index = 0;
  while ((index = value.indexOf(word, index)) !== -1) { count++; index += word.length; }
  return count;
}

export function searchChatHistory(conversations: SearchConversation[], query: string): ChatSearchResult[] {
  const word = query.trim();
  if (!word) return [];
  return conversations.flatMap(conversation => {
    const hits = conversation.messages.flatMap(message => {
      if (['context-note', 'recalled', 'group-rename', 'pat'].includes(message.kind ?? '') ||
        ['alias-experience', 'phone-proxy-send', 'phone-inspection'].includes(message.source ?? '') ||
        message.senderId === 'narrator' && message.source !== 'user-narration') return [];
      const occurrences = keywordOccurrences(message.text, word);
      return occurrences ? [{ message, occurrences }] : [];
    }).reverse();
    return hits.length || keywordOccurrences(conversation.title, word) ? [{ conversation, hits, occurrences: hits.reduce((sum, hit) => sum + hit.occurrences, 0) }] : [];
  }).sort((a, b) => b.hits.length - a.hits.length || (b.hits[0]?.message.createdAt ?? '').localeCompare(a.hits[0]?.message.createdAt ?? ''));
}

export function searchExcerpt(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.trim().toLowerCase());
  const start = Math.max(0, index - 35), end = Math.min(text.length, Math.max(index, 0) + query.trim().length + 85);
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
