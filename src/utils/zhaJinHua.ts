export type PokerSuit = '♠' | '♥' | '♣' | '♦';
export type PokerCard = { rank: number; suit: PokerSuit };
export type PokerSeat = { id: string; name: string; cards: PokerCard[]; chips: number; folded: boolean; looked: boolean };
export type PokerChatLine = { id: string; senderId: string; name: string; text: string; at: string };
export type PokerGame = {
  id: string;
  buyIn: number;
  seats: PokerSeat[];
  pot: number;
  bet: number;
  turn: number;
  actions: number;
  winner: number | null;
  log: string[];
  chat?: PokerChatLine[];
};

export const POKER_SUITS: PokerSuit[] = ['♠', '♥', '♣', '♦'];
export const cardText = (card: PokerCard) => `${card.suit}${card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : card.rank}`;

// 豹子 > 顺金 > 金花 > 顺子 > 对子 > 单张。A23 是最小顺子。
export function handScore(cards: PokerCard[]): number[] {
  if (cards.length !== 3) throw new Error('需要三张牌');
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const flush = cards.every(c => c.suit === cards[0].suit);
  const straightHigh = ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2
    ? 3 : ranks[0] - 1 === ranks[1] && ranks[1] - 1 === ranks[2] ? ranks[0] : 0;
  if (ranks[0] === ranks[2]) return [6, ranks[0]];
  if (flush && straightHigh) return [5, straightHigh];
  if (flush) return [4, ...ranks];
  if (straightHigh) return [3, straightHigh];
  if (ranks[0] === ranks[1]) return [2, ranks[0], ranks[2]];
  if (ranks[1] === ranks[2]) return [2, ranks[1], ranks[0]];
  return [1, ...ranks];
}

export const HAND_NAMES = ['','单张','对子','顺子','金花','顺金','豹子'];
export function compareHands(a: PokerCard[], b: PokerCard[]): number {
  const left = handScore(a), right = handScore(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if ((left[i] ?? 0) !== (right[i] ?? 0)) return (left[i] ?? 0) - (right[i] ?? 0);
  }
  return 0;
}

const active = (game: PokerGame) => game.seats.map((seat, index) => !seat.folded ? index : -1).filter(index => index >= 0);
const nextTurn = (game: PokerGame, from: number) => {
  for (let step = 1; step <= game.seats.length; step++) {
    const index = (from + step) % game.seats.length;
    if (!game.seats[index].folded) return index;
  }
  return from;
};
const finish = (game: PokerGame, reason: string): PokerGame => {
  const contenders = active(game);
  const winner = contenders.reduce((best, index) => compareHands(game.seats[index].cards, game.seats[best].cards) > 0 ? index : best, contenders[0]);
  return { ...game, winner, log: [...game.log, `${reason}，${game.seats[winner].name}赢得底池 ${game.pot}。`] };
};

