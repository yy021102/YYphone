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

test('hard mode interrupts an open three before it becomes an open four', () => {
  const board = Array(225).fill(0);
  for (let x = 5; x <= 7; x++) board[index(x, 7)] = 1;
  board[index(1, 1)] = 2;
  board[index(2, 1)] = 2;
  const before = [...board];
  assert.ok([index(4, 7), index(8, 7)].includes(chooseMove(board, 2, 1, 'hard')));
  assert.deepEqual(board, before);
});

test('hard mode creates a two-direction threat when there is no forced defense', () => {
  const board = Array(225).fill(0);
  [[7, 6], [7, 8], [6, 7], [8, 7]].forEach(([x, y]) => { board[index(x, y)] = 2; });
  board[index(1, 1)] = 1;
  board[index(2, 1)] = 1;
  assert.equal(chooseMove(board, 2, 1, 'hard'), index(7, 7));
});
