import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adjacentMines, isSavedMines, MINE_LEVELS, mineNeighbors, mineSeconds, newMineGame, revealMineCell, toggleMineFlag, type MineGame } from './minesweeper';

const fixture = (): MineGame => ({ id: 'fixture', difficulty: 'normal', status: 'playing', startedAt: 1000, mines: [0,4,8,24,40,56,60,70,76,80], flags: [], revealed: [10] });
const seeded = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('both difficulties place exactly their mine count after first reveal, outside the complete safe opening', () => {
  for (const difficulty of ['normal', 'hard'] as const) for (const seed of [1,42,350,9981]) for (const first of [0,40,MINE_LEVELS[difficulty].columns * MINE_LEVELS[difficulty].rows - 1]) {
    const blank = newMineGame(difficulty); assert.equal(blank.mines.length, 0);
    const game = revealMineCell(blank, first, seeded(seed), 2000);
    assert.equal(game.mines.length, MINE_LEVELS[difficulty].count); assert.equal(new Set(game.mines).size, game.mines.length);
    assert(![first, ...mineNeighbors(first, difficulty)].some(cell => game.mines.includes(cell)));
    assert(game.revealed.includes(first)); assert.equal(adjacentMines(game, first), 0); assert.equal(game.startedAt, 2000);
    assert(isSavedMines({ version: 1, game, best: {} })); assert.equal(blank.status, 'ready');
  }
});

test('neighbors stay within rows; corner, edge and center numbers are correct', () => {
  assert.deepEqual(mineNeighbors(0, 'normal'), [1,9,10]);
  assert.deepEqual(mineNeighbors(8, 'normal'), [7,16,17]);
  assert.equal(mineNeighbors(40, 'normal').length, 8);
  assert.equal(adjacentMines(fixture(), 10), 1); assert.equal(adjacentMines(fixture(), 39), 1);
});

test('flood fill opens empty areas and numbered boundaries, while leaving flags and mines closed', () => {
  const game = { ...fixture(), flags: [73] }, next = revealMineCell(game, 72);
  assert(next.revealed.includes(72)); assert(next.revealed.includes(63)); assert(!next.revealed.includes(73));
  assert(!next.revealed.some(cell => next.mines.includes(cell))); assert.deepEqual(game.revealed, [10]);
});

test('flags toggle before the clock starts, cannot exceed mine count, and prevent opening', () => {
  const initial = newMineGame(), flagged = toggleMineFlag(initial, 0);
  assert.equal(flagged.status, 'ready'); assert.equal(flagged.startedAt, undefined);
  assert.equal(revealMineCell(flagged, 0), flagged); assert.deepEqual(toggleMineFlag(flagged, 0).flags, []);
  let game = initial; for (let i = 0; i < 10; i++) game = toggleMineFlag(game, i);
  assert.equal(toggleMineFlag(game, 10), game); assert.equal(toggleMineFlag(fixture(), 10).flags.length, 0);
  assert.equal(toggleMineFlag(initial, -1), initial); assert.equal(revealMineCell(initial, 1000), initial);
});

test('chording requires matching flags; a wrong matching flag can still hit a mine', () => {
  const original = fixture(); assert.equal(revealMineCell(original, 10), original);
  const good = revealMineCell({ ...original, flags: [0] }, 10);
  assert.notEqual(good.status, 'lost'); assert(good.revealed.includes(1)); assert(!good.revealed.includes(0));
  const wrong = revealMineCell({ ...original, flags: [1] }, 10, Math.random, 9000);
  assert.equal(wrong.status, 'lost'); assert(wrong.revealed.includes(0)); assert.equal(wrong.endedAt, 9000);
  assert.equal(revealMineCell(wrong, 2), wrong); assert.equal(toggleMineFlag(wrong, 2), wrong);
});

test('victory needs every safe square, not every flag; results freeze time and auto-mark mines', () => {
  const game = fixture(); game.revealed = Array.from({ length: 81 }, (_, index) => index).filter(i => !game.mines.includes(i) && i !== 1);
  const won = revealMineCell(game, 1, Math.random, 12345);
  assert.equal(won.status, 'won'); assert.deepEqual(won.flags, won.mines);
  assert.equal(mineSeconds(won, 999999), 11); assert.equal(mineSeconds(newMineGame()), 0);
  assert(isSavedMines({ version: 1, game: won, best: { normal: 11 } }));
  const lost = revealMineCell(fixture(), 0, Math.random, 12000);
  assert.equal(lost.status, 'lost'); assert(isSavedMines({ version: 1, game: lost, best: {} }));
});

test('saved game validation rejects duplicate/out-of-range tiles, inconsistent results and invalid times', () => {
  const saved = { version: 1, game: fixture(), best: {} }; assert(isSavedMines(JSON.parse(JSON.stringify(saved))));
  for (const patch of [{ mines: [0,0,...fixture().mines.slice(2)] }, { flags: [10] }, { revealed: [100] }, { status: 'won' }, { status: 'ready' }, { startedAt: 'yesterday' }, { mines: [] }]) {
    assert.equal(isSavedMines({ ...saved, game: { ...saved.game, ...patch } }), false);
  }
  assert.equal(isSavedMines({ ...saved, best: { normal: -1 } }), false);
});
