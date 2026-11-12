import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMove2048, continue2048, finish2048, isSaved2048, move2048, new2048, report2048, shift2048, spawn2048, type Game2048State } from './game2048';

const board = (...values: number[]) => [...values, ...Array(16 - values.length).fill(0)];
const game = (values: number[]): Game2048State => ({ id: 'fixture', board: values, score: 0, moves: 0, hasWon: false, status: 'playing', startedAt: '2026-11-12T08:00:00Z' });

test('each tile merges at most once per move, with correct scoring and ordering', () => {
  assert.deepEqual(shift2048(board(2,2,2,2), 'left').board.slice(0,4), [4,4,0,0]);
  assert.equal(shift2048(board(2,2,2,2), 'left').gained, 8);
  assert.deepEqual(shift2048(board(2,2,4,0), 'left').board.slice(0,4), [4,4,0,0], 'a newly merged four cannot immediately merge again');
  assert.deepEqual(shift2048(board(2,2,4,4), 'right').board.slice(0,4), [0,0,4,8]);
  const vertical = board(2,0,0,0,2,0,0,0,4,0,0,0,4,0,0,0);
  assert.deepEqual([0,4,8,12].map(index => shift2048(vertical, 'up').board[index]), [4,8,0,0]);
  assert.deepEqual([0,4,8,12].map(index => shift2048(vertical, 'down').board[index]), [0,0,4,8]);
});

test('new games spawn two tiles; only effective moves spawn and increase move count', () => {
  const initial = new2048(() => 0); assert.equal(initial.board.filter(Boolean).length, 2); assert.equal(initial.score, 0);
  const original = game(board(2,0,0,0)); let calls = 0;
  assert.equal(move2048(original, 'left', () => { calls++; return 0; }), original); assert.equal(calls, 0);
  const merged = move2048(game(board(2,2)), 'left', () => 0);
  assert.deepEqual(merged.board.slice(0,4), [4,2,0,0]); assert.equal(merged.score, 4); assert.equal(merged.moves, 1);
  assert.deepEqual(original.board, board(2,0,0,0));
  assert.equal(spawn2048(board(2), () => .95).filter(n => n === 4).length, 1);
});

test('game-over detection respects row boundaries and only finishes when no move is possible', () => {
  const blocked = [2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  assert.equal(canMove2048(blocked), false, 'equal values at adjacent row ends do not count as neighbors');
  assert.equal(move2048(game(blocked), 'up').status, 'over');
  assert.equal(canMove2048([...blocked.slice(0,15),0]), true);
  assert.equal(canMove2048([2,2,...blocked.slice(2)]), true);
});

test('2048 win can be continued without repeated win pauses; finished games are inert and shareable', () => {
  const won = move2048(game(board(1024,1024)), 'left', () => 0, new Date('2026-11-12T08:01:00Z'));
  assert.equal(won.status, 'won'); assert.equal(won.hasWon, true); assert.equal(won.score, 2048);
  assert.equal(move2048(won, 'right'), won);
  const continued = continue2048(won); assert.equal(continued.status, 'playing'); assert.equal(continued.endedAt, undefined);
  const next = move2048(continued, 'right', () => 0); assert.notEqual(next.status, 'won');
  const ended = finish2048(next, new Date('2026-11-12T08:02:00Z')); assert.equal(move2048(ended, 'left'), ended);
  const detail = report2048(ended); assert.match(detail, /角色未参与/); assert.match(detail, /最大方块：2048/); assert.match(detail, /最终棋盘/); assert.match(detail, /曾合成 2048/);
});

test('saved boards validate before use, including best score and valid tile values', () => {
  const initial = game(board(2,4)); assert.equal(isSaved2048({ version:1, game:initial, best:0 }), true);
  for (const bad of [{ ...initial, board: board(3) }, { ...initial, board: [2] }, { ...initial, board: Array(16).fill(0) }, { ...initial, score: -1 }, { ...initial, startedAt: 'bad date' }]) assert.equal(isSaved2048({ version:1, game:bad, best:0 }), false);
  assert.equal(isSaved2048({ version:1, game:{ ...initial, score:10 }, best:4 }), false);
});
