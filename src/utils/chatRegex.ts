import { readStoredValue, writeStoredValue } from './localStorage';
export const CHAT_REGEX_KEY = 'yyphone:chat-regex';
export const CHAT_REGEX_EVENT = 'yyphone:chat-regex-change';
export interface ChatRegexRule { id: string; name: string; enabled: boolean; pattern: string; flags: string; replacement: string; target: 'character' | 'user' | 'both'; interactive?: boolean; testText?: string; prompt?: string; promptEnabled?: boolean }
export interface ChatRegexSettings { enabled: boolean; rules: ChatRegexRule[] }
export const EMPTY_CHAT_REGEX: ChatRegexSettings = { enabled: true, rules: [] };
export const REGEX_EXAMPLE = {
  name: '一封来信', pattern: '\\[信件\\]([\\s\\S]*?)\\|([\\s\\S]*?)\\[/信件\\]', flags: 'g', target: 'character' as const,
  replacement: '<section style="padding:22px 18px;border:1px solid #e9dce3;border-radius:18px;background:linear-gradient(145deg,#fffaf5,#f7edf4 65%,#edf5fa);color:#746373;box-shadow:0 5px 18px #a48b9b18"><div style="font-size:10px;letter-spacing:4px;color:#b098a7">一封来信</div><h3 style="margin:16px 0;font-size:18px;font-family:serif">$1</h3><div style="font-size:14px;line-height:1.9">$2</div><div style="margin-top:18px;text-align:right;color:#b098a7">♡</div></section>',
};
export const REGEX_EXAMPLE_TEXT = '[信件]写给今天的你|路过花店的时候，看到门口换了一盆小雏菊。\n想起你说喜欢，就拍下来留着，等你忙完给你看。[/信件]';
export function regexExpression(pattern: string, flags: string): RegExp {
  if (!pattern || pattern.length > 2000) throw new Error('查找正则需填写，最多 2000 字符。');
  const literal = pattern.match(/^\/([\s\S]*)\/([a-z]*)$/i);
  const source = literal ? literal[1] : pattern, actualFlags = literal ? literal[2] : flags;
  if (!/^[gimsu]*$/.test(actualFlags) || new Set(actualFlags).size !== actualFlags.length) throw new Error('标志支持 g、i、m、s、u，不能重复。');
  try { return new RegExp(source, actualFlags); } catch { throw new Error('查找正则格式无效，请检查括号和转义。'); }
}
export function validateChatRegex(value: unknown): ChatRegexSettings {
  const v = value as ChatRegexSettings;
  if (!v || typeof v.enabled !== 'boolean' || !Array.isArray(v.rules) || v.rules.length > 30) throw new Error('正则文件格式无效，最多保存 30 条规则。');
  const ids = new Set<string>();
  const rules = v.rules.map(rule => {
    if (!rule || typeof rule.id !== 'string' || !rule.id || ids.has(rule.id) || typeof rule.name !== 'string' || !rule.name.trim() || rule.name.length > 80 || typeof rule.enabled !== 'boolean' || typeof rule.pattern !== 'string' || typeof rule.flags !== 'string' || typeof rule.replacement !== 'string' || !rule.replacement.trim() || rule.replacement.length > 40000 || !['character', 'user', 'both'].includes(rule.target)) throw new Error('规则名称、匹配表达式或 HTML 模板不完整。');
    if (rule.interactive !== undefined && typeof rule.interactive !== 'boolean') throw new Error('卡片交互开关格式无效。');
    if (rule.testText !== undefined && (typeof rule.testText !== 'string' || rule.testText.length > 20000)) throw new Error('测试消息最多 20000 字符。');
    if (rule.prompt !== undefined && (typeof rule.prompt !== 'string' || rule.prompt.length > 20000)) throw new Error('正则提示词最多 20000 字符。');
    if (rule.promptEnabled !== undefined && typeof rule.promptEnabled !== 'boolean') throw new Error('提示词注入开关格式无效。');
    ids.add(rule.id); regexExpression(rule.pattern, rule.flags);
    return { id: rule.id, name: rule.name.trim(), enabled: rule.enabled, pattern: rule.pattern, flags: rule.flags, replacement: rule.replacement, target: rule.target, ...(rule.interactive !== undefined ? { interactive: rule.interactive } : {}),
      ...(rule.testText !== undefined ? { testText: rule.testText } : {}),
      ...(rule.prompt !== undefined ? { prompt: rule.prompt } : {}),
      ...(rule.promptEnabled !== undefined ? { promptEnabled: rule.promptEnabled } : {}),
    };
  });
  return { enabled: v.enabled, rules };
}
export function readChatRegex(): ChatRegexSettings {
  const raw = readStoredValue<unknown>(CHAT_REGEX_KEY, EMPTY_CHAT_REGEX, (_v): _v is unknown => true);
  try { return validateChatRegex(raw); } catch { return EMPTY_CHAT_REGEX; }
}
export function saveChatRegex(value: ChatRegexSettings) {
  writeStoredValue(CHAT_REGEX_KEY, validateChatRegex(value));
  window.dispatchEvent(new Event(CHAT_REGEX_EVENT));
}
export function exportChatRegex(settings: ChatRegexSettings, ruleId?: string) {
  const valid = validateChatRegex(settings);
  const rules = ruleId === undefined ? valid.rules : valid.rules.filter(rule => rule.id === ruleId);
  if (ruleId !== undefined && !rules.length) throw new Error('要导出的正则不存在。');
  return { format: 'yyphone-chat-regex', version: 1, settings: { ...valid, rules } };
}

