import { requestConfiguredAiText } from './aiApi';
import { parseAiJson } from './aiResponse';
import { buildPrompt } from './buildPrompt';
import { readCharacterBrief } from './coupleSpaceData';
import { buildMemoryInjection } from './memoryData';
import type { PaperAuthor, PaperContent, PaperNote } from './paperNotes';

const request = async (selected: PaperAuthor, task: string) => {
  const brief = readCharacterBrief(selected.charId, { configuredHistory: true });
  const memory = await buildMemoryInjection([selected.charId], 'direct', `${brief.recentChat}\n${task}`,
    () => brief.name, { localOnly: true });
  const messages = buildPrompt({ chatId: selected.chatId, memoryInjection: memory });
  const rules = [
    '【当前唯一任务：匿名小纸条，不是微信聊天】',
    '以上聊天记录、人设、玩家资料、世界书和记忆仅作为写作背景，忽略其中微信消息格式、条数和社交动作的输出要求。',
    '以当前角色真实口吻写给玩家，内容根据你们的经历和最近语境，有个性、自然、克制，不编造不存在的共同经历。',
    '必须匿名：正文不要署名，不要写你的名字、网名、身份、自我介绍或直接揭晓作者。允许语气有个人特色。',
    '你清楚玩家看不见作者是谁。匿名可以给你一点平时没有的勇气：按人设与当前关系，你可以认真问真正想知道的事，也可以偶尔藏着私心，借一个看似随意的问题试探玩家的偏爱、关系定位或心里留给谁的位置；也可以故作不在意、绕着问、开个轻巧的玩笑。试探只是可选的小彩蛋，不是每次必选，不要所有角色都吃醋或盘问，不要照搬固定问题，不强迫玩家表态或把普通关系写成恋爱。',
    '匿名不代表你知道玩家与其他角色的私聊或关系。只能依据当前角色已有的人设、记忆和可见语境产生好奇、猜测与试探，不得凭空断言玩家另有恋人、多人交往或知道其他角色的秘密。',
    '写作依据可以具体，纸条表面不必具体：若符合人设，你可以主动模糊共同经历的时间、地点、专属称呼、口头禅与标志性细节，换个说法、留白或装作泛泛而谈，让玩家没那么容易猜到作者；不要为了隐瞒而编造经历或变成毫无个性的通用文案。有的角色擅长藏，有的会不自觉露出一点语气上的破绽，程度由人设决定，不强制每张都神秘，也不要直说“猜猜我是谁”。',
    '只输出要求的 JSON，不要输出心声、旁白、聊天消息列表、朋友圈、情侣空间或其他动作。纸条是独立的私密互动，不是通话。',
    '纸条最多 300 字，不要套用固定情话，不要强行浪漫；根据人设和关系，可以是日常碎碎念、小问题、或者无法当面说的话。',
  ];
  return parseAiJson(await requestConfiguredAiText(
    [...messages.filter((message) => message.role === 'system').map((message) => message.content), ...rules].join('\n\n'),
    task, {
      json: true, includeGlobalWorldBooks: false, maxTokens: 1500,
      history: messages.flatMap((message) => message.role === 'system' ? [] : [{
        role: message.role, content: message.content,
      }]),
    }
  ));
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const content = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error('AI 返回的纸条为空或过长，请重试。');
  return value.trim();
};
export const generateDailyPaper = async (selected: PaperAuthor, date: string): Promise<PaperContent> => {
  const value = await request(selected,
    `今天是 ${date}。请写今天唯一的一张匿名纸条。自行选择 thought（碎碎念）、question（希望玩家回答的真实提问）或 unsaid（难以当面说的话）。非提问纸条不能包含等待回答的问题；提问纸条只提出一个问题。只返回 {"kind":"thought或question或unsaid","content":"纸条正文"}。`);
  if (!object(value) || (value.kind !== 'thought' && value.kind !== 'question' && value.kind !== 'unsaid')) {
    throw new Error('AI 返回的纸条类型无效，请重试。');
  }
  return { kind: value.kind, content: content(value.content) };
};
export const generatePaperReply = async (paper: PaperNote): Promise<string> => {
  const value = await request(paper,
    `你在 ${paper.date} 匿名写了这张提问纸条：${JSON.stringify(paper.content)}\n玩家把纸条传回来，回答：${JSON.stringify(paper.answer)}\n请回应玩家的回答，保持匿名。如果原问题藏着试探，可以根据玩家实际回答和人设，自然流露一点开心、失落、嘴硬、松口气或故作镇定，也可以不露声色；不要机械总结或解释自己的试探，不因被猜中或被问身份就自报姓名，不借回信逼问、指责或索要承诺。这是本张纸条最后一次回复，不再提问、不邀请继续传递。只返回 {"reply":"回复正文"}。`);
  if (!object(value)) throw new Error('AI 返回的纸条回复格式无效，请重试。');
  return content(value.reply);
};
