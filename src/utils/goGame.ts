export type GoStone = 0 | 1 | 2;
export type GoSize = 9 | 13;
export type GoState = {
  size: GoSize;
  board: GoStone[];
  turn: 1 | 2;
  passes: number;
  phase: 'play' | 'score';
  moves: number;
  captures: [number, number];
  positions: string[];
  lastMove: number;
  lastCaptured: number[];
};

const opponent = (stone: 1 | 2): 1 | 2 => stone === 1 ? 2 : 1;
const keyOf = (board: GoStone[]) => board.join('');
export const newGoGame = (size: GoSize = 9): GoState => {
  const board = Array<GoStone>(size * size).fill(0);
  return { size, board, turn: 1, passes: 0, phase: 'play', moves: 0,
    captures: [0, 0], positions: [keyOf(board)], lastMove: -1, lastCaptured: [] };
};

export const goNeighbors = (index: number, size: number) => {
  const x = index % size, y = Math.floor(index / size);
  return [x > 0 ? index - 1 : -1, x < size - 1 ? index + 1 : -1,
    y > 0 ? index - size : -1, y < size - 1 ? index + size : -1].filter((value) => value >= 0);
};

export const goGroup = (board: GoStone[], start: number, size: number): { stones: number[]; liberties: number[] } => {
  const color = board[start];
  if (!color) return { stones: [], liberties: [] };
  const stones: number[] = [], liberties = new Set<number>(), seen = new Set([start]), stack = [start];
  while (stack.length) {
    const index = stack.pop()!;
    stones.push(index);
    for (const next of goNeighbors(index, size)) {
      if (board[next] === 0) liberties.add(next);
      else if (board[next] === color && !seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return { stones, liberties: [...liberties] };
};

export const placeGoStone = (state: GoState, index: number): GoState | null => {
  if (state.phase !== 'play' || index < 0 || index >= state.board.length || state.board[index] !== 0) return null;
  const board = [...state.board];
  board[index] = state.turn;
  const captured = new Set<number>();
  for (const neighbor of goNeighbors(index, state.size)) {
    if (board[neighbor] !== opponent(state.turn)) continue;
    const group = goGroup(board, neighbor, state.size);
    if (group.liberties.length === 0) group.stones.forEach((stone) => captured.add(stone));
  }
  captured.forEach((stone) => { board[stone] = 0; });
  if (goGroup(board, index, state.size).liberties.length === 0) return null;
  const key = keyOf(board);
  if (state.positions.includes(key)) return null;
  const captures: [number, number] = [...state.captures] as [number, number];
  captures[state.turn - 1] += captured.size;
  return { ...state, board, turn: opponent(state.turn), passes: 0, moves: state.moves + 1,
    captures, positions: [...state.positions, key], lastMove: index, lastCaptured: [...captured] };
};

export const passGoTurn = (state: GoState): GoState => {
  if (state.phase !== 'play') return state;
  const passes = state.passes + 1;
  return { ...state, turn: opponent(state.turn), passes, moves: state.moves + 1,
    phase: passes >= 2 ? 'score' : 'play', lastMove: -1, lastCaptured: [] };
};

export const resumeGoGame = (state: GoState): GoState =>
  state.phase === 'score' ? { ...state, phase: 'play', passes: 0 } : state;

export const goAreaScore = (state: GoState, dead: number[] = []) => {
  const board = [...state.board];
  const removed = new Set(dead);
  removed.forEach((index) => { if (index >= 0 && index < board.length) board[index] = 0; });
  const territory: Array<GoStone | 3> = Array(board.length).fill(0);
  const seen = new Set<number>();
  let black = board.filter((stone) => stone === 1).length;
  let white = board.filter((stone) => stone === 2).length;
  for (let start = 0; start < board.length; start++) {
    if (board[start] !== 0 || seen.has(start)) continue;
    const region: number[] = [], borders = new Set<GoStone>(), stack = [start];
    seen.add(start);
    while (stack.length) {
      const index = stack.pop()!;
      region.push(index);
      for (const next of goNeighbors(index, state.size)) {
        if (board[next]) borders.add(board[next]);
        else if (!seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    const owner: GoStone | 3 = borders.size === 1 ? [...borders][0] : borders.size === 0 ? 0 : 3;
    region.forEach((index) => { territory[index] = owner; });
    if (owner === 1) black += region.length;
    if (owner === 2) white += region.length;
  }
  const komi = state.size === 9 ? 5.5 : 6.5;
  return { black, white: white + komi, komi, territory, board,
    winner: black > white + komi ? 1 as const : 2 as const };
};

export const chooseGoMove = (state: GoState): number => {
  if (state.phase !== 'play') return -1;
  const color = state.turn, other = opponent(color), size = state.size;
  const score = goAreaScore(state);
  if (state.passes === 1 && state.moves > size * size * 0.65 &&
    (color === 1 ? score.black > score.white + 2 : score.white > score.black + 2)) return -1;
  const occupied = state.board.flatMap((stone, index) => stone ? [index] : []);
  let best = -1, bestValue = -Infinity;
  for (let index = 0; index < state.board.length; index++) {
    if (state.board[index]) continue;
    const neighbors = goNeighbors(index, size);
    const ownTouch = neighbors.filter((next) => state.board[next] === color).length;
    const enemyTouch = neighbors.filter((next) => state.board[next] === other).length;
    if (ownTouch === neighbors.length && !enemyTouch) continue;
    const next = placeGoStone(state, index);
    if (!next) continue;
    const captured = next.lastCaptured.length;
    const ownGroup = goGroup(next.board, index, size);
    if (ownGroup.liberties.length === 1 && !captured) continue;
    const x = index % size, y = Math.floor(index / size);
    const cornerStar = Math.min(Math.abs(x - 2), Math.abs(x - (size - 3))) +
      Math.min(Math.abs(y - 2), Math.abs(y - (size - 3)));
    let value = captured * 90 + enemyTouch * 5 + ownTouch * 1.5 + Math.min(ownGroup.liberties.length, 6) * 1.1;
    if (occupied.length < 8) value += Math.max(0, 8 - cornerStar * 2);
    if (occupied.length && !neighbors.some((neighbor) => state.board[neighbor])) {
      const nearest = Math.min(...occupied.map((point) => Math.max(Math.abs(point % size - x), Math.abs(Math.floor(point / size) - y))));
      value += nearest === 2 ? 3 : nearest > 4 ? -4 : 0;
    }
    if (score.territory[index] === color && !enemyTouch && !captured) value -= 35;
    for (const neighbor of neighbors) if (state.board[neighbor] === color) {
      const before = goGroup(state.board, neighbor, size);
      if (before.liberties.length === 1 && ownGroup.liberties.length > 1) value += before.stones.length * 25;
    }
    value += Math.random() * 0.8;
    if (value > bestValue) { bestValue = value; best = index; }
  }
  return bestValue < -5 ? -1 : best;
};
