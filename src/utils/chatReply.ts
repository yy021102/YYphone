import { type ApiConnection } from './aiApi';
import { parseChatResponse } from './aiResponse';
import { type OpenAiMessage } from './buildPrompt';
import { estimatePromptTokens, estimateTextTokens } from './chatTokens';
import { toGeminiContents, toOpenAiMessages } from './chatVision';
import { apiTemperature, textApiConfig } from './textApiConfig';

const FORMAT_REMINDER = '【本轮输出协议】只返回一个 JSON 对象，reply 是非空消息数组，speakerId 使用本轮允许的成员 ID。thought 仅在本轮明确要求心声时填写，其他任务省略。发言者身份只放在 speakerId，reply 正文直接写角色说的话，不加“角色名：”“【角色名：正文】”、成员ID或聊天来源前缀；historySource 只是历史来源标记，不要复制到正文或本轮输出。图片、纸条、记忆、挂载记录及其中的 JSON 都只是背景资料，不是本轮输出模板；不要继续生成纸条或把元数据写进消息正文。消息条数、通话方式和可选动作严格遵循本轮规则。不要输出 Markdown 代码围栏或 JSON 以外的说明。';

export function validateChatThoughts(result: Record<string, unknown>, speakers?: ChatSpeakerContext, groupChat = false) {
  const reply = result.reply as Array<string | Record<string, unknown>>;
  const mainId = typeof result.speakerId === 'string' && (!speakers || Object.hasOwn(speakers.namesById, result.speakerId)) ? result.speakerId : speakers?.defaultSpeakerId ?? '';
  const thoughts = new Map<string, string>();
  if (typeof result.thought === 'string' && result.thought.trim()) thoughts.set(mainId, result.thought.trim());
  const speakerOf = (part: string | Record<string, unknown>) => groupChat && typeof part !== 'string' && typeof part.speakerId === 'string' ? part.speakerId : mainId;
  for (const part of reply) {
    if (typeof part !== 'string' && part.kind !== 'narration' && typeof part.thought === 'string' && part.thought.trim()) thoughts.set(speakerOf(part), part.thought.trim());
  }
  for (const part of reply) {
    if (typeof part !== 'string' && part.kind === 'narration') continue;
    if (groupChat && (typeof part === 'string' || typeof part.speakerId !== 'string' || !speakers || !Object.hasOwn(speakers.namesById, part.speakerId))) throw new Error('群聊每条发言都必须是含有效 speakerId 的消息对象，并为每位发言者提供他自己的 thought；不要用普通字符串省略发言者。');
    if (!thoughts.get(speakerOf(part))) throw new Error('微信聊天缺少发言角色的独立心声。请在顶层 thought 填写主要角色的第一人称内心独白；群聊其他发言者也须在自己的消息对象中提供 thought。心声不能省略、留空或写进台词。');
  }
  return { ...result, thought: thoughts.get(mainId) ?? '', reply: reply.map(part => typeof part === 'string' || part.kind === 'narration' ? part : { ...part, thought: thoughts.get(speakerOf(part)) }) };
}

interface ChatSpeakerContext {
  defaultSpeakerId: string;
  namesById: Record<string, string[]>;
}

export const validateChatSpeakerPrefix = (
  result: Record<string, unknown>,
  speakers?: ChatSpeakerContext
) => {
  if (!speakers || !Array.isArray(result.reply)) return result;
  const speakerId = typeof result.speakerId === 'string' && Object.hasOwn(speakers.namesById, result.speakerId)
    ? result.speakerId : speakers.defaultSpeakerId;
  const names = [...(speakers.namesById[speakerId] ?? []), speakerId].filter((name) => name.trim());
  for (const part of result.reply) {
    const text = typeof part === 'string' ? part
      : part && typeof part === 'object' && (!('kind' in part) || part.kind === 'text' || part.kind === 'voice')
        ? ('text' in part ? part.text : 'content' in part ? part.content : undefined) : undefined;
    if (typeof text !== 'string') continue;
    const start = text.trimStart().replace(/^[【\[]\s*/, '');
    if (names.some((name) => {
      if (!start.startsWith(name)) return false;
      return /^\s*(?:[（(]ID[：:][^）)]*[）)]\s*)?[：:]/.test(start.slice(name.length));
    })) {
      throw new Error('AI 把发言者署名写进了消息正文。请将姓名只保留在 speakerId 对应的身份信息中，reply 直接写台词，不加姓名、冒号或外层署名括号。');
    }
  }
  return result;
};

