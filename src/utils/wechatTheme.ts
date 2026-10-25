export const WECHAT_THEME_CSS_LIMIT = 60000;

// This is the editable light-theme template, not a screenshot or placeholder.
export const DEFAULT_WECHAT_THEME_CSS = `/* 微信完整聊天主题 · 默认浅色样式
 * 可以把本框全部复制给 AI，描述想要的风格，再把修改后的 CSS 粘贴回来。
 * 只修改布局和样式，不新增按钮，不更改按钮功能。
 * 深色模式会停用整段主题，统一使用系统深色样式。
 * .is-user = 我的消息；.is-character = 对方消息。
 * 支持图片 url(...)、::before / ::after 装饰、@media、@supports、@keyframes。
 * 所有选择器自动限制在微信聊天页面内，不影响其他 App 和美化编辑页。
 */

/* 01 整个聊天页面：背景、字体、通用文字颜色 */
.wechat-app {
  --yy-theme-background: #ededed;
  /* 如需统一修改头像大小，取消下一行注释： */
  /* --yy-theme-avatar-size: 44px; */
  background-color: var(--yy-theme-background);
  color: #111;
  /* font-family: "PingFang SC", "Microsoft YaHei", sans-serif; */
}

/* 02 顶部标题栏：保留手机顶部安全区；可增加背景图或伪元素装饰 */
.yy-wechat-header {
  background: var(--yy-theme-background);
  color: #181818;
  border-bottom: 1px solid #dedede;
  box-shadow: none;
  backdrop-filter: none;
}
.yy-wechat-header .yy-header-title { color: inherit; font-size: calc(17px * var(--font-scale, 1)); font-weight: 600; }
.yy-wechat-header .yy-header-back,
.yy-wechat-header .yy-header-action button { color: inherit; }
/* .yy-header-back = 返回；.yy-header-action = 右侧设置按钮。仅改变外观和位置。 */

/* 03 消息滚动区域：背景图片可以直接填在这里 */
.yy-chat-surface { background-color: var(--yy-theme-background); }
.yy-chat-history {
  background-color: var(--yy-theme-background);
  /* background-image: url("你的图片链接"); */
  background-size: cover;
  background-position: center;
  padding: 16px 12px;
}
.yy-chat-timestamp { color: #999; font-size: calc(10px * var(--font-scale, 1)); text-align: center; }

/* 04 消息排列与头像：行间距在 .yy-chat-history > * + * 中调整 */
.yy-chat-history > * + * { margin-top: 20px; }
.yy-chat-message-row { gap: 12px; align-items: flex-start; }
.yy-chat-avatar { width: var(--yy-chat-avatar-size, 40px); height: var(--yy-chat-avatar-size, 40px); border-radius: 4px; }
.yy-chat-message-content {
  /* 为对侧头像留出位置，长消息自动换行 */
  max-width: calc(100% - var(--yy-chat-avatar-size, 40px) - var(--yy-chat-avatar-size, 40px) - 24px);
}

/* 05 普通文字气泡：颜色变量与下方原有颜色设置联动，也可直接改成颜色值 */
.yy-chat-message-bubble.is-plain {
  border-radius: 4px;
  padding: 8px 12px;
  color: #111;
  font-size: calc(16px * var(--font-scale, 1));
  line-height: 1.5;
  border: none;
  box-shadow: none;
  overflow-wrap: anywhere;
}
.yy-chat-message-bubble.is-user.is-plain { background: var(--yy-user-bubble-color, #95ec69); }
.yy-chat-message-bubble.is-character.is-plain { background: var(--yy-character-bubble-color, #fff); }

/* 06 气泡尖角：改成 display: none 可以去掉；也可用于像素气泡等装饰 */
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

/* 07 图片、表情包、语音：图片与表情包没有文字气泡底色 */
.yy-chat-message-bubble.is-media { padding: 0; background: transparent; }
.yy-chat-voice-message { color: inherit; }
.yy-chat-voice-duration { font-size: calc(12px * var(--font-scale, 1)); }

/* 08 红包与转账：原卡片和回执共用；只更换样式，不影响资金和领取状态 */
.yy-chat-message-bubble.is-payment { width: 244px; max-width: 100%; padding: 0; }
.yy-chat-payment-card { --payment-color: #fa9d3b; background: var(--payment-color); color: #fff; border-radius: 4px; }
.yy-chat-payment-card.is-settled { --payment-color: #f5c795; }
.yy-chat-payment-main { padding: 12px; gap: 10px; min-height: 76px; }
.yy-chat-payment-icon { width: 40px; height: 44px; }
.yy-chat-payment-title { font-size: calc(16px * var(--font-scale, 1)); }
.yy-chat-payment-title.is-amount { font-size: calc(19px * var(--font-scale, 1)); }
.yy-chat-payment-status { font-size: calc(12px * var(--font-scale, 1)); }
.yy-chat-payment-footer { border-top: 1px solid #ffffff26; padding: 4px 10px; font-size: calc(10px * var(--font-scale, 1)); }
.yy-chat-payment-notice { color: #999; font-size: calc(12px * var(--font-scale, 1)); }

/* 09 底部输入栏：固定三个按钮 + 一个输入框；可移动位置或替换外观 */
.yy-chat-composer { background: #f7f7f7; color: #191919; border-top: 1px solid #dcdcdc; padding: 8px; gap: 8px; }
/* 底部安全区与输入栏共用背景；不再单独铺白条。
   --wechat-composer-bottom-padding：基础底边距；--wechat-chat-safe-bottom：额外安全区高度。 */
.yy-chat-composer { padding-bottom: calc(var(--wechat-composer-bottom-padding, 8px) + var(--wechat-chat-safe-bottom, min(env(safe-area-inset-bottom, 0px), 12px))); }
.yy-chat-attachments { order: 0; } /* 加号：展开原有功能菜单 */
.yy-chat-input { order: 1; background: #fff; color: #111; border-radius: 5px; border: none; padding: 8px 12px; font-size: calc(16px * var(--font-scale, 1)); }
.yy-chat-emoji { order: 2; } /* 表情按钮 */
.yy-chat-generate,
.yy-chat-send { order: 3; background: transparent; color: inherit; } /* 空白时爱心生成，有字时飞机发送 */
/* 替换图标示例（取消注释，并填写图片链接，按钮功能不会改变）：
.yy-chat-generate { background: url("爱心图片链接") center / 24px 24px no-repeat; }
.yy-chat-generate > svg, .yy-chat-generate > img { opacity: 0; }
*/

/* 10 加号功能菜单、表情面板与弹窗 */
.yy-chat-attachment-panel,
.yy-chat-emoji-panel { background: #f7f7f7; border-color: #dedede; }
.yy-chat-attachment-icon { background: #fff; color: #555; border-radius: 12px; box-shadow: none; }
/* [role="dialog"] = 聊天中的原有弹窗；不要用 CSS 伪造新增功能按钮。 */

/* 11 窄屏适配示例：可以按需要添加响应式布局 */
@media (max-width: 360px) {
  .yy-chat-composer { gap: 6px; }
}
`;

