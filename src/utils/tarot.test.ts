import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TAROT_DECK, TAROT_SPREADS, createTarotRecord, isTarotRecord, makeTarotDraw,
  recoverTarotInterpretations, shuffleTarotDeck, tarotContext, tarotRandomInt, tarotShareText,
} from './tarot';

const makeRecord = () => createTarotRecord({ spreadId: 'focus', question: '我想怎样安排新的生活？', userName: '我',
  includeReversed: true, cards: TAROT_SPREADS[1].positions.map((position, i) => makeTarotDraw(`major-${i}`, position, true, () => i % 2)) });

test('deck contains 22 major cards and four complete fourteen-card suits with original references', () => {
  assert.equal(TAROT_DECK.length, 78);
  assert.equal(new Set(TAROT_DECK.map(card => card.id)).size, 78);
  assert.equal(TAROT_DECK.filter(card => card.suit === 'major').length, 22);
  for (const suit of ['wands', 'cups', 'swords', 'pentacles']) {
    assert.deepEqual(TAROT_DECK.filter(card => card.suit === suit).map(card => card.rank), Array.from({ length: 14 }, (_, i) => i + 1));
  }
  for (const card of TAROT_DECK) {
    for (const field of [card.name, card.english, card.keywords, card.upright, card.reversed]) assert.ok(field.trim());
  }
  assert.equal(TAROT_DECK.find(card => card.id === 'major-8')?.name, '力量');
  assert.equal(TAROT_DECK.find(card => card.id === 'major-11')?.name, '正义');
});

test('shuffle preserves every card exactly once without mutating the catalogue', () => {
  const before = TAROT_DECK.map(card => card.id);
  const shuffled = shuffleTarotDeck(() => 0);
  assert.equal(shuffled.length, 78);
  assert.deepEqual(shuffled.map(card => card.id).sort(), [...before].sort());
  assert.notDeepEqual(shuffled.map(card => card.id), before);
  assert.deepEqual(TAROT_DECK.map(card => card.id), before);
  assert.throws(() => shuffleTarotDeck(max => max), /随机数/);
});

test('secure random indices are bounded and reversal is optional without consuming extra randomness', () => {
  for (const max of [1, 2, 78]) {
    for (let i = 0; i < 100; i++) { const value = tarotRandomInt(max); assert.ok(Number.isInteger(value) && value >= 0 && value < max); }
  }
  for (const max of [0, -1, 1.5, Infinity]) assert.throws(() => tarotRandomInt(max));
  assert.equal(makeTarotDraw('major-0', '今日提醒', false, () => { throw new Error('must not request orientation'); }).reversed, false);
  assert.equal(makeTarotDraw('major-0', '今日提醒', true, () => 1).reversed, true);
  assert.throws(() => makeTarotDraw('missing', '今日提醒', true));
});

test('records preserve draw positions, validate shape and never accept repeated cards or impossible orientations', () => {
  const record = makeRecord();
  assert.ok(isTarotRecord(JSON.parse(JSON.stringify(record))));
  assert.equal(record.cards.length, 3);
  assert.ok(!isTarotRecord({ ...record, cards: [record.cards[0], { ...record.cards[1], cardId: record.cards[0].cardId }, record.cards[2]] }));
  assert.ok(!isTarotRecord({ ...record, includeReversed: false }));
  assert.ok(!isTarotRecord({ ...record, cards: record.cards.slice(1) }));
  assert.ok(!isTarotRecord({ ...record, cards: record.cards.map(card => ({ ...card, position: '错误牌位' })) }));
  assert.ok(!isTarotRecord({ ...record, createdAt: 'invalid date' }));
  assert.ok(!isTarotRecord({ ...record, interpretations: [{ id: 'bad', status: 'done', text: '' }] }));
  assert.throws(() => createTarotRecord({ ...record, cards: [] }));
  const daily = createTarotRecord({ spreadId: 'daily', question: '', userName: '我', includeReversed: false,
    cards: [makeTarotDraw('major-0', '今日提醒', false)] });
  assert.equal(daily.question, TAROT_SPREADS[0].question);
  record.cards[0].reversed = true;
  assert.equal(daily.cards[0].reversed, false);
});

test('interrupted interpretation is recovered explicitly without changing cards or successful readings', () => {
  const record = makeRecord();
  record.interpretations = [
    { id: 'pending', reader: { mode: 'oracle' }, status: 'pending', text: '', createdAt: record.createdAt },
    { id: 'done', reader: { mode: 'character', actorId: 'person', actorName: '林间' }, status: 'done', text: '慢慢来。', createdAt: record.createdAt },
  ];
  const [recovered] = recoverTarotInterpretations([record]);
  assert.equal(record.interpretations[0].status, 'pending');
  assert.equal(recovered.interpretations[0].status, 'error');
  assert.match(recovered.interpretations[0].error ?? '', /1 次 AI/);
  assert.deepEqual(recovered.cards, record.cards);
  assert.deepEqual(recovered.interpretations[1], record.interpretations[1]);
});

test('five-card insight preserves every position and includes all five cards in AI and shared records', () => {
  const spread = TAROT_SPREADS.find(item => item.id === 'insight');
  assert.ok(spread);
  assert.deepEqual(spread.positions, ['现状', '阻碍', '背后影响', '建议', '可探索的方向']);
  const record = createTarotRecord({ spreadId: spread.id, question: '', userName: '我', includeReversed: true,
    cards: spread.positions.map((position, i) => makeTarotDraw(`major-${i}`, position, true, () => i % 2)) });
  assert.equal(record.question, spread.question);
  assert.ok(isTarotRecord(JSON.parse(JSON.stringify(record))));
  assert.equal(record.cards.length, 5);
  assert.ok(!isTarotRecord({ ...record, cards: record.cards.slice(0, 4) }));
  assert.ok(!isTarotRecord({ ...record, spreadId: 'focus' }));
  for (const [i, draw] of record.cards.entries()) {
    assert.ok(tarotContext(record).includes(`${i + 1}. ${draw.position}：`));
    assert.ok(tarotShareText(record).includes(`${i + 1}. ${draw.position}：`));
  }
  assert.ok(isTarotRecord(makeRecord()));
});

test('AI and forwarding contexts contain the exact cards, orientations and complete saved readings', () => {
  const record = makeRecord();
  record.interpretations = [{ id: 'done', reader: { mode: 'character', actorId: 'person', actorName: '林间' },
    status: 'done', text: '你可以一步一步尝试。', createdAt: record.createdAt }];
  const context = tarotContext(record);
  assert.match(context, /阻碍：魔术师.*逆位/);
  assert.match(context, /建议：女祭司.*正位/);
  const shared = tarotShareText(record);
  assert.match(shared, /林间的解读/);
  assert.match(shared, /一步一步尝试/);
  assert.match(shared, /不是未来预测/);
});
