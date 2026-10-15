import { useEffect, useState } from 'react';
import { readStoredValue, writeStoredValue } from './localStorage';
import { CharacterNpc, readCharacterNpcs } from './characterNpcs';

export const MOMENTS_STORAGE_KEY = 'yyphone:wechat-moments';
export const MOMENTS_COVER_STORAGE_KEY = 'yyphone:wechat-moments-cover';
export const MOMENT_USER_ID = 'user';

export type MomentAuthorType = 'user' | 'char' | 'npc';

export interface MomentVisibilityRule {
  type: 'all' | 'selected' | 'exclude';
  targetIds: string[];
}

export interface MomentLike {
  id: string;
  name: string;
}

export interface MomentComment {
  id: string;
  authorId: string;
  authorName: string;
  replyToName?: string;
  content: string;
  createdAt: string;
}

export interface MomentPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorType: MomentAuthorType;
  parentCharId?: string;
  content: string;
  images?: string[];
  textImageCards?: string[];
  location?: string;
  createdAt: string;
  updatedAt?: string;
  visibilityRule?: MomentVisibilityRule;
  likes: MomentLike[];
  comments: MomentComment[];
  // Characters who already read this post body in a chat prompt.
  seenByCharIds: string[];
  // Per character: comment IDs already delivered to that character's chat prompt.
  seenCommentIdsByChar: Record<string, string[]>;
}

export interface MomentActor {
  id: string;
  name: string;
  avatarUrl: string;
  persona: string;
  type: 'char' | 'npc';
  linkedCharIds: string[];
}

export const MAX_MOMENT_MEDIA = 9;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const createMomentId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeComment = (value: unknown): MomentComment | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.content !== 'string') return undefined;
  return {
    id: value.id,
    authorId: typeof value.authorId === 'string' ? value.authorId : '',
    authorName: typeof value.authorName === 'string' ? value.authorName : '',
    ...(typeof value.replyToName === 'string' && value.replyToName ? { replyToName: value.replyToName } : {}),
    content: value.content,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  };
};

const normalizePost = (value: unknown): MomentPost | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string') return undefined;
  const authorType: MomentAuthorType =
    value.authorType === 'char' || value.authorType === 'npc' ? value.authorType : 'user';
  const rule = isRecord(value.visibilityRule) ? value.visibilityRule : undefined;
  const images = stringList(value.images);
  const cards = stringList(value.textImageCards);
  const seenComments: Record<string, string[]> = {};
  if (isRecord(value.seenCommentIdsByChar)) {
    Object.entries(value.seenCommentIdsByChar).forEach(([charId, ids]) => {
      seenComments[charId] = stringList(ids);
    });
  }
  return {
    id: value.id,
    authorId: typeof value.authorId === 'string' ? value.authorId : MOMENT_USER_ID,
    authorName: typeof value.authorName === 'string' ? value.authorName : '',
    authorAvatar: typeof value.authorAvatar === 'string' ? value.authorAvatar : '',
    authorType,
    ...(typeof value.parentCharId === 'string' && value.parentCharId ? { parentCharId: value.parentCharId } : {}),
    content: typeof value.content === 'string' ? value.content : '',
    ...(images.length ? { images } : {}),
    ...(cards.length ? { textImageCards: cards } : {}),
    ...(typeof value.location === 'string' && value.location ? { location: value.location } : {}),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
    ...(rule && (rule.type === 'selected' || rule.type === 'exclude')
      ? { visibilityRule: { type: rule.type, targetIds: stringList(rule.targetIds) } }
      : {}),
    likes: Array.isArray(value.likes)
      ? value.likes.flatMap((like) =>
          isRecord(like) && typeof like.id === 'string' && typeof like.name === 'string'
            ? [{ id: like.id, name: like.name }]
            : []
        )
      : [],
    comments: Array.isArray(value.comments)
      ? value.comments.flatMap((comment) => {
          const normalized = normalizeComment(comment);
          return normalized ? [normalized] : [];
        })
      : [],
    seenByCharIds: stringList(value.seenByCharIds),
    seenCommentIdsByChar: seenComments,
  };
};

export const readMoments = (): MomentPost[] => {
  const raw = readStoredValue<unknown>(MOMENTS_STORAGE_KEY, [], (value): value is unknown => true);
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item) => {
      const post = normalizePost(item);
      return post ? [post] : [];
    })
    .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
};

const listeners = new Set<() => void>();

