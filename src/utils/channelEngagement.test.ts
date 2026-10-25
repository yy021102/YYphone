import assert from 'node:assert/strict';
import { test } from 'node:test';
import { channelFollowers, createChannelEngagement, ensureChannelEngagement, inferChannelFollowers } from './channelEngagement';
import { emptyChannelProfile, isChannelProfile } from './channelProfile';
import { appendChannelReply, isChannelData, type ChannelData, type ChannelItem } from './channelLife';
import { createChannelArchive, parseChannelArchive } from './channelArchive';

const post = (id = 'p', authorId = 'self'): ChannelItem => ({ id, author: { id: authorId, name: authorId }, text: '今天画了海边的小房子', time: 1, replies: [] });
test('account sizes support zero, explicit creator fan counts and persona estimates', () => {
  assert.equal(inferChannelFollowers('画手，20.5万粉丝'), 205000);
  assert.equal(inferChannelFollowers('粉丝数：120万'), 1200000);
  assert.equal(inferChannelFollowers('零粉新人'), 0); assert.equal(inferChannelFollowers('普通素人主播'), 50);
  assert(inferChannelFollowers('黑红网红') > inferChannelFollowers('插画博主'));
  const settings = emptyChannelProfile().settings;
  settings.roles = [{ contactId: 'a', identity: '顶流明星', persona: '普通素人', relationToUser: '' }];
  assert.equal(channelFollowers({ id: 'a', name: '角色', persona: '百万粉丝' }, settings), 50);
  settings.roles[0].followerCount = 0; assert.equal(channelFollowers({ id: 'a', name: '角色' }, settings), 0);
});
test('post activity scales with followers, stays stable and persists in backups', () => {
  const profile = emptyChannelProfile(); profile.settings.followerCount = 100;
  const small = createChannelEngagement(post(), profile.settings);
  profile.settings.followerCount = 1000000;
  const large = createChannelEngagement(post(), profile.settings);
  assert(large.likes > small.likes * 100); assert(large.views > small.views * 100);
  for (const value of Object.values(large)) assert(Number.isSafeInteger(value) && value >= 0);
  assert(large.likes <= large.views); assert(large.comments <= large.views); assert(large.saves <= large.likes);
  const data: ChannelData = { posts: [{ ...post(), engagement: large }], rooms: [], messages: [], following: [] };
  profile.settings.followerCount = 0;
  assert.equal(ensureChannelEngagement(data, profile.settings), data);
  assert.deepEqual(parseChannelArchive(createChannelArchive(data, profile)).data.posts[0].engagement, large);
  const changed = appendChannelReply(data.posts[0], { id: 'self', name: '我' }, '谢谢', { now: 2, own: true });
  assert.equal(changed.engagement!.comments, large.comments + 1);
  assert(isChannelData({ ...data, posts: [changed] }));
});
test('legacy post metrics use current character settings without changing other content', () => {
  const settings = emptyChannelProfile().settings;
  const data: ChannelData = { posts: [post('old', 'a')], rooms: [], messages: [], following: ['a'] };
  const next = ensureChannelEngagement(data, settings, [{ id: 'a', name: '角色', persona: '粉丝15万的博主' }]);
  assert.equal(next.posts[0].engagement!.followers, 150000); assert.equal(data.posts[0].engagement, undefined);
  assert.equal(next.following, data.following);
});
test('profile counts and injection switches round-trip while rejecting invalid values', () => {
  const value = emptyChannelProfile(); value.settings = { ...value.settings, persona: '我的平台人设', audienceAttitude: '理性路人', followerCount: 0, followingCount: 123,
    roles: [{ contactId: 'a', identity: '', relationToUser: '', injectChatContext: true, injectMemory: false, followerCount: 999 }] };
  assert(isChannelProfile(value));
  for (const invalid of [-1, 1.5, NaN, Infinity, 1000000001]) assert(!isChannelProfile({ ...value, settings: { ...value.settings, followerCount: invalid } }));
  assert(!isChannelProfile({ ...value, settings: { ...value.settings, roles: [{ ...value.settings.roles[0], injectMemory: 'yes' }] } }));
});
