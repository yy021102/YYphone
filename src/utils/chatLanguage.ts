export const CHAT_LANGUAGES = [
  { id: 'en', label: '英语' },
  { id: 'ja', label: '日语' },
  { id: 'ko', label: '韩语' },
  { id: 'fr', label: '法语' },
  { id: 'de', label: '德语' },
  { id: 'es', label: '西班牙语' },
  { id: 'it', label: '意大利语' },
  { id: 'pt', label: '葡萄牙语' },
  { id: 'ru', label: '俄语' },
  { id: 'ar', label: '阿拉伯语' },
  { id: 'th', label: '泰语' },
  { id: 'vi', label: '越南语' },
  { id: 'yue', label: '粤语（繁体口语）' },
  { id: 'zh-TW', label: '繁体中文' },
] as const;

export type ChatLanguage = typeof CHAT_LANGUAGES[number]['id'];
export interface ChatLanguageSettings {
  foreignLanguageEnabled?: boolean;
  chatLanguage?: ChatLanguage;
}
export interface ChatTranslation {
  language: ChatLanguage;
  text: string;
  sourceText: string;
}
interface TranslatableMessage {
  text: string;
  kind?: string;
  chatTranslation?: ChatTranslation;
}

export const isChatLanguage = (value: unknown): value is ChatLanguage =>
  CHAT_LANGUAGES.some(language => language.id === value);

export const isChatTranslation = (value: unknown): value is ChatTranslation => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return isChatLanguage(record.language) && typeof record.text === 'string' && !!record.text.trim() &&
    typeof record.sourceText === 'string' && !!record.sourceText.trim();
};

export const effectiveChatLanguage = (settings: ChatLanguageSettings): ChatLanguage | undefined =>
  settings.foreignLanguageEnabled === true && isChatLanguage(settings.chatLanguage) ? settings.chatLanguage : undefined;

export const messageTranslation = (message: TranslatableMessage): ChatTranslation | undefined =>
  (!message.kind || message.kind === 'text' || message.kind === 'voice') &&
  isChatTranslation(message.chatTranslation) && message.chatTranslation.sourceText === message.text
    ? message.chatTranslation : undefined;

export const CHINESE_OUTPUT_RULES = '【默认输出语言】本任务使用简体中文，包括角色交流、心声、旁白、记忆、流水账、总结、游戏内交流与其他应用内容。即使角色是外国人、人设要求外语，或历史聊天使用外语/粤语/繁体，也不能沿用历史语言；按含义理解后用简体中文表达。只有微信聊天正文有明确独立的本对话或目标私聊语言规则时才可覆盖正文语言，不能扩散到其他内容。保留必要的专名、代码、JSON 字段名、ID 与要求的枚举值，不翻译协议字段。';

export function chatLanguageInstructions(language?: ChatLanguage): string {
  if (!language) return CHINESE_OUTPUT_RULES;
  const label = CHAT_LANGUAGES.find(item => item.id === language)!.label;
  return [
    `【仅本轮微信正文语言】当前对话明确启用${label}。覆盖默认正文语言：只有 reply 中普通 text 和 voice 的 text（包括语音转写）使用${label}。`,
    language === 'yue' ? '使用自然的粤语口语与繁体粤字，不要把普通话仅转成繁体。' : '',
    '每条普通文字或语音消息必须使用对象 {"kind":"text 或 voice","text":"所选语言原文","translation":"对应的简体中文翻译"}，不能只返回字符串，每条原文不超过1000字。translation 必须逐条准确对应 text，不能遗漏、概括或混在正文里，不加“翻译”等前缀；纯表情或标点可不提供译文。',
    '语音消息、已接通的语音通话和视频通话台词同样沿用所选语言，不要因通话改回中文。通话时按通话要求返回一段完整台词，并为它提供 translation；视频动作另用 kind:"narration" 的简体中文旁白，不把旁白放进台词或译文。',
    'translation 只供玩家查看，不是角色说出的另一句话，不参与语音播放；后续历史仅保留原始发言，不需要角色提及翻译或假装听到中文译文。',
    'thought（包括群聊各成员的心声）、旁白、图片描述、附件标题/摘要/留言、朋友圈/情侣空间/游戏等动作内容仍必须使用简体中文，不受本开关影响。引用 quote 保留被引用的原文。此设置不要求玩家使用同一种语言，不代写玩家的回答。',
  ].filter(Boolean).join('\n');
}

function assertChinese(text: string, field: string) {
  if (/\p{L}/u.test(text) && !/\p{Script=Han}/u.test(text)) {
    throw new Error(`AI 返回的${field}不是中文，请用简体中文重新生成。`);
  }
}

export function validateChatLanguage(result: Record<string, unknown>, language?: ChatLanguage, chineseThoughts = false): Record<string, unknown> {
  if (chineseThoughts && typeof result.thought === 'string') assertChinese(result.thought, '心声');
  if (!Array.isArray(result.reply)) return result;
  for (const part of result.reply) {
    if (part && typeof part === 'object' && !Array.isArray(part)) {
      const record = part as Record<string, unknown>;
      if (chineseThoughts && typeof record.thought === 'string') assertChinese(record.thought, '心声');
    }
    if (!language) continue;
    const record = part && typeof part === 'object' && !Array.isArray(part) ? part as Record<string, unknown> : undefined;
    const rawKind = record?.kind ?? record?.type ?? record?.messageType ?? 'text';
    const kind = typeof rawKind === 'string' ? rawKind.trim().toLowerCase() : rawKind;
    if (!['text', 'voice', 'quote', 'reply', '引用', '引用消息'].includes(String(kind))) continue;
    const text = typeof part === 'string' ? part : record?.text ?? record?.content;
    if (typeof text !== 'string' || !/[\p{L}\p{N}]/u.test(text)) continue;
    if (text.trim().length > 1000) throw new Error('AI 外语消息单条原文超过1000字，请分成自然的完整消息并逐条配对译文。');
    if (typeof record?.translation !== 'string' || !record.translation.trim()) {
      throw new Error('AI 外语消息缺少逐条的简体中文 translation 译文，请保留原文并补全译文。');
    }
    assertChinese(record.translation, '译文');
  }
  return result;
}