const ROOT = '.wechat-app.wechat-chat-open[data-wechat-theme="light"]';

function splitSelectors(source: string): string[] {
  const result: string[] = [];
  let current = '', quote = '', depth = 0, escaped = false;
  for (const char of source) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === '\\') { current += char; escaped = true; continue; }
    if (quote) { current += char; if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    if (char === '(' || char === '[') depth++;
    if (char === ')' || char === ']') depth--;
    if (char === ',' && depth === 0) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

export function compileWeChatTheme(css: string): string {
  if (css.length > WECHAT_THEME_CSS_LIMIT) throw new Error(`完整主题 CSS 最多支持 ${WECHAT_THEME_CSS_LIMIT} 个字符。`);
  if (!css.trim()) return '';
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const animations = new Map<string, string>();
  const collect = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSKeyframesRule) animations.set(rule.name, `yy-wechat-theme-${rule.name}`);
      else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) collect(rule.cssRules);
    }
  };
  collect(sheet.cssRules);
  const declarations = (style: CSSStyleDeclaration) => {
    let result = '';
    for (const property of Array.from(style)) {
      let value = style.getPropertyValue(property);
      if (/expression\s*\(|(?:javascript|vbscript)\s*:/i.test(value)) throw new Error('主题只支持 CSS 样式。');
      if (/^(?:-webkit-)?animation(?:-name)?$/.test(property)) {
        value = value.replace(/[a-zA-Z_][\w-]*/g, name => animations.get(name) ?? name);
      }
      result += `${property}: ${value}${style.getPropertyPriority(property) ? ' !important' : ''};`;
    }
    return result;
  };
  const compile = (rules: CSSRuleList): string => Array.from(rules).map(rule => {
    if (rule instanceof CSSStyleRule) {
      if (rule.cssRules.length) throw new Error('请使用平铺的 CSS 选择器，嵌套适配请使用 @media 或 @supports。');
      const selectors = splitSelectors(rule.selectorText).map(selector => {
        // Root aliases target the app itself; a leading sibling cannot escape it.
        const rootMatch = /^(?:\.wechat-app|:root|html|body)(?=[\s.#[:>+~]|$)/.exec(selector);
        if (!rootMatch) {
          if (/^[+~]/.test(selector.trimStart())) throw new Error('主题只能修改微信页面内部的元素。');
          return `${ROOT} ${selector}`;
        }
        const remainder = rootMatch ? selector.slice(rootMatch[0].length) : selector;
        let depth = 0, quote = '', escaped = false;
        for (let index = 0; index < remainder.length; index++) {
          const char = remainder[index];
          if (escaped) { escaped = false; continue; }
          if (char === '\\') { escaped = true; continue; }
          if (quote) { if (char === quote) quote = ''; continue; }
          if (char === '"' || char === "'") quote = char;
          if (char === '(' || char === '[') depth++;
          if (char === ')' || char === ']') depth--;
          if (!depth && !quote && /[\s>+~]/.test(char)) {
            if (/^[+~]/.test(remainder.slice(index).trimStart())) throw new Error('主题只能修改微信页面内部的元素。');
            break;
          }
        }
        return rootMatch ? `${ROOT}${remainder}` : `${ROOT} ${selector}`;
      });
      return `${selectors.join(', ')} { ${declarations(rule.style)} }`;
    }
    if (rule instanceof CSSMediaRule) return `@media ${rule.conditionText} { ${compile(rule.cssRules)} }`;
    if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText} { ${compile(rule.cssRules)} }`;
    if (rule instanceof CSSKeyframesRule) {
      if (!/^[a-zA-Z_][\w-]*$/.test(rule.name)) throw new Error('动画名称请使用英文字母、数字、下划线或短横线。');
      return `@keyframes ${animations.get(rule.name)} { ${Array.from(rule.cssRules).map(frame => `${(frame as CSSKeyframeRule).keyText} { ${declarations((frame as CSSKeyframeRule).style)} }`).join('\n')} }`;
    }
    throw new Error('完整主题支持普通 CSS、@media、@supports 和 @keyframes；字体可使用已有字体，图片可使用 url()。');
  }).join('\n');
  const compiled = compile(sheet.cssRules);
  if (!compiled.trim()) throw new Error('没有找到有效的 CSS 样式，请检查代码。');
  return compiled;
}