export function buildChatRegexPrompt(settings = readChatRegex()): string {
  if (!settings.enabled) return '';
  const rules = settings.rules.filter(rule => rule.enabled && rule.promptEnabled !== false && rule.prompt?.trim());
  if (!rules.length) return '';
  return ['【已启用正则的输出约定】以下是用户为 HTML 展示配置的消息格式与写作要求。根据约定在合适情境使用，不为了展示卡片每轮触发。保持本轮 JSON 回复协议：格式文本写在一条普通 text 消息内，不直接返回 HTML，也不把模板、测试消息或心声当作台词。',
    ...rules.map(rule => `【${rule.name}】\n${rule.target === 'user' ? '该规则只美化用户消息，不据此代替用户发言。\n' : ''}${rule.prompt!.trim()}`),
  ].join('\n\n');
}
export const escapeRegexHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const captureHtml = (text: string) => escapeRegexHtml(text).replace(/\r?\n/g, '<br>');

/** Runs only in a time-limited worker in the browser; never modifies the stored message. */
export function renderChatRegex(text: string, sender: 'character' | 'user', settings: ChatRegexSettings): { html: string; ruleName: string; interactive: boolean } | null {
  if (!settings.enabled || text.length > 20000) return null;
  for (const rule of settings.rules) {
    if (!rule.enabled || rule.target !== 'both' && rule.target !== sender) continue;
    const expression = regexExpression(rule.pattern, rule.flags);
    let match: RegExpExecArray | null, end = 0, html = '', hits = 0;
    while ((match = expression.exec(text))) {
      if (++hits > 50) throw new Error('匹配次数过多，请缩小正则范围。');
      html += `<span style="white-space:pre-wrap">${escapeRegexHtml(text.slice(end, match.index))}</span>`;
      const found = match;
      html += rule.replacement.replace(/\$(\$|&|\d{1,2}|<[^>]+>)/g, (token, key: string) => {
        if (key === '$') return '$';
        if (key === '&') return captureHtml(found[0]);
        if (key.startsWith('<')) return found.groups ? captureHtml(found.groups[key.slice(1, -1)] ?? '') : token;
        const n = Number(key);
        if (n > 0 && n < found.length) return captureHtml(found[n] ?? '');
        if (key.length === 2 && Number(key[0]) > 0 && Number(key[0]) < found.length) return captureHtml(found[Number(key[0])] ?? '') + key[1];
        return token;
      });
      if (html.length > 120000) throw new Error('生成的 HTML 太长，请简化模板。');
      end = match.index + match[0].length;
      if (!expression.global) break;
      if (!match[0].length) expression.lastIndex += expression.unicode && (text.codePointAt(expression.lastIndex) ?? 0) > 0xffff ? 2 : 1;
    }
    if (hits) return { html: html + `<span style="white-space:pre-wrap">${escapeRegexHtml(text.slice(end))}</span>`, ruleName: rule.name, interactive: rule.interactive === true };
  }
  return null;
}
