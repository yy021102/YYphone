export interface PacketClaim {
  recipientId: string;
  amount: string;
  claimed: boolean;
}

// Divide a packet in cents, leaving at least one cent for every remaining share.
export const splitLuckyPacket = (amount: string, quantity: number): string[] => {
  const total = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(total) || quantity < 1 || !Number.isInteger(quantity) || total < quantity) {
    throw new Error('红包总金额须不少于红包个数 × 0.01 元。');
  }
  let remaining = total;
  const shares: string[] = [];
  for (let index = 0; index < quantity; index += 1) {
    const left = quantity - index;
    const cents = left === 1 ? remaining : Math.min(
      remaining - left + 1,
      Math.max(1, Math.floor(Math.random() * (remaining / left) * 2) + 1),
    );
    shares.push((cents / 100).toFixed(2));
    remaining -= cents;
  }
  return shares;
};

export const createPacketClaims = (amount: string, quantity: number, recipients: string[], playerEligible: boolean): PacketClaim[] => {
  const shuffled = [...recipients.filter((id) => id !== 'user')];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  if (playerEligible && recipients.includes('user')) shuffled.unshift('user');
  return splitLuckyPacket(amount, quantity).slice(0, shuffled.length).map((share, index) => ({
    recipientId: shuffled[index], amount: share, claimed: shuffled[index] !== 'user',
  }));
};

export const luckyPacketWinner = (claims: PacketClaim[] | undefined, quantity: number | undefined): string | undefined => {
  if (!claims || !quantity || claims.filter((claim) => claim.claimed).length !== quantity) return undefined;
  return claims.reduce((winner, claim) => Number(claim.amount) > Number(winner.amount) ? claim : winner).recipientId;
};
