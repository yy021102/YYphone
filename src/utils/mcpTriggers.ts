import type { SearchTool } from './mcpTools';
import { publicLink } from './linkPreview';

export interface McpTriggerRule { id: string; toolId: string; keywords: string[] }
export interface McpToolCall { tool: SearchTool; query: string; args?: Record<string, unknown> }
export interface McpDirectPlan { matched: boolean; calls: McpToolCall[]; notes: string[] }
export const defaultMcpTriggerRules = (): McpTriggerRule[] => [
  { id: 'hot', toolId: '@hot', keywords: ['热搜', '今天热搜', '今天微博', '今日微博'] },
  { id: 'search', toolId: '@search', keywords: ['你去搜', '去搜', '搜索', '搜一下', '搜一搜'] },
];
export const parseMcpKeywords = (value: string) => [...new Set(value.split(/[,，、;；\n]/).map(word => word.trim()).filter(Boolean))];
export const isMcpTriggerRules = (value: unknown): value is McpTriggerRule[] => Array.isArray(value) && value.length <= 50 &&
  value.every(rule => !!rule && typeof rule === 'object' && typeof rule.id === 'string' && typeof rule.toolId === 'string' &&
    Array.isArray(rule.keywords) && rule.keywords.length <= 100 && rule.keywords.every((word: unknown) => typeof word === 'string' && word.length <= 100)) &&
  new Set(value.map(rule => rule.id)).size === value.length;

export function pendingMcpInput(messages: readonly { senderId: string; text: string; externalUrl?: string }[], participantIds: readonly string[]): string {
  let lastReply = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (participantIds.includes(messages[index].senderId)) { lastReply = index; break; }
  }
  return messages.slice(lastReply + 1).filter(message => message.senderId === 'user').map(message =>
    [message.text, message.externalUrl && !message.text.includes(message.externalUrl) ? message.externalUrl : ''].filter(Boolean).join('\n')).join('\n');
}

export function sharedMcpUrls(text: string): string[] {
  const links = (text.match(/(?:https?:\/\/|www\.)[^\s<>"“”`]+/gi) ?? []).flatMap(value => {
    const clean = value.replace(/[，。！？；、）】》」.,!?;:)\]]+$/g, '');
    const url = publicLink(/^www\./i.test(clean) ? `https://${clean}` : clean);
    return url ? [url] : [];
  });
  return [...new Set(links)];
}

function resolveRuleTool(id: string, tools: SearchTool[]): SearchTool | undefined {
  if (id === '@hot') return tools.find(tool => tool.provider === 'builtin-hot') ?? tools.find(tool => tool.provider === 'hot');
  if (id !== '@search') return tools.find(tool => tool.id === id);
  return tools.find(tool => ['tavily', 'bocha', 'exa'].includes(tool.provider)) ??
    tools.find(tool => tool.provider === 'mcp' && /search|搜索|检索/i.test(`${tool.toolName} ${tool.name}`)) ??
    tools.find(tool => tool.provider === 'rest');
}

export function buildMcpDirectPlan(query: string, tools: SearchTool[], rules: McpTriggerRule[]): McpDirectPlan {
  const plan: McpDirectPlan = { matched: false, calls: [], notes: [] };
  const urls = sharedMcpUrls(query);
  if (urls.length) {
    plan.matched = true;
    const reader = tools.find(tool => tool.provider === 'reader'), summary = tools.find(tool => tool.provider === 'summary');
    const tool = reader ?? summary;
    if (!tool) plan.notes.push('网页全文与摘要工具均未启用，本轮没有读取链接。');
    else plan.calls = urls.slice(0, 3).map(url => ({ tool, query: url }));
    if (urls.length > 3) plan.notes.push('其余链接本轮未读取，请分开发送。');
    // A shared page always takes precedence over keyword/AI routing.
    return plan;
  }
  const lower = query.toLocaleLowerCase();
  const matches = rules.flatMap((rule, order) => rule.keywords.flatMap(keyword => {
    const word = keyword.trim().toLocaleLowerCase();
    if (!word) return [];
    let index = lower.indexOf(word);
    while (index >= 0 && /(?:不要|不用|别|不必|无需)(?:再|去|帮我|你)?\s*$/.test(query.slice(0, index))) index = lower.indexOf(word, index + word.length);
    if (index < 0) return [];
    return [{ rule, keyword, index, order }];
  })).sort((a, b) => b.keyword.length - a.keyword.length || a.order - b.order);
  const used = new Set<string>();
  for (const match of matches) {
    plan.matched = true;
    const tool = resolveRuleTool(match.rule.toolId, tools);
    if (!tool) { plan.notes.push(match.rule.toolId === '@search' ? '请先配置并启用一个搜索工具。' : '匹配的查询工具未启用或已删除。'); continue; }
    if (used.has(tool.id)) continue;
    // Overlapping hot/search rules select the more specific (longest) phrase.
    if (plan.calls.length && ['@hot', '@search'].includes(match.rule.toolId) && matches.some(other => other.keyword.length > match.keyword.length &&
      match.index >= other.index && match.index < other.index + other.keyword.length)) continue;
    let searchQuery: string;
    if (['builtin-hot', 'hot'].includes(tool.provider)) {
      searchQuery = /微博|weibo/i.test(query) ? '微博' : /百度|baidu/i.test(query) ? '百度' : /知乎|zhihu/i.test(query) ? '知乎' : /抖音|douyin/i.test(query) ? '抖音' : /B站|哔哩|bilibili/i.test(query) ? 'B站' : '热搜';
    } else if (['reader', 'summary'].includes(tool.provider)) {
      plan.notes.push('这个关键词对应网页阅读工具，请同时提供完整网址。'); continue;
    } else {
      // Use only the topic after the explicit trigger, never copy earlier private conversation.
      searchQuery = query.slice(match.index + match.keyword.length).split(/\r?\n/, 1)[0].replace(/^[\s，,:：。!?！？、]*(?:一下|一搜|一查|帮我|关于)?[\s，,:：、]*/, '').trim();
      if (!searchQuery) { plan.notes.push('请在搜索关键词后写上要查询的内容。'); continue; }
      searchQuery = searchQuery.slice(0, 500);
    }
    used.add(tool.id); plan.calls.push({ tool, query: searchQuery });
    if (plan.calls.length === 2) break;
  }
  plan.notes = [...new Set(plan.notes)];
  return plan;
}
