import { createMomentId, readMoments, updateMoments } from './momentsData';

export interface SocialChat {
  id: string;
  type: 'direct' | 'group' | 'observer';
  participantIds: string[];
  allowGroupPrivate?: boolean;
  allowAutoMoments?: boolean;
  allowAutoCouple?: boolean;
  messages: Array<{ id: string; senderId: string; text: string; createdAt: string }>;
}

export interface SocialActor {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface SocialContext {
  chat: SocialChat;
  actors: SocialActor[];
  regenerate: boolean;
  now: Date;
}

interface CoupleAction {
  day: 'today' | 'previous';
  overnightEvidence?: string;
  mood?: { moodId: string; note: string };
  diary?: { title: string; content: string };
  note?: string;
  answers?: Array<{ questionId: string; content: string }>;
}

export interface SocialActions {
  privateMessage?: { texts: string[]; reason: string };
  moment?: { content: string };
  couple?: CoupleAction;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown, label: string, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(`${label}为空或过长，已取消本次回复。`);
  }
  return value.trim();
};

export const buildSocialInstructions = (ctx: SocialContext): string => {
  const { chat } = ctx;
  if (ctx.regenerate || chat.type === 'observer') {
    return '本轮禁止 privateMessage、momentPost、coupleWrite；重生成和旁观群聊不触发新的跨应用主动行为。';
  }
  const lines = [
    '【主动行为】以下可选字段只在有真实动机、符合发言角色人设与当前情境时使用，通常省略。不要为了使用功能而使用，不要每轮重复同一种行为。动作仅代表本轮 speakerId 本人，NPC 不允许。关闭的行为不得声称已完成。只有返回有效动作字段并写入成功才算真的做过；不要仅在 reply 中口头说已发布、已记录。',
  ];
  if (chat.type === 'group' && chat.allowGroupPrivate !== false && ctx.actors.length) {
    lines.push('【群聊触发私聊】你可以因为群聊里确实不适合公开说的关心、提醒、悄悄话等，私下给玩家发微信。可选 privateMessage:{"texts":["私聊消息"],"reason":"基于当前群聊与人设的私发动机"}。只能由本轮主要角色 speakerId 发送给 user，不允许 NPC、非群成员或旁观群聊触发；不要为了私聊而私聊，不要在群里泄露私聊正文。私聊不是电话。');
  } else lines.push('本轮禁止 privateMessage。');
  if (chat.allowAutoMoments !== false && ctx.actors.length) {
    lines.push('【主动朋友圈】可选 momentPost:{"content":"朋友圈正文"}。只在角色确有值得分享的生活、想法或情绪时发，符合其分享欲和人设，低频自然，不为了回应玩家而每轮发圈，不重复、不刷屏，不泄露群聊中他人隐私。不设次数任务，不需要向玩家汇报每次发圈。');
    const posts = readMoments().filter((post) => ctx.actors.some((actor) => actor.id === post.authorId)).slice(0, 8);
    lines.push(`角色近期已发朋友圈（避免重复，留意实际发布时间）：\n${posts.map((post) => `${post.authorId} ${post.createdAt}：${post.content}`).join('\n') || '暂无'}`);
  } else lines.push('本轮禁止 momentPost。');
  lines.push('本轮禁止 coupleWrite，不自动写入情侣空间，也不要声称已经写入；情侣空间仅由玩家在应用内手动生成或编辑。');
  return lines.join('\n');
};

export const parseSocialActions = (record: Record<string, unknown>, ctx: SocialContext, actorId: string): SocialActions => {
  const result: SocialActions = {};
  const hasActions = ['privateMessage', 'momentPost', 'coupleWrite'].some((key) => record[key] !== undefined);
  if (!hasActions) return result;
  if (ctx.regenerate || ctx.chat.type === 'observer' || actorId.startsWith('npc:') || !ctx.chat.participantIds.includes(actorId) ||
    !ctx.actors.some((actor) => actor.id === actorId)) {
    throw new Error('本轮角色不允许触发主动跨应用行为，已取消回复。');
  }
  if (record.privateMessage !== undefined) {
    const raw = record.privateMessage;
    if (ctx.chat.type !== 'group' || ctx.chat.allowGroupPrivate === false || !isRecord(raw) ||
      !Array.isArray(raw.texts) || !raw.texts.length) throw new Error('群聊私发格式或权限无效。');
    result.privateMessage = {
      texts: raw.texts.map((value) => text(value, '私聊正文', 2000)),
      reason: text(raw.reason, '私发动机', 500),
    };
  }
  if (record.momentPost !== undefined) {
    if (ctx.chat.allowAutoMoments === false || !isRecord(record.momentPost)) throw new Error('主动朋友圈格式或权限无效。');
    const content = text(record.momentPost.content, '朋友圈正文', 4000);
    if (readMoments().some((post) => post.authorId === actorId && post.content.trim() === content)) {
      throw new Error('角色生成了重复的朋友圈，已取消本次回复。');
    }
    result.moment = { content };
  }
  if (record.coupleWrite !== undefined) {
    throw new Error('已关闭自动写情侣空间，请在情侣空间内手动生成或编辑。');
  }
  return result;
};

export const applySocialWrites = (actions: SocialActions, ctx: SocialContext, actor: SocialActor) => {
  if (actions.couple) {
    throw new Error('已关闭自动写情侣空间，未写入任何内容。');
  }
  if (actions.moment) {
    const content = actions.moment.content;
    updateMoments((posts) => {
      if (posts.some((post) => post.authorId === actor.id && post.content.trim() === content)) throw new Error('朋友圈内容已存在。');
      return [{
        id: createMomentId('moment'), authorId: actor.id, authorName: actor.name,
        authorAvatar: actor.avatarUrl, authorType: 'char', content,
        createdAt: ctx.now.toISOString(), likes: [], comments: [],
        seenByCharIds: [actor.id], seenCommentIdsByChar: {},
      }, ...posts];
    });
  }
};
