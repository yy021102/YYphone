import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCallReplyParts, type CallReplyPart } from './callReply';
import { messageTranslation } from './chatLanguage';

const parts: CallReplyPart[] = [
  { kind: 'text', text: 'Hello!', chatTranslation: { language: 'en', text: '你好！', sourceText: 'Hello!' } },
  { kind: 'narration', text: '他轻轻挥了挥手。' },
  { kind: 'voice', text: 'Can you hear me?', chatTranslation: { language: 'en', text: '能听见我吗？', sourceText: 'Can you hear me?' } },
];

test('foreign calls combine original speech and paired translations without speaking video narration', () => {
  for (const mode of ['voice', 'video'] as const) {
    const result = normalizeCallReplyParts(parts, mode, 'en');
    assert.equal(result[0].text, 'Hello! Can you hear me?');
    assert.deepEqual(messageTranslation(result[0]), {
      language: 'en', text: '你好！ 能听见我吗？', sourceText: 'Hello! Can you hear me?',
    });
    assert.equal(result.length, mode === 'video' ? 2 : 1);
    if (mode === 'video') assert.deepEqual(result[1], { kind: 'narration', text: '他轻轻挥了挥手。' });
    assert.equal(result[0].text.includes('他轻轻'), false);
  }
});

test('call translation pairing keeps unpunctuated foreign speech unchanged and supports Cantonese and Arabic', () => {
  for (const [language, text] of [['en', 'Hello'], ['yue', '你食咗飯未'], ['ar', 'مرحبا']] as const) {
    const result = normalizeCallReplyParts([{ text, chatTranslation: { language, text: '你好', sourceText: text } }], 'voice', language);
    assert.equal(result[0].text, text);
    assert.equal(messageTranslation(result[0])?.sourceText, text);
  }
  assert.equal(normalizeCallReplyParts(parts, 'voice')[0].chatTranslation?.language, 'en');
});

test('missing, stale and mixed-language translations are explicit errors, never silently dropped', () => {
  for (const bad of [
    { text: 'Hello' },
    { text: 'Hello', chatTranslation: { language: 'en' as const, text: '你好', sourceText: 'Old text' } },
    { text: 'Hello', chatTranslation: { language: 'ja' as const, text: '你好', sourceText: 'Hello' } },
  ]) assert.throws(() => normalizeCallReplyParts([bad], 'video', 'en'), /完整译文/);
  assert.throws(() => normalizeCallReplyParts([...parts, { text: 'Untranslated fragment' }], 'voice'), /完整译文/);
});

test('punctuation-only call lines need no translation and can accompany translated speech', () => {
  assert.deepEqual(normalizeCallReplyParts([{ text: '？' }], 'voice', 'en'), [{ text: '？', kind: 'text' }]);
  const result = normalizeCallReplyParts([parts[0], { text: '❤️' }], 'voice', 'en');
  assert.equal(result[0].chatTranslation?.text, '你好！ ❤️');
  assert.equal(result[0].chatTranslation?.sourceText, 'Hello! ❤️');
});

test('overlong translated call text is not truncated into a mismatched original and translation', () => {
  const text = 'A'.repeat(4001);
  assert.throws(() => normalizeCallReplyParts([{ text, chatTranslation: { language: 'en', text: '中文译文', sourceText: text } }], 'voice', 'en'), /台词过长/);
});

test('Chinese calls retain sentence completion and independent narration without requiring translation', () => {
  assert.deepEqual(normalizeCallReplyParts([{ text: '听见了吗' }, { kind: 'narration', text: '他看向屏幕' }], 'video'), [
    { text: '听见了吗。', kind: 'text' }, { text: '他看向屏幕', kind: 'narration' },
  ]);
});
