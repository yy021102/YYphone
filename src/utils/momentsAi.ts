import { requestConfiguredAiText } from './aiApi';
import { readStoredValue } from './localStorage';
import {
  createMomentId,
  describeMomentForPrompt,
  getInteractionCandidates,
  MomentActor,
  MomentComment,
  MomentLike,
  MomentPost,
  MOMENT_USER_ID,
} from './momentsData';

const CHATS_STORAGE_KEY = 'yyphone:wechat-chats';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const parseJsonObject = (text: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // Fall through to the error below.
      }
    }
  }
  if (!isRecord(parsed)) throw new Error('AI 返回的内容不是有效的 JSON，请重试。');
  return parsed;
};

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const formatComments = (post: MomentPost) =>
  post.comments.length
    ? post.comments
        .map((comment) => {
          const who = comment.authorId === MOMENT_USER_ID ? `玩家(${comment.authorName})` : comment.authorName;
          return `- ${who}${comment.replyToName ? ` 回复 ${comment.replyToName}` : ''}：${comment.content}`;
        })
        .join('\n')
    : '（暂无评论）';

export interface GeneratedInteractions {
  likes: MomentLike[];
  comments: MomentComment[];
}

/** Button-triggered generation: likes plus 2~4 comments (including threaded replies) for one post. */
export const generateMomentInteractions = async (
  post: MomentPost,
  actors: MomentActor[]
): Promise<GeneratedInteractions> => {
  const candidates = getInteractionCandidates(post, actors);
  if (candidates.length === 0) throw new Error('这条朋友圈没有可互动的角色或 NPC（请检查可见范围）。');

  const systemPrompt = [
    '你是微信朋友圈的互动生成器，需要让下列角色/NPC 以各自的身份对一条朋友圈点赞与评论。',
    '可互动者（authorId 必须取自这里）：',
    ...candidates.map((actor) =>
      `- ID：${actor.id}｜姓名：${actor.name}｜${actor.type === 'npc' ? 'NPC' : '主要角色'}｜设定：${actor.persona || '未补充设定'}`
    ),
    '规则：',
    '1. 生成 2~4 条新评论，每条不超过 40 字，口吻符合各自人设，像真实的朋友圈评论。',
    '2. 可以对评论区已有评论做楼中楼回复（replyToName 填被回复者姓名，包括回复玩家的评论），不要自己回复自己。',
    '3. 不得代替玩家发言，不得使用候选名单之外的人物。',
    '4. likes 为点赞者 ID 数组，可为空。',
    '只返回 JSON：{"likes":["ID"],"comments":[{"authorId":"ID","replyToName":"可选","content":"评论内容"}]}',
  ].join('\n');
  const userPrompt = [
    `朋友圈作者：${post.authorType === 'user' ? `玩家(${post.authorName})` : post.authorName}`,
    describeMomentForPrompt(post),
    `已有评论：\n${formatComments(post)}`,
  ].join('\n');

  const result = parseJsonObject(await requestConfiguredAiText(systemPrompt, userPrompt, { json: true }));
  const actorById = new Map(candidates.map((actor) => [actor.id, actor]));
  const existingNames = new Set(post.comments.map((comment) => comment.authorName));

  const likes: MomentLike[] = [];
  if (Array.isArray(result.likes)) {
    result.likes.forEach((id) => {
      const actor = typeof id === 'string' ? actorById.get(id) : undefined;
      if (actor && !likes.some((like) => like.id === actor.id)) likes.push({ id: actor.id, name: actor.name });
    });
  }

  const comments: MomentComment[] = [];
  const now = Date.now();
  if (Array.isArray(result.comments)) {
    result.comments.slice(0, 4).forEach((item, index) => {
      if (!isRecord(item)) return;
      const actor = typeof item.authorId === 'string' ? actorById.get(item.authorId) : undefined;
      const content = clean(item.content, 120);
      if (!actor || !content) return;
      const replyTo = clean(item.replyToName, 40);
      const validReply =
        replyTo &&
        replyTo !== actor.name &&
        (existingNames.has(replyTo) ||
          comments.some((comment) => comment.authorName === replyTo) ||
          replyTo === post.authorName);
      comments.push({
        id: `${createMomentId('comment')}-${index}`,
        authorId: actor.id,
        authorName: actor.name,
        ...(validReply ? { replyToName: replyTo } : {}),
        content,
        createdAt: new Date(now + index).toISOString(),
      });
    });
  }
  if (comments.length === 0 && likes.length === 0) throw new Error('AI 没有生成可用的互动，请重试。');
  return { likes, comments };
};

