import assert from 'node:assert/strict';
import { test } from 'node:test';
import { favoriteDate, favoriteShareContent, isWeChatFavorites, snapshotFavoriteMessage, type WeChatFavorite } from './wechatFavorites';

const favorite: WeChatFavorite = { id: 'f', sourceChatId: 'c', sourceMessageId: 'm', sourceChatTitle: '好友', sourceSenderName: '角色', savedAt: '2026-10-25T12:00:00+08:00', message: { text: '想收藏的话' } };

test('snapshot is independent and excludes character thoughts and payment state', () => {
  const original = { kind: 'transfer', text: '请收款', amount: '20.00', thought: '私密心声', paymentStatus: 'pending', recipientId: 'user' };
  const snapshot = snapshotFavoriteMessage(original);
  original.text = '已被编辑';
  assert.equal(snapshot.text, '请收款');
  assert.equal('thought' in snapshot, false);
  assert.equal('paymentStatus' in snapshot, false);
});

test('shares preserve image and voice content while payments become non-payable cards', () => {
  const image = favoriteShareContent({ ...favorite, message: { kind: 'image', text: '照片', imageUrl: 'data:image/png;base64,AAAA' } });
  assert.equal(image.kind, 'image'); assert.equal(image.imageUrl, 'data:image/png;base64,AAAA');
  assert.equal(favoriteShareContent({ ...favorite, message: { kind: 'voice', text: '晚安' } }).kind, 'voice');
  const transfer = favoriteShareContent({ ...favorite, message: { kind: 'transfer', text: '请收款', amount: '20.00' } });
  assert.equal(transfer.kind, 'link'); assert.match(transfer.content!, /20.00/);
  assert.equal('amount' in transfer, false);
  assert.equal('paymentStatus' in transfer, false);
});

test('validates stored favorites and formats today, other dates and previous years', () => {
  assert.equal(isWeChatFavorites([favorite]), true);
  assert.equal(isWeChatFavorites([{ ...favorite, message: { text: 10 } }]), false);
  const now = new Date(2026, 9, 25, 20);
  assert.equal(favoriteDate(new Date(2026, 9, 25, 10).toISOString(), now), '今天');
  assert.equal(favoriteDate(new Date(2026, 7, 29, 10).toISOString(), now), '8月29日');
  assert.equal(favoriteDate(new Date(2025, 7, 29, 10).toISOString(), now), '2025年8月29日');
});
