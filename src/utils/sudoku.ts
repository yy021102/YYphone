export type SudokuGrid = number[];
export type SudokuDifficulty = 'normal' | 'hard';
const row = (index: number) => Math.floor(index / 9);
const col = (index: number) => index % 9;
const box = (index: number) => Math.floor(row(index) / 3) * 3 + Math.floor(col(index) / 3);

export const candidatesAt = (grid: SudokuGrid, index: number): number[] => {
  if (grid[index]) return [];
  const used = new Set(grid.filter((value, other) => value &&
    (row(index) === row(other) || col(index) === col(other) || box(index) === box(other))));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(value => !used.has(value));
};

export interface LogicalMove { index: number; value: number; reason: string }
export const findLogicalMove = (grid: SudokuGrid): LogicalMove | null => {
  for (let index = 0; index < 81; index++) {
    if (grid[index]) continue;
    const options = candidatesAt(grid, index);
    if (options.length === 1) return { index, value: options[0], reason: '这一格排除同行、同列和同宫的数字后只剩一个候选' };
  }
  const units: Array<{ cells: number[]; name: string }> = [];
  for (let n = 0; n < 9; n++) {
    units.push({ cells: Array.from({ length: 9 }, (_, c) => n * 9 + c), name: `第${n + 1}行` });
    units.push({ cells: Array.from({ length: 9 }, (_, r) => r * 9 + n), name: `第${n + 1}列` });
    units.push({ cells: Array.from({ length: 9 }, (_, k) => (Math.floor(n / 3) * 3 + Math.floor(k / 3)) * 9 + n % 3 * 3 + k % 3), name: `第${n + 1}宫` });
  }
  for (const unit of units) for (let value = 1; value <= 9; value++) {
    if (unit.cells.some(index => grid[index] === value)) continue;
    const places = unit.cells.filter(index => !grid[index] && candidatesAt(grid, index).includes(value));
    if (places.length === 1) return { index: places[0], value, reason: `${unit.name}只有这一格能填${value}` };
  }
  return null;
};

export const countSolutions = (grid: SudokuGrid, limit = 2): number => {
  let choice = -1, options: number[] = [];
  for (let index = 0; index < 81; index++) {
    if (grid[index]) continue;
    const next = candidatesAt(grid, index);
    if (!next.length) return 0;
    if (choice < 0 || next.length < options.length) { choice = index; options = next; }
    if (options.length === 1) break;
  }
  if (choice < 0) return 1;
  let count = 0;
  for (const value of options) {
    grid[choice] = value;
    count += countSolutions(grid, limit - count);
    if (count >= limit) break;
  }
  grid[choice] = 0;
  return count;
};

const shuffle = <T,>(items: T[]): T[] => {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
};

const HARD_TEMPLATE = '100007090030020008009600500005300900010080002600004000300000010040000007007000300'
  .split('').map(Number);
const solveOne = (grid: SudokuGrid): SudokuGrid | null => {
  let choice = -1, options: number[] = [];
  for (let index = 0; index < 81; index++) {
    if (grid[index]) continue;
    const next = candidatesAt(grid, index);
    if (!next.length) return null;
    if (choice < 0 || next.length < options.length) { choice = index; options = next; }
  }
  if (choice < 0) return [...grid];
  for (const value of options) {
    grid[choice] = value;
    const solved = solveOne(grid);
    if (solved) { grid[choice] = 0; return solved; }
  }
  grid[choice] = 0;
  return null;
};
const HARD_SOLUTION = solveOne([...HARD_TEMPLATE]);

export const createSudoku = (difficulty: SudokuDifficulty = 'normal'): { puzzle: SudokuGrid; solution: SudokuGrid } => {
  const rows = shuffle([0, 1, 2]).flatMap(band => shuffle([0, 1, 2]).map(within => band * 3 + within));
  const cols = shuffle([0, 1, 2]).flatMap(stack => shuffle([0, 1, 2]).map(within => stack * 3 + within));
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  if (difficulty === 'hard') {
    if (!HARD_SOLUTION) throw new Error('高难数独题库无有效解。');
    const transpose = Math.random() < 0.5;
    const transform = (source: SudokuGrid) => Array.from({ length: 81 }, (_, index) => {
      const from = transpose ? cols[col(index)] * 9 + rows[row(index)] : rows[row(index)] * 9 + cols[col(index)];
      return source[from] ? digits[source[from] - 1] : 0;
    });
    return { puzzle: transform(HARD_TEMPLATE), solution: transform(HARD_SOLUTION) };
  }
  const solution = Array.from({ length: 81 }, (_, index) =>
    digits[(rows[row(index)] * 3 + Math.floor(rows[row(index)] / 3) + cols[col(index)]) % 9]);
  const puzzle = [...solution];
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (puzzle.filter(Boolean).length <= 29) break;
    const value = puzzle[index]; puzzle[index] = 0;
    if (countSolutions([...puzzle]) !== 1) puzzle[index] = value;
  }
  return { puzzle, solution };
};
