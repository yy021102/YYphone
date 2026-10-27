import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyBubblePreset, applyChatCombination, applyChatPage, captureChatCombination, captureChatPage, compileChatAppearance, DEFAULT_BUBBLE_STYLE, DEFAULT_CHAT_APPEARANCE, exportChatAppearance, independentBubbles, isChatAppearance, resetChatAppearance, type ChatAppearance } from './chatAppearance';

const appearance = (): ChatAppearance => ({ ...structuredClone(DEFAULT_CHAT_APPEARANCE), backgroundUrl: 'https://example.invalid/garden.jpg',
  themeCss: '.yy-chat-history{background:pink}.yy-chat-message-bubble{border-radius:30px}',
  userAvatarFrame: { enabled: true, color1: '#123456', color2: '#abcdef', width: 2, angle: 90 },
  bubbleMode: 'custom', bubbleOverride: { ...DEFAULT_BUBBLE_STYLE, css: '.yy-chat-message-bubble{border-radius:12px}', userBubbleColor: '#abcdef', userBubbleOpacity: .5 },
  pagePresets: [{ id: 'page', name: '页面收藏', backgroundUrl: 'page.jpg' }], bubblePresets: [{ id: 'bubble', name: '气泡收藏', css: 'div{color:red}' }], presets: [{ id: 'set', name: '整套收藏', backgroundUrl: 'set.jpg' }],
});
test('switching pages changes only the page and preserves the exact independent bubbles and libraries', () => {
  const a = appearance(), next = applyChatPage(a, { backgroundUrl: 'new.jpg', themeCss: '.yy-chat-history{background:blue}', userBubbleColor: '#555555' });
  assert.equal(next.backgroundUrl, 'new.jpg'); assert.deepEqual(next.bubbleOverride, a.bubbleOverride); assert.equal(next.bubbleMode, 'custom');
  assert.deepEqual(next.presets, a.presets); assert.deepEqual(next.pagePresets, a.pagePresets); assert.deepEqual(next.bubblePresets, a.bubblePresets);
  assert(!('bubbleOverride' in captureChatPage(a))); assert(!('bubbleMode' in captureChatPage(a)));
});
test('switching independent bubbles never replaces the page, icons, avatar frames or legacy layout', () => {
  const a = appearance(); a.layoutCss = '.yy-chat-composer{gap:9px}'; a.sendIconUrl = 'send.svg';
  const b = applyBubblePreset(a, { id: 'new', name: '新气泡', css: '.yy-chat-message-bubble{border:1px solid}', userBubbleColor: '#999999', characterBubbleColor: '#cccccc', userBubbleOpacity: .7, characterBubbleOpacity: .9 });
  assert.deepEqual(captureChatPage(b), captureChatPage(a)); assert.equal(b.bubbleOverride?.userBubbleColor, '#999999'); assert.equal(b.bubbleOverride?.userBubbleOpacity, .7);
  const copy = captureChatCombination(b); copy.bubbleOverride!.css = 'edited'; assert.notEqual(b.bubbleOverride?.css, copy.bubbleOverride?.css);
});
test('all three reset choices retain every saved preset and reset only their intended scope', () => {
  const a = appearance(), page = resetChatAppearance(a, 'page'), bubbles = resetChatAppearance(a, 'bubbles'), all = resetChatAppearance(a, 'all');
  assert.deepEqual(captureChatPage(page), captureChatPage(DEFAULT_CHAT_APPEARANCE)); assert.deepEqual(page.bubbleOverride, a.bubbleOverride); assert.equal(page.bubbleMode, 'custom');
  assert.deepEqual(captureChatPage(bubbles), captureChatPage(a)); assert.deepEqual(bubbles.bubbleOverride, DEFAULT_BUBBLE_STYLE);
  assert.deepEqual(captureChatPage(all), captureChatPage(DEFAULT_CHAT_APPEARANCE)); assert.equal(all.bubbleMode, 'follow'); assert.equal(all.bubbleOverride, undefined);
  for (const state of [page, bubbles, all]) { assert.deepEqual(state.presets, a.presets); assert.deepEqual(state.pagePresets, a.pagePresets); assert.deepEqual(state.bubblePresets, a.bubblePresets); }
});
test('complete combinations preserve the selected bubble mode, colors, opacity and both avatar frames', () => {
  const a = appearance(), style = captureChatCombination(a), other = { ...structuredClone(DEFAULT_CHAT_APPEARANCE), presets: a.presets };
  const restored = applyChatCombination(other, style); assert.deepEqual(captureChatCombination(restored), style); assert.deepEqual(restored.presets, other.presets);
  const old = applyChatCombination(a, { backgroundUrl: 'old.jpg', bubbleCss: '.yy-chat-message-bubble{color:red}' }); assert.equal(old.bubbleMode, 'follow'); assert.equal(old.bubbleOverride, undefined); assert.equal(old.backgroundUrl, 'old.jpg');
});
test('legacy appearances and CSS-only bubble presets remain readable without silently changing old styles', () => {
  const old = { backgroundUrl: '', userBubbleColor: '#123456', characterBubbleColor: '#ffffff', bubbleCss: '.yy-chat-message-bubble{border-radius:19px}', presets: [], bubblePresets: [{ id: 'old', name: '旧气泡', css: '.yy-chat-message-bubble{color:blue}' }] };
  assert(isChatAppearance(old)); const own = independentBubbles(old); assert.equal(own.css, old.bubbleCss); assert.equal(own.userBubbleColor, '#123456'); assert(!('bubbleOverride' in old));
  const next = applyBubblePreset(old, old.bubblePresets[0]); assert.equal(next.bubbleMode, 'custom'); assert.equal(next.bubbleOverride?.css, old.bubblePresets[0].css); assert.deepEqual(captureChatPage(next), captureChatPage(old));
});
test('separate exports contain only their intended styles, and full exports retain backwards-compatible format', () => {
  const a = appearance(), page = exportChatAppearance(a, 'page'), bubble = exportChatAppearance(a, 'bubbles'), all = exportChatAppearance(a, 'all');
  assert.equal(page.format, 'yyphone-chat-page'); assert(!('bubbleOverride' in page.style!));
  assert.equal(bubble.format, 'yyphone-chat-bubble-css'); assert.equal(bubble.bubbleStyle?.css, a.bubbleOverride?.css); assert(!('backgroundUrl' in bubble.bubbleStyle!));
  assert.equal(all.format, 'yyphone-chat-appearance'); assert.equal(all.version, 1); assert.deepEqual(all.style?.userAvatarFrame, a.userAvatarFrame); assert.deepEqual(all.style?.bubbleOverride, a.bubbleOverride);
  assert.throws(() => exportChatAppearance({ ...a, bubbleMode: 'follow' }, 'bubbles'), /独立气泡/);
});
test('invalid new settings are rejected and dark mode completely disables all custom code', () => {
  const a = appearance(); assert(isChatAppearance(a)); assert(!isChatAppearance({ ...a, bubbleMode: 'bad' }));
  assert(!isChatAppearance({ ...a, bubbleOverride: { ...a.bubbleOverride, userBubbleOpacity: NaN } })); assert(!isChatAppearance({ ...a, bubbleOverride: { ...a.bubbleOverride, userBubbleColor: 'red;}' } }));
  assert.throws(() => compileChatAppearance({ ...a, bubbleMode: 'follow', bubbleOverride: { ...a.bubbleOverride!, userBubbleColor: '#bad' } }), /设置/);
  assert.equal(compileChatAppearance(a, true), '');
});
