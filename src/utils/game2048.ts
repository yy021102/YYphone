export type Direction2048 = 'left' | 'right' | 'up' | 'down';
export interface Game2048State {
  id: string; board: number[]; score: number; moves: number; hasWon: boolean;
  status: 'playing' | 'won' | 'over' | 'ended'; startedAt: string; endedAt?: string;
}
export interface Saved2048 { version: 1; game: Game2048State; best: number }
export const GAME_2048_KEY = 'yyphone:game-2048';
export function isGame2048(value: unknown): value is Game2048State {
  const game = value as Game2048State;
  return !!game && typeof game.id === 'string' && !!game.id && Array.isArray(game.board) && game.board.length === 16 &&
    game.board.some(Boolean) &&
    game.board.every(n => Number.isSafeInteger(n) && (n === 0 || n >= 2 && Number.isInteger(Math.log2(n)))) &&
    Number.isSafeInteger(game.score) && game.score >= 0 && Number.isSafeInteger(game.moves) && game.moves >= 0 &&
    typeof game.hasWon === 'boolean' && ['playing', 'won', 'over', 'ended'].includes(game.status) &&
    typeof game.startedAt === 'string' && Number.isFinite(Date.parse(game.startedAt)) &&
    (game.endedAt === undefined || typeof game.endedAt === 'string' && Number.isFinite(Date.parse(game.endedAt)));
}
export const isSaved2048 = (value: unknown): value is Saved2048 => {
  const saved = value as Saved2048;
  return !!saved && saved.version === 1 && isGame2048(saved.game) && Number.isSafeInteger(saved.best) && saved.best >= saved.game.score;
};

export function spawn2048(board: number[], random = Math.random): number[] {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return board;
  const next = [...board], index = empty[Math.min(empty.length - 1, Math.max(0, Math.floor(random() * empty.length)))];
  next[index] = random() < .9 ? 2 : 4;
  return next;
}
export function new2048(random = Math.random, now = new Date()): Game2048State {
  return { id: crypto.randomUUID(), board: spawn2048(spawn2048(Array(16).fill(0), random), random), score: 0, moves: 0, hasWon: false, status: 'playing', startedAt: now.toISOString() };
}
export function shift2048(board: number[], direction: Direction2048) {
  const next = Array(16).fill(0); let gained = 0;
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, index) => direction === 'left' ? line * 4 + index : direction === 'right' ? line * 4 + 3 - index : direction === 'up' ? index * 4 + line : (3 - index) * 4 + line);
    const values = indices.map(index => board[index]).filter(Boolean), merged: number[] = [];
    for (let index = 0; index < values.length; index++) {
      if (values[index] === values[index + 1]) { const value = values[index] * 2; merged.push(value); gained += value; index++; }
      else merged.push(values[index]);
    }
    indices.forEach((index, position) => { next[index] = merged[position] ?? 0; });
  }
  return { board: next, gained, changed: board.some((value, index) => value !== next[index]) };
}
export function canMove2048(board: number[]): boolean {
  return board.some((value, index) => value === 0 || index % 4 < 3 && value === board[index + 1] || index < 12 && value === board[index + 4]);
}
export function move2048(game: Game2048State, direction: Direction2048, random = Math.random, now = new Date()): Game2048State {
  if (game.status !== 'playing') return game;
  const moved = shift2048(game.board, direction);
  if (!moved.changed) return canMove2048(game.board) ? game : { ...game, status: 'over', endedAt: now.toISOString() };
  const board = spawn2048(moved.board, random), won = !game.hasWon && Math.max(...board) >= 2048;
  const status = won ? 'won' : canMove2048(board) ? 'playing' : 'over';
  return { ...game, board, score: game.score + moved.gained, moves: game.moves + 1, hasWon: game.hasWon || won, status, ...(status !== 'playing' ? { endedAt: now.toISOString() } : {}) };
}
export function continue2048(game: Game2048State): Game2048State {
  if (game.status !== 'won') return game;
  return canMove2048(game.board) ? { ...game, status: 'playing', endedAt: undefined } : { ...game, status: 'over' };
}
export function finish2048(game: Game2048State, now = new Date()): Game2048State {
  return game.status === 'playing' ? { ...game, status: 'ended', endedAt: now.toISOString() } : game;
}
export function report2048(game: Game2048State) {
  const seconds = Math.max(0, Math.floor((Date.parse(game.endedAt ?? game.startedAt) - Date.parse(game.startedAt)) / 1000));
  return [
    '2048 · 单人游戏记录', '这是玩家独自游玩的记录，角色未参与本局。',
    `得分：${game.score} 分`, `最大方块：${Math.max(...game.board)}`, `有效步数：${game.moves}`, `本局时长：${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`,
    `结果：${game.status === 'won' ? '合成 2048' : game.status === 'over' ? '无可移动方块，本局结束' : '玩家结束本局'}${game.hasWon && game.status !== 'won' ? '，曾合成 2048' : ''}`,
    `结束时间：${new Date(game.endedAt ?? game.startedAt).toLocaleString('zh-CN')}`, '最终棋盘：',
    ...Array.from({ length: 4 }, (_, row) => game.board.slice(row * 4, row * 4 + 4).map(n => n || '·').join('  ')),
  ].join('\n');
}
