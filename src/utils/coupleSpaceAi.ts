import { requestConfiguredAiText } from './aiApi';
import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';
import { localDateString, readCharacterBrief } from './coupleSpaceData';

export interface MoodChoice {
  id: string;
  label: string;
  kaomoji: string;
}

const parseJson = (text: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new Error('AI 返回的内容不是有效 JSON，请重试。');
};

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const request = async (charId: string, userName: string, task: string, schema: string, maxTokens?: number) => {
  const brief = readCharacterBrief(charId);
  const system = [
    `你正在扮演「${brief.name}」，正在和恋人「${userName}」共用一个微信里的情侣空间小应用。`,
    `角色设定：${brief.persona || '保持自然、亲切、符合上下文。'}`,
    brief.recentChat
      ? `你们最近微信里的最新聊天（由旧到新，共 ${brief.recentChat.split('\n').length} 条；写作时自然承接这些近况和情绪，不要无视）：\n${brief.recentChat}`
      : '',
    '要求：完全以该角色的口吻与性格写作，像真人一样自然、有生活感和小情绪，不要套话；内容简短；不要提到自己是 AI。',
    `只返回一个 JSON 对象，格式：${schema}`,
  ].filter(Boolean).join('\n');
  return parseJson(await requestConfiguredAiText(system, task, { json: true, ...(maxTokens ? { maxTokens } : {}) }));
};

export const generateCharMood = async (
  charId: string,
  userName: string,
  dateStr: string,
  moods: MoodChoice[],
  userMood?: { label?: string; note?: string }
) => {
  const options = moods.map((mood) => `${mood.id}=${mood.kaomoji}（${mood.label}）`).join('；');
  const data = await request(
    charId,
    userName,
    `请决定你在 ${dateStr} 这一天的心情，并写一句心情小记（30 字以内，第一人称）。${
      userMood?.label ? `玩家这天的心情是${userMood.label}${userMood.note ? `，写着：${userMood.note}` : ''}。` : ''
    }可选心情（只能选一个 id）：${options}`,
    '{"moodId":"心情 id","note":"心情小记"}'
  );
  const moodId = str(data.moodId, 20);
  const mood = moods.find((item) => item.id === moodId) ?? moods.find((item) => item.kaomoji === moodId);
  if (!mood) throw new Error('AI 选择了不存在的心情，请重试。');
  return { moodId: mood.id, note: str(data.note, 80) };
};

export const generateCharDiary = async (charId: string, userName: string, space: CharacterCoupleSpace) => {
  const todayUser = space.diaries.find((entry) => entry.author === 'user' && entry.dateStr === localDateString());
  const recentUser = todayUser ?? space.diaries.find((entry) => entry.author === 'user');
  const data = await request(
    charId,
    userName,
    `请写一篇今天的交换日记（只写一篇），标题 15 字以内，正文 60~200 字。${
      recentUser
        ? `玩家${todayUser ? '今天' : '最近'}写的日记《${recentUser.title}》：${recentUser.content.slice(0, 300)}。你的日记里要有一部分内容明确呼应玩家日记里提到的事或心情（用你自己的视角回应，不要复述原文），其余部分写你自己的一天。`
        : ''
    }`,
    '{"title":"标题","content":"正文"}'
  );
  const content = str(data.content, 600);
  if (!content) throw new Error('AI 没有写出日记内容，请重试。');
  return { title: str(data.title, 30) || '今日小记', content };
};

export const generateDiaryReply = async (charId: string, userName: string, title: string, content: string,
  context?: { author: 'user' | 'char'; annotations: Array<{ authorName: string; content: string }> }) => {
  const data = await request(
    charId,
    userName,
    `${context?.author === 'char' ? '这是你自己写的' : '玩家写了一篇'}交换日记《${title}》：${content.slice(0, 1000)}\n已有批注：${JSON.stringify(context?.annotations.slice(-10) ?? [])}。请以角色本人身份写一段20~80字的批注，回应日记或玩家的最新批注。不替玩家说话，不重复已有内容。`,
    '{"reply":"回复"}'
  );
  const reply = str(data.reply, 200);
  if (!reply) throw new Error('AI 没有写出回复，请重试。');
  return reply;
};

export const generateQaAnswer = async (charId: string, userName: string, question: string, userAnswer?: string) => {
  const data = await request(
    charId,
    userName,
    `情侣空间每日问答的问题：「${question}」。${userAnswer ? `玩家的回答是：${userAnswer}。` : ''}请用 15~80 字回答。`,
    '{"answer":"回答"}'
  );
  const answer = str(data.answer, 200);
  if (!answer) throw new Error('AI 没有给出回答，请重试。');
  return answer;
};

export const generateQaQuestion = async (charId: string, userName: string, space: CharacterCoupleSpace) => {
  const asked = space.qaList.slice(0, 6).map((entry) => entry.question).join('；');
  const data = await request(
    charId,
    userName,
    `请向恋人提一个适合情侣之间的小问题（40 字以内，符合你的性格）。${asked ? `不要和这些重复：${asked}` : ''}`,
    '{"question":"问题"}'
  );
  const question = str(data.question, 80);
  if (!question) throw new Error('AI 没有提出问题，请重试。');
  return question;
};

export const generateStickyNote = async (charId: string, userName: string, space: CharacterCoupleSpace) => {
  const latest = space.stickyNotes.find((note) => note.author === 'user');
  const data = await request(
    charId,
    userName,
    `请在碎碎念便签墙上贴一张便签（50 字以内）。${
      latest ? `玩家刚贴了一张：「${latest.content.slice(0, 80)}」，可以回应它。` : '可以聊聊你此刻的小心思。'
    }`,
    '{"content":"便签内容"}'
  );
  const content = str(data.content, 120);
  if (!content) throw new Error('AI 没有写出便签，请重试。');
  return content;
};

