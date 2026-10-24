import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidatesAt, countSolutions, createSudoku, findLogicalMove } from './sudoku';
import { isSudokuProgress } from './sudokuProgress';

test('generated challenge has one valid solution', () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { puzzle, solution } = createSudoku();
    assert.equal(puzzle.length, 81);
    assert.ok(puzzle.filter(Boolean).length <= 30);
    assert.equal(countSolutions([...puzzle]), 1);
    for (let index = 0; index < 81; index++) {
      if (puzzle[index]) assert.equal(puzzle[index], solution[index]);
      else assert.ok(candidatesAt(puzzle, index).includes(solution[index]));
    }
  }
});

test('participant only fills a logically forced cell', () => {
  assert.equal(findLogicalMove(Array(81).fill(0)), null);
  const { solution } = createSudoku();
  const board = [...solution]; board[40] = 0;
  const move = findLogicalMove(board);
  assert.equal(move?.index, 40);
  assert.equal(move?.value, solution[40]);
});

test('hard challenge remains uniquely solvable after random transformations', () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { puzzle, solution } = createSudoku('hard');
    assert.equal(puzzle.filter(Boolean).length, 23);
    assert.equal(countSolutions([...puzzle]), 1);
    for (let index = 0; index < 81; index++) if (puzzle[index]) assert.equal(puzzle[index], solution[index]);
  }
});

test('saved progress accepts a valid board and rejects a changed clue', () => {
  const game = createSudoku();
  const progress = { version: 1, difficulty: 'normal', nextDifficulty: 'hard', ...game,
    grid: [...game.puzzle], gameId: 'game-1', selected: -1, notes: {}, pencil: false,
    mode: 'participate', characterId: 'role-1', speechHistory: ['角色：我来看看'],
    characterCells: [], recipients: [], shared: false, shareNote: '', hintIndex: -1,
    correctMoves: 0, seenCorrect: [], nextCommentAt: 5 };
  assert.equal(isSudokuProgress(progress), true);
  assert.equal(isSudokuProgress({ ...progress, chatHistory: [
    { from: 'user', name: '我', text: '这一步你怎么看？' },
    { from: 'character', name: '角色', text: '先看这一列。' },
  ] }), true);
  assert.equal(isSudokuProgress({ ...progress, chatHistory: [{ from: 'invalid', name: '角色', text: '无效' }] }), false);
  const index = game.puzzle.findIndex(Boolean);
  const changed = { ...progress, grid: [...progress.grid] };
  changed.grid[index] = 0;
  assert.equal(isSudokuProgress(changed), false);
});
