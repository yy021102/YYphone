import { toMessageContent, type PromptChatMessage, type OpenAiMessage, type PromptTokenCategory } from './buildPrompt';

export const PROMPT_TOKEN_CATEGORIES = [
  { id: 'history', label: '当前聊天历史', description: '挂载范围内的当前聊天记录及其发送时间标记。' },
  { id: 'mountedHistory', label: '其他挂载聊天', description: '其他聊天实际挂载的记录、来源说明和发送时间标记。' },
  { id: 'currentInput', label: '本次玩家消息', description: '提示词末尾单独发送的本次玩家消息，包括已保存的图片梗概。' },
  { id: 'memory', label: '记忆／摘要／连续性参考', description: '本轮实际带入的记忆、流水账摘要、成长记录及启用的最近心声等连续性参考。' },
  { id: 'worldBook', label: '世界书', description: '本轮实际命中的世界书条目，包含深度前、中、后各位置。' },
  { id: 'character', label: '角色人设', description: '当前角色及相关 NPC 的姓名、身份与人设。' },
  { id: 'userPersona', label: '玩家资料／聊天补充', description: '当前玩家资料以及本对话保存的补充设定。' },
  { id: 'system', label: '系统提示词／回复协议', description: '交流规则、时间感知、语言、回复格式、表情包目录及本轮附带的功能指令。' },
  { id: 'other', label: '其他上下文／工具', description: '环境、互动事件、动态、商品、工具结果及额外图片参考等本轮上下文。' },
  { id: 'overhead', label: '消息格式开销', description: '每条消息估算 4 Tokens，整个请求另估算 3 Tokens。' },
] as const;

export interface PromptTokenEstimate {
  input: number;
  breakdown: Record<PromptTokenCategory | 'overhead', number>;
}

export const estimateTextTokens = (text: string): number => {
  const chunks = text.match(/[A-Za-z0-9]+|\s+|[\s\S]/gu) ?? [];
  let tokens = 0;
  for (const chunk of chunks) {
    if (/^[A-Za-z0-9]+$/.test(chunk)) tokens += Math.ceil(chunk.length / 4);
    else if (/^\s+$/.test(chunk)) tokens += Math.ceil(chunk.length / 4);
    else if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(chunk)) tokens += 1.5;
    else tokens += (chunk.codePointAt(0) ?? 0) > 0xffff ? 3 : 1;
  }
  return Math.ceil(tokens);
};

export const estimateConversationTokens = (messages: PromptChatMessage[]): number =>
  messages.reduce((total, message) => total + 4 + estimateTextTokens(toMessageContent(message)), 0);

export function estimatePromptTokenBreakdown(messages: OpenAiMessage[]): PromptTokenEstimate {
  const breakdown: PromptTokenEstimate['breakdown'] = {
    history: 0, mountedHistory: 0, currentInput: 0, memory: 0, worldBook: 0,
    character: 0, userPersona: 0, system: 0, other: 0, overhead: 3,
  };
  let input = 3;
  for (const message of messages) {
    const parts = message.tokenParts ?? [{ category: message.tokenCategory ?? (message.role === 'system' ? 'system' : 'other'), content: message.content }];
    if (message.tokenParts && parts.map(part => part.content).join('') !== message.content) {
      throw new Error('Token 分类内容与实际提示词不一致，无法准确估算，请重新生成预估。');
    }
    let prefix = '', tokens = 0;
    for (const part of parts) {
      prefix += part.content;
      const next = estimateTextTokens(prefix);
      // Attribute incremental cost so mixed-source messages keep the same rounding as the original estimator.
      breakdown[part.category] += next - tokens;
      tokens = next;
    }
    breakdown.overhead += 4;
    input += tokens + 4;
  }
  return { input, breakdown };
}

export const estimatePromptTokens = (messages: OpenAiMessage[]): number =>
  estimatePromptTokenBreakdown(messages).input;
