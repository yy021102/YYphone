import assert from 'node:assert/strict';
import test from 'node:test';
import { actionCost, compareHands, formatPokerResult, handScore, newPokerGame, pokerAction, pokerPayout, pokerSeatNet, type PokerCard } from './zhaJinHua';

const cards = (ranks: number[], suits: PokerCard['suit'][] = ['♠', '♥', '♣']): PokerCard[] => ranks.map((rank, i) => ({ rank, suit: suits[i] }));

test('三张牌型顺序与 A23 特例', () => {
  const hands = [
    cards([14, 14, 14]),
    cards([12, 13, 14], ['♠', '♠', '♠']),
    cards([2, 7, 10], ['♥', '♥', '♥']),
    cards([7, 8, 9]),
    cards([11, 11, 2]),
    cards([14, 10, 5]),
  ];
  for (let i = 0; i < hands.length - 1; i++) assert.ok(compareHands(hands[i], hands[i + 1]) > 0);
  assert.deepEqual(handScore(cards([14, 2, 3])), [3, 3]);
  assert.ok(compareHands(cards([2, 3, 4]), cards([14, 2, 3])) > 0);
});

test('分享记录包含对话、所有牌面和逐人盈亏', () => {
  const game = newPokerGame([{ id: 'user', name: '玩家' }, { id: 'a', name: '甲' }, { id: 'b', name: '乙' }], 20, () => 0.3);
  const finished = { ...game, winner: 1, chat: [
    { id: 'one', senderId: 'user', name: '玩家', text: '敢不敢比牌？', at: '2026-01-01T00:00:00Z' },
    { id: 'two', senderId: 'a', name: '甲', text: '来。', at: '2026-01-01T00:00:01Z' },
  ] };
  const detail = formatPokerResult(finished);
  for (const seat of finished.seats) {
    assert.ok(detail.includes(seat.name));
    for (const card of seat.cards) assert.ok(detail.includes(card.suit));
  }
  assert.ok(detail.includes('玩家：敢不敢比牌？'));
  assert.ok(detail.includes('甲：来。'));
  assert.equal(finished.seats.reduce((sum, _, index) => sum + pokerSeatNet(finished, index), 0), 0);
});

test('买入筹码守恒，看牌投注翻倍，同牌比牌发起者出局', () => {
  const game = newPokerGame([{ id: 'user', name: '我' }, { id: 'a', name: '甲' }, { id: 'b', name: '乙' }], 20, () => 0.4);
  assert.equal(game.seats.reduce((sum, seat) => sum + seat.chips, 0) + game.pot, 60);
  const looked = pokerAction(game, 'look');
  assert.equal(actionCost(looked), game.bet * 2);
  const called = pokerAction(looked, 'call');
  assert.equal(called.seats[0].chips, game.seats[0].chips - game.bet * 2);
  assert.equal(called.seats.reduce((sum, seat) => sum + seat.chips, 0) + called.pot, 60);
  const tied = { ...called, turn: 0, actions: 2, seats: called.seats.map((seat, i) => ({ ...seat, cards: i === 1 ? called.seats[0].cards : seat.cards })) };
  const compared = pokerAction(tied, 'compare', 1);
  assert.equal(compared.seats[0].folded, true);
  assert.equal(compared.seats.reduce((sum, seat) => sum + seat.chips, 0) + compared.pot, 60);
  assert.ok(pokerPayout(compared) >= 0);
});
