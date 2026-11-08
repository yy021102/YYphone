import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REGEX_EXAMPLE, REGEX_EXAMPLE_TEXT, regexExpression, renderChatRegex, validateChatRegex, type ChatRegexRule } from './chatRegex';
const rule = (patch: Partial<ChatRegexRule> = {}): ChatRegexRule => ({ ...REGEX_EXAMPLE, id: 'one', enabled: true, ...patch });
const settings = (rules = [rule()]) => ({ enabled: true, rules });
test('HTML rendering fills capture groups, preserves unmatched content, and leaves original text untouched', () => {
  const input = `前文\n${REGEX_EXAMPLE_TEXT}\n后文`;
  const result = renderChatRegex(input, 'character', settings());
  assert.match(result!.html, /<section/);
  assert.match(result!.html, /写给今天的你/);
  assert.match(result!.html, /<br>/);
  assert.match(result!.html, /前文\n/);
  assert.match(result!.html, /后文/);
  assert.match(input, /\[信件\]/);
  assert.equal(renderChatRegex(input, 'user', settings()), null);
  assert.equal(renderChatRegex(input, 'character', { ...settings(), enabled: false }), null);
  assert.equal(renderChatRegex('普通消息', 'character', settings()), null);
});
test('captured HTML and quotes are text, not executable markup; named groups and literal dollar work', () => {
  const result = renderChatRegex('[卡]<img src=x onerror=alert(1)>"[/卡]', 'user', settings([rule({ target: 'both', pattern: '\\[卡\\](?<body>.*?)\\[/卡\\]', replacement: '<div>$<body> / $$ / $1 / $&</div>' })]));
  assert.match(result!.html, /&lt;img/);
  assert.match(result!.html, /&quot;/);
  assert.doesNotMatch(result!.html, /<img/);
  assert.match(result!.html, / \/ \$ \/ /);
});
test('priority, global replacements, disabled rules and zero-width Unicode matches are bounded', () => {
  assert.match(renderChatRegex('a a', 'character', settings([rule({ pattern: 'a', replacement: '<b>第一</b>' }), rule({ pattern: 'a', replacement: '第二' })]))!.html, /第一/);
  assert.doesNotMatch(renderChatRegex('a a', 'character', settings([rule({ pattern: 'a', replacement: '第一' }), rule({ pattern: 'a', replacement: '第二' })]))!.html, /第二/);
  assert.equal((renderChatRegex('a a', 'character', settings([rule({ pattern: '/a/g', replacement: '命中' })]))!.html.match(/命中/g) ?? []).length, 2);
  assert.equal(renderChatRegex('a', 'character', settings([rule({ pattern: 'a', enabled: false })])), null);
  assert.equal((renderChatRegex('😀', 'character', settings([rule({ pattern: '(?=)', flags: 'gu', replacement: '.' })]))!.html.match(/\./g) ?? []).length, 2);
  assert.throws(() => renderChatRegex('a'.repeat(100), 'character', settings([rule({ pattern: 'a' })])), /次数过多/);
  assert.equal(renderChatRegex('a'.repeat(20001), 'character', settings()), null);
});
test('invalid imports and expressions fail before saving; export configuration round-trips', () => {
  assert.deepEqual(validateChatRegex(JSON.parse(JSON.stringify(settings()))), settings());
  assert.throws(() => regexExpression('(', 'g'), /格式无效/);
  assert.throws(() => regexExpression('a', 'gg'), /不能重复/);
  assert.throws(() => validateChatRegex(settings([rule(), rule()])), /不完整/);
  assert.throws(() => validateChatRegex(settings([rule({ replacement: 'x'.repeat(40001) })])), /不完整/);
  assert.equal(renderChatRegex(REGEX_EXAMPLE_TEXT, 'character', settings())?.interactive, false);
  const interactive = settings([rule({ interactive: true })]);
  assert.deepEqual(validateChatRegex(JSON.parse(JSON.stringify(interactive))), interactive);
  assert.equal(renderChatRegex(REGEX_EXAMPLE_TEXT, 'character', interactive)?.interactive, true);
  assert.throws(() => validateChatRegex(settings([rule({ interactive: 'true' as unknown as boolean })])), /交互开关/);
});
