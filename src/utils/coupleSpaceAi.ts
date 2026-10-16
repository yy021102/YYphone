import { requestConfiguredAiText } from './aiApi';
import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';
import { readCharacterBrief } from './coupleSpaceData';

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

const request = async (charId: string, userName: string, task: string, schema: string) => {
  const brief = readCharacterBrief(charId);
  const system = [
    `你正在扮演「${brief.name}」，正在和恋人「${userName}」共用一个微信里的情侣空间小应用。`,
    `角色设定：${brief.persona || '保持自然、亲切、符合上下文。'}`,
    brief.recentChat ? `你们最近的聊天（仅供把握语气和近况）：\n${brief.recentChat}` : '',
    '要求：完全以该角色的口吻与性格写作，像真人一样自然、有生活感和小情绪，不要套话；内容简短；不要提到自己是 AI。',
    `只返回一个 JSON 对象，格式：${schema}`,
  ].filter(Boolean).join('\n');
  return parseJson(await requestConfiguredAiText(system, task, { json: true }));
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
  const recentUser = space.diaries.find((entry) => entry.author === 'user');
  const data = await request(
    charId,
    userName,
    `请写一篇今天的交换日记，标题 15 字以内，正文 60~200 字。${
      recentUser ? `玩家最近写的日记《${recentUser.title}》：${recentUser.content.slice(0, 200)}，可以自然呼应。` : ''
    }`,
    '{"title":"标题","content":"正文"}'
  );
  const content = str(data.content, 600);
  if (!content) throw new Error('AI 没有写出日记内容，请重试。');
  return { title: str(data.title, 30) || '今日小记', content };
};

export const generateDiaryReply = async (charId: string, userName: string, title: string, content: string) => {
  const data = await request(
    charId,
    userName,
    `玩家写了一篇交换日记《${title}》：${content.slice(0, 400)}\n请写一段 20~80 字的回复批注。`,
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
