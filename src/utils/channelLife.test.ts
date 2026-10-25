import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendChannelReply, channelFeedPeople, channelItems, channelPublicContext, channelReply, hasChannelUnread, isChannelData, parseChannelBatch, type ChannelData, type ChannelItem } from './channelLife';
const item = (id: string, authorId = 'a', extra: Partial<ChannelItem> = {}): ChannelItem => ({ id, author: { id: authorId, name: authorId }, text: `${id}的一天`, time: 100, replies: [], ...extra });
const empty = (): ChannelData => ({ posts: [], rooms: [], messages: [], following: [] });

test('old Channels data and live gifts remain valid without new metadata', () => {
  const data = empty(); data.posts.push(item('p')); data.rooms.push(item('r', 'a', { live: { viewers: 3, hearts: 2, gifts: [{ id: 'g', senderId: 'b', senderName: 'B', giftId: 'flower', createdAt: 3, amount: 1 }] } }));
  assert(isChannelData(data));
  assert(!hasChannelUnread(item('legacy-thread')));
  assert(isChannelData({ ...data, saved: ['p'], messages: [item('m', 'a', { lastIncomingAt: 200, readAt: 0, replies: ['我：你好'], ownReplyIndices: [0] })] }));
  assert(!isChannelData({ ...data, messages: [item('bad', 'a', { lastIncomingAt: NaN })] }));
});

test('feed generation always has five distinct authors, even with zero or duplicate contacts', () => {
  for (const count of [0, 1, 2, 5, 20]) {
    const contacts = Array.from({ length: count }, (_, index) => ({ id: `c${index}`, name: `角色${index}` }));
    const before = structuredClone(contacts);
    const people = channelFeedPeople([...contacts, ...contacts, { id: 'self', name: '我' }]);
    assert.equal(people.length, 5); assert.equal(new Set(people.map((person) => person.id)).size, 5);
    assert(people.every((person) => person.id !== 'self'));
    assert.deepEqual(contacts, before);
    assert(people.filter((person) => person.id.startsWith('stranger:')).length >= 2);
  }
});

test('comments preserve publication time and unread metadata; private replies update activity/read status', () => {
  const original = item('p', 'a', { time: 10 }); const me = { id: 'self', name: '旧昵称' }; const other = { id: 'a', name: '林渡' };
  const comment = appendChannelReply(original, me, '有趣！', { now: 1000, own: true });
  assert.equal(comment.time, 10); assert.deepEqual(comment.ownReplyIndices, [0]); assert.equal(comment.lastIncomingAt, undefined);
  const inbound = appendChannelReply(comment, other, '说个新鲜事', { now: 2000, thread: true });
  assert(hasChannelUnread(inbound)); assert.equal(inbound.time, 2000); assert.equal(original.replies.length, 0);
  const read = { ...inbound, readAt: 2000 }; assert(!hasChannelUnread(read));
  const second = appendChannelReply(read, other, '你觉得呢？', { now: 3000, thread: true, read: true });
  assert(!hasChannelUnread(second)); assert.equal(second.readAt, 3000);
  const renamed = appendChannelReply(second, { ...me, name: '新昵称' }, '我觉得可以', { now: 4000, own: true, thread: true });
  assert.deepEqual(renamed.ownReplyIndices, [0, 3]);
  assert.deepEqual(channelReply('林渡：原话：你好'), { name: '林渡', text: '原话：你好' });
});

test('saved/topic/creator feeds and live/replay filters use actual data', () => {
  const data = empty();
  data.posts = [item('mine', 'self'), item('night', 'a', { topic: 'night' }), item('trip', 'b', { topic: 'explore', time: 200 })];
  data.following = ['a']; data.saved = ['trip', 'gone'];
  const options = { kind: 'posts' as const, filter: 'all', topic: 'all', search: '', friendIds: ['a'] };
  assert.deepEqual(channelItems(data, options).map((item) => item.id), ['trip', 'night']);
  assert.deepEqual(channelItems(data, { ...options, filter: 'saved' }).map((item) => item.id), ['trip']);
  assert.deepEqual(channelItems(data, { ...options, topic: 'night' }).map((item) => item.id), ['night']);
  assert.deepEqual(channelItems(data, { ...options, filter: 'self' }).map((item) => item.id), ['mine']);
  data.rooms = [item('on', 'a'), item('off', 'b', { ended: true }), item('my-live', 'self')];
  assert.deepEqual(channelItems(data, { ...options, kind: 'rooms' }).map((item) => item.id), ['on']);
  assert.deepEqual(channelItems(data, { ...options, kind: 'rooms', filter: 'replay' }).map((item) => item.id), ['off']);
  data.messages = [item('friend', 'a'), item('new-person', 'stranger:x')];
  assert.deepEqual(channelItems(data, { ...options, kind: 'messages', filter: 'stranger' }).map((item) => item.id), ['new-person']);
});

test('feed batch validation refuses missing, duplicate or unmapped authors and duplicate content', () => {
  const people = channelFeedPeople([]);
  const items = people.map((person, index) => ({ authorId: person.id, text: `今天的故事${index}`, topic: 'night' }));
  assert.equal(parseChannelBatch({ items }, people).length, 5);
  assert.throws(() => parseChannelBatch({ items: items.slice(1) }, people));
  assert.throws(() => parseChannelBatch({ items: [items[0], items[0], ...items.slice(2)] }, people));
  assert.throws(() => parseChannelBatch({ items: items.map((entry) => ({ ...entry, text: '重复正文' })) }, people));
});

test('public generation context includes the latest own updates and never private messages or picture bytes', () => {
  const data = empty(); data.posts = [item('own', 'self', { imageUrl: 'data:image/jpeg;base64,secret' }), item('others-secret', 'a')]; data.messages = [item('private-secret')];
  const serialized = JSON.stringify(channelPublicContext(data));
  assert(serialized.includes('own')); assert(!serialized.includes('others-secret')); assert(!serialized.includes('private-secret')); assert(!serialized.includes('base64'));
});
