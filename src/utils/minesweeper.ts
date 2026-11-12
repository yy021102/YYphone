export type MineDifficulty = 'normal' | 'hard';
export const MINE_LEVELS = {
  normal: { label: '普通', columns: 9, rows: 9, count: 10 },
  hard: { label: '困难', columns: 9, rows: 12, count: 24 },
} as const;
export const MINESWEEPER_KEY = 'yyphone:minesweeper';
export interface MineGame {
  id: string; difficulty: MineDifficulty; mines: number[]; revealed: number[]; flags: number[];
  status: 'ready' | 'playing' | 'won' | 'lost'; startedAt?: number; endedAt?: number;
}
export interface SavedMines { version: 1; game: MineGame; best: Partial<Record<MineDifficulty, number>> }
export const mineDifficulty = (value: unknown): value is MineDifficulty => value === 'normal' || value === 'hard';
export function mineNeighbors(index: number, difficulty: MineDifficulty): number[] {
  const { columns, rows } = MINE_LEVELS[difficulty], row = Math.floor(index / columns), column = index % columns;
  const neighbors: number[] = [];
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    if ((!x && !y) || row + y < 0 || row + y >= rows || column + x < 0 || column + x >= columns) continue;
    neighbors.push((row + y) * columns + column + x);
  }
  return neighbors;
}
export const adjacentMines = (game: MineGame, index: number) => mineNeighbors(index, game.difficulty).filter(cell => game.mines.includes(cell)).length;
export const newMineGame = (difficulty: MineDifficulty = 'normal'): MineGame => ({ id: crypto.randomUUID(), difficulty, mines: [], revealed: [], flags: [], status: 'ready' });
export function mineSeconds(game: MineGame, now = Date.now()): number {
  return game.startedAt === undefined ? 0 : Math.max(0, Math.floor(((game.endedAt ?? now) - game.startedAt) / 1000));
}
export function toggleMineFlag(game: MineGame, index: number): MineGame {
  const { rows, columns, count } = MINE_LEVELS[game.difficulty];
  if (!Number.isInteger(index) || index < 0 || index >= rows * columns || game.status === 'won' || game.status === 'lost' || game.revealed.includes(index)) return game;
  if (game.flags.includes(index)) return { ...game, flags: game.flags.filter(cell => cell !== index) };
  return game.flags.length >= count ? game : { ...game, flags: [...game.flags, index] };
}
/** Place mines after the first reveal; the tapped cell and all eight neighbors are safe. */
function placeMines(game: MineGame, first: number, random: () => number): number[] {
  const { rows, columns, count } = MINE_LEVELS[game.difficulty];
  const safe = new Set([first, ...mineNeighbors(first, game.difficulty)]);
  const candidates = Array.from({ length: rows * columns }, (_, i) => i).filter(i => !safe.has(i));
  for (let index = 0; index < count; index++) {
    const chosen = index + Math.min(candidates.length - index - 1, Math.max(0, Math.floor(random() * (candidates.length - index))));
    [candidates[index], candidates[chosen]] = [candidates[chosen], candidates[index]];
  }
  return candidates.slice(0, count);
}
export function revealMineCell(game: MineGame, index: number, random = Math.random, now = Date.now()): MineGame {
  const { rows, columns } = MINE_LEVELS[game.difficulty];
  if (!Number.isInteger(index) || index < 0 || index >= rows * columns || game.status === 'won' || game.status === 'lost' || game.flags.includes(index)) return game;
  const neighbors = mineNeighbors(index, game.difficulty);
  const open = game.revealed.includes(index);
  // Tapping an open number clears its remaining neighbors only when the flag count matches.
  if (open && (!adjacentMines(game, index) || neighbors.filter(i => game.flags.includes(i)).length !== adjacentMines(game, index))) return game;
  const next: MineGame = game.status === 'ready' ? { ...game, mines: placeMines(game, index, random), startedAt: now, status: 'playing' } : game;
  const revealed = new Set(next.revealed), flags = new Set(next.flags), mines = new Set(next.mines);
  const queue = open ? neighbors : [index];
  let hit = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor];
    if (revealed.has(cell) || flags.has(cell)) continue;
    revealed.add(cell);
    if (mines.has(cell)) { hit = true; break; }
    if (!adjacentMines(next, cell)) queue.push(...mineNeighbors(cell, next.difficulty).filter(i => !revealed.has(i)));
  }
  if (revealed.size === next.revealed.length) return game;
  const won = !hit && revealed.size === rows * columns - mines.size;
  return { ...next, revealed: [...revealed], status: hit ? 'lost' : won ? 'won' : 'playing',
    ...(won ? { flags: [...mines] } : {}), ...(hit || won ? { endedAt: now } : {}) };
}
export function isSavedMines(value: unknown): value is SavedMines {
  const saved = value as SavedMines, game = saved?.game;
  if (!saved || saved.version !== 1 || !game || typeof game.id !== 'string' || !game.id || !mineDifficulty(game.difficulty) || !saved.best || typeof saved.best !== 'object' || Array.isArray(saved.best)) return false;
  const { rows, columns, count } = MINE_LEVELS[game.difficulty];
  const indices = (items: unknown): items is number[] => Array.isArray(items) && new Set(items).size === items.length && items.every(i => Number.isInteger(i) && i >= 0 && i < rows * columns);
  if (![game.mines, game.revealed, game.flags].every(indices) || game.flags.length > count || game.flags.some(i => game.revealed.includes(i)) ||
    !Object.entries(saved.best).every(([key, seconds]) => mineDifficulty(key) && Number.isSafeInteger(seconds) && seconds >= 0)) return false;
  if (game.status === 'ready') return !game.mines.length && !game.revealed.length && game.startedAt === undefined && game.endedAt === undefined;
  if (game.mines.length !== count || !Number.isFinite(game.startedAt) || game.startedAt! < 0 || !game.revealed.length) return false;
  const hit = game.revealed.some(i => game.mines.includes(i));
  if (game.status === 'playing') return !hit && game.revealed.length < rows * columns - count && game.endedAt === undefined;
  return (game.status === 'won' ? !hit && game.revealed.length === rows * columns - count : game.status === 'lost' && hit) && Number.isFinite(game.endedAt) && game.endedAt! >= game.startedAt!;
}
