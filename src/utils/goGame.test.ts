import assert from 'node:assert/strict';
import test from 'node:test';
import { goAreaScore, newGoGame, passGoTurn, placeGoStone, resumeGoGame, type GoState } from './goGame';

const at = (x: number, y: number) => y * 9 + x;
const setup = (stones: Array<[number, number, 1 | 2]>, turn: 1 | 2 = 1): GoState => {
  const state = newGoGame(9);
  stones.forEach(([x, y, color]) => { state.board[at(x, y)] = color; });
  return { ...state, turn, positions: [state.board.join('')] };
};

test('围棋提掉无气的整组棋', () => {
  const state = setup([[4, 4, 2], [4, 3, 1], [3, 4, 1], [5, 4, 1]]);
  const next = placeGoStone(state, at(4, 5));
  assert.ok(next);
  assert.equal(next.board[at(4, 4)], 0);
  assert.equal(next.captures[0], 1);
  assert.deepEqual(next.lastCaptured, [at(4, 4)]);
});

test('围棋禁止自杀及重复棋盘局面', () => {
  const state = setup([[4, 3, 2], [3, 4, 2], [5, 4, 2], [4, 5, 2]]);
  assert.equal(placeGoStone(state, at(4, 4)), null);
  const open = newGoGame(9);
  const played = placeGoStone(open, at(4, 4))!;
  assert.equal(placeGoStone({ ...open, positions: [...open.positions, played.board.join('')] }, at(4, 4)), null);
});

test('围棋真实劫形不能立即提回', () => {
  const state = setup([
    [4, 4, 2], [4, 3, 1], [3, 4, 1], [5, 4, 1],
    [3, 5, 2], [5, 5, 2], [4, 6, 2],
  ]);
  const captured = placeGoStone(state, at(4, 5));
  assert.ok(captured);
  assert.deepEqual(captured.lastCaptured, [at(4, 4)]);
  assert.equal(placeGoStone(captured, at(4, 4)), null);
});

test('连续停两手进入可恢复的计分阶段，面积包含活子和围空', () => {
  const board = setup([[4, 3, 1], [3, 4, 1], [5, 4, 1], [4, 5, 1], [0, 0, 2]]);
  const score = goAreaScore(board);
  assert.equal(score.black, 5);
  assert.equal(score.white, 6.5);
  const afterMarkingDead = goAreaScore(board, [at(0, 0)]);
  assert.equal(afterMarkingDead.board[at(0, 0)], 0);
  assert.ok(afterMarkingDead.black > score.black);
  const first = passGoTurn(board);
  assert.equal(first.phase, 'play');
  const second = passGoTurn(first);
  assert.equal(second.phase, 'score');
  assert.equal(resumeGoGame(second).phase, 'play');
});
