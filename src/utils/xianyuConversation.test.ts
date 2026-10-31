import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyXianyuPrice, parseXianyuReply, prepareXianyuReroll } from './xianyuConversation';
import type { XianyuChatThread, XianyuProduct } from '../apps/TaobaoApp';
const item: XianyuProduct = { id: 'item', title: '相机', desc: '九成新', price: 100, freeShipping: true, emoji: '📷', sellerName: '卖家' };
const thread: XianyuChatThread = { id: 'a', itemId: item.id, itemPrice: 100, itemTitle: item.title, peerName: '卖家', messages: [{ id: 'u', sender: 'me', text: '80可以吗', time: '12:00' }] };

test('seller changes become actual listing/thread prices; buyer proposals cannot execute seller actions', () => {
  const reply = parseXianyuReply({ reply: ['80给你吧', '改好了'], priceChange: 80 }, false);
  const changed = applyXianyuPrice([item], [thread, { ...thread, id: 'b' }, { ...thread, id: 'other', itemId: 'other' }], item.id, reply.price!);
  assert.equal(changed.items[0].price, 80);
  assert.deepEqual(changed.threads.map(t => t.itemPrice), [80, 80, 100]);
  assert.equal(item.price, 100); assert.equal(thread.itemPrice, 100);
  assert.throws(() => parseXianyuReply({ reply: ['我80买'], buy: true, priceChange: 80 }, true), /买家不能/);
  assert.throws(() => parseXianyuReply({ reply: ['改好了'], priceChange: null }, false), /实际新价格/);
  assert.equal(parseXianyuReply({ reply: ['要不要改成80呢'], priceChange: null }, false).price, undefined);
  assert.equal(parseXianyuReply({ reply: ['没改好，等一下'], priceChange: null }, false).price, undefined);
  for (const price of [-1, Infinity, NaN, '80', 1000001]) assert.throws(() => parseXianyuReply({ reply: ['改好了'], priceChange: price }, false));
  assert.throws(() => applyXianyuPrice([{ ...item, soldToThreadId: 'buyer' }], [thread], item.id, 80), /已成交/);
});

test('reroll removes the entire latest reply batch and restores its pre-change price without touching real sales', () => {
  const messages: XianyuChatThread['messages'] = [...thread.messages,
    { id: 'p1', sender: 'peer', text: '80给你', time: '12:01', batchId: 'reply', priceChange: { before: 100, after: 80 } },
    { id: 'p2', sender: 'peer', text: '改好了', time: '12:01', batchId: 'reply' }];
  const live = { ...item, price: 80 }, conversation = { ...thread, messages };
  const prepared = prepareXianyuReroll(conversation, live);
  assert.deepEqual(prepared.messages, thread.messages); assert.equal(prepared.price, 100);
  assert.equal(conversation.messages.length, 3); assert.equal(live.price, 80);
  assert.throws(() => prepareXianyuReroll(conversation, { ...live, soldToThreadId: thread.id }), /已成交/);
  assert.throws(() => prepareXianyuReroll(conversation, { ...live, price: 70 }), /价格已变动/);
  assert.throws(() => prepareXianyuReroll(thread, item), /没有可重新生成/);
  const legacy = prepareXianyuReroll({ ...thread, messages: [...thread.messages, { id: 'old', sender: 'peer', text: '可以看看', time: '刚刚' }] }, item);
  assert.deepEqual(legacy.messages, thread.messages); assert.equal(legacy.price, 100);
});
