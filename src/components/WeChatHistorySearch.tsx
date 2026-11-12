import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { searchChatHistory, searchExcerpt, type SearchConversation } from '../utils/chatSearch';
import './weChatHistorySearch.css';

function Highlight({ text, query }: { text: string; query: string }) {
  const word = query.trim().toLowerCase(), pieces = []; let start = 0, index: number;
  if (!word) return <>{text}</>;
  while ((index = text.toLowerCase().indexOf(word, start)) >= 0) {
    pieces.push(text.slice(start, index), <mark key={index}>{text.slice(index, index + word.length)}</mark>); start = index + word.length;
  }
  return <>{pieces}{text.slice(start)}</>;
}
export function WeChatHistorySearch({ conversations, query, onOpen }: {
  conversations: SearchConversation[]; query: string; onOpen: (conversation: SearchConversation, messageId?: string) => void;
}) {
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => searchChatHistory(conversations, deferredQuery), [conversations, deferredQuery]);
  const [selectedId, setSelectedId] = useState(''), [limit, setLimit] = useState(50);
  useEffect(() => { setSelectedId(''); setLimit(50); }, [query]);
  const selected = results.find(result => result.conversation.id === selectedId);
  return <section className="yy-chat-search" aria-label="聊天记录搜索">
    {selected ? <>
      <header><button type="button" aria-label="返回搜索结果" onClick={() => setSelectedId('')}><ArrowLeft size={16} /></button><strong>{selected.conversation.title}</strong><span>{selected.hits.length} 条消息 · {selected.occurrences} 处匹配</span></header>
      {selected.hits.slice(0, limit).map(({ message }) => <button type="button" className="yy-search-message" key={message.id} aria-label={`查看消息：${message.text.slice(0, 40)}`} onClick={() => onOpen(selected.conversation, message.id)}>
        <span className="yy-search-byline"><strong>{message.senderName || (message.senderId === 'user' ? '我' : selected.conversation.title)}</strong><time>{new Date(message.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></span>
        <span className="yy-search-excerpt"><Highlight text={searchExcerpt(message.text, deferredQuery)} query={deferredQuery} /></span>
      </button>)}
      {selected.hits.length > limit && <button type="button" className="yy-search-more" onClick={() => setLimit(count => count + 50)}>更多记录</button>}
    </> : <>
      <p className="yy-search-summary">聊天记录{results.length > 0 ? ` · ${results.length} 个对话` : ''}</p>
      {results.map(({ conversation, hits, occurrences }) => <button type="button" className="yy-search-conversation" key={conversation.id} onClick={() => { if (hits.length) { setSelectedId(conversation.id); setLimit(50); } else onOpen(conversation); }}>
        <span className="yy-search-avatar">{conversation.avatarUrl ? <img src={conversation.avatarUrl} alt="" /> : conversation.title.slice(0, 1)}</span>
        <span className="yy-search-copy"><strong><Highlight text={conversation.title} query={deferredQuery} /></strong><small>{hits.length ? `${hits.length} 条相关消息 · ${occurrences} 处匹配` : '打开对话'}</small>{hits[0] && <span><Highlight text={searchExcerpt(hits[0].message.text, deferredQuery)} query={deferredQuery} /></span>}</span><ChevronRight size={15} />
      </button>)}
      {!results.length && <p className="yy-search-empty">没有找到相关聊天记录</p>}
    </>}
  </section>;
}
