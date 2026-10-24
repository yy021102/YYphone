import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAdventureShare } from './adventureShare';
import type { AdventureShare } from '../components/TextAdventureSimulator';

const snapshot: AdventureShare = {
  id: 'share-1', worldTitle: '槐巷夜话', worldTag: '中式恐怖', turn: 5,
  chapter: '第一幕', place: '槐巷', sceneTitle: '雨夜的红伞', progress: '我们拿到了车票，仍不知道伞的来历。',
  companionId: 'char-a', companionName: '阿宁', status: 'paused',
};

test('companion receives a roleplay progress card with explicit fiction boundary', () => {
  const result = formatAdventureShare(snapshot, 'char-a');
  assert.match(result.content, /中途暂停 · 第6回合/);
  assert.match(result.content, /雨夜的红伞/);
  assert.match(result.aiContext, /你和玩家在这个世界里共同扮演主角/);
  assert.match(result.aiContext, /不是真实穿越/);
});

test('another recipient is not mistaken for the companion', () => {
  const result = formatAdventureShare({ ...snapshot, status: 'completed' }, 'char-b');
  assert.match(result.content, /已结束/);
  assert.match(result.aiContext, /你是这张卡片的接收者，不是该局同行者/);
});
