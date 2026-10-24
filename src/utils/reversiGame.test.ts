import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseReversiMove, newReversiGame, placeReversiStone, reversiCounts, reversiMoves, type ReversiStone } from './reversiGame';

test('黑白棋开局只有四个合法落点，非法落点不能改变棋盘', () => {
  const game = newReversiGame();
  assert.deepEqual(reversiMoves(game.board, 1).sort((a, b) => a - b), [19, 26, 37, 44]);
  assert.equal(placeReversiStone(game, 0), null);
  const next = placeReversiStone(game, 19)!;
  assert.equal(next.board[19], 1);
  assert.equal(next.board[27], 1);
  assert.equal(reversiCounts(next.board).black, 4);
});

test('黑白棋双方都无合法落点时立即结算', () => {
  const board = Array<ReversiStone>(64).fill(1);
  board[0] = 0;
  board[1] = 2;
  const game = { ...newReversiGame(), board };
  const next = placeReversiStone(game, 0)!;
  assert.equal(next.finished, true);
  assert.equal(next.board.filter((stone) => stone === 1).length, 64);
  assert.equal(reversiMoves(next.board, 2).length, 0);
});

test('黑白棋对手选点始终来自当前合法落点', () => {
  let game = newReversiGame();
  for (let step = 0; step < 16 && !game.finished; step++) {
    const legal = reversiMoves(game.board, game.turn);
    const move = chooseReversiMove(game, 2);
    assert.ok(legal.includes(move));
    game = placeReversiStone(game, move)!;
  }
});

test('一方无合法落点时自动跳过并由另一方继续', () => {
  let game = newReversiGame();
  let foundPass = false;
  for (let step = 0; step < 60 && !game.finished; step++) {
    const move = reversiMoves(game.board, game.turn)[0];
    const next = placeReversiStone(game, move)!;
    if (next.passed) {
      assert.equal(next.turn, game.turn);
      assert.ok(reversiMoves(next.board, next.turn).length > 0);
      foundPass = true;
      break;
    }
    game = next;
  }
  assert.equal(foundPass, true);
});
