import { localDateString, readCoupleSpaces, updateCoupleSpace } from './coupleSpaceData';
import { createMomentId, readMoments, updateMoments } from './momentsData';
import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';

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

const dates = (now: Date) => {
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  return { today: localDateString(now), previous: localDateString(previous) };
};

export const coupleActionDate = (action: CoupleAction, ctx: SocialContext): string => {
  if (action.day === 'today') return dates(ctx.now).today;
  const evidence = action.overnightEvidence?.trim();
  const recent = ctx.chat.messages.slice(-12).filter((message) => {
    const age = ctx.now.getTime() - Date.parse(message.createdAt);
    return message.senderId !== 'narrator' && age >= 0 && age <= 6 * 3600_000;
  });
  if (action.day !== 'previous' || ctx.now.getHours() >= 12 || !evidence ||
    !recent.some((message) => message.text.includes(evidence))) {
    throw new Error('情侣空间前一天归档缺少近期熬夜语境依据，已取消本次回复。');
  }
  return dates(ctx.now).previous;
};

const boundSpace = (ctx: SocialContext, actorId: string) =>
  ctx.chat.type === 'direct' && ctx.chat.participantIds.length === 1 &&
  ctx.chat.participantIds[0] === actorId ? readCoupleSpaces()[actorId] : undefined;

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
  const actor = ctx.actors[0];
  const space = actor && boundSpace(ctx, actor.id);
  if (chat.allowAutoCouple !== false && space?.bindStatus === 'bound') {
    const day = dates(ctx.now);
    lines.push(
      `【主动情侣空间】你与玩家已绑定。现在是本地时间 ${ctx.now.toLocaleString('zh-CN', { hour12: false })}；当日=${day.today}，前一日=${day.previous}。`,
      '临睡前等自然时机，若这一天还没记录，可以主动记录心情与心情小记、写日记，然后自然跟玩家说。不强制每天写，便签和回答问答尤其不必每天有，不重复写、不覆盖已有记录；已写过就不要再声称刚补写。',
      '【熬夜归档】不要机械地在零点把共同度过的一天切断。若近期对话明确说明仍在延续前一晚、两人还没睡，睡前总结归前一天（day="previous"）；overnightEvidence 必须逐字引用近期对话中能说明尚未睡觉、仍是前一晚的片段。跨零点本身不是依据；已睡醒、新一天已开始或语境不明确时用 today。中午以后不能归前一天。',
      '可选 coupleWrite:{"day":"today或previous","overnightEvidence":"前一天归档时的对话原文依据","mood":{"moodId":"happy_1或calm_1或sad_1或angry_1或tired_1","note":"心情小记"},"diary":{"title":"日记标题","content":"第一人称日记正文"},"note":"便签正文","answers":[{"questionId":"待回答问题ID","content":"回答"}]}。仅返回实际想写的项目，不必全填。answers 只能回答下列已有、尚未回答的问题。',
      ...[day.today, day.previous].map((date) => `${date}：${JSON.stringify({
        mood: space.moods[date]?.charMoodId ? { id: space.moods[date].charMoodId, note: space.moods[date].charNote } : '未记录',
        diary: space.diaries.filter((entry) => entry.author === 'char' && entry.dateStr === date).map((entry) => ({ title: entry.title, content: entry.content })),
      })}`),
      `最近角色便签：${JSON.stringify(space.stickyNotes.filter((note) => note.author === 'char').slice(0, 4).map((note) => note.content))}`,
      `可回答的问题：${JSON.stringify(space.qaList.filter((qa) => !qa.charAnswer && (qa.askedBy === 'user' || qa.askedBy === 'system' || qa.userAnswer)).map((qa) => ({ id: qa.id, question: qa.question, userAnswer: qa.userAnswer })))}`,
    );
  } else lines.push('本轮禁止 coupleWrite。');
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
    const raw = record.coupleWrite;
    const space = boundSpace(ctx, actorId);
    if (ctx.chat.allowAutoCouple === false || space?.bindStatus !== 'bound' || !isRecord(raw) ||
      (raw.day !== 'today' && raw.day !== 'previous')) throw new Error('主动情侣空间格式或绑定状态无效。');
    const action: CoupleAction = { day: raw.day };
    if (raw.day === 'previous') action.overnightEvidence = text(raw.overnightEvidence, '熬夜归档依据', 500);
    if (raw.mood !== undefined) {
      if (!isRecord(raw.mood) || !['happy_1', 'calm_1', 'sad_1', 'angry_1', 'tired_1'].includes(String(raw.mood.moodId))) {
        throw new Error('角色选择的心情无效。');
      }
      action.mood = { moodId: String(raw.mood.moodId), note: text(raw.mood.note, '心情小记', 500) };
    }
    if (raw.diary !== undefined) {
      if (!isRecord(raw.diary)) throw new Error('角色日记格式无效。');
      action.diary = { title: text(raw.diary.title, '日记标题', 100), content: text(raw.diary.content, '日记正文', 6000) };
    }
    if (raw.note !== undefined) action.note = text(raw.note, '情侣便签', 1000);
    if (raw.answers !== undefined) {
      if (!Array.isArray(raw.answers)) throw new Error('情侣问答格式无效。');
      action.answers = raw.answers.map((answer) => {
        if (!isRecord(answer)) throw new Error('情侣问答内容无效。');
        return { questionId: text(answer.questionId, '问题ID', 200), content: text(answer.content, '问题回答', 2000) };
      });
    }
    if (!action.mood && !action.diary && !action.note && !action.answers?.length) throw new Error('情侣空间写入内容为空。');
    const date = coupleActionDate(action, ctx);
    validateCoupleWrite(space, action, date);
    result.couple = action;
  }
  return result;
};

