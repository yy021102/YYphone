import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conversationAppearance, chatBackground } from './chatOverrides';
import { applyBubblePreset, applyChatCombination, applyChatPage, captureChatCombination, captureChatPage, compileChatAppearance, DEFAULT_BUBBLE_STYLE, DEFAULT_CHAT_APPEARANCE, exportChatAppearance, independentBubbles, isChatAppearance, resetChatAppearance, type ChatAppearance } from './chatAppearance';

const appearance = (): ChatAppearance => ({ ...structuredClone(DEFAULT_CHAT_APPEARANCE), backgroundUrl: 'https://example.invalid/garden.jpg',
  themeCss: '.yy-chat-history{background:pink}.yy-chat-message-bubble{border-radius:30px}',
  userAvatarFrame: { enabled: true, color1: '#123456', color2: '#abcdef', width: 2, angle: 90 },
  bubbleMode: 'custom', bubbleOverride: { ...DEFAULT_BUBBLE_STYLE, css: '.yy-chat-message-bubble{border-radius:12px}', userBubbleColor: '#abcdef', userBubbleOpacity: .5 },
  pagePresets: [{ id: 'page', name: '页面收藏', backgroundUrl: 'page.jpg' }], bubblePresets: [{ id: 'bubble', name: '气泡收藏', css: 'div{color:red}' }], presets: [{ id: 'set', name: '整套收藏', backgroundUrl: 'set.jpg' }],
});

test('conversation presets follow global by default; page snapshots keep independent bubbles and never mutate libraries', () => {
  const global = appearance(), before = structuredClone(global);
  assert.equal(conversationAppearance(global), global);
  const selected = { scope: 'page' as const, preset: structuredClone(global.pagePresets![0]) };
  assert.equal(conversationAppearance(global, { appearancePreset: selected }), global);
  const chat = { customAppearanceEnabled: true, appearancePreset: selected };
  assert.equal(conversationAppearance(global, chat).backgroundUrl, 'page.jpg');
  assert.deepEqual(conversationAppearance(global, chat).bubbleOverride, global.bubbleOverride);
  global.pagePresets![0].backgroundUrl = 'edited.jpg';
  const next = conversationAppearance(global, chat);
  assert.equal(next.backgroundUrl, 'page.jpg', 'saved snapshots survive library edits');
  assert.equal(chatBackground({ backgroundUrl: 'private.jpg' }, next.backgroundUrl, false), 'private.jpg');
  assert.equal(chatBackground(chat, next.backgroundUrl, true), '');
  assert.equal(compileChatAppearance(next, true), '');
  assert.equal(conversationAppearance(global, { ...chat, customAppearanceEnabled: false }), global);
  assert.equal(before.backgroundUrl, global.backgroundUrl); assert.deepEqual(before.bubbleOverride, global.bubbleOverride);
});

test('conversation complete presets restore their own bubbles while other conversations still follow global', () => {
  const global = appearance();
  const next = conversationAppearance(global, { customAppearanceEnabled: true, appearancePreset: { scope: 'all', preset: { id: 'set', name: '单聊', ...captureChatCombination({ ...global, backgroundUrl: 'local.jpg', bubbleMode: 'follow', bubbleOverride: undefined }) } } });
  assert.equal(next.backgroundUrl, 'local.jpg'); assert.equal(next.bubbleMode, 'follow'); assert.equal(next.bubbleOverride, undefined);
  assert.equal(conversationAppearance(global, {}).backgroundUrl, global.backgroundUrl);
  assert.equal(global.bubbleMode, 'custom');
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

test('page, bubble and combination exports retain the matching preset name', () => {
  let a = appearance();
  a = { ...a, pagePresets: [{ id: 'page-a', name: 'a', ...captureChatPage(a) }], bubblePresets: [{ id: 'bubble-a', name: '气泡a', ...independentBubbles(a) }], presets: [{ id: 'all-a', name: '整套a', ...captureChatCombination(a) }] };
  for (const part of ['page', 'bubbles', 'all'] as const) {
    const expected = part === 'page' ? 'a' : part === 'bubbles' ? '气泡a' : '整套a';
    const file = JSON.parse(JSON.stringify(exportChatAppearance(a, part)));
    assert.equal(file.name, expected);
    assert.equal(file.version, 1);
  }
  const changed = { ...a, backgroundUrl: 'different.png' };
  assert.equal(exportChatAppearance(changed, 'page', 'page-a').name, undefined, 'changed style cannot borrow the selected preset name');
});
