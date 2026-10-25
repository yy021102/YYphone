import assert from 'node:assert/strict';
import { test } from 'node:test';
import { channelAudience, channelCommentPeople, channelViewerCount, parseChannelPosts } from './channelInteractions';
import { appendChannelReply, isChannelData, type ChannelData, type ChannelItem } from './channelLife';
import { channelMemoryForRole } from './channelMemory';

const people = [{ id: 'a', name: '林渡' }, { id: 'b', name: '时予' }, { id: 'c', name: '青禾' }];
const item = (id: string, authorId: string, extra: Partial<ChannelItem> = {}): ChannelItem => ({ id, author: { id: authorId, name: authorId }, text: id, time: 1, replies: [], ...extra });

test('seven comments include distinct known roles and strangers, including with no contacts', () => {
  for (const contacts of [[], people, [...people, ...people]]) {
    const roster = channelCommentPeople(contacts);
    assert.equal(roster.length, 7);
    assert.equal(new Set(roster.map(person => person.id)).size, 7);
    assert.equal(new Set(roster.map(person => person.name)).size, 7);
    assert(roster.filter(person => person.id.startsWith('stranger:')).length >= 4);
    if (contacts.length) assert(roster.some(person => person.id === 'a'));
  }
  assert(!channelCommentPeople(people, 7, 'a').some(person => person.id === 'a'));
});

test('five posts each require four complete, distinct, mapped comments before acceptance', () => {
  const authors = channelCommentPeople(people, 5);
  const commenters = channelCommentPeople(people);
  const payload = { items: authors.map((author, index) => ({ authorId: author.id, text: `第${index}篇独立内容`,
    comments: commenters.filter(person => person.id !== author.id).slice(0, 4).map((person, position) => ({ authorId: person.id, text: `这篇的第${position}个不同回应` })) })) };
  const parsed = parseChannelPosts(payload, authors, commenters);
  assert.equal(parsed.length, 5);
  assert(parsed.every(post => post.comments.length === 4));
  const fewer = structuredClone(payload); fewer.items[4].comments.pop();
  assert.throws(() => parseChannelPosts(fewer, authors, commenters), /评论不完整/);
  const duplicate = structuredClone(payload); duplicate.items[0].comments[1] = duplicate.items[0].comments[0];
  assert.throws(() => parseChannelPosts(duplicate, authors, commenters), /重复/);
  const unknown = structuredClone(payload); unknown.items[2].comments[0].authorId = 'missing';
  assert.throws(() => parseChannelPosts(unknown, authors, commenters));
  const self = structuredClone(payload); self.items[0].comments[0].authorId = authors[0].id;
  assert.throws(() => parseChannelPosts(self, authors, commenters));
});

test('audience follows identity, explicit overrides, fixed counts and hostile atmosphere', () => {
  assert.equal(channelAudience('普通素人').max, 30);
  assert.equal(channelAudience('刚起步的素人主播').max, 30);
  assert.equal(channelAudience('摄影博主').max, 2500);
  const controversial = channelAudience('百万粉丝黑红网红');
  assert.equal(controversial.min, 8000); assert.match(controversial.atmosphere, /黑粉、串子/);
  assert.equal(channelAudience('热门网红', 'small').max, 30);
  const fixed = channelAudience('普通素人', 'custom', 12);
  assert.equal(channelViewerCount(90000, fixed, 1), 12);
  assert.equal(channelViewerCount(-100, fixed, 1), 12);
  assert.equal(channelViewerCount(NaN, { min: 3, max: 10 }, 7), 7);
  assert.equal(channelViewerCount(3.8, { min: 0, max: 10 }, 0), 4);
});

test('shared memory stays per-role and includes only participated live rooms', () => {
  const data: ChannelData = { posts: [], following: [], messages: [item('dm-a-secret', 'a'), item('dm-b-secret', 'b')],
    rooms: [item('invited-a', 'self', { live: { viewers: 5, hearts: 0, gifts: [], invitedRoleIds: ['a'] } }),
      item('spoke-a', 'b', { replies: ['a：来了'], replyAuthorIds: ['a'] }), item('unrelated-live', 'b'), item('own-a', 'a')] };
  assert.equal(channelMemoryForRole(data, { contactId: 'a' }), '');
  const dm = channelMemoryForRole(data, { contactId: 'a', sharePrivateMemory: true });
  assert(dm.includes('dm-a-secret')); assert(!dm.includes('dm-b-secret')); assert(!dm.includes('invited-a'));
  const live = channelMemoryForRole(data, { contactId: 'a', shareLiveMemory: true });
  assert(live.includes('invited-a')); assert(live.includes('spoke-a')); assert(live.includes('own-a'));
  assert(!live.includes('unrelated-live')); assert(!live.includes('dm-a-secret'));
  const privateSurface = channelMemoryForRole(data, { contactId: 'a', shareLiveMemory: true, sharePrivateMemory: true }, false);
  assert(privateSurface.includes('invited-a')); assert(!privateSurface.includes('dm-a-secret'));
});

test('memory participant IDs survive appending to legacy messages and metadata validates', () => {
  const original = item('old', 'self', { replies: ['旧用户：你好'], live: { viewers: 3, hearts: 0, gifts: [],
    invitedRoleIds: ['a'], participantIds: ['a'], audience: { min: 1, max: 30 }, atmosphere: '安静的素人直播间' } });
  const next = appendChannelReply(original, people[0], '我来啦', { now: 2 });
  assert.deepEqual(next.replyAuthorIds, ['', 'a']);
  const data: ChannelData = { posts: [], rooms: [next], messages: [], following: [] };
  assert(isChannelData(data));
  assert(!isChannelData({ ...data, rooms: [{ ...next, replyAuthorIds: ['a'] }] }));
  assert(!isChannelData({ ...data, rooms: [{ ...next, live: { ...next.live, audience: { min: 10, max: 1 } } }] }));
});