const validateCoupleWrite = (space: CharacterCoupleSpace, action: CoupleAction, date: string) => {
  if (space.bindStatus !== 'bound') throw new Error('情侣空间已解除绑定，无法写入。');
  if (action.mood && space.moods[date]?.charMoodId) throw new Error('这一天已有角色心情，不重复写入。');
  if (action.diary && space.diaries.some((entry) => entry.author === 'char' && entry.dateStr === date)) {
    throw new Error('这一天已有角色日记，不重复写入。');
  }
  if (action.note && space.stickyNotes.some((note) => note.author === 'char' && note.content.trim() === action.note)) {
    throw new Error('情侣便签内容重复。');
  }
  const ids = new Set<string>();
  for (const answer of action.answers ?? []) {
    const qa = space.qaList.find((entry) => entry.id === answer.questionId);
    if (!qa || qa.charAnswer || ids.has(qa.id) || (qa.askedBy === 'char' && !qa.userAnswer)) {
      throw new Error('情侣问答不存在或已经回答，不能覆盖。');
    }
    ids.add(qa.id);
  }
};

export const applySocialWrites = (actions: SocialActions, ctx: SocialContext, actor: SocialActor) => {
  if (actions.couple) {
    const action = actions.couple;
    const date = coupleActionDate(action, ctx);
    updateCoupleSpace(actor.id, (space) => {
      validateCoupleWrite(space, action, date);
      return {
        ...space,
        moods: action.mood ? {
          ...space.moods,
          [date]: { ...space.moods[date], dateStr: date, charMoodId: action.mood.moodId, charNote: action.mood.note },
        } : space.moods,
        diaries: action.diary ? [{
          id: createMomentId('diary'), author: 'char', authorName: actor.name, dateStr: date,
          ...action.diary, seenByChar: true,
        }, ...space.diaries] : space.diaries,
        stickyNotes: action.note ? [{
          id: createMomentId('note'), author: 'char', authorName: actor.name, content: action.note,
          colorBg: '#DCEEFF', createdAt: date, seenByChar: true,
        }, ...space.stickyNotes] : space.stickyNotes,
        qaList: space.qaList.map((qa) => {
          const answer = action.answers?.find((item) => item.questionId === qa.id);
          return answer ? { ...qa, charAnswer: answer.content } : qa;
        }),
      };
    });
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
