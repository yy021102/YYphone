import { isAvatarFrame, type AvatarFrameStyle } from './avatarFrame';
import { compileWeChatTheme, DEFAULT_WECHAT_THEME_CSS } from './wechatTheme';

export interface BubbleStyle {
  css: string; userBubbleColor: string; characterBubbleColor: string;
  userBubbleOpacity: number; characterBubbleOpacity: number;
}
export interface BubbleCssPreset {
  id: string; name: string; css: string;
  userBubbleColor?: string; characterBubbleColor?: string;
  userBubbleOpacity?: number; characterBubbleOpacity?: number;
}
export interface ChatAppearancePreset {
  id: string; name: string; backgroundUrl: string;
  userBubbleColor?: string; characterBubbleColor?: string;
  userBubbleOpacity?: number; characterBubbleOpacity?: number;
  bubbleCss?: string; layoutCss?: string; themeCss?: string;
  sendIconUrl?: string; generateIconUrl?: string;
  userAvatarFrame?: AvatarFrameStyle; characterAvatarFrame?: AvatarFrameStyle;
  bubbleMode?: 'follow' | 'custom'; bubbleOverride?: BubbleStyle;
}
export interface ChatAppearance {
  backgroundUrl: string; userBubbleColor: string; characterBubbleColor: string;
  userBubbleOpacity?: number; characterBubbleOpacity?: number;
  bubbleCss?: string; layoutCss?: string; themeCss?: string;
  sendIconUrl?: string; generateIconUrl?: string;
  presets: ChatAppearancePreset[]; bubblePresets?: BubbleCssPreset[]; pagePresets?: ChatAppearancePreset[];
  userAvatarFrame?: AvatarFrameStyle; characterAvatarFrame?: AvatarFrameStyle;
  bubbleMode?: 'follow' | 'custom'; bubbleOverride?: BubbleStyle;
}

export const DEFAULT_BUBBLE_CSS = `/* 独立气泡 · 仅浅色模式生效
 * .is-user 是我的消息，.is-character 是角色消息。
 * 本框只改变文字与语音气泡，不改变页面和按钮功能。
 * 颜色跟随下方色盘；也可以把 background 改成颜色、渐变或 url("图片链接")。
 * 页面原有气泡及其装饰会暂时停用；选择“跟随页面”即可恢复。
 */

/* 01 气泡主体：形状、边框、内边距、文字、阴影 */
.yy-chat-message-bubble.is-plain {
  border-radius: 4px;
  padding: 8px 12px;
  color: #111;
  font-size: calc(16px * var(--font-scale, 1));
  line-height: 1.5;
  border: none;
  box-shadow: none;
}
.yy-chat-message-bubble.is-user.is-plain { background: var(--yy-user-bubble-color); }
.yy-chat-message-bubble.is-character.is-plain { background: var(--yy-character-bubble-color); }

/* 02 尖角：改成 content: none 可隐藏；::after 可添加装饰 */
.yy-chat-message-bubble.is-plain::before {
  content: "";
  position: absolute;
  top: 14px;
  left: -5px;
  width: 10px;
  height: 10px;
  border-radius: 1px;
  background: inherit;
  transform: rotate(45deg);
}
.yy-chat-message-bubble.is-user.is-plain::before { left: auto; right: -5px; }

/* 03 语音：数字和图标的外观 */
.yy-chat-voice-message { color: inherit; }
.yy-chat-voice-duration { font-size: calc(12px * var(--font-scale, 1)); }
`;
export const DEFAULT_BUBBLE_STYLE: BubbleStyle = {
  css: DEFAULT_BUBBLE_CSS, userBubbleColor: '#95ec69', characterBubbleColor: '#ffffff',
  userBubbleOpacity: 1, characterBubbleOpacity: 1,
};
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  backgroundUrl: '', userBubbleColor: '#95ec69', characterBubbleColor: '#ffffff',
  userBubbleOpacity: 1, characterBubbleOpacity: 1, bubbleCss: '', layoutCss: '', themeCss: DEFAULT_WECHAT_THEME_CSS,
  sendIconUrl: '', generateIconUrl: '', presets: [], bubblePresets: [], pagePresets: [], bubbleMode: 'follow',
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const opacity = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export const isBubbleStyle = (v: unknown): v is BubbleStyle => record(v) && typeof v.css === 'string' &&
  /^#[a-f\d]{6}$/i.test(String(v.userBubbleColor)) && /^#[a-f\d]{6}$/i.test(String(v.characterBubbleColor)) && opacity(v.userBubbleOpacity) && opacity(v.characterBubbleOpacity);