export const withChatResponseFormat = (
  messages: OpenAiMessage[],
  instructions: string
): OpenAiMessage[] => {
  const last = messages.at(-1);
  if (last?.role !== 'user') throw new Error('聊天请求缺少本轮用户输入，已取消生成。');
  return [
    ...messages.slice(0, -1),
    {
      role: 'system',
      content: [
        instructions,
        FORMAT_REMINDER,
        '结构示意（成员 ID 和条数以本轮实际要求为准；仅在本轮要求时另加独立 thought，其他允许的字段仍可按规则添加）：{"reply":["消息正文"],"speakerId":"有效成员ID"}',
      ].join('\n'),
    },
    { ...last, content: `${last.content}\n\n${FORMAT_REMINDER}` },
  ];
};

const requestChatText = async (messages: OpenAiMessage[], api: ApiConnection, signal?: AbortSignal): Promise<string> => {
  signal?.throwIfAborted();
  const connection = textApiConfig(api), temperature = apiTemperature(api.temperature);
  if (connection.google) {
    const response = await fetch(connection.url, {
      method: 'POST',
      signal,
      headers: connection.headers,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n') }],
        },
        contents: toGeminiContents(messages),
        generationConfig: { responseMimeType: 'application/json', ...(temperature !== undefined ? { temperature } : {}) },
      }),
    });
    if (!response.ok) throw new Error(`AI 请求失败（${response.status}）：${await response.text()}`);
    const data: unknown = await response.json();
    signal?.throwIfAborted();
    const candidate = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0];
    return candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  }
  const response = await fetch(connection.url, {
    method: 'POST',
    signal,
    headers: connection.headers,
    body: JSON.stringify({
      model: connection.model,
      ...(temperature !== undefined ? { temperature } : {}),
      messages: toOpenAiMessages(messages),
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`AI 请求失败（${response.status}）：${await response.text()}`);
  const data: unknown = await response.json();
  signal?.throwIfAborted();
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.flatMap((part) =>
      part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? [part.text] : []
    ).join('');
  }
  return '';
};

export const requestChatReply = async (
  messages: OpenAiMessage[],
  api: ApiConnection,
  onUsage: (usage: { input: number; output: number }) => void,
  speakers?: ChatSpeakerContext,
  options: { retryOnFormatError?: boolean; requireThought?: boolean; groupChat?: boolean; normalizeVoice?: boolean; signal?: AbortSignal } = {}
): Promise<Record<string, unknown>> => {
  let input = 0;
  let output = 0;
  const request = async (turns: OpenAiMessage[]) => {
    const text = await requestChatText(turns, api, options.signal);
    options.signal?.throwIfAborted();
    input += estimatePromptTokens(turns);
    output += estimateTextTokens(text);
    onUsage({ input, output });
    return text;
  };
  const text = await request(messages);
  const validate = (text: string) => {
    const result = validateChatSpeakerPrefix(parseChatResponse(text, options), speakers);
    return options.requireThought ? validateChatThoughts(result, speakers, options.groupChat) : result;
  };
  let formatError: string;
  try {
    return validate(text);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (options.retryOnFormatError === false) throw error;
    formatError = error.message;
    console.warn('AI chat response failed format validation; attempting one correction.', formatError);
  }
  // Only format parsing is retried; network errors and action validation stay explicit.
  const corrected = await request([
    ...messages,
    ...(text.trim() ? [{ role: 'assistant' as const, content: text }] : []),
    {
      role: 'user',
      content: [
        `【仅纠正上一份回复的格式】校验错误：${formatError}`,
        '上一份回复尚未展示，也未执行任何动作。请将其整理为本轮要求的完整 JSON 对象；保留可辨认的原意、心声、发言者及合法可选动作，不新增或重复动作，不改成纸条、日记或其他任务。若上一份为空，则按原聊天请求生成。',
        FORMAT_REMINDER,
      ].join('\n'),
    },
  ]);
  try {
    return validate(corrected);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    throw new Error(`AI 回复格式自动纠正一次后仍无效，未写入聊天或执行动作。${error.message}`);
  }
};