export const generateCoupleBatch = async (
  charId: string, userName: string, space: CharacterCoupleSpace, moods: MoodChoice[]
): Promise<CharacterCoupleSpace> => {
  const today = localDateString();
  const moodDates = [...new Set([today, ...Object.values(space.moods)
    .filter((item) => item.userMoodId && !item.charMoodId).map((item) => item.dateStr)])]
    .filter((date) => !space.moods[date]?.charMoodId);
  const diaries = space.diaries.filter((item) => item.author === 'user' && !item.replyComment);
  const questions = space.qaList.filter((item) => !item.charAnswer &&
    (item.askedBy !== 'char' || item.userAnswer));
  const needsDiary = !space.diaries.some((item) => item.author === 'char' && item.dateStr === today);
  const needsQuestion = !space.qaList.some((item) => item.dateStr === today);
  const data = await request(charId, userName,
    `一次完成情侣空间全部待写内容，不要漏项、不覆盖已有内容。今天=${today}。
心情可选：${JSON.stringify(moods)}。
需要写心情的日期（逐一返回）：${JSON.stringify(moodDates)}。
玩家心情：${JSON.stringify(space.moods)}。
需要回复的玩家日记（逐一按 id 回复）：${JSON.stringify(diaries)}。
需要回答的问题（逐一按 id 回答）：${JSON.stringify(questions)}。
${needsDiary ? '写一篇今天自己的日记，60~200字，呼应玩家近况。' : '今天已有自己的日记，diary 返回 null。'}
${needsQuestion ? '今天还没有问答，生成一个新问题并写自己的回答，放入 qa。' : '今天已有问答，qa 返回 null。'}
写一条新的碎碎念，50字以内。最近便签：${JSON.stringify(space.stickyNotes.slice(0, 6))}。
最近日记：${JSON.stringify(space.diaries.slice(0, 4))}。
每个列表只包含指定 id/日期，返回完整，不要用省略号。`,
    '{"moods":[{"date":"YYYY-MM-DD","moodId":"心情id","note":"小记"}],"diary":{"title":"标题","content":"正文"}或null,"replies":[{"id":"日记id","reply":"批注"}],"answers":[{"id":"问题id","answer":"回答"}],"qa":{"question":"新问题","answer":"自己的回答"}或null,"note":"便签正文"}', 16000
  );
  const requiredText = (value: unknown, max: number, label: string) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
      throw new Error(`AI 返回的${label}为空或过长，未保存本次生成。`);
    }
    return value.trim();
  };
  const listBy = (value: unknown, ids: string[], key: string) => {
    if (!Array.isArray(value) || value.length !== ids.length) throw new Error('AI 未返回全部待写内容，未保存，请重试。');
    const result = new Map<string, Record<string, unknown>>();
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('AI 返回列表格式无效。');
      const row = item as Record<string, unknown>;
      if (typeof row[key] !== 'string' || !ids.includes(row[key]) || result.has(row[key])) throw new Error('AI 返回的日期或记录 ID 无效。');
      result.set(row[key], row);
    }
    return result;
  };
  const next: CharacterCoupleSpace = { ...space, moods: { ...space.moods },
    diaries: [...space.diaries], qaList: [...space.qaList], stickyNotes: [...space.stickyNotes] };
  const generatedMoods = listBy(data.moods, moodDates, 'date');
  for (const [date, row] of generatedMoods) {
    if (!moods.some((mood) => mood.id === row.moodId)) throw new Error('AI 选择了不存在的心情。');
    next.moods[date] = { ...next.moods[date], dateStr: date, charMoodId: String(row.moodId),
      charNote: requiredText(row.note, 80, '心情小记') };
  }
  const replies = listBy(data.replies, diaries.map((item) => item.id), 'id');
  next.diaries = next.diaries.map((item) => replies.has(item.id)
    ? { ...item, replyComment: requiredText(replies.get(item.id)?.reply, 200, '日记批注') } : item);
  const answers = listBy(data.answers, questions.map((item) => item.id), 'id');
  next.qaList = next.qaList.map((item) => answers.has(item.id)
    ? { ...item, charAnswer: requiredText(answers.get(item.id)?.answer, 200, '问答回答') } : item);
  const name = readCharacterBrief(charId).name;
  const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (needsDiary) {
    const diary = data.diary;
    if (!diary || typeof diary !== 'object' || Array.isArray(diary)) throw new Error('AI 遗漏了今日日记。');
    const row = diary as Record<string, unknown>;
    next.diaries.unshift({ id: id('diary'), author: 'char', authorName: name, dateStr: today,
      title: requiredText(row.title, 30, '日记标题'), content: requiredText(row.content, 600, '日记正文'), seenByChar: true });
  }
  if (needsQuestion) {
    const qa = data.qa;
    if (!qa || typeof qa !== 'object' || Array.isArray(qa)) throw new Error('AI 遗漏了今日问答。');
    const row = qa as Record<string, unknown>;
    next.qaList.unshift({ id: id('qa'), dateStr: today, askedBy: 'char',
      question: requiredText(row.question, 80, '问题'), charAnswer: requiredText(row.answer, 200, '回答') });
  }
  next.stickyNotes.unshift({ id: id('note'), author: 'char', authorName: name,
    content: requiredText(data.note, 120, '便签'), colorBg: '#DCEEFF', createdAt: today, seenByChar: true });
  return next;
};
