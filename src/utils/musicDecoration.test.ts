import assert from 'node:assert/strict';
import { test } from 'node:test';
import { musicBubbleBackground, normalizeMusicDecoration } from './musicDecoration';

test('existing music appearances keep vinyl and no decorative text by default', () => {
  const style = normalizeMusicDecoration(undefined);
  assert.equal(style.discMode, 'vinyl');
  assert.equal(style.darkenBackground, true);
  assert.equal(style.userBubble.text, '');
  assert.equal(style.companionBubble.text, '');
});

test('each bubble retains independent color, transparency and text through serialization', () => {
  const input = { discMode: 'image', darkenBackground: false, userBubble: { text: '我讨厌你', color: '#d3a4b5', opacity: 35 }, companionBubble: { text: '^^', color: '#223344', opacity: 0 } };
  const style = normalizeMusicDecoration(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(style, input);
  assert.equal(musicBubbleBackground(style.userBubble.color, style.userBubble.opacity), 'rgb(211 164 181 / 0.35)');
  assert.equal(musicBubbleBackground(style.companionBubble.color, style.companionBubble.opacity), 'rgb(34 51 68 / 0)');
});

test('imported malformed decoration values cannot create arbitrary CSS or unbounded text', () => {
  const style = normalizeMusicDecoration({ discMode: 'other', userBubble: { text: 'x'.repeat(100), color: 'url(https://invalid/)', opacity: 200 }, companionBubble: { color: '#abcdef', opacity: Number.NaN } });
  assert.equal(style.discMode, 'vinyl'); assert.equal(style.userBubble.text.length, 40);
  assert.equal(style.userBubble.color, '#626268'); assert.equal(style.userBubble.opacity, 100);
  assert.equal(style.companionBubble.opacity, 70);
});
