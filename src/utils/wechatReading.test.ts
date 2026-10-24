import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReadingText, pageAtOffset, paginateReadingText, readingPageContext, readingShareText, type ReadingBook } from './wechatReading';

test('分页保留全文顺序，位置锚点可在字号变化后定位', () => {
  const text = normalizeReadingText(`\uFEFF第一章\r\n${'海风吹过。她停下脚步。\r\n'.repeat(150)}`);
  const smaller = paginateReadingText(text, 240);
  const larger = paginateReadingText(text, 420);
  assert.ok(smaller.length > larger.length);
  assert.equal(smaller.map(page => page.text).join('\n').replace(/\s/g, ''), text.replace(/\s/g, ''));
  const offset = smaller[3].start;
  assert.ok(larger[pageAtOffset(larger, offset)].start <= offset);
  const context = readingPageContext(smaller, 3);
  assert.ok(context.includes('【前2页】'));
  assert.ok(context.includes('【当前页】'));
  assert.equal(context.includes(smaller[0].text), false);
});

test('分享卡片包含已读梗概与共读记录', () => {
  const book: ReadingBook = {
    id: 'book-1', title: '夜航', fileName: '夜航.txt', textLength: 100, createdAt: '', updatedAt: '', status: 'paused',
    position: 50, maxReadOffset: 80, font: 'normal', theme: 'paper', companionId: 'a', coRead: true,
    autoComment: true, lastAutoOffset: 0, recap: '两人发现了一封信。', recapOffset: 70,
    dialogue: [{ id: 'line-1', senderId: 'a', name: '阿青', text: '这封信有点奇怪。', pageStart: 0, createdAt: '' }],
  };
  const detail = readingShareText(book, '第一章\n正文'.repeat(20), 1, 5, '阿青');
  assert.match(detail, /暂时合上书/);
  assert.match(detail, /两人发现了一封信/);
  assert.match(detail, /阿青：这封信有点奇怪/);
});
