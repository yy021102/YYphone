import { toMessageContent, type PromptChatMessage, type OpenAiMessage } from './buildPrompt';

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

export const estimatePromptTokens = (messages: OpenAiMessage[]): number =>
  3 + messages.reduce((total, message) => total + 4 + estimateTextTokens(message.content), 0);
