import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChannelsLiveRoom, type LiveRoomState } from './ChannelsLiveRoom';

const live: LiveRoomState = { viewers: 42, hearts: 3, gifts: [], scene: '主播正在窗边整理唱片。' };
const room = { id: 'room-1', author: { id: 'host', name: '阿澄' }, text: '晚间听歌', time: 1,
  replies: ['观众甲：这首好听', '玩家：再放一遍吧'], live };
const props = { me: { id: 'self', name: '玩家' }, busy: false, error: '', following: false,
  onBack: () => {}, onFollow: () => {}, onSend: () => {}, onAdvance: () => {}, onGift: () => null,
  onBackgroundChange: () => {}, onLike: () => {}, onEnd: () => {} };

test('live room shows scene, audience and interactive controls; replay keeps history', () => {
  const active = renderToStaticMarkup(<ChannelsLiveRoom {...props} room={room} />);
  assert.match(active, /主播正在窗边整理唱片/);
  assert.match(active, /这首好听/);
  assert.match(active, /42/);
  assert.match(active, /送礼物/);
  assert.match(active, /背景/);
  assert.match(active, /刷新直播/);

  const replay = renderToStaticMarkup(<ChannelsLiveRoom {...props} room={{ ...room, ended: true }} />);
  assert.match(replay, /直播已结束/);
  assert.match(replay, /这首好听/);
  assert.doesNotMatch(replay, /aria-label="送礼物"/);
  assert.doesNotMatch(replay, /发送直播弹幕/);
});

test('host speech and actions appear outside audience barrage; player host has separate action input', () => {
  const html = renderToStaticMarkup(<ChannelsLiveRoom {...props} room={{ ...room, replies: ['阿澄：这是主播发言', '观众甲：这是弹幕'], replyAuthorIds: ['host', 'viewer'], live: { ...live, hostActions: ['拨动唱片'] } }} />);
  const host = html.slice(html.indexOf('aria-label="主播动态"'), html.indexOf('</section>', html.indexOf('aria-label="主播动态"')));
  assert.match(host, /这是主播发言/); assert.match(host, /拨动唱片/); assert.doesNotMatch(host, /这是弹幕/);
  const barrage = html.slice(html.indexOf('aria-label="直播间弹幕"'));
  assert.doesNotMatch(barrage, /这是主播发言/);
  const own = renderToStaticMarkup(<ChannelsLiveRoom {...props} room={{ ...room, author: props.me }} />);
  assert.match(own, /aria-label="主播行为"/); assert.match(own, /aria-label="发送直播弹幕"/);
});
