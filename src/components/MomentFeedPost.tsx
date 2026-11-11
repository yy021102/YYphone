import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { Heart, Lock, MapPin, MessageCircle } from 'lucide-react';
import { MOMENT_USER_ID, type MomentComment, type MomentPost } from '../utils/momentsData';
import { MomentMediaGrid, type MomentMediaItem } from './MomentCards';

function useMomentPress(onOpen: () => void, skipButtons = false) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => cancel, []);
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      cancel(); held.current = false;
      if (event.button !== 0 || !event.isPrimary || skipButtons && (event.target as HTMLElement).closest('button,input,textarea,select,a')) return;
      event.stopPropagation(); origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => { held.current = true; onOpen(); }, 500);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) cancel(); },
    onPointerUp: cancel, onPointerCancel: cancel, onPointerLeave: cancel,
    onContextMenu: (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); cancel(); onOpen(); },
    onClickCapture: (event: React.MouseEvent) => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; } },
  };
}

function CommentLine({ comment, onReply, onManage }: { comment: MomentComment; onReply: () => void; onManage: () => void }) {
  const press = useMomentPress(onManage);
  return <button type="button" className="moment-comment" {...press} onClick={onReply} aria-label={`${comment.authorName}：${comment.content}`}>
    <span className="moment-name">{comment.authorName}</span>{comment.replyToName && <> 回复 <span className="moment-name">{comment.replyToName}</span></>}：{comment.content}
  </button>;
}

export function MomentFeedPost({ post, author, time, visibility, interactionOpen, generating, commentEditor, onOpenMedia, onManage, onManageComment, onComment, onReply, onLike, onToggleInteraction }: {
  post: MomentPost; author: { name: string; avatar: string }; time: string; visibility: string;
  interactionOpen: boolean; generating: boolean; commentEditor?: ReactNode;
  onOpenMedia: (item: MomentMediaItem) => void; onManage: () => void; onManageComment: (comment: MomentComment) => void;
  onComment: () => void; onReply: (comment: MomentComment) => void; onLike: () => void; onToggleInteraction: () => void;
}) {
  const press = useMomentPress(onManage, true);
  const liked = post.likes.some(like => like.id === MOMENT_USER_ID);
  return <article className="moment-post" aria-label={`${author.name} 的朋友圈`} tabIndex={0} {...press} onKeyDown={event => {
    if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) { event.preventDefault(); onManage(); }
  }}>
    {author.avatar ? <img className="moment-avatar" src={author.avatar} alt={`${author.name} 的头像`}/> : <span className="moment-avatar moment-avatar-fallback">{author.name.trim().charAt(0) || '?'}</span>}
    <div className="moment-body">
      <h3 className="moment-author moment-name">{author.name}</h3>
      {post.content && <p className="moment-content">{post.content}</p>}
      <MomentMediaGrid images={post.images} cards={post.textImageCards} onOpen={onOpenMedia}/>
      {post.location && <p className="moment-location"><MapPin size={12}/>{post.location}</p>}
      <div className="moment-meta"><div className="moment-meta-text"><time dateTime={post.createdAt}>{time}</time>{visibility && <span title={visibility} className="moment-visibility"><Lock size={10}/>{visibility}</span>}{generating && <span role="status">正在更新…</span>}</div>
        <div className="moment-interaction-anchor" onClick={event => event.stopPropagation()}>
          {interactionOpen && <div className="moment-interaction-menu" role="menu" aria-label="朋友圈互动">
            <button type="button" role="menuitem" onClick={onLike}><Heart size={16} fill={liked ? 'currentColor' : 'none'}/>{liked ? '取消赞' : '赞'}</button>
            <button type="button" role="menuitem" onClick={onComment}><MessageCircle size={16}/>评论</button>
          </div>}
          <button type="button" className="moment-more" aria-label="点赞或评论" aria-expanded={interactionOpen} onClick={onToggleInteraction}><span/><span/></button>
        </div>
      </div>
      {(post.likes.length > 0 || post.comments.length > 0) && <div className="moment-discussion">
        {post.likes.length > 0 && <div className="moment-likes"><Heart size={14}/><span>{post.likes.map(like => like.name).join('，')}</span></div>}
        {post.comments.length > 0 && <div className="moment-comments">{post.comments.map(comment => <CommentLine key={comment.id} comment={comment} onReply={() => onReply(comment)} onManage={() => onManageComment(comment)}/>)}</div>}
      </div>}
      {commentEditor}
    </div>
  </article>;
}
