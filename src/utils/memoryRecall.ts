import { resolveChatHistoryCount } from './chatHistory';

export interface MemoryTopicQuery { focus: string; context: string[] }
export type MemoryRecallQuery = string | MemoryTopicQuery;
interface RecallMessage { senderId: string; text?: string; kind?: string; hidden?: boolean; source?: string }

const SMALL_REPLY = /^(?:嗯+|哦+|啊+|对[啊呀的]?|是[啊呀的]?|好[啊呀的]?|真的[吗嘛]?|哈哈+|继续|然后呢|后来呢|好看|我也是|为什么|怎么说)[\s.!?？。~～]*$/;
const REFERENCE = /它|[这那](?:个|件|条|次|张|本|份|些|时候)|上次|之前|以前|后来|还记得|刚才|接着|继续/;
const TOPIC_CHANGE = /换个话题|换一个话题|说点别的|聊点别的|另外一件事|不聊.{0,12}了|不说.{0,12}了/;

/** Uses only this conversation's allowed history; no cross-account lookup or model call. */
export function conversationMemoryQuery(messages: readonly RecallMessage[], options: {
  participantIds: readonly string[]; historyLimit?: number; currentInput?: string;
}): MemoryTopicQuery {
  const allowed = new Set(['user', ...options.participantIds]);
  const visible = messages.slice(-resolveChatHistoryCount(options.historyLimit))
    .filter(m => allowed.has(m.senderId) && !m.hidden && m.text?.trim() &&
      !['thought', 'thinking', 'system', 'context-note', 'recalled', 'pat'].includes(m.kind ?? '') &&
      !['alias-experience', 'character-perspective', 'phone-inspection'].includes(m.source ?? ''))
    .slice(-14);
  let index = options.currentInput === '' ? visible.length - 1 : -1;
  if (options.currentInput !== '') for (let i = visible.length - 1; i >= 0; i--) {
    if (visible[i].senderId === 'user' && (options.currentInput === undefined || visible[i].text === options.currentInput)) { index = i; break; }
  }
  if (index < 0) index = visible.length - 1;
  const focus = visible[index]?.text?.trim().slice(-600) ?? '';
  if (!focus || TOPIC_CHANGE.test(focus) || !(REFERENCE.test(focus) || SMALL_REPLY.test(focus))) return { focus, context: [] };
  const context: string[] = [];
  let length = 0;
  for (let i = index - 1; i >= 0 && context.length < 8; i--) {
    const line = visible[i].text!.trim();
    if (TOPIC_CHANGE.test(line)) break;
    if (SMALL_REPLY.test(line) || line === focus || context.includes(line)) continue;
    const anchor = line.slice(0, Math.min(180, 1000 - length));
    if (!anchor) break;
    context.push(anchor); length += anchor.length;
    if (length >= 1000) break;
  }
  return { focus, context };
}

export function memoryQueryParts(query: MemoryRecallQuery) {
  const focus = typeof query === 'string' ? query : query.focus;
  const context = typeof query === 'string' ? [] : query.context.slice(0, 8);
  return { focus, context, text: context.length ? `当前消息：${focus}\n承接的近处话题：\n${context.slice().reverse().join('\n')}` : focus };
}
