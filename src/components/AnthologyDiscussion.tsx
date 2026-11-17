import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { addAnthologyDiscussion, readAnthologyAuthors, type AnthologyArticle } from '../utils/anthology';
import { replyToAnthologyDiscussion } from '../utils/anthologyGeneration';

export function AnthologyDiscussion({ article, onUpdate }: { article: AnthologyArticle; onUpdate: () => unknown }) {
  const [text, setText] = useState(''), [pending, setPending] = useState(''), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const available = readAnthologyAuthors().some(a => a.id === article.authorId);
  const request = async (discussionId?: string) => {
    if (controller.current) return;
    const active = new AbortController(); controller.current = active; setError('');
    try {
      const id = discussionId ?? addAnthologyDiscussion(article.id, text).id;
      if (!discussionId) setText('');
      setPending(id); onUpdate();
      await replyToAnthologyDiscussion(article.id, id, active.signal);
      if (alive.current) onUpdate();
    } catch (cause) {
      if (alive.current) { onUpdate(); setError(active.signal.aborted ? '已停止，你的回复已保留。' : cause instanceof Error ? cause.message : '作者暂未回复，请重试。'); }
    } finally {
      if (controller.current === active) controller.current = null;
      if (alive.current) setPending('');
    }
  };
  return <section className="anthology-discussion" aria-label="文章回复">
    <h2>页边来往</h2>
    <div className="anthology-discussion-list">{(article.discussion ?? []).map(item => <article key={item.id}>
      <header>{item.userAvatar && <img src={item.userAvatar} alt=""/>}<strong>{item.userName}</strong><time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></header>
      <p>{item.body}</p>
      {item.reply ? <div className="anthology-author-reply"><strong>{item.reply.authorName}<small>作者</small></strong><p>{item.reply.body}</p></div>
        : pending === item.id ? <div className="anthology-reply-status" role="status"><Loader2 size={13} className="animate-spin"/>作者正在回信<button type="button" onClick={() => controller.current?.abort()}>停止</button></div>
        : <button type="button" className="anthology-reply-retry" disabled={!!pending || !available} onClick={() => void request(item.id)}>请作者回复</button>}
    </article>)}</div>
    <form onSubmit={event => { event.preventDefault(); void request(); }}>
      <textarea aria-label="回复文章" placeholder="读到这里，想和作者说……" maxLength={8000} value={text} disabled={!!pending || !available} onChange={event => setText(event.target.value)}/>
      <button type="submit" disabled={!!pending || !available || !text.trim()}><Send size={13}/>发出回复</button>
    </form>
    {!available && <p className="anthology-hint">作者已不在通讯录中，往来仍会保留。</p>}
    {error && <p className="anthology-error" role="alert">{error}</p>}
  </section>;
}
