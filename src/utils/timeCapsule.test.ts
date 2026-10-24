import assert from 'node:assert/strict';
import test from 'node:test';
import { daysUntil, shanghaiToday, tomorrowInShanghai } from './timeCapsule';

test('Shanghai date determines unlock across UTC boundary', () => {
  const beforeMidnight = new Date('2026-10-23T15:59:59Z');
  const afterMidnight = new Date('2026-10-23T16:00:00Z');
  assert.equal(shanghaiToday(beforeMidnight), '2026-10-23');
  assert.equal(shanghaiToday(afterMidnight), '2026-10-24');
  assert.equal(tomorrowInShanghai(beforeMidnight), '2026-10-24');
  assert.equal(tomorrowInShanghai(afterMidnight), '2026-10-25');
});

test('remaining days use calendar days, including month boundary', () => {
  assert.equal(daysUntil('2027-01-01', '2026-12-31'), 1);
  assert.equal(daysUntil('2026-10-24', '2026-10-24'), 0);
  assert.equal(daysUntil('2026-10-23', '2026-10-24'), 0);
});