const pageFieldsValid = (v: Record<string, unknown>) => typeof v.backgroundUrl === 'string' &&
  ['userBubbleColor', 'characterBubbleColor', 'bubbleCss', 'layoutCss', 'themeCss', 'sendIconUrl', 'generateIconUrl'].every(k => v[k] === undefined || typeof v[k] === 'string') &&
  ['userBubbleOpacity', 'characterBubbleOpacity'].every(k => v[k] === undefined || opacity(v[k])) &&
  ['userAvatarFrame', 'characterAvatarFrame'].every(k => v[k] === undefined || isAvatarFrame(v[k])) &&
  (v.bubbleMode === undefined || v.bubbleMode === 'follow' || v.bubbleMode === 'custom') && (v.bubbleOverride === undefined || isBubbleStyle(v.bubbleOverride));
const isPreset = (v: unknown): v is ChatAppearancePreset => record(v) && typeof v.id === 'string' && typeof v.name === 'string' && pageFieldsValid(v);
export const isChatAppearance = (v: unknown): v is ChatAppearance => record(v) && pageFieldsValid(v) &&
  typeof v.userBubbleColor === 'string' && typeof v.characterBubbleColor === 'string' && Array.isArray(v.presets) && v.presets.every(isPreset) &&
  (v.pagePresets === undefined || Array.isArray(v.pagePresets) && v.pagePresets.every(isPreset)) &&
  (v.bubblePresets === undefined || Array.isArray(v.bubblePresets) && v.bubblePresets.every(p => record(p) && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.css === 'string' &&
    ['userBubbleColor', 'characterBubbleColor'].every(k => p[k] === undefined || /^#[a-f\d]{6}$/i.test(String(p[k]))) &&
    ['userBubbleOpacity', 'characterBubbleOpacity'].every(k => p[k] === undefined || opacity(p[k]))));

export function independentBubbles(a: ChatAppearance): BubbleStyle {
  return a.bubbleOverride ?? { ...DEFAULT_BUBBLE_STYLE, ...(a.bubbleCss?.trim() ? { css: a.bubbleCss } : {}),
    userBubbleColor: /^#[a-f\d]{6}$/i.test(a.userBubbleColor) ? a.userBubbleColor : DEFAULT_BUBBLE_STYLE.userBubbleColor,
    characterBubbleColor: /^#[a-f\d]{6}$/i.test(a.characterBubbleColor) ? a.characterBubbleColor : DEFAULT_BUBBLE_STYLE.characterBubbleColor,
    userBubbleOpacity: a.userBubbleOpacity ?? 1, characterBubbleOpacity: a.characterBubbleOpacity ?? 1 };
}
export function captureChatPage(a: ChatAppearance): Omit<ChatAppearancePreset, 'id' | 'name'> {
  return {
    backgroundUrl: a.backgroundUrl, userBubbleColor: a.userBubbleColor, characterBubbleColor: a.characterBubbleColor,
    userBubbleOpacity: a.userBubbleOpacity ?? 1, characterBubbleOpacity: a.characterBubbleOpacity ?? 1,
    bubbleCss: a.bubbleCss ?? '', layoutCss: a.layoutCss ?? '', themeCss: a.themeCss,
    sendIconUrl: a.sendIconUrl ?? '', generateIconUrl: a.generateIconUrl ?? '',
    userAvatarFrame: structuredClone(a.userAvatarFrame), characterAvatarFrame: structuredClone(a.characterAvatarFrame),
  };
}
export function captureChatCombination(a: ChatAppearance): Omit<ChatAppearancePreset, 'id' | 'name'> {
  return { ...captureChatPage(a), bubbleMode: a.bubbleMode, bubbleOverride: structuredClone(a.bubbleOverride) };
}
export function applyChatPage(a: ChatAppearance, page: Omit<ChatAppearancePreset, 'id' | 'name'>): ChatAppearance {
  return { ...a, ...captureChatPage({ ...DEFAULT_CHAT_APPEARANCE, ...page, themeCss: page.themeCss }) };
}
export function applyChatCombination(a: ChatAppearance, style: Omit<ChatAppearancePreset, 'id' | 'name'>): ChatAppearance {
  return { ...applyChatPage(a, style), bubbleMode: style.bubbleMode ?? 'follow', bubbleOverride: structuredClone(style.bubbleOverride) };
}
export function applyBubblePreset(a: ChatAppearance, preset: BubbleCssPreset): ChatAppearance {
  return { ...a, bubbleMode: 'custom', bubbleOverride: { ...DEFAULT_BUBBLE_STYLE, css: preset.css,
    userBubbleColor: preset.userBubbleColor ?? independentBubbles(a).userBubbleColor,
    characterBubbleColor: preset.characterBubbleColor ?? independentBubbles(a).characterBubbleColor,
    userBubbleOpacity: preset.userBubbleOpacity ?? 1, characterBubbleOpacity: preset.characterBubbleOpacity ?? 1 } };
}
export function resetChatAppearance(a: ChatAppearance, part: 'page' | 'bubbles' | 'all'): ChatAppearance {
  if (part === 'bubbles') return { ...a, bubbleMode: 'custom', bubbleOverride: { ...DEFAULT_BUBBLE_STYLE } };
  const page = applyChatPage(a, DEFAULT_CHAT_APPEARANCE);
  return part === 'page' ? page : { ...page, bubbleMode: 'follow', bubbleOverride: undefined };
}

/** Retain the old restrictions and order for existing styles until an independent bubble is chosen. */
function legacyCss(css: string, exclude: boolean) {
  if (css.length > 20000 || /@|url\s*\(|expression\s*\(|javascript\s*:/i.test(css)) throw new Error('旧版 CSS 最多 20000 字符，不支持 @ 规则或图片链接；可移入页面 CSS 使用。');
  return compileWeChatTheme(css, { root: '.yy-chat-surface', bubbles: exclude ? 'exclude' : undefined, animationPrefix: 'yy-wechat-legacy-' });
}
const rgba = (hex: string, alpha: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;
export function compileChatAppearance(a: ChatAppearance, dark = false): string {
  if (dark) return '';
  if (!isChatAppearance(a)) throw new Error('美化设置中的颜色、透明度或预设格式无效，请检查后再保存。');
  const independent = a.bubbleMode === 'custom';
  const page = [legacyCss(a.bubbleCss ?? '', independent), legacyCss(a.layoutCss ?? '', independent), compileWeChatTheme(a.themeCss ?? '', { bubbles: independent ? 'exclude' : undefined })];
  if (!independent) return page.join('\n');
  const b = independentBubbles(a);
  if (!isBubbleStyle(b)) throw new Error('气泡颜色或透明度无效。');
  const base = `
    :where(.yy-chat-message-bubble.is-plain) {
      --yy-user-bubble-color: ${rgba(b.userBubbleColor, b.userBubbleOpacity)};
      --yy-character-bubble-color: ${rgba(b.characterBubbleColor, b.characterBubbleOpacity)};
      position: relative; background: var(--yy-character-bubble-color); color: #111; padding: 8px 12px;
      border: none; border-radius: 4px; box-shadow: none; font-size: calc(16px * var(--font-scale, 1)); line-height: 1.5;
    }
    :where(.yy-chat-message-bubble.is-user.is-plain) { background: var(--yy-user-bubble-color); }
    :where(.yy-chat-message-bubble.is-plain)::before { all: unset; content: ''; position: absolute; top: 14px; left: -5px; width: 10px; height: 10px; background: inherit; border-radius: 1px; transform: rotate(45deg); }
    :where(.yy-chat-message-bubble.is-user.is-plain)::before { left: auto; right: -5px; }
    :where(.yy-chat-message-bubble.is-plain)::after { all: unset; content: none; }
  `;
  return [...page, compileWeChatTheme(base, { bubbles: 'only' }), compileWeChatTheme(b.css, { bubbles: 'only', animationPrefix: 'yy-wechat-bubble-' })].join('\n');
}

export type AppearancePart = 'page' | 'bubbles' | 'all';
export function exportChatAppearance(a: ChatAppearance, part: AppearancePart) {
  if (part === 'bubbles') {
    if (a.bubbleMode !== 'custom') throw new Error('请先选择独立气泡，再导出气泡预设。');
    const bubbleStyle = independentBubbles(a); return { format: 'yyphone-chat-bubble-css', version: 1, bubbleCss: bubbleStyle.css, bubbleStyle };
  }
  return { format: part === 'page' ? 'yyphone-chat-page' : 'yyphone-chat-appearance', version: 1,
    style: part === 'page' ? captureChatPage(a) : captureChatCombination(a) };
}
export function importChatAppearance(a: ChatAppearance, raw: unknown, part: AppearancePart): ChatAppearance {
  if (!record(raw) || raw.version !== 1) throw new Error('美化文件格式不正确。');
  let next: ChatAppearance;
  if (part === 'bubbles') {
    if (raw.format !== 'yyphone-chat-bubble-css' || typeof raw.bubbleCss !== 'string' || (raw.bubbleStyle !== undefined && !isBubbleStyle(raw.bubbleStyle))) throw new Error('气泡预设文件无效。');
    next = raw.bubbleStyle ? { ...a, bubbleMode: 'custom', bubbleOverride: structuredClone(raw.bubbleStyle as BubbleStyle) } : applyBubblePreset(a, { id: '', name: '', css: raw.bubbleCss });
  } else {
    if (raw.format !== (part === 'page' ? 'yyphone-chat-page' : 'yyphone-chat-appearance') || !record(raw.style) || !pageFieldsValid(raw.style)) throw new Error('页面或整套美化文件无效。');
    next = part === 'page' ? applyChatPage(a, raw.style as unknown as ChatAppearancePreset) : applyChatCombination(a, raw.style as unknown as ChatAppearancePreset);
  }
  compileChatAppearance(next);
  return next;
}
