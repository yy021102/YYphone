import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMove } from './GomokuGame';

const index = (x: number, y: number) => y * 15 + x;

test('hard mode finishes its own open four', () => {
  const board = Array(225).fill(0);
  for (let x = 5; x <= 8; x++) board[index(x, 7)] = 2;
  board[index(4, 6)] = 1;
  assert.ok([index(4, 7), index(9, 7)].includes(chooseMove(board, 2, 1, 'hard')));
});

test('hard mode blocks an immediate opponent win', () => {
  const board = Array(225).fill(0);
  board[index(4, 7)] = 2;
  for (let x = 5; x <= 8; x++) board[index(x, 7)] = 1;
  assert.equal(chooseMove(board, 2, 1, 'hard'), index(9, 7));
});
