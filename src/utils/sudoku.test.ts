import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidatesAt, countSolutions, createSudoku, findLogicalMove } from './sudoku';

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
