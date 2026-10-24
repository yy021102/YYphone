import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAdventureWorldBooks } from './adventureWorldBooks';

test('only bound world books enter the adventure prompt', () => {
  const books = [
    { id: 'a', name: '王国设定', entries: [{ title: '王室', content: '王冠要付代价' }] },
    { id: 'b', name: '无关设定', entries: [{ title: '别处', content: '不应注入' }] },
  ];
  const context = formatAdventureWorldBooks(['a', 'missing'], books);
  assert.match(context, /王冠要付代价/);
  assert.doesNotMatch(context, /不应注入/);
  assert.equal(formatAdventureWorldBooks([], books), '');
});
