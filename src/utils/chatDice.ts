export const CHAT_DICE_STICKER_ID = 'builtin-dice';
export const CHAT_DICE_ROLL_MS = 1100;
export const CHAT_DICE_VALUES = [1, 2, 3, 4, 5, 6] as const;
export type ChatDiceValue = typeof CHAT_DICE_VALUES[number];

const pipPositions = [
  [[50, 50]],
  [[28, 28], [72, 72]],
  [[28, 28], [50, 50], [72, 72]],
  [[28, 28], [72, 28], [28, 72], [72, 72]],
  [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
];

export const CHAT_DICE_FACE_IMAGES = CHAT_DICE_VALUES.map(value => {
  const pips = pipPositions[value - 1].map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="${value === 1 ? 12 : 8}" fill="${value === 1 || value === 4 ? '#cb3e37' : '#30343b'}"/>`).join('');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="15" fill="#faf9f5" stroke="#cbcbd0" stroke-width="3"/>${pips}</svg>`)}`;
});

const sideValues = [[3, 2], [3, 6], [6, 2], [5, 1], [4, 1], [2, 3]];
const dicePips = (value: number, side = false) => pipPositions[value - 1].map(([x, y]) =>
  `<circle cx="${x}" cy="${y}" r="${value === 1 ? 11 : 8}" fill="${value === 1 ? side ? '#a34039' : '#c7463e' : side ? 'url(#side-pip)' : 'url(#top-pip)'}"/>`).join('');

export const CHAT_DICE_IMAGES = CHAT_DICE_VALUES.map(value => {
  const [left, right] = sideValues[value - 1];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs>
  <linearGradient id="body" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#f0f0ee"/><stop offset=".6" stop-color="#b9b9b7"/><stop offset="1" stop-color="#929391"/></linearGradient>
  <linearGradient id="left" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="#e0e0de"/><stop offset="1" stop-color="#a8a9a7"/></linearGradient>
  <linearGradient id="right" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#dededc"/><stop offset="1" stop-color="#a0a19f"/></linearGradient>
  <radialGradient id="top" cx=".46" cy=".35" r=".7"><stop stop-color="#fdfdfc"/><stop offset=".75" stop-color="#f4f4f2"/><stop offset="1" stop-color="#dfdfdd"/></radialGradient>
  <radialGradient id="top-pip" cx=".5" cy=".65"><stop stop-color="#080909"/><stop offset=".7" stop-color="#171818"/><stop offset="1" stop-color="#646563"/></radialGradient>
  <radialGradient id="side-pip"><stop stop-color="#626460"/><stop offset="1" stop-color="#92938f"/></radialGradient>
  <filter id="shadow" x="-.3" y="-.6" width="1.6" height="2.2"><feGaussianBlur stdDeviation="2.4"/></filter>
</defs>
<ellipse cx="50" cy="89" rx="26" ry="5" fill="#777" opacity=".3" filter="url(#shadow)"/>
<path d="M12 37 C7 46 12 58 18 67 L33 85 C42 96 56 97 67 85 L82 67 C89 56 92 46 86 37 L51 25 Z" fill="url(#body)" stroke="#cececb" stroke-width=".7"/>
<path d="M12 40 C15 50 32 59 48 65 L49 91 C42 91 37 87 32 81 L19 65 C13 56 10 47 12 40Z" fill="url(#left)"/>
<path d="M51 65 C67 60 83 50 87 40 C90 49 86 58 81 66 L66 84 C61 90 56 93 51 92Z" fill="url(#right)"/>
<g data-face="left" transform="matrix(.32 .19 .04 .22 14 50)">${dicePips(left, true)}</g>
<g data-face="right" transform="matrix(.32 -.19 -.04 .22 54 69)">${dicePips(right, true)}</g>
<path d="M50 8 C61 8 79 25 86 37 C93 49 72 61 57 66 Q50 69 43 66 C28 61 7 50 12 38 C17 25 38 8 50 8Z" fill="url(#top)" stroke="#e5e5e2" stroke-width="1"/>
<path d="M15 39 C13 49 31 59 44 63 M55 64 C70 59 83 50 85 43" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.3" stroke-linecap="round"/>
<g data-face="top" data-value="${value}" transform="matrix(.4 .24 -.4 .24 50 14)">${dicePips(value)}</g>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
});

export function readChatDiceValue(message: { kind?: string; imageUrl?: string }): ChatDiceValue | undefined {
  if (message.kind !== 'sticker' || !message.imageUrl) return undefined;
  const index = CHAT_DICE_IMAGES.indexOf(message.imageUrl);
  return CHAT_DICE_VALUES[index < 0 ? CHAT_DICE_FACE_IMAGES.indexOf(message.imageUrl) : index];
}

export function chatDiceRollRemaining(createdAt: string, now = Date.now()): number {
  const started = Date.parse(createdAt);
  return Number.isFinite(started) ? Math.max(0, Math.min(CHAT_DICE_ROLL_MS, started + CHAT_DICE_ROLL_MS - now)) : 0;
}

export function rollChatDice() {
  const value = CHAT_DICE_VALUES[Math.floor(Math.random() * CHAT_DICE_VALUES.length)];
  return { imageUrl: CHAT_DICE_IMAGES[value - 1], description: `骰子：${value}点` };
}
