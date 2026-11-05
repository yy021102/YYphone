import { useEffect, useRef, useState } from 'react';
import { Square } from 'lucide-react';
import { ao3CommentCharacters, generateAo3Comments } from '../utils/ao3Comments';
import { readAo3State, type Ao3Action, type Ao3Comment, type Ao3Work } from '../utils/ao3Data';

export function Ao3Comments({ work, userName, onAction }: {
  work: Ao3Work; userName: string; onAction: (action: Ao3Action) => boolean;
}) {
  const [text, setText] = useState(''), [replyTo, setReplyTo] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState<{ mode: 'extra' | 'reply'; target?: string } | null>(null);
  const request = useRef<AbortController | null>(null), input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  const target = work.comments.find(c => c.id === replyTo);
  const hasCharacter = ao3CommentCharacters(work).length > 0;
  const generate = async (mode: 'extra' | 'reply', targetId?: string) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError(''); setRetry({ mode, target: targetId });
    try {
      const current = readAo3State().works.find(w => w.id === work.id);
      if (!current) throw new Error('作品已不存在，无法生成评论。');
      const comments = await generateAo3Comments(current, mode, controller.signal, targetId);
      if (controller.signal.aborted || request.current !== controller) return;
      if (!onAction({ type: 'comments', work: current, comments })) throw new Error('新评论未能保存，原评论已保留，请重试。');
      setRetry(null);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '评论生成失败，已发表的留言已保留，请重试。');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  const post = () => {
    if (!text.trim() || request.current) return;
    const comment: Ao3Comment = { id: crypto.randomUUID(), author: userName, body: text.trim(), createdAt: new Date().toISOString(),
      identity: { type: 'user', id: 'user' }, ...(replyTo ? { replyTo } : {}) };
    if (!onAction({ type: 'comment', id: work.id, comment })) return;
    setText(''); setReplyTo(''); void generate('reply', comment.id);
  };
  const roots = work.comments.filter(c => !c.replyTo);
  const rootIds = new Map<string, string>();
  const threads = new Map<string, Ao3Comment[]>();
  for (const comment of work.comments) {
    const rootId = comment.replyTo ? rootIds.get(comment.replyTo)! : comment.id;
    rootIds.set(comment.id, rootId);
    const thread = threads.get(rootId) ?? [];
    thread.push(comment); threads.set(rootId, thread);
  }
  const chooseReply = (comment: Ao3Comment) => {
    setReplyTo(comment.id); input.current?.focus(); input.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  return <div className="ao3-comment-section">
    <h3>评论 / Comments</h3>
    <div className="ao3-actions">
      <button className="ao3-button" disabled={busy || !hasCharacter} onClick={() => void generate('extra')}>再生成 3 条评论 · 角色必出现</button>
      {busy && <button className="ao3-button" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); setError('已停止生成，已发表的留言和原评论均已保留。'); }}><Square size={12}/>停止生成评论</button>}
    </div>
    <p className="ao3-help">新评论只会追加。</p>
    {!hasCharacter && <p className="ao3-help">额外生成需有关联的通讯录角色；无关联角色时，你仍可留言并收到路人回复。</p>}
    {busy && <p role="status" className="ao3-writing-status">正在生成 3 条{retry?.mode === 'reply' ? '回复你的留言' : '新评论'}…</p>}
    {error && <p className="ao3-notice ao3-error" role="alert">{error}</p>}
    {!busy && retry && <button className="ao3-button" onClick={() => void generate(retry.mode, retry.target)}>重试生成{retry.mode === 'reply' ? '回复' : '评论'}</button>}
    {roots.map(root => <div className="ao3-comment-thread" key={root.id}>{threads.get(root.id)!.map(comment => {
      const parent = work.comments.find(c => c.id === comment.replyTo);
      const isAuthor = comment.identity?.type === 'character' && work.generation?.authorType === 'character' && work.generation.authorCharId === comment.identity.id;
      const badge = isAuthor ? '作者' : comment.identity?.type === 'character' ? '角色' : comment.identity?.type === 'npc' ? 'NPC' : comment.identity?.type === 'user' ? '你' : '';
      return <article className={parent ? 'ao3-comment-reply' : ''} key={comment.id} id={`ao3-comment-${comment.id}`}>
        <header><strong>{comment.author}{badge && <small className="ao3-comment-badge">{badge}</small>}</strong><time>{new Date(comment.createdAt).toLocaleDateString('zh-CN')}</time></header>
        {parent && <div className="ao3-reply-context">回复 {parent.author}：{parent.body.slice(0, 100)}{parent.body.length > 100 ? '…' : ''}</div>}
        <p>{comment.body}</p><div className="ao3-comment-actions">
          <button className="ao3-link" disabled={busy} onClick={() => chooseReply(comment)}>回复</button>
          {comment.identity?.type === 'user' && !work.comments.some(c => c.replyTo === comment.id && c.identity?.type !== 'user') &&
            <button className="ao3-link" disabled={busy} onClick={() => void generate('reply', comment.id)}>生成回复</button>}
        </div>
      </article>;
    })}</div>)}
    <form onSubmit={e => { e.preventDefault(); post(); }}>
      {target && <div className="ao3-reply-context">正在回复 {target.author}：{target.body.slice(0, 100)} <button type="button" className="ao3-link" disabled={busy} onClick={() => setReplyTo('')}>取消回复</button></div>}
      <label>{target ? `以 ${userName} 的身份回复` : `以 ${userName} 的身份留言`}<textarea ref={input} aria-label="评论内容" rows={4} maxLength={5000} required disabled={busy} value={text} onChange={e => setText(e.target.value)}/></label>
      <button className="ao3-button" disabled={busy || !text.trim()} type="submit">{target ? '发表回复' : '发表评论'}</button>
    </form>
  </div>;
}
