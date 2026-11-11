import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  Link2,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CharacterNpc } from '../utils/characterNpcs';
import { compressImageFile } from '../utils/imageFile';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { readSetting, SETTINGS_KEYS } from '../utils/settings';
import {
  buildMomentActors,
  createMomentId,
  getInteractionCandidates,
  MOMENT_USER_ID,
  MOMENTS_COVER_STORAGE_KEY,
  MomentActor,
  MomentPost,
  updateMoments,
  useMoments,
} from '../utils/momentsData';
import {
  generateMomentContent,
  generateMomentInteractions,
  MomentGenerationMode,
} from '../utils/momentsAi';
import { MomentMediaItem, TextImageCard } from './MomentCards';
import { MomentFeedPost } from './MomentFeedPost';
import './moments.css';
import { MomentComposer, MomentComposerResult } from './MomentComposer';

interface MomentsTabContact {
  id: string;
  name: string;
  avatarUrl: string;
  persona: string;
}

interface MomentsTabProps {
  userName: string;
  userAvatarUrl: string;
  contacts: MomentsTabContact[];
  npcs: CharacterNpc[];
  onBack: () => void;
}

const Avatar: React.FC<{ src: string; name: string; className: string }> = ({ src, name, className }) =>
  src ? (
    <img src={src} alt={`${name} 的头像`} className={`${className} object-cover`} />
  ) : (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-tr from-sky-300 to-pink-200 text-xs font-bold text-white`}
    >
      {name.trim().charAt(0) || '?'}
    </div>
  );

const formatRelativeTime = (iso: string) => {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const date = new Date(time);
  if (hours < 48) return '昨天';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

interface CommentTarget {
  postId: string;
  replyToName?: string;
}

const MODE_OPTIONS: Array<[MomentGenerationMode, string]> = [
  ['auto', '随机'],
  ['text', '纯文字'],
  ['card', '文字+文字图'],
];

export const MomentsTab: React.FC<MomentsTabProps> = ({ userName, userAvatarUrl, contacts, npcs, onBack }) => {
  const posts = useMoments();
  const actors = useMemo(() => buildMomentActors(contacts, npcs), [contacts, npcs]);
  const [cover, setCover] = useState(() =>
    readStoredValue(MOMENTS_COVER_STORAGE_KEY, '', (value): value is string => typeof value === 'string')
  );
  const signature = useMemo(
    () => readSetting<{ signature?: unknown }>(
      SETTINGS_KEYS.userProfile,
      {},
      (value): value is { signature?: unknown } => !!value && typeof value === 'object'
    ).signature,
    []
  );
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverUrlDraft, setCoverUrlDraft] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<MomentPost | null>(null);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshAuthor, setRefreshAuthor] = useState('random');
  const [refreshTopic, setRefreshTopic] = useState('');
  const [refreshMode, setRefreshMode] = useState<MomentGenerationMode>('auto');
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState<MomentMediaItem | null>(null);
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [generatingId, setGeneratingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [interactionId, setInteractionId] = useState('');
  const [actionTarget, setActionTarget] = useState<{ postId: string; commentId?: string } | null>(null);
  const actionPost = posts.find(post => post.id === actionTarget?.postId);
  const actionComment = actionPost?.comments.find(comment => comment.id === actionTarget?.commentId);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActionTarget(null); setInteractionId(''); setCameraMenuOpen(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const resolveAuthor = (post: MomentPost) => {
    if (post.authorType === 'user') return { name: userName, avatar: userAvatarUrl };
    const live = post.authorType === 'char'
      ? contacts.find((item) => item.id === post.authorId)
      : npcs.find((item) => item.id === post.authorId);
    return { name: live?.name ?? post.authorName, avatar: live?.avatarUrl ?? post.authorAvatar };
  };

  const nameOfTarget = (id: string) =>
    contacts.find((item) => item.id === id)?.name ?? npcs.find((item) => item.id === id)?.name ?? id;

  const saveCover = (value: string) => {
    writeStoredValue(MOMENTS_COVER_STORAGE_KEY, value);
    setCover(value);
  };

  const applyCoverUrl = () => {
    const url = coverUrlDraft.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError('请输入 http(s) 开头的图片链接。');
      return;
    }
    saveCover(url);
    setCoverUrlDraft('');
    setCoverOpen(false);
    setError('');
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    try {
      saveCover(await compressImageFile(file, { maxDimension: 900, maxBytes: 240 * 1024 }));
      setCoverOpen(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '背景图片处理失败。');
    }
  };

  const openComposer = (post?: MomentPost) => {
    setEditing(post ?? null);
    setComposerOpen(true);
    setError('');
  };

  const handleSubmit = (result: MomentComposerResult) => {
    const now = new Date().toISOString();
    if (editing) {
      // Editing clears seenByCharIds so characters re-read the updated content in their next chat.
      updateMoments((current) =>
        current.map((post) =>
          post.id === editing.id
            ? {
                ...post,
                content: result.content,
                images: result.images.length ? result.images : undefined,
                textImageCards: result.textImageCards.length ? result.textImageCards : undefined,
                location: result.location || undefined,
                visibilityRule: result.visibilityRule,
                updatedAt: now,
                seenByCharIds: [],
              }
            : post
        )
      );
    } else {
      const post: MomentPost = {
        id: createMomentId('moment'),
        authorId: MOMENT_USER_ID,
        authorName: userName,
        authorAvatar: userAvatarUrl,
        authorType: 'user',
        content: result.content,
        ...(result.images.length ? { images: result.images } : {}),
        ...(result.textImageCards.length ? { textImageCards: result.textImageCards } : {}),
        ...(result.location ? { location: result.location } : {}),
        createdAt: now,
        ...(result.visibilityRule ? { visibilityRule: result.visibilityRule } : {}),
        likes: [],
        comments: [],
        seenByCharIds: [],
        seenCommentIdsByChar: {},
      };
      updateMoments((current) => [post, ...current]);
    }
    setComposerOpen(false);
    setEditing(null);
  };

  const deletePost = (post: MomentPost) => {
    if (!window.confirm('确定删除这条朋友圈？')) return;
    updateMoments((current) => current.filter((item) => item.id !== post.id));
  };

  const toggleLike = (post: MomentPost) =>
    updateMoments((current) =>
      current.map((item) =>
        item.id !== post.id
          ? item
          : item.likes.some((like) => like.id === MOMENT_USER_ID)
            ? { ...item, likes: item.likes.filter((like) => like.id !== MOMENT_USER_ID) }
            : { ...item, likes: [...item.likes, { id: MOMENT_USER_ID, name: userName }] }
      )
    );

  const submitComment = () => {
    const content = commentDraft.trim();
    if (!commentTarget || !content) return;
    const target = commentTarget;
    updateMoments((current) =>
      current.map((item) =>
        item.id !== target.postId
          ? item
          : {
              ...item,
              comments: [
                ...item.comments,
                {
                  id: createMomentId('comment'),
                  authorId: MOMENT_USER_ID,
                  authorName: userName,
                  ...(target.replyToName ? { replyToName: target.replyToName } : {}),
                  content: content.slice(0, 300),
                  createdAt: new Date().toISOString(),
                },
              ],
            }
      )
    );
    setCommentDraft('');
    setCommentTarget(null);
  };

  const deleteComment = (postId: string, commentId: string) =>
    updateMoments((current) =>
      current.map((item) =>
        item.id !== postId ? item : { ...item, comments: item.comments.filter((comment) => comment.id !== commentId) }
      )
    );

  const generateInteractions = async (post: MomentPost) => {
    if (generatingId) return;
    setGeneratingId(post.id);
    setError('');
    setNotice('');
    try {
      const result = await generateMomentInteractions(post, actors);
      let addedLikes = 0;
      let addedComments = 0;
      updateMoments((current) =>
        current.map((item) =>
          item.id !== post.id ? item : (() => {
            const allowedIds = new Set(getInteractionCandidates(item, actors).map((actor) => actor.id));
            const likes = result.likes.filter((like) => allowedIds.has(like.id) && !item.likes.some((existing) => existing.id === like.id));
            const comments = result.comments.filter((comment) => allowedIds.has(comment.authorId));
            addedLikes = likes.length;
            addedComments = comments.length;
            const interactedIds = [...new Set([...likes.map((like) => like.id), ...comments.map((comment) => comment.authorId)])];
            return {
              ...item,
              likes: [...item.likes, ...likes],
              comments: [...item.comments, ...comments],
              ...((item.updatedAt ?? '') === (post.updatedAt ?? '') ? {
                seenByCharIds: [...new Set([...item.seenByCharIds, ...interactedIds])],
                seenCommentIdsByChar: {
                  ...item.seenCommentIdsByChar,
                  ...Object.fromEntries(interactedIds.map((id) => [id, [...new Set([
                    ...(item.seenCommentIdsByChar[id] ?? []),
                    ...post.comments.map((comment) => comment.id),
                    ...comments.map((comment) => comment.id),
                  ])]])),
                },
              } : {}),
            };
          })()
        )
      );
      setNotice(addedLikes + addedComments > 0
        ? '互动已更新'
        : '当前没有可新增的互动，可能角色已被拉黑。');
    } catch (err) {
      console.error('Could not generate moment interactions.', err);
      setError(err instanceof Error ? err.message : '生成评论失败，请检查网络与 API 配置。');
    } finally {
      setGeneratingId('');
    }
  };

  const refreshMoments = async () => {
    if (refreshing) return;
    const pool = refreshAuthor === 'random'
      ? actors
      : actors.filter((actor) => actor.id === refreshAuthor);
    if (pool.length === 0) {
      setError('通讯录里还没有可发布朋友圈的角色或 NPC。');
      return;
    }
    const actor: MomentActor = pool[Math.floor(Math.random() * pool.length)];
    setRefreshing(true);
    setError('');
    setNotice('');
    try {
      const generated = await generateMomentContent(actor, refreshTopic, refreshMode);
      const post: MomentPost = {
        id: createMomentId('moment'),
        authorId: actor.id,
        authorName: actor.name,
        authorAvatar: actor.avatarUrl,
        authorType: actor.type,
        ...(actor.type === 'npc' && actor.linkedCharIds[0] ? { parentCharId: actor.linkedCharIds[0] } : {}),
        content: generated.content,
        ...(generated.textImageCards.length ? { textImageCards: generated.textImageCards } : {}),
        ...(generated.location ? { location: generated.location } : {}),
        createdAt: new Date().toISOString(),
        likes: [],
        comments: [],
        seenByCharIds: actor.type === 'char' ? [actor.id] : [],
        seenCommentIdsByChar: {},
      };
      updateMoments((current) => [post, ...current]);
      setRefreshOpen(false);
      setRefreshTopic('');
      setNotice(`${actor.name} 发布了一条新朋友圈。`);
    } catch (err) {
      console.error('Could not generate a moment.', err);
      setError(err instanceof Error ? err.message : '刷新朋友圈失败，请检查网络与 API 配置。');
    } finally {
      setRefreshing(false);
    }
  };

  const visibilityLabel = (post: MomentPost) => {
    const rule = post.visibilityRule;
    if (!rule || rule.type === 'all') return '';
    const names = rule.targetIds.map(nameOfTarget).join('、') || '无人';
    return rule.type === 'selected' ? `仅 ${names} 可见` : `不给 ${names} 看`;
  };

  const modalShell = 'absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4';
  const modalCard = 'w-full max-w-sm max-h-[90%] overflow-y-auto rounded-3xl bg-white/95 p-4 shadow-2xl space-y-3 text-slate-700';
  const inputClass =
    'w-full rounded-xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400';

  return (
    <div className="moments-root" onClick={() => { setInteractionId(''); setCameraMenuOpen(false); }}>
      <header className="moments-header">
        <button type="button" data-swipe-back aria-label="返回发现" onClick={onBack}><ChevronLeft size={26}/></button>
        <h2>朋友圈</h2>
        <button type="button" aria-label="发布与生成朋友圈" aria-expanded={cameraMenuOpen} onClick={event => { event.stopPropagation(); setCameraMenuOpen(open => !open); setInteractionId(''); }}><Camera size={23}/></button>
        {cameraMenuOpen && <div role="menu" aria-label="发布朋友圈" className="moments-camera-menu">
          <button type="button" role="menuitem" onClick={() => openComposer()}><Pencil size={17}/>发表朋友圈</button>
          <button type="button" role="menuitem" aria-label="AI 生成朋友圈" onClick={() => { setRefreshOpen(true); setError(''); }}><Sparkles size={17}/>生成朋友圈</button>
        </div>}
      </header>
      <div className="moments-scroll no-scrollbar" onScroll={() => { setInteractionId(''); setCameraMenuOpen(false); }}>
        <div className="moments-profile">
          <button type="button" aria-label="更换朋友圈背景" className="moments-cover" onClick={() => { setCoverOpen(true); setError(''); }} style={cover ? { backgroundImage: `url("${cover}")` } : undefined}/>
          <span className="moments-profile-name">{userName}</span>
          <Avatar src={userAvatarUrl} name={userName} className="moments-profile-avatar"/>
        </div>
        <p className="moments-signature">{typeof signature === 'string' ? signature : ''}</p>
        {(notice || error) && <p role={error ? 'alert' : 'status'} className={`mx-5 mb-2 text-[11px] ${error ? 'text-rose-500' : 'text-slate-400'}`}>{error || notice}</p>}
        {posts.length === 0 && <p className="py-12 text-center text-xs text-slate-400">还没有朋友圈</p>}
        {posts.map(post => <MomentFeedPost key={post.id} post={post} author={resolveAuthor(post)} time={formatRelativeTime(post.createdAt)} visibility={visibilityLabel(post)}
          interactionOpen={interactionId === post.id} generating={generatingId === post.id} onOpenMedia={setLightbox}
          onManage={() => { setActionTarget({ postId: post.id }); setInteractionId(''); setCameraMenuOpen(false); }}
          onManageComment={comment => { setActionTarget({ postId: post.id, commentId: comment.id }); setInteractionId(''); }}
          onToggleInteraction={() => { setInteractionId(current => current === post.id ? '' : post.id); setCameraMenuOpen(false); }}
          onLike={() => { toggleLike(post); setInteractionId(''); }}
          onComment={() => { setCommentTarget({ postId: post.id }); setCommentDraft(''); setInteractionId(''); }}
          onReply={comment => { setCommentTarget({ postId: post.id, ...(comment.authorId === MOMENT_USER_ID ? {} : { replyToName: comment.authorName }) }); setCommentDraft(''); }}
          commentEditor={commentTarget?.postId === post.id ? <form className="moment-comment-editor mt-2 flex items-center gap-2" onSubmit={event => { event.preventDefault(); submitComment(); }}>
            <input autoFocus aria-label="评论内容" value={commentDraft} onChange={event => setCommentDraft(event.target.value)} maxLength={300} placeholder={commentTarget.replyToName ? `回复 ${commentTarget.replyToName}` : '评论'} className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800 outline-none"/>
            <button type="submit" aria-label="发送评论" disabled={!commentDraft.trim()} className="rounded bg-[#07c160] p-2 text-white disabled:opacity-40"><Send size={15}/></button>
            <button type="button" aria-label="取消评论" onClick={() => setCommentTarget(null)} className="p-1 text-slate-400"><X size={17}/></button>
          </form> : undefined}
        />)}
      </div>
      {actionTarget && actionPost && (!actionTarget.commentId || actionComment) && <div className="moments-actions" onClick={() => setActionTarget(null)}>
        <section role="dialog" aria-modal="true" aria-label={actionComment ? '评论操作' : '朋友圈操作'} className="moments-action-sheet" onClick={event => event.stopPropagation()}>
          <h3>{actionComment ? actionComment.authorName : resolveAuthor(actionPost).name}</h3>
          {actionComment ? <>
            <button type="button" onClick={() => { setCommentTarget({ postId: actionPost.id, ...(actionComment.authorId === MOMENT_USER_ID ? {} : { replyToName: actionComment.authorName }) }); setCommentDraft(''); setActionTarget(null); }}>回复</button>
            <button type="button" className="is-danger" onClick={() => { deleteComment(actionPost.id, actionComment.id); setActionTarget(null); }}>删除评论</button>
          </> : <>
            <button type="button" onClick={() => { openComposer(actionPost); setActionTarget(null); }}><Pencil size={17}/>编辑</button>
            <button type="button" disabled={!!generatingId} onClick={() => { setActionTarget(null); void generateInteractions(actionPost); }}><Sparkles size={17}/>生成评论</button>
            <button type="button" className="is-danger" onClick={() => { setActionTarget(null); deletePost(actionPost); }}><Trash2 size={17}/>删除</button>
          </>}
          <button type="button" data-swipe-back onClick={() => setActionTarget(null)}>取消</button>
        </section>
      </div>}
      {composerOpen && (
        <MomentComposer
          key={editing?.id ?? 'new'}
          initial={editing ?? undefined}
          contacts={contacts}
          onClose={() => { setComposerOpen(false); setEditing(null); }}
          onSubmit={handleSubmit}
        />
      )}

      {coverOpen && (
        <div
          className={modalShell}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setCoverOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-label="更换朋友圈背景" className={modalCard}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#2C4A5C]">朋友圈背景</h2>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setCoverOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={coverUrlDraft}
                onChange={(event) => setCoverUrlDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') applyCoverUrl(); }}
                placeholder="图床链接 https://..."
                aria-label="背景图片链接"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={applyCoverUrl}
                disabled={!coverUrlDraft.trim()}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-sky-400 to-pink-400 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
              >
                <Link2 className="w-3 h-3" />使用
              </button>
            </div>
            <button
              type="button"
              onClick={() => coverFileRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-dashed border-sky-300 px-3 py-2.5 text-xs font-bold text-sky-600 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />从相册选择
            </button>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void uploadCover(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => { saveCover(''); setCoverOpen(false); }}
              disabled={!cover}
              className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-500 disabled:opacity-40 cursor-pointer"
            >
              恢复默认背景
            </button>
            {error && <p role="alert" className="text-[11px] font-bold text-rose-500">{error}</p>}
          </section>
        </div>
      )}

      {refreshOpen && (
        <div
          className={modalShell}
          onMouseDown={(event) => { if (event.target === event.currentTarget && !refreshing) setRefreshOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-label="刷新朋友圈" className={modalCard}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#2C4A5C]">刷新朋友圈</h2>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setRefreshOpen(false)}
                disabled={refreshing}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 disabled:opacity-40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block space-y-1 text-xs font-bold text-[#2C4A5C]">
              谁来发
              <select
                value={refreshAuthor}
                onChange={(event) => setRefreshAuthor(event.target.value)}
                aria-label="选择发布者"
                className={inputClass}
              >
                <option value="random">随机</option>
                {contacts.length > 0 && (
                  <optgroup label="主要角色">
                    {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                  </optgroup>
                )}
                {npcs.length > 0 && (
                  <optgroup label="关联 NPC">
                    {npcs.map((npc) => <option key={npc.id} value={npc.id}>{npc.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-bold text-[#2C4A5C]">
              主题关键词（选填）
              <input
                value={refreshTopic}
                onChange={(event) => setRefreshTopic(event.target.value)}
                maxLength={40}
                placeholder="留空则结合人设与最近记忆自由发挥"
                aria-label="主题关键词"
                className={inputClass}
              />
            </label>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#2C4A5C]">形式</p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 p-1">
                {MODE_OPTIONS.map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRefreshMode(mode)}
                    className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                      refreshMode === mode ? 'bg-white text-[#2C4A5C] shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p role="alert" className="text-[11px] font-bold text-rose-500">{error}</p>}
            <button
              type="button"
              onClick={() => void refreshMoments()}
              disabled={refreshing}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-pink-400 py-2.5 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '生成中…' : '生成新朋友圈'}
            </button>
          </section>
        </div>
      )}

      {lightbox && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="查看大图"
        >
          {lightbox.type === 'image' ? (
            <img src={lightbox.value} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          ) : (
            <div className="aspect-square w-[78%] max-w-xs">
              <TextImageCard text={lightbox.value} large />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
