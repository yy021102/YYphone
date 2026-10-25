import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearChannelSection, createChannelArchive, parseChannelArchive, trimChannelReplays } from './channelArchive';
import { channelPerson, channelPlatformPublicContext, emptyChannelProfile, isChannelProfile, type ChannelSettings } from './channelProfile';
import { channelItems, type ChannelData, type ChannelItem } from './channelLife';

const item = (id: string, extra: Partial<ChannelItem> = {}): ChannelItem => ({ id, author: { id: 'a', name: '角色' }, text: id, time: 1, replies: [], ...extra });
const data = (): ChannelData => ({ posts: [item('post', { imageUrl: 'data:image/png;base64,a', textImage: '文字图的画面', liked: true, replies: ['角色：评论'], replyAuthorIds: ['a'] })],
  rooms: [item('room', { live: { viewers: 12, hearts: 5, gifts: [{ id: 'gift', senderId: 'a', senderName: '角色', giftId: 'flower', createdAt: 1, amount: 1 }],
    background: { presetId: 'night', imageUrl: 'data:image/png;base64,b' }, invitedRoleIds: ['a'], audience: { min: 12, max: 12 }, atmosphere: '随意聊天' } })],
  messages: [item('dm', { sourcePostId: 'post', replies: ['我：你好'], replyAuthorIds: ['self'], ownReplyIndices: [0], readAt: 10, lastIncomingAt: 9 })], saved: ['post'], following: ['a'] });
const profile = () => {
  const value = emptyChannelProfile();
  value.settings = { ...value.settings, nickname: '我的网名', avatarUrl: 'data:image/png;base64,c', accountId: 'my_id', identity: '素人', bio: '签名',
    platformSetting: '平台设定', prompt: '专用提示词', worldBookIds: ['book'], relationships: [{ leftId: 'a', rightId: 'b', description: '朋友' }],
    roles: [{ contactId: 'a', nickname: '角色网名', accountId: 'role_id', identity: '主播', relationToUser: '同学', sharePrivateMemory: true, shareLiveMemory: true }] };
  value.presets = [{ id: 'preset', name: '完整设置', settings: structuredClone(value.settings) }]; value.activePresetId = 'preset';
  return value;
};

test('archive round-trips all platform content, metadata, settings and entire page presets independently', () => {
  const original = data(); const settings = profile();
  const archive = createChannelArchive(original, settings);
  const restored = parseChannelArchive(JSON.parse(JSON.stringify(archive)));
  assert.deepEqual(restored.data, original); assert.deepEqual(restored.profile, settings);
  settings.settings.roles[0].nickname = '修改'; original.posts[0].text = '修改';
  assert.equal(restored.profile.presets[0].settings.roles[0].nickname, '角色网名');
  assert.equal(restored.data.posts[0].text, 'post');
  assert(!('apiKey' in restored));
});
test('public platform persona and audience attitudes take precedence without exposing private relationships', () => {
  const settings = profile().settings;
  settings.roles[0] = { ...settings.roles[0], persona: '黑红画手，嘴硬心软', audienceAttitude: '黑粉、真粉和路人都有', relationToUser: '不公开的私下关系' };
  const context = channelPlatformPublicContext(settings, [{ id: 'a', name: '真实姓名', persona: '私人秘密', avatarUrl: 'data:secret' }]);
  assert.equal(context[0].persona, '黑红画手，嘴硬心软'); assert.match(context[0].audienceAttitude, /黑粉/);
  assert(!JSON.stringify(context).includes('私人秘密')); assert(!JSON.stringify(context).includes('不公开')); assert(!JSON.stringify(context).includes('data:'));
  assert(isChannelProfile({ ...profile(), settings }));
  const legacy = profile().settings; assert.equal(channelPlatformPublicContext(legacy, [{ id: 'a', name: '角色' }])[0].persona, '主播');
});

test('archive validation rejects unrelated formats, unsupported versions and broken links or records', () => {
  const archive = createChannelArchive(data(), profile());
  for (const patch of [{ format: 'other' }, { version: 2 }, { profile: {} }, { data: { ...archive.data, messages: [{ ...archive.data.messages[0], replyAuthorIds: [] }] } }]) {
    assert.throws(() => parseChannelArchive({ ...archive, ...patch }));
  }
  const duplicate = structuredClone(archive); duplicate.data.rooms[0].id = duplicate.data.posts[0].id;
  assert.throws(() => parseChannelArchive(duplicate), /编号/);
  const missingPreset = structuredClone(archive); missingPreset.profile.activePresetId = 'missing';
  assert.throws(() => parseChannelArchive(missingPreset), /预设/);
});

test('replay retention uses latest end time, keeps all active streams and applies on import/export', () => {
  const original = data(); original.rooms = Array.from({ length: 6 }, (_, index) => item(`ended-${index}`, { ended: true, endedAt: index + 10, time: 100 - index }));
  original.rooms.push(item('ongoing', { time: 1 }));
  const next = trimChannelReplays(original);
  assert.deepEqual(next.rooms.map(room => room.id), ['ended-3','ended-4','ended-5','ongoing']);
  assert.equal(original.rooms.length, 7);
  const replays = channelItems(next, { kind: 'rooms', filter: 'replay', search: '', topic: 'all', friendIds: [] });
  assert.deepEqual(replays.map(room => room.id), ['ended-5','ended-4','ended-3']);
  assert.equal(createChannelArchive(original, profile()).data.rooms.length, 4);
  const archive = createChannelArchive(data(), profile()); archive.data = original;
  assert.equal(parseChannelArchive(archive).data.rooms.length, 4);
});

test('each clear action affects only the selected section and removes stale post references', () => {
  const original = data();
  const plaza = clearChannelSection(original, 'posts');
  assert.equal(plaza.posts.length, 0); assert.deepEqual(plaza.saved, []); assert.equal(plaza.messages[0].sourcePostId, undefined);
  assert.deepEqual(plaza.rooms, original.rooms); assert.deepEqual(plaza.messages[0].replies, original.messages[0].replies);
  const live = clearChannelSection(original, 'rooms'); assert.deepEqual(live.rooms, []); assert.deepEqual(live.posts, original.posts); assert.deepEqual(live.messages, original.messages);
  const dm = clearChannelSection(original, 'messages'); assert.deepEqual(dm.messages, []); assert.deepEqual(dm.rooms, original.rooms); assert.deepEqual(dm.saved, ['post']);
  assert.equal(original.messages[0].sourcePostId, 'post'); assert.deepEqual(dm.following, ['a']);
});

test('platform aliases inherit contact settings when blank and never change stable contact IDs', () => {
  const contact = { id: 'contact-stable', name: '真实姓名', forumNickname: '角色网名', forumHandle: '@role_id', persona: '原本人设' };
  const settings: ChannelSettings = { ...emptyChannelProfile().settings, roles: [{ contactId: contact.id, nickname: '新网名', accountId: '@new_id', identity: '', relationToUser: '' }] };
  assert.deepEqual(channelPerson(contact, settings), { ...contact, name: '新网名', accountId: 'new_id' });
  settings.roles[0].nickname = '  '; settings.roles[0].accountId = '';
  assert.equal(channelPerson(contact, settings).name, '角色网名'); assert.equal(channelPerson(contact, settings).accountId, 'role_id');
  assert.equal(channelPerson({ id: 'plain', name: '角色' }).name, '角色');
  assert(isChannelProfile(profile()));
  const legacy = emptyChannelProfile(); legacy.settings.roles = [{ contactId: 'old', identity: '', relationToUser: '' }]; assert(isChannelProfile(legacy));
});
