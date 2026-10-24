export type LiarRank = 'A' | 'K' | 'Q' | 'J';
export type LiarSeat = { id: string; name: string; hand: LiarCard[]; shots: number; danger: number; out: boolean };
export type LiarCard = { id: number; rank: LiarRank };
export type LiarPlay = { seat: number; cards: LiarCard[] };
export type LiarRound = {
  id: string; seats: LiarSeat[]; table: Exclude<LiarRank, 'J'>; turn: number;
  pending: LiarPlay | null; round: number; log: string[]; reveal: LiarPlay | null; winner: number | null;
};

const ranks: LiarRank[] = [...Array(6).fill('A'), ...Array(6).fill('K'), ...Array(6).fill('Q'), 'J', 'J'];
const tables: Array<Exclude<LiarRank, 'J'>> = ['A', 'K', 'Q'];
const randomInt = (max: number, random: () => number) => Math.floor(random() * max);
const shuffled = <T,>(values: T[], random: () => number) => {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index--) {
    const other = randomInt(index + 1, random);
    [next[index], next[other]] = [next[other], next[index]];
  }
  return next;
};
const aliveIndices = (seats: LiarSeat[]) => seats.flatMap((seat, index) => seat.out ? [] : [index]);
export const nextLiarSeat = (seats: LiarSeat[], from: number) => {
  for (let step = 1; step <= seats.length; step++) {
    const candidate = (from + step) % seats.length;
    if (!seats[candidate].out) return candidate;
  }
  return from;
};

const deal = (game: LiarRound, random: () => number, first: number): LiarRound => {
  const deck = shuffled(ranks.map((rank, id) => ({ id, rank })), random);
  const seats = game.seats.map((seat) => ({ ...seat, hand: seat.out ? [] : Array.from({ length: 5 }, () => deck.pop()!) }));
  const table = tables[randomInt(tables.length, random)];
  return { ...game, seats, table, turn: seats[first]?.out ? nextLiarSeat(seats, first) : first,
    pending: null, round: game.round + 1,
    log: [...game.log, `第 ${game.round + 1} 局开桌：本轮声明 ${table}，J 可代替。`].slice(-30) };
};

export const newLiarRound = (players: Array<{ id: string; name: string }>, random: () => number = Math.random): LiarRound => {
  if (players.length < 2 || players.length > 4) throw new Error('骗子酒馆需要 2 至 4 人。');
  const seats = players.map((player) => ({ ...player, hand: [] as LiarCard[], shots: 0,
    danger: randomInt(6, random), out: false }));
  return deal({ id: `liar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, seats,
    table: 'A', turn: 0, pending: null, round: 0, log: [], reveal: null, winner: null }, random, 0);
};

export const playLiarCards = (game: LiarRound, seatIndex: number, ids: number[]): LiarRound => {
  if (game.winner !== null || game.turn !== seatIndex || ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length) return game;
  const seat = game.seats[seatIndex];
  const cards = ids.map((id) => seat.hand.find((card) => card.id === id));
  if (cards.some((card) => !card)) return game;
  const seats = game.seats.map((entry, index) => index === seatIndex
    ? { ...entry, hand: entry.hand.filter((card) => !ids.includes(card.id)) } : entry);
  return { ...game, seats, pending: { seat: seatIndex, cards: cards as LiarCard[] }, reveal: null,
    turn: nextLiarSeat(seats, seatIndex),
    log: [...game.log, `${seat.name}扣下 ${ids.length} 张牌，声称都是 ${game.table}。`].slice(-30) };
};

export const challengeLiar = (game: LiarRound, challenger: number, random: () => number = Math.random): LiarRound => {
  if (game.winner !== null || game.turn !== challenger || !game.pending) return game;
  const pending = game.pending;
  const liar = pending.cards.some((card) => card.rank !== game.table && card.rank !== 'J');
  const loser = liar ? pending.seat : challenger;
  const seats = game.seats.map((seat) => ({ ...seat, hand: [...seat.hand] }));
  const target = seats[loser];
  const eliminated = target.shots === target.danger;
  target.shots += 1;
  target.out = eliminated;
  const ranksShown = pending.cards.map((card) => card.rank).join('、');
  const log = [...game.log, `${seats[challenger].name}质疑了${seats[pending.seat].name}：翻开 ${ranksShown}，${liar ? '确实在说谎' : '全部有效'}。`,
    `${target.name}接受第 ${target.shots}/6 次命运判定，${eliminated ? '本局出局' : '平安过关'}。`].slice(-30);
  const survivors = aliveIndices(seats);
  const resolved: LiarRound = { ...game, seats, log, reveal: pending, pending: null,
    winner: survivors.length === 1 ? survivors[0] : null };
  return resolved.winner !== null ? resolved : deal(resolved, random, eliminated ? nextLiarSeat(seats, loser) : loser);
};

export const botLiarAction = (game: LiarRound, random: () => number = Math.random): LiarRound => {
  const index = game.turn;
  if (index === 0 || game.seats[index].out || game.winner !== null) return game;
  const hand = game.seats[index].hand;
  if (game.pending) {
    const declared = game.pending.cards.length;
    const knownValid = hand.filter((card) => card.rank === game.table || card.rank === 'J').length;
    const suspicious = Math.min(0.82, 0.1 + declared * 0.13 + knownValid * 0.075 + (hand.length === 0 ? 0.5 : 0));
    if (random() < suspicious) return challengeLiar(game, index, random);
  }
  if (hand.length === 0) return game.pending ? challengeLiar(game, index, random) : deal(game, random, index);
  const valid = hand.filter((card) => card.rank === game.table || card.rank === 'J');
  const bluff = valid.length === 0 || random() < 0.22;
  const chosen = shuffled(bluff ? hand : valid, random).slice(0, Math.min(hand.length, random() < 0.26 ? 2 : 1));
  return playLiarCards(game, index, chosen.map((card) => card.id));
};