export type MomentGenerationMode = 'auto' | 'text' | 'card';

export interface GeneratedMomentContent {
  content: string;
  textImageCards: string[];
  location: string;
}

const readRecentChatMemory = (actor: MomentActor, limit = 12) => {
  const chats = readStoredValue<unknown>(CHATS_STORAGE_KEY, [], (value): value is unknown => true);
  if (!Array.isArray(chats)) return '';
  const messages = chats
    .filter(isRecord)
    .filter((chat) =>
      Array.isArray(chat.participantIds) &&
      (chat.participantIds as unknown[]).some(
        (id) => typeof id === 'string' && (id === actor.id || actor.linkedCharIds.includes(id) || id === `npc:${actor.id}`)
      )
    )
    .flatMap((chat) => (Array.isArray(chat.messages) ? chat.messages : []))
    .filter(isRecord)
    .filter((message) =>
      typeof message.text === 'string' &&
      message.text.trim() &&
      typeof message.createdAt === 'string' &&
      message.senderId !== 'narrator'
    )
    .sort((left, right) => (Date.parse(String(left.createdAt)) || 0) - (Date.parse(String(right.createdAt)) || 0))
    .slice(-limit);
  return messages
    .map((message) => `${message.senderId === 'user' ? '玩家' : '对方'}：${String(message.text).slice(0, 80)}`)
    .join('\n');
};

/** Generates one moment for a character or NPC, optionally steered by a topic. */
export const generateMomentContent = async (
  actor: MomentActor,
  topic: string,
  mode: MomentGenerationMode
): Promise<GeneratedMomentContent> => {
  const memory = readRecentChatMemory(actor);
  const modeRule =
    mode === 'text'
      ? '本条为纯文字动态，textImageCards 必须是空数组。'
      : mode === 'card'
        ? '本条为带文字图卡片的动态：textImageCards 提供 1~3 段，每段 6~30 字的画面描述或心情短句（会被渲染成艺术字卡片，不是真实图片）。'
        : 'textImageCards 可选：适合时提供 1~3 段 6~30 字的画面描述/心情短句，否则返回空数组。';
  const systemPrompt = [
    `你要以「${actor.name}」（${actor.type === 'npc' ? '关联 NPC' : '主要角色'}）的身份发一条微信朋友圈。`,
    `人设：${actor.persona || '未补充设定。'}`,
    memory ? `最近与玩家相关的聊天片段（仅作灵感参考，不要照抄）：\n${memory}` : '',
    '要求：口吻真实自然、符合人设，像日常朋友圈，正文 10~80 字，可带少量 emoji；不要提及自己是 AI；不要编造图片 URL。',
    modeRule,
    '只返回 JSON：{"content":"正文","textImageCards":["卡片文字"],"location":"可选定位，没有则空字符串"}',
  ].filter(Boolean).join('\n');
  const userPrompt = topic.trim()
    ? `请围绕主题「${topic.trim()}」发一条朋友圈。`
    : '请结合你的人设与最近经历，自由发挥发一条朋友圈。';

  const result = parseJsonObject(await requestConfiguredAiText(systemPrompt, userPrompt, { json: true }));
  const content = clean(result.content, 600);
  let cards = Array.isArray(result.textImageCards)
    ? result.textImageCards.map((card) => clean(card, 120)).filter(Boolean).slice(0, 3)
    : [];
  if (mode === 'text') cards = [];
  if (mode === 'card' && cards.length === 0 && content) cards = [content.slice(0, 40)];
  if (!content && cards.length === 0) throw new Error('AI 没有生成可用的朋友圈内容，请重试。');
  return { content, textImageCards: cards, location: clean(result.location, 40) };
};
