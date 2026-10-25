import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStrangerPublicContext, generateStrangerMessages } from './channelStrangerMessages';

const publicItem = (text: string, time: number, authorId = 'self') => ({ author: { id: authorId }, text, time, replies: [] as string[] });
const fixture = () => ({
  profile: { nickname: '小舟', identity: '插画师', bio: '养猫、画画，偶尔弹吉他', platformSetting: '日常创作社区', prompt: '轻松口语' },
  posts: [publicItem('昨天画的海', 1), publicItem('今天画了一只橘猫', 4), publicItem('无关路人的旅行', 10, 'other')],
  rooms: [{ ...publicItem('深夜画画直播', 5), live: { scene: '正在给橘猫上色' }, replies: ['小舟：猫耳朵画歪了'] }],
  messages: [
    { author: { id: 'stranger:old', name: '旧来信者' }, text: '你家猫好可爱', time: 1 },
    { author: { id: 'friend', name: '林渡' }, text: '好友私聊中的秘密约定', time: 2 },
  ],
  contactNames: ['林渡'], worldBook: '现代日常世界',
});
const rosterFrom = (task: string): Array<{ id: string; style: string }> => {
  const line = task.split('\n').find((line) => line.includes('各按分配的交流方式发挥：'))!;
  return JSON.parse(line.slice(line.indexOf('[')));
};
const responseFor = (task: string) => ({ items: rosterFrom(task).map((person, index) => ({
  authorId: person.id, name: `陌生访客${index}`, text: `关于橘猫插画的不同想法${index}，你平时也用这个配色吗？`,
})) });

test('stranger context uses latest own posts and live scenes, without mixing in other creators', () => {
  const input = fixture();
  input.posts.push(publicItem('更旧的内容', -2), publicItem('最旧的内容', -3));
  const before = structuredClone(input.posts);
  const context = buildStrangerPublicContext(input);
  assert.deepEqual(context.posts.map((item) => item.text), ['今天画了一只橘猫', '昨天画的海', '更旧的内容']);
  assert.equal(context.lives[0].scene, '正在给橘猫上色');
  assert.deepEqual(context.lives[0].publicInteractions, ['小舟：猫耳朵画歪了']);
  assert.equal(context.profile.bio, '养猫、画画，偶尔弹吉他');
  assert.deepEqual(input.posts, before);
});

test('stranger batch requests five distinct styles and includes the persona, recent posts and live', async () => {
  let requests = 0;
  const result = await generateStrangerMessages(fixture(), async (system, task) => {
    requests++;
    assert(system.includes('不能知道私聊'));
    assert(task.includes('插画师') && task.includes('养猫、画画') && task.includes('轻松口语'));
    assert(task.includes('今天画了一只橘猫') && task.includes('正在给橘猫上色'));
    assert(!task.includes('无关路人的旅行') && !task.includes('好友私聊中的秘密约定'));
    assert.equal(new Set(rosterFrom(task).map((person) => person.style)).size, 5);
    return JSON.stringify(responseFor(task));
  });
  assert.equal(requests, 1);
  assert.equal(result.length, 5);
  assert.equal(new Set(result.map((item) => item.author.id)).size, 5);
  assert(result.every((item) => item.author.id.startsWith('stranger:') && item.author.persona.includes('交流方式')));
});

test('incomplete, repeated, impersonating or malformed stranger batches get one complete retry', async (t) => {
  for (const invalid of ['short', 'duplicate-text', 'duplicate-id', 'duplicate-name', 'friend-name', 'old-name', 'old-text', 'empty', 'json']) {
    await t.test(invalid, async () => {
      let requests = 0;
      const result = await generateStrangerMessages(fixture(), async (_system, task) => {
        const response = responseFor(task);
        if (++requests === 2) {
          assert(task.includes('上次返回未通过校验'));
          return JSON.stringify(response);
        }
        if (invalid === 'short') response.items.pop();
        if (invalid === 'duplicate-text') response.items[1].text = response.items[0].text;
        if (invalid === 'duplicate-id') response.items[1].authorId = response.items[0].authorId;
        if (invalid === 'duplicate-name') response.items[1].name = response.items[0].name;
        if (invalid === 'friend-name') response.items[1].name = '林渡';
        if (invalid === 'old-name') response.items[1].name = '旧来信者';
        if (invalid === 'old-text') response.items[1].text = '你家猫好可爱！';
        if (invalid === 'empty') response.items[1].text = '   ';
        return invalid === 'json' ? 'invalid JSON' : JSON.stringify(response);
      });
      assert.equal(result.length, 5);
      assert.equal(requests, 2);
    });
  }
});

test('failed batches reject completely and do not create fabricated fallback messages', async () => {
  let requests = 0;
  await assert.rejects(generateStrangerMessages(fixture(), async () => {
    requests++;
    return '{"items":[]}';
  }), /未生成完整五条/);
  assert.equal(requests, 2);
});

test('a new account with no posts or live has an explicit no-fabricated-history fallback', async () => {
  const input = fixture();
  input.posts = []; input.rooms = []; input.messages = [];
  const result = await generateStrangerMessages(input, async (system, task) => {
    assert(system.includes('不能杜撰看过的帖子、直播或玩家经历'));
    assert(task.includes('"posts":[]') && task.includes('"lives":[]'));
    return JSON.stringify(responseFor(task));
  });
  assert.equal(result.length, 5);
});
