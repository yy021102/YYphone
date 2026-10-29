import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatRangeMessageIds } from './chatHistory';

test('range deletion uses inclusive one-based chronological positions, excluding silent context and leaving originals intact', () => {
  const messages = Array.from({ length: 125 }, (_, index) => ({ id: `m-${index + 1}`, source: undefined as string | undefined }));
  messages.splice(0, 0, { id: 'silent-before', source: 'alias-experience' });
  messages.splice(50, 0, { id: 'silent-middle', source: 'alias-experience' });
  const ids = new Set(chatRangeMessageIds(messages, '1', '100'));
  assert.equal(ids.size, 100); assert(ids.has('m-1')); assert(ids.has('m-100')); assert(!ids.has('m-101')); assert(!ids.has('silent-before'));
  assert.equal(messages.length, 127);
  const remaining = messages.filter(message => !ids.has(message.id));
  assert.equal(remaining.length, 27); assert(remaining.some(message => message.id === 'silent-middle'));
  assert.deepEqual(chatRangeMessageIds(messages, '125', '125'), ['m-125']);
});

test('invalid ranges are rejected rather than silently expanding or clamping a destructive operation', () => {
  const messages = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  for (const [from, to] of [['', '2'], ['0', '1'], ['-1', '2'], ['2', '1'], ['1', '4'], ['1.1', '2'], ['1e0', '2'], ['Infinity', '2']]) {
    assert.throws(() => chatRangeMessageIds(messages, from, to), /起止条数/);
  }
  assert.throws(() => chatRangeMessageIds([], '1', '1'), /没有可删除/);
  assert.deepEqual(messages, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});
