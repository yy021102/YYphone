import assert from 'node:assert/strict';
import test from 'node:test';
import { botLiarAction, challengeLiar, newLiarRound, playLiarCards, type LiarRound } from './liarsBar';

const players = [{ id: 'user', name: '玩家' }, { id: 'c1', name: '甲' }];
const fixed = () => 0;

test('扣牌只接受当前玩家手中的一到三张，下一位才能质疑', () => {
  const game = newLiarRound(players, fixed);
  const first = game.seats[0].hand[0].id;
  assert.equal(playLiarCards(game, 1, [game.seats[1].hand[0].id]), game);
  assert.equal(playLiarCards(game, 0, [first, first]), game);
  const played = playLiarCards(game, 0, [first]);
  assert.equal(played.turn, 1);
  assert.equal(played.seats[0].hand.length, 4);
  assert.equal(played.pending?.cards[0].id, first);
  assert.equal(challengeLiar(played, 0, fixed), played);
});

test('质疑时只根据真实暗牌判定说谎者，落败者接受判定', () => {
  const base = newLiarRound(players, fixed);
  const liarCard = { id: 999, rank: base.table === 'A' ? 'K' as const : 'A' as const };
  const fake: LiarRound = { ...base, seats: base.seats.map((seat, index) => index === 0 ? { ...seat, hand: [liarCard] } : seat) };
  const played = playLiarCards(fake, 0, [999]);
  const resolved = challengeLiar(played, 1, fixed);
  assert.equal(resolved.seats[0].shots, 1);
  assert.equal(resolved.seats[1].shots, 0);
  assert.equal(resolved.reveal?.cards[0].rank, liarCard.rank);
  assert.match(resolved.log.join(' '), /确实在说谎/);
  const honestCard = { id: 998, rank: base.table };
  const honest: LiarRound = { ...base, seats: base.seats.map((seat, index) => index === 0 ? { ...seat, hand: [honestCard] } : seat) };
  const honestResult = challengeLiar(playLiarCards(honest, 0, [998]), 1, fixed);
  assert.equal(honestResult.seats[0].shots, 0);
  assert.equal(honestResult.seats[1].shots, 1);
});

test('六次命运判定中指定一次出局，最终只剩一位获胜', () => {
  const base = newLiarRound(players, fixed);
  const liarCard = { id: 999, rank: base.table === 'A' ? 'K' as const : 'A' as const };
  const ready: LiarRound = { ...base, seats: base.seats.map((seat, index) => index === 0 ? { ...seat, hand: [liarCard], danger: 0 } : seat) };
  const result = challengeLiar(playLiarCards(ready, 0, [999]), 1, fixed);
  assert.equal(result.seats[0].out, true);
  assert.equal(result.winner, 1);
});

test('机器人只在自己回合行动，并且永远从自己的手牌扣牌', () => {
  const base = newLiarRound(players, fixed);
  assert.equal(botLiarAction(base, fixed), base);
  const first = playLiarCards(base, 0, [base.seats[0].hand[0].id]);
  const originalIds = new Set(first.seats[1].hand.map((card) => card.id));
  const after = botLiarAction(first, () => 0.99);
  if (after.pending?.seat === 1) {
    assert.ok(after.pending.cards.every((card) => originalIds.has(card.id)));
  }
});
