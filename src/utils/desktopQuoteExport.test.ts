import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findQuotedMessage, readMessageQuote } from './messageQuote';
import { isDesktopAppearance, isHomeAppearance, portableHomeBeauty } from './homeAppearance';
import { buildCharacterExport } from './characterExport';
import type { BeautySettings } from '../types';

test('quotes survive object fields, line breaks, punctuation and older messages without inventing references', () => {
  const original = { id: 'old', senderId: 'user', text: '今天下雨了\n记得带伞。' };
  const messages = [original, ...Array.from({ length: 60 }, (_, i) => ({ id: String(i), senderId: 'char', text: `新消息${i}` }))];
  for (const part of [{ quote: original.text }, { replyTo: { text: original.text } }, { quoteText: '今天下雨了 记得带伞' }, { quote: { messageId: 'old' } }]) {
    assert.equal(findQuotedMessage(messages, readMessageQuote(part)), original);
  }
  assert.equal(findQuotedMessage(messages, '不存在的消息'), undefined);
  assert.equal(findQuotedMessage([{ id: 'secret', senderId: 'user', kind: 'context-note', text: '隐藏上下文记录' }], '隐藏上下文记录'), undefined);
  assert.equal(findQuotedMessage([{ ...original, text: '记得，带伞' }, { ...original, id: 'other', text: '记得。带伞' }], '记得带伞'), undefined);
});

test('portable home themes omit personal avatar, remain valid, and leave the original untouched', () => {
  const widget = { background: '', disc: '', note: '' };
  const settings: BeautySettings = { themeId: 'test', wallpaperId: 'test', wallpapers: { lockScreen: '', homeScreen: '' }, appIcons: {}, desktopAppearance: { textColor: '#123456', iconOpacity: 0, panelOpacity: .2 }, homeAppearance: { calendar: widget, music: widget, profile: { avatarUrl: 'private-avatar', coverImageUrl: 'cover', avatarFrameEnabled: false } } };
  const portable = JSON.parse(JSON.stringify(portableHomeBeauty(settings)));
  assert.equal('avatarUrl' in portable.homeAppearance.profile, false);
  assert.equal(isHomeAppearance(portable.homeAppearance), true);
  assert.equal(settings.homeAppearance?.profile.avatarUrl, 'private-avatar');
  assert.deepEqual(portable.desktopAppearance, settings.desktopAppearance);
  assert.equal(isDesktopAppearance(portable.desktopAppearance), true);
  assert.equal(isDesktopAppearance({ iconOpacity: 1.1 }), false);
  assert.equal(isDesktopAppearance({ textColor: 'url(evil)' }), false);
});

test('voice exclusion removes all voice configuration without altering character or world books', () => {
  const char = { id: 'a', name: '角色', avatarUrl: 'avatar', persona: '人设', group: '', starred: false, worldBooks: [], voiceEnabled: true, voiceId: 'private-voice', voiceLanguage: 'zh' };
  const exported = buildCharacterExport(char, [], [], { includeVoice: false }).contacts[0];
  for (const key of ['voiceEnabled', 'voiceId', 'voiceLanguage']) assert.equal(key in exported, false);
  assert.equal(exported.persona, char.persona);
  assert.equal(buildCharacterExport(char, [], [], { includeVoice: true }).contacts[0].voiceId, 'private-voice');
  assert.equal(char.voiceId, 'private-voice');
});