export const subscribeMoments = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Reads the latest stored posts, applies a pure updater, persists and notifies subscribers. */
export const updateMoments = (updater: (posts: MomentPost[]) => MomentPost[]) => {
  const next = updater(readMoments());
  writeStoredValue(MOMENTS_STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
  return next;
};

export const useMoments = () => {
  const [posts, setPosts] = useState<MomentPost[]>(readMoments);
  useEffect(() => subscribeMoments(() => setPosts(readMoments())), []);
  return posts;
};

export const isVisibleByRule = (rule: MomentVisibilityRule | undefined, id: string) => {
  if (!rule || rule.type === 'all') return true;
  return rule.type === 'selected' ? rule.targetIds.includes(id) : !rule.targetIds.includes(id);
};

export const buildMomentActors = (
  contacts: Array<{ id: string; name: string; avatarUrl: string; persona: string }>,
  npcs: CharacterNpc[]
): MomentActor[] => [
  ...contacts.map((contact): MomentActor => ({
    id: contact.id,
    name: contact.name,
    avatarUrl: contact.avatarUrl,
    persona: contact.persona,
    type: 'char',
    linkedCharIds: [contact.id],
  })),
  ...npcs.map((npc): MomentActor => ({
    id: npc.id,
    name: npc.name,
    avatarUrl: npc.avatarUrl,
    persona: npc.persona,
    type: 'npc',
    linkedCharIds: npc.linkedCharIds,
  })),
];

const isActorVisible = (rule: MomentVisibilityRule | undefined, actor: MomentActor) =>
  actor.type === 'char'
    ? isVisibleByRule(rule, actor.id)
    : actor.linkedCharIds.some((charId) => isVisibleByRule(rule, charId));

/** Characters/NPCs that may like or comment on a post. */
export const getInteractionCandidates = (post: MomentPost, actors: MomentActor[]): MomentActor[] => {
  if (post.authorType === 'user') {
    return actors.filter((actor) => isActorVisible(post.visibilityRule, actor));
  }
  const author = actors.find((actor) => actor.id === post.authorId);
  const linked = author?.linkedCharIds ?? (post.parentCharId ? [post.parentCharId] : []);
  return actors.filter(
    (actor) =>
      isActorVisible(post.visibilityRule, actor) &&
      (actor.id === post.authorId || actor.linkedCharIds.some((charId) => linked.includes(charId)))
  );
};

const formatMomentTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const describeMomentForPrompt = (post: MomentPost) => {
  const parts = [`正文：${post.content.trim() || '（无文字）'}`];
  if (post.textImageCards?.length) {
    parts.push(`文字图：${post.textImageCards.map((card) => `「${card}」`).join('、')}`);
  }
  if (post.images?.length) parts.push(`配图：${post.images.length} 张真实图片（内容无法查看）`);
  if (post.location) parts.push(`定位：${post.location}`);
  return parts.join('\n');
};

// Own posts, the user's posts that the rule allows, and posts by NPCs linked to this character.
const isPostRelevantToChar = (post: MomentPost, charId: string, npcs: CharacterNpc[]) => {
  if (post.authorType === 'user') return isVisibleByRule(post.visibilityRule, charId);
  if (post.authorType === 'char') return post.authorId === charId;
  const npc = npcs.find((item) => item.id === post.authorId);
  return npc ? npc.linkedCharIds.includes(charId) : post.parentCharId === charId;
};

export interface MomentInjectionMark {
  postId: string;
  charId: string;
  commentIds: string[];
  markBody: boolean;
  version: string;
}

export interface MomentsInjection {
  text: string;
  marks: MomentInjectionMark[];
}

export const EMPTY_MOMENTS_INJECTION: MomentsInjection = { text: '', marks: [] };

const MAX_POSTS_PER_CHAR = 5;
const MAX_COMMENTS_PER_POST = 10;

/**
 * Collects moments each character in the chat has not read yet. Nothing is marked as seen
 * here; call applyMomentsAfterChat once the AI reply has actually succeeded.
 */
export const buildMomentsInjection = (
  participantIds: string[],
  isObserver: boolean,
  nameOf: (charId: string) => string | undefined
): MomentsInjection => {
  if (isObserver) return EMPTY_MOMENTS_INJECTION;
  const charIds = participantIds.filter((id) => !id.startsWith('npc:'));
  if (charIds.length === 0) return EMPTY_MOMENTS_INJECTION;

  const posts = readMoments();
  if (posts.length === 0) return EMPTY_MOMENTS_INJECTION;
  const npcs = readCharacterNpcs();
  const marks: MomentInjectionMark[] = [];
  const sections: string[] = [];

  charIds.forEach((charId) => {
    const lines: string[] = [];
    let count = 0;
    for (const post of posts) {
      if (count >= MAX_POSTS_PER_CHAR) break;
      if (!isPostRelevantToChar(post, charId, npcs)) continue;
      const bodyUnread = post.authorId !== charId && !post.seenByCharIds.includes(charId);
      const seenComments = new Set(post.seenCommentIdsByChar[charId] ?? []);
      const newComments = post.comments.filter(
        (comment) => !seenComments.has(comment.id) && comment.authorId !== charId
      );
      if (!bodyUnread && newComments.length === 0) continue;

      const shownComments = (bodyUnread ? post.comments : newComments).slice(-MAX_COMMENTS_PER_POST);
      const authorLabel = post.authorType === 'user'
        ? '玩家'
        : post.authorId === charId ? '你自己' : `${post.authorName}（你的关联 NPC）`;
      const header = bodyUnread
        ? `【${authorLabel}发布了朋友圈${post.updatedAt ? '（已被修改，以下为最新内容）' : ''}】${formatMomentTime(post.createdAt)}　朋友圈ID：${post.id}`
        : `【${authorLabel}的朋友圈有新评论】朋友圈ID：${post.id}\n（原动态：${post.content.trim().slice(0, 60) || '无文字'}）`;
      const commentLines = shownComments.map((comment) => {
        const who = comment.authorId === MOMENT_USER_ID ? '玩家' : comment.authorName;
        const self = comment.authorId === charId ? '（你）' : '';
        return `  · ${who}${self}${comment.replyToName ? ` 回复 ${comment.replyToName}` : ''}：${comment.content}`;
      });
      lines.push([
        header,
        ...(bodyUnread ? [describeMomentForPrompt(post)] : []),
        ...(commentLines.length ? [bodyUnread ? '评论区：' : '新评论：', ...commentLines] : []),
      ].join('\n'));
      marks.push({
        postId: post.id,
        charId,
        commentIds: post.comments.map((comment) => comment.id),
        markBody: bodyUnread,
        version: post.updatedAt ?? '',
      });
      count += 1;
    }
    if (lines.length) sections.push(`角色「${nameOf(charId) ?? charId}」尚未读过的朋友圈：\n${lines.join('\n\n')}`);
  });

  if (sections.length === 0) return EMPTY_MOMENTS_INJECTION;
  return {
    marks,
    text: [
      '【朋友圈动态】以下是尚未被相应角色读过的朋友圈内容，只会告知这一次，之后不会再重复提供。角色可以在本次回复中自然地提及，但不要逐条复述，也不要让未读到这些内容的角色知道它们。',
      ...sections,
    ].join('\n\n'),
  };
};

export interface MomentChatAction {
  postId: string;
  charId: string;
  charName: string;
  type: 'like' | 'comment';
  content?: string;
  replyToName?: string;
}

/** After a successful reply: record what was delivered and apply the like/comment actions it returned. */
export const applyMomentsAfterChat = (injection: MomentsInjection, actions: MomentChatAction[]) => {
  if (injection.marks.length === 0) return;
  const now = new Date().toISOString();
  updateMoments((posts) =>
    posts.map((post) => {
      const marks = injection.marks.filter((mark) => mark.postId === post.id);
      if (marks.length === 0) return post;
      const seenByCharIds = new Set(post.seenByCharIds);
      const seenCommentIdsByChar = { ...post.seenCommentIdsByChar };
      marks.forEach((mark) => {
        if (mark.markBody && (post.updatedAt ?? '') === mark.version) seenByCharIds.add(mark.charId);
        seenCommentIdsByChar[mark.charId] = [
          ...new Set([...(seenCommentIdsByChar[mark.charId] ?? []), ...mark.commentIds]),
        ];
      });
      let likes = post.likes;
      let comments = post.comments;
      actions
        .filter((action) => action.postId === post.id && marks.some((mark) => mark.charId === action.charId))
        .forEach((action, index) => {
          if (action.type === 'like') {
            if (!likes.some((like) => like.id === action.charId)) {
              likes = [...likes, { id: action.charId, name: action.charName }];
            }
          } else if (action.content) {
            comments = [
              ...comments,
              {
                id: `${createMomentId('comment')}-${index}`,
                authorId: action.charId,
                authorName: action.charName,
                ...(action.replyToName ? { replyToName: action.replyToName } : {}),
                content: action.content,
                createdAt: now,
              },
            ];
          }
        });
      return {
        ...post,
        likes,
        comments,
        seenByCharIds: [...seenByCharIds],
        seenCommentIdsByChar,
      };
    })
  );
};
