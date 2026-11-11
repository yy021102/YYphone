import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { writeStoredValue } from './localStorage';
import { canRecallMessage, recallContext, recallMessage, recallTimeline, parseRecallActions, characterRecallInstructions, validChatRecall, type RecallMessage } from './chatRecall';
import { buildPrompt } from './buildPrompt';
import { readDirectMessages } from './journalData';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
beforeEach(async () => { values.clear(); await clearDbStorage(); });
const user: RecallMessage = { id: 'user-message', senderId: 'user', kind: 'text', text: 'WITHDRAWN_PRIVATE_SENTINEL', createdAt: '2026-11-12T12:00:00Z' };
const char: RecallMessage = { id: 'char-message', senderId: 'a', kind: 'text', text: 'CHAR_PRIVATE_SENTINEL', createdAt: '2026-11-12T12:01:00Z' };
function seed(messages: RecallMessage[], type = 'direct') {
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '甲', persona: '自然', worldBooks: [] }, { id: 'b', name: '乙', persona: '', worldBooks: [] }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'chat', type, participantIds: type === 'direct' ? ['a'] : ['a', 'b'], noteName: '', context: '', blocked: false, avatars: {}, messages }]);
}
test('withdrawal makes one persisted seen decision per member, retains a private snapshot and clears public payloads', () => {
  const message = { ...user, imageUrl: 'data:image/png;base64,SECRET', thought: 'PRIVATE_THOUGHT', replyTo: { id: 'q', text: 'QUOTE' } };
  let rolls = 0;
  const recalled = recallMessage(message, ['a', 'b'], [], () => ++rolls === 1 ? .1 : .9);
  assert.equal(rolls, 2); assert.equal(recalled.kind, 'recalled'); assert.equal(recalled.text, '');
  assert.deepEqual(recalled.recall?.seenBy, ['user', 'a']);
  assert.equal(recalled.recall?.original.text, user.text); assert.ok(validChatRecall(recalled.recall));
  assert.equal(recalled.imageUrl, undefined); assert.equal(recalled.thought, undefined); assert.equal(recalled.replyTo, undefined);
  const saved = JSON.parse(JSON.stringify(recalled));
  assert.match(recallContext(saved, ['a']), /WITHDRAWN_PRIVATE_SENTINEL/);
  assert.doesNotMatch(recallContext(saved, ['b']), /WITHDRAWN_PRIVATE_SENTINEL|SECRET|PRIVATE_THOUGHT/);
  assert.doesNotMatch(recallContext(saved, ['a', 'b']), /base64/);
  assert.match(recallContext(saved, ['a', 'b']), /这些角色没有看到：b/);
});
test('already delivered messages and actual subsequent replies are seen; authors always know their own withdrawal', () => {
  assert.ok(recallMessage({ ...user, aiSeenBy: ['a'] }, ['a'], [], () => .99).recall?.seenBy.includes('a'));
  assert.ok(recallMessage(user, ['a'], [char], () => .99).recall?.seenBy.includes('a'));
  const own = recallMessage(char, ['a'], [], () => .99);
  assert.match(recallContext(own, ['a']), /CHAR_PRIVATE_SENTINEL/);
});
test('unseen withdrawn input and quoted original are absent from real chat prompts and memory extraction', () => {
  const quoted = { ...user, id: 'quote', text: '稍后聊', replyTo: { id: user.id, text: user.text, senderName: '玩家' } };
  const messages = recallTimeline([user, quoted], new Set([user.id]), ['a'], () => .99);
  assert.equal((messages[1] as typeof quoted).replyTo.text, '[原消息已撤回]');
  seed(messages);
  assert.doesNotMatch(JSON.stringify(buildPrompt({ chatId: 'chat', timeAwarenessEnabled: false })), /WITHDRAWN_PRIVATE_SENTINEL/);
  assert.doesNotMatch(JSON.stringify(readDirectMessages('a')), /WITHDRAWN_PRIVATE_SENTINEL/);
  seed([recallMessage(user, ['a'], [], () => .99)]);
  const last = buildPrompt({ chatId: 'chat', currentInput: '', timeAwarenessEnabled: false }).at(-1)!.content;
  assert.match(last, /撤回了一条消息/); assert.doesNotMatch(last, /WITHDRAWN_PRIVATE_SENTINEL/);
  seed([recallMessage(user, ['a'], [], () => .1)]);
  assert.match(JSON.stringify(buildPrompt({ chatId: 'chat', currentInput: '' })), /WITHDRAWN_PRIVATE_SENTINEL/);
  assert.match(JSON.stringify(readDirectMessages('a')), /WITHDRAWN_PRIVATE_SENTINEL/);
});
test('character actions honor the switch, authorship and a bounded list; finance or state-changing cards cannot be recalled', () => {
  for (const kind of ['transfer', 'red-packet', 'couple-invite', 'order', 'context-note', 'intimate-pay']) assert.equal(canRecallMessage({ ...user, kind }), false);
  assert.deepEqual(parseRecallActions([{ messageId: char.id, speakerId: 'a' }], [char], true, ['a']), [char.id]);
  assert.deepEqual(parseRecallActions([], [char], false, ['a']), []);
  assert.throws(() => parseRecallActions([{ messageId: char.id, speakerId: 'a' }], [char], false, ['a']));
  assert.throws(() => parseRecallActions([{ messageId: user.id, speakerId: 'a' }], [user], true, ['a']));
  assert.throws(() => parseRecallActions([{ messageId: char.id, speakerId: 'b' }], [char], true, ['a', 'b']));
  const recalled = recallMessage(char, ['a']);
  assert.throws(() => parseRecallActions([{ messageId: char.id, speakerId: 'a' }], [recalled], true, ['a']));
  assert.match(characterRecallInstructions([char], true, ['a']), /recall:true/);
  assert.doesNotMatch(characterRecallInstructions([char], false, ['a']), /CHAR_PRIVATE_SENTINEL/);
});
