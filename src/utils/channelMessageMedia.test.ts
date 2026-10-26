import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChannelMessages, isChannelMedia } from './channelMessageMedia';
import { isChannelData, channelPublicContext } from './channelLife';

test('private replies keep multiple visible messages and media without thoughts or fabricated URLs', () => {
  const messages = parseChannelMessages({ messages: [
    { kind: 'thought', text: '秘密心声' }, { kind: 'text', text: '<think>不能显示</think>在吗' },
    { kind: 'voice', text: '想和你说声晚安' }, { kind: 'image', text: '窗边的小猫', url: 'https://fake.invalid/cat.png' },
    { kind: 'transfer', text: '还你的饭钱', amount: 20 },
  ] });
  assert.deepEqual(messages.map(m => m.text), ['在吗', '想和你说声晚安', '窗边的小猫', '还你的饭钱']);
  assert.equal(messages[2].media?.url, undefined);
  assert.equal(messages[3].media?.amount, 20);
  assert(messages[3].media?.id);
  assert.equal(isChannelMedia({ kind: 'image', text: '', url: 'javascript:alert(1)' }), false);
  assert.throws(() => parseChannelMessages({ messages: [{ kind: 'thought', text: '秘密' }] }));
  assert.equal(parseChannelMessages({ text: '好呀\n马上来' }).length, 2);
});

test('media and host actions persist in archives and private media never enters public context', () => {
  const author = { id: 'self', name: '玩家' };
  const item = { id: 'post', author, text: '', time: 1, replies: [], textVideo: '拍摄晚霞的视频' };
  const data = { posts: [item], rooms: [{ ...item, id: 'live', live: { viewers: 1, hearts: 0, gifts: [], hostActions: ['拿起画笔'] } }], messages: [{ ...item, id: 'dm', replies: ['玩家：图片'], replyMedia: { 0: { kind: 'image' as const, text: '私密配图', url: 'data:image/png;base64,AAAA' } } }], following: [] };
  assert(isChannelData(JSON.parse(JSON.stringify(data))));
  assert(!JSON.stringify(channelPublicContext(data)).includes('私密配图'));
  assert(!isChannelData({ ...data, messages: [{ ...data.messages[0], replyMedia: { 3: { kind: 'voice', text: '越界' } } }] }));
});
