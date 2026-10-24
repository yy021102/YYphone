export type ReversiStone = 0 | 1 | 2;
export type ReversiState = {
  board: ReversiStone[];
  turn: 1 | 2;
  moves: number;
  lastMove: number;
  flipped: number[];
  passed: 1 | 2 | null;
  finished: boolean;
};
const SIZE = 8;
const directions = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const other = (stone: 1 | 2): 1 | 2 => stone === 1 ? 2 : 1;
const inside = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const at = (x: number, y: number) => y * SIZE + x;

export const newReversiGame = (): ReversiState => {
  const board = Array<ReversiStone>(64).fill(0);
  board[at(3, 3)] = 2; board[at(4, 4)] = 2;
  board[at(4, 3)] = 1; board[at(3, 4)] = 1;
  return { board, turn: 1, moves: 0, lastMove: -1, flipped: [], passed: null, finished: false };
};

export const reversiFlips = (board: ReversiStone[], index: number, color: 1 | 2): number[] => {
  if (index < 0 || index >= 64 || board[index] !== 0) return [];
  const x = index % SIZE, y = Math.floor(index / SIZE), enemy = other(color);
  const flips: number[] = [];
  for (const [dx, dy] of directions) {
    let px = x + dx, py = y + dy;
    const line: number[] = [];
    while (inside(px, py) && board[at(px, py)] === enemy) {
      line.push(at(px, py)); px += dx; py += dy;
    }
    if (line.length && inside(px, py) && board[at(px, py)] === color) flips.push(...line);
  }
  return flips;
};

export const reversiMoves = (board: ReversiStone[], color: 1 | 2): number[] =>
  board.flatMap((stone, index) => stone === 0 && reversiFlips(board, index, color).length ? [index] : []);

export const placeReversiStone = (state: ReversiState, index: number): ReversiState | null => {
  if (state.finished) return null;
  const flipped = reversiFlips(state.board, index, state.turn);
  if (!flipped.length) return null;
  const board = [...state.board];
  board[index] = state.turn;
  flipped.forEach((point) => { board[point] = state.turn; });
  const enemy = other(state.turn);
  const enemyMoves = reversiMoves(board, enemy);
  const myMoves = enemyMoves.length ? [] : reversiMoves(board, state.turn);
  return { board, turn: enemyMoves.length ? enemy : state.turn, moves: state.moves + 1,
    lastMove: index, flipped, passed: enemyMoves.length ? null : enemy,
    finished: enemyMoves.length === 0 && myMoves.length === 0 };
};

export const reversiCounts = (board: ReversiStone[]) => ({
  black: board.filter((stone) => stone === 1).length,
  white: board.filter((stone) => stone === 2).length,
});

const WEIGHTS = [
  120, -25, 18, 7, 7, 18, -25, 120,
  -25, -45, -6, -5, -5, -6, -45, -25,
  18, -6, 12, 3, 3, 12, -6, 18,
  7, -5, 3, 2, 2, 3, -5, 7,
  7, -5, 3, 2, 2, 3, -5, 7,
  18, -6, 12, 3, 3, 12, -6, 18,
  -25, -45, -6, -5, -5, -6, -45, -25,
  120, -25, 18, 7, 7, 18, -25, 120,
];
const evaluate = (board: ReversiStone[], color: 1 | 2) => {
  const enemy = other(color), empties = board.filter((stone) => stone === 0).length;
  const material = board.reduce<number>((score, stone) => score + (stone === color ? 1 : stone === enemy ? -1 : 0), 0);
  const positional = board.reduce<number>((score, stone, index) => score + (stone === color ? WEIGHTS[index] : stone === enemy ? -WEIGHTS[index] : 0), 0);
  const mobility = reversiMoves(board, color).length - reversiMoves(board, enemy).length;
  return positional + mobility * 7 + material * (empties < 14 ? 12 : 0.4);
};

export const chooseReversiMove = (state: ReversiState, depth = 3): number => {
  const color = state.turn;
  const moves = reversiMoves(state.board, color);
  if (!moves.length) return -1;
  const search = (board: ReversiStone[], side: 1 | 2, remaining: number, alpha: number, beta: number): number => {
    const legal = reversiMoves(board, side);
    if (remaining <= 0) return evaluate(board, color);
    if (!legal.length) {
      if (!reversiMoves(board, other(side)).length) {
        const count = reversiCounts(board);
        const difference = color === 1 ? count.black - count.white : count.white - count.black;
        return difference * 10000;
      }
      return search(board, other(side), remaining - 1, alpha, beta);
    }
    const maximizing = side === color;
    let best = maximizing ? -Infinity : Infinity;
    for (const index of legal.sort((a, b) => WEIGHTS[b] - WEIGHTS[a])) {
      const next = placeReversiStone({ board, turn: side, moves: 0, lastMove: -1, flipped: [], passed: null, finished: false }, index)!;
      const value = search(next.board, next.turn, remaining - 1, alpha, beta);
      best = maximizing ? Math.max(best, value) : Math.min(best, value);
      if (maximizing) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  };
  let bestMove = moves[0], bestValue = -Infinity;
  for (const index of moves.sort((a, b) => WEIGHTS[b] - WEIGHTS[a])) {
    const next = placeReversiStone(state, index)!;
    const value = search(next.board, next.turn, depth, -Infinity, Infinity);
    if (value > bestValue) { bestValue = value; bestMove = index; }
  }
  return bestMove;
};