export function newPokerGame(players: { id: string; name: string }[], buyIn: number, random = Math.random): PokerGame {
  if (players.length !== 3 || !Number.isSafeInteger(buyIn) || buyIn < 10) throw new Error('需要三名玩家，买入至少 10 元');
  const deck = POKER_SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 2 })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const ante = Math.max(1, Math.floor(buyIn / 20));
  return {
    id: `zjh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    buyIn,
    seats: players.map((player, i) => ({ ...player, cards: deck.slice(i * 3, i * 3 + 3), chips: buyIn - ante, folded: false, looked: false })),
    pot: ante * 3, bet: ante, turn: 0, actions: 0, winner: null,
    log: [`三人入座，各下底注 ${ante}。`], chat: [],
  };
}

export function actionCost(game: PokerGame, seat = game.turn, bet = game.bet): number {
  return bet * (game.seats[seat].looked ? 2 : 1);
}

export function pokerAction(game: PokerGame, action: 'look' | 'call' | 'raise' | 'fold' | 'compare', target?: number): PokerGame {
  if (game.winner !== null) return game;
  const actor = game.turn;
  const seats = game.seats.map(seat => ({ ...seat }));
  const player = seats[actor];
  const log = [...game.log];
  if (action === 'look') {
    if (player.looked) return game;
    player.looked = true;
    return { ...game, seats, log: [...log, `${player.name}看了牌。`] };
  }
  if (action === 'fold') {
    player.folded = true;
    log.push(`${player.name}弃牌。`);
  } else if (action === 'compare') {
    if (game.actions < 2 || target === undefined || target === actor || !seats[target] || seats[target].folded) return game;
    const cost = actionCost(game, actor) * 2;
    if (player.chips < cost) return game;
    player.chips -= cost;
    const result = compareHands(player.cards, seats[target].cards);
    const loser = result > 0 ? target : actor; // 同牌时，发起比牌的人输。
    seats[loser].folded = true;
    log.push(`${player.name}花 ${cost} 与${seats[target].name}比牌，${seats[loser].name}出局。`);
    game = { ...game, pot: game.pot + cost };
  } else {
    const newBet = action === 'raise' ? Math.min(game.bet * 2, Math.max(2, Math.floor(game.buyIn / 4))) : game.bet;
    if (action === 'raise' && newBet <= game.bet) return game;
    const cost = actionCost(game, actor, newBet);
    if (player.chips < cost) return game;
    player.chips -= cost;
    game = { ...game, pot: game.pot + cost, bet: newBet };
    log.push(`${player.name}${action === 'raise' ? '加注' : '跟注'} ${cost}${player.looked ? '（已看牌）' : '（闷牌）'}。`);
  }
  const next: PokerGame = { ...game, seats, log, actions: game.actions + 1, turn: nextTurn({ ...game, seats }, actor) };
  if (active(next).length === 1) return finish(next, '只剩一人');
  if (next.actions >= 15 || active(next).some(index => next.seats[index].chips < actionCost(next, index))) return finish(next, '自动开牌');
  return next;
}

export function botPokerAction(game: PokerGame, random = Math.random): PokerGame {
  if (game.winner !== null || game.turn === 0) return game;
  const actor = game.turn;
  const seat = game.seats[actor];
  const strength = handScore(seat.cards)[0];
  if (seat.chips < actionCost(game)) return pokerAction(game, 'fold');
  if (!seat.looked && seat.chips >= game.bet * 2 && game.actions >= 2 && random() < 0.48) return pokerAction(game, 'look');
  if (game.actions >= 2 && strength <= 1 && seat.looked && random() < 0.46) return pokerAction(game, 'fold');
  const targets = active(game).filter(index => index !== actor);
  if (game.actions >= 4 && targets.length && seat.chips >= actionCost(game) * 2 && random() < (strength >= 3 ? 0.42 : 0.12)) {
    return pokerAction(game, 'compare', targets[Math.floor(random() * targets.length)]);
  }
  if (strength >= 3 && seat.chips >= actionCost(game, actor, Math.min(game.bet * 2, Math.max(2, Math.floor(game.buyIn / 4)))) && random() < 0.35) {
    const raised = pokerAction(game, 'raise');
    if (raised !== game) return raised;
  }
  return pokerAction(game, 'call');
}

export const pokerPayout = (game: PokerGame) => game.seats[0].chips + (game.winner === 0 ? game.pot : 0);
export const pokerSeatPayout = (game: PokerGame, index: number) => game.seats[index].chips + (game.winner === index ? game.pot : 0);
export const pokerSeatNet = (game: PokerGame, index: number) => pokerSeatPayout(game, index) - game.buyIn;

export function formatPokerResult(game: PokerGame): string {
  if (game.winner === null) throw new Error('牌局尚未结束');
  const lines = [
    `炸金花 · ${game.seats[game.winner].name}获胜`,
    `底池 ¥${game.pot}｜每人买入 ¥${game.buyIn}`,
    '',
    '【牌面与输赢】',
    ...game.seats.map((seat, index) => {
      const net = pokerSeatNet(game, index);
      return `${seat.name}${index === game.winner ? ' 👑' : ''}：${seat.cards.map(cardText).join(' ')}（${HAND_NAMES[handScore(seat.cards)[0]]}）｜返还 ¥${pokerSeatPayout(game, index)}｜${net >= 0 ? '赢' : '输'} ¥${Math.abs(net)}`;
    }),
    '',
    '【局内对话】',
    ...(game.chat?.length ? game.chat.map(line => `${line.name}：${line.text}`) : ['本局没有对话。']),
  ];
  return lines.join('\n');
}
