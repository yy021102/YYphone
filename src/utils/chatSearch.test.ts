import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordOccurrences, searchChatHistory, searchExcerpt, type SearchConversation } from './chatSearch';

const message = (id: string, text: string, patch = {}) => ({ id, text, createdAt: '2026-11-12T08:00:00Z', senderId: 'a', ...patch });
const conversation = (id: string, messages: ReturnType<typeof message>[], title = id): SearchConversation => ({ id, targetId: id, type: 'chat', title, messages });

test('search separates matching messages from keyword occurrences per conversation', () => {
  const results = searchChatHistory([
    conversation('a', [message('1', '宝宝宝宝'), message('2', '宝宝今天开心吗'), message('3', '无关')]),
    conversation('b', [message('4', '宝宝你好')]),
  ], '宝宝');
  assert.deepEqual(results.map(result => [result.conversation.id, result.hits.length, result.occurrences]), [['a', 2, 3], ['b', 1, 1]]);
  assert.deepEqual(results[0].hits.map(hit => hit.message.id), ['2', '1']);
});

test('keywords are literal, case insensitive and whitespace trimmed, with no regular expression execution', () => {
  assert.equal(keywordOccurrences('Hello HELLO hello', ' hello '), 3);
  assert.equal(keywordOccurrences('[a.*] [a.*]', '[a.*]'), 2);
  assert.equal(keywordOccurrences('宝宝宝宝', '宝宝'), 2);
  assert.equal(keywordOccurrences('anything', ' '), 0);
  assert.equal(searchChatHistory([conversation('a', [message('1', 'other')], '宝宝的群聊')], '宝宝')[0].hits.length, 0);
  assert.deepEqual(searchChatHistory([], '宝宝'), []);
});

test('hidden context, recalled originals and thoughts never become searchable speech', () => {
  const messages = [
    message('context', '宝宝静默记忆', { kind: 'context-note' }),
    message('alias', '宝宝小号同步', { source: 'alias-experience' }),
    message('proxy', '宝宝反查动作', { source: 'phone-proxy-send' }),
    message('inspection', '宝宝反查手机', { source: 'phone-inspection' }),
    message('recall', '宝宝', { kind: 'recalled', recall: { original: { text: '宝宝' } } }),
    message('thought', '你好', { thought: '宝宝' }),
    message('pat', '宝宝', { kind: 'pat' }),
    message('visible', '宝宝', { kind: 'voice' }),
  ];
  const result = searchChatHistory([conversation('a', messages)], '宝宝')[0];
  assert.deepEqual(result.hits.map(hit => hit.message.id), ['visible']);
  assert.equal(result.occurrences, 1);
});

test('search covers older local history and previews include the first match without changing stored messages', () => {
  const messages = Array.from({ length: 300 }, (_, index) => message(String(index), index === 0 ? `${'前文'.repeat(80)}宝宝${'后文'.repeat(80)}` : '其他消息'));
  const before = JSON.stringify(messages);
  const result = searchChatHistory([conversation('a', messages)], '宝宝')[0];
  assert.equal(result.hits[0].message.id, '0');
  const excerpt = searchExcerpt(result.hits[0].message.text, '宝宝');
  assert.match(excerpt, /^….*宝宝.*…$/);
  assert.ok(excerpt.length < 150);
  assert.equal(JSON.stringify(messages), before);
});
