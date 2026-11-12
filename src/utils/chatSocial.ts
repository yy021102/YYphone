import { createMomentId, readMoments, updateMoments } from './momentsData';
import { CHAT_LANGUAGES, validateChatLanguage, type ChatLanguage, type ChatTranslation } from './chatLanguage';

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
  privateChatLanguages?: Record<string, ChatLanguage | undefined>;
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
  privateMessage?: { texts: string[]; reason: string; translations?: Array<ChatTranslation | undefined> };
  privateMessages?: Array<NonNullable<SocialActions['privateMessage']> & { speakerId: string }>;
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
    return '本轮禁止 privateMessage、momentPost、coupleWrite；也禁止 privateMessages。重生成和旁观群聊不触发新的跨应用主动行为。';
  }
  if (!ctx.actors.length || (chat.allowAutoMoments === false && (chat.type !== 'group' || chat.allowGroupPrivate === false))) {
    return '本轮禁止 privateMessage、momentPost、coupleWrite；也禁止 privateMessages。当前没有可用的跨应用主动行为。';
  }
  const lines = [
    '【主动行为】以下可选字段只在有真实动机、符合发言角色人设与当前情境时使用，通常省略。不要为了使用功能而使用，不要每轮重复同一种行为。朋友圈等顶层动作仅代表本轮 speakerId 本人；群聊私聊动作可分别指定实际发送者。NPC 不允许。关闭的行为不得声称已完成。只有返回有效动作字段并写入成功才算真的做过；不要仅在 reply 中口头说已发布、已记录。',
  ];
  if (chat.type === 'group' && chat.allowGroupPrivate !== false && ctx.actors.length) {
    lines.push('【群聊触发私聊】群成员可以因为当前话题确实不适合公开说的关心、提醒、悄悄话，私下给 user 发微信。返回 privateMessages:[{"speakerId":"实际私发者的成员ID","texts":["私聊正文"],"reason":"当前私发动机"}]。任一可用角色均可发送，不受顶层主要角色 speakerId 限制；同轮可有不同发送者，每位只写一项。不允许 NPC、非群成员或旁观群聊触发。只有确实想私发才使用，不要每轮触发；一旦本轮台词明确表示现在私聊发给 user、让 user 查收私信，就必须同时返回该成员的私聊动作和真实正文，不能只口头承诺。若只是以后再发、条件未满足或私聊对象是其他群成员，不要向 user 发送。不要把群里的一句话机械复制为私信，不在群内泄露私聊正文。私聊不是电话。兼容旧字段 privateMessage（省略 speakerId 时由顶层 speakerId 发出）；不要同时使用新旧字段。');
    lines.push('【群转私语言隔离】私聊 texts 不沿用当前群聊的语言，按各动作 speakerId 对应的目标私聊设置生成。目标私聊未开启其他语言时用简体中文字符串；开启时每条改用 {"text":"目标语言原文，不超过1000字","translation":"逐条对应的简体中文翻译"}。reason 始终使用简体中文。目标私聊语言：' +
      ctx.actors.map(actor => `${actor.id}：${CHAT_LANGUAGES.find(item => item.id === ctx.privateChatLanguages?.[actor.id])?.label ?? '简体中文（未开启）'}`).join('；'));
  } else lines.push('本轮禁止 privateMessage、privateMessages。');
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
  if (record.privateMessages !== undefined || (isRecord(record.privateMessage) && record.privateMessage.speakerId !== undefined)) {
    if (record.privateMessages !== undefined && record.privateMessage !== undefined) throw new Error('群聊私信请勿同时使用新旧字段。');
    const entries = record.privateMessages ?? [record.privateMessage];
    if (!Array.isArray(entries) || entries.length > ctx.actors.length) throw new Error('群聊私发格式或权限无效。');
    if (ctx.regenerate || ctx.chat.type !== 'group' || ctx.chat.allowGroupPrivate === false) throw new Error('本轮不允许群聊私发。');
    const senders = new Set<string>();
    result.privateMessages = entries.map(entry => {
      if (!isRecord(entry) || typeof entry.speakerId !== 'string' || senders.has(entry.speakerId)) throw new Error('群聊私发成员无效或重复。');
      senders.add(entry.speakerId);
      const { speakerId, ...message } = entry;
      const parsed = parseSocialActions({ privateMessage: message }, ctx, speakerId).privateMessage!;
      return { ...parsed, speakerId };
    });
    const { privateMessages: _many, privateMessage: _one, ...other } = record;
    return { ...parseSocialActions(other, ctx, actorId), ...result };
  }
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
    const language = ctx.privateChatLanguages?.[actorId];
    if (language) validateChatLanguage({ reply: raw.texts.map(value => isRecord(value)
      ? { kind: 'text', text: value.text, translation: value.translation } : value) }, language);
    result.privateMessage = {
      texts: raw.texts.map(value => text(language && isRecord(value) ? value.text : value, '私聊正文', 2000)),
      reason: text(raw.reason, '私发动机', 500),
      ...(language ? { translations: raw.texts.map(value => isRecord(value) && typeof value.translation === 'string' && value.translation.trim() ? {
        language, text: value.translation.trim(), sourceText: text(value.text, '私聊正文', 1000),
      } : undefined) } : {}),
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

export function groupPrivateDeliveries(actions: SocialActions, mainId: string) {
  return actions.privateMessages ?? (actions.privateMessage ? [{ ...actions.privateMessage, speakerId: mainId }] : []);
}

/** Only explicit, immediate promises to the user; hypothetical/future statements stay optional. */
export function validateGroupPrivatePromises(record: Record<string, unknown>, ctx: SocialContext, mainId: string) {
  if (ctx.regenerate || ctx.chat.type !== 'group' || ctx.chat.allowGroupPrivate === false) return;
  const actions = parseSocialActions({
    ...(record.privateMessage !== undefined ? { privateMessage: record.privateMessage } : {}),
    ...(record.privateMessages !== undefined ? { privateMessages: record.privateMessages } : {}),
  }, ctx, mainId);
  const sent = new Set(groupPrivateDeliveries(actions, mainId).map(action => action.speakerId));
  if (!Array.isArray(record.reply)) return;
  for (const part of record.reply) {
    if (!isRecord(part) || (part.kind !== undefined && part.kind !== 'text') || typeof part.text !== 'string') continue;
    const id = typeof part.speakerId === 'string' ? part.speakerId : mainId;
    if (!ctx.actors.some(actor => actor.id === id) || sent.has(id)) continue;
    const value = part.text;
    if (/[“”「」『』"？?]|(?:如果|要是|等会|待会|回头|以后|明天|下次|稍后|晚点|之前|上次|不|没|别).{0,12}(?:私聊|私信|私发|单独发)/.test(value)) continue;
    if (/(?:我.{0,4}(?:现在|这就|马上|已经)?私聊.{0,6}(?:发你|发给你)|我.{0,4}(?:现在|这就|马上|已经)?(?:私信你|单独发你|单独发给你)|(?:^|[，。！\s])(?:私聊|私信|私发).{0,4}(?:发你|发给你|给你)|(?:给你|发你|发给你).{0,6}(?:私聊|私信|私发)|(?:看|查收).{0,3}(?:我.{0,3})?私信)/.test(value)) {
      throw new Error(`成员 ${id} 明确表示本轮私聊给 user，但缺少对应动作。请在 privateMessages 中补全此成员实际要发的正文及 reason；若尚不打算发送，改掉群内已发送或立即发送的承诺。不要替其他成员发送。`);
    }
  }
}

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
