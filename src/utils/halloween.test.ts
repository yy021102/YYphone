import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { DEFAULT_HALLOWEEN_SETTINGS, HALLOWEEN_BEST_KEY, HALLOWEEN_REWARD_KEY, HALLOWEEN_SEEN_KEY, completeHalloweenGame, halloweenDate, halloweenIsDue, isHalloweenSeason, keepHalloweenBest, makeHalloweenRound, markHalloweenSeen, readHalloweenBest, readHalloweenReward, readHalloweenSeen, readHalloweenSettings, redeemHalloweenTheme, saveHalloweenSettings, swapPumpkins, type PumpkinOrder } from './halloween';

const values = new Map<string, string>();
const events = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  dispatchEvent: events.dispatchEvent.bind(events), localStorage: {
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  },
} });
beforeEach(async () => { await clearDbStorage(); });

test('seasonal opening uses local dates, includes October 29 through November 1, and never appears outside the season', () => {
  for (const [month, day, expected] of [[9, 28, false], [9, 29, true], [9, 30, true], [9, 31, true], [10, 1, true], [10, 2, false], [0, 31, false], [11, 31, false]] as const) {
    const date = new Date(2026, month, day, 23, 59);
    assert.equal(isHalloweenSeason(date), expected);
    assert.equal(halloweenIsDue(DEFAULT_HALLOWEEN_SETTINGS, [], date), expected);
    assert.equal(halloweenIsDue({ enabled: false }, [], date), false);
  }
  assert.equal(halloweenDate(new Date(2026, 9, 31, 0, 1)), '2026-10-31');
});
test('automatic appearances are once per local day and become eligible next day or next year', () => {
  const today = new Date(2026, 9, 30);
  markHalloweenSeen(today); markHalloweenSeen(today);
  assert.deepEqual(readHalloweenSeen(), ['2026-10-30']);
  assert.equal(halloweenIsDue(DEFAULT_HALLOWEEN_SETTINGS, readHalloweenSeen(), today), false);
  assert.equal(halloweenIsDue(DEFAULT_HALLOWEEN_SETTINGS, readHalloweenSeen(), new Date(2026, 9, 31)), true);
  assert.equal(halloweenIsDue(DEFAULT_HALLOWEEN_SETTINGS, readHalloweenSeen(), new Date(2027, 9, 30)), true);
  for (let i = 0; i < 25; i++) markHalloweenSeen(new Date(2026, 8, 1 + i));
  assert.equal(readHalloweenSeen().length, 16);
  assert(JSON.parse(readStorageString(HALLOWEEN_SEEN_KEY)!).includes('2026-09-25'));
});
test('the opening switch persists without mutating birthday settings, chats, memory, inventory or financial data', async () => {
  const untouched = ['yyphone:birthday-settings', 'yyphone:wechat-chats', 'yyphone:memories', 'yyphone:alipay-data', 'yyphone:inventory'];
  for (const key of untouched) writeStoredValue(key, { sentinel: key });
  assert.equal(readHalloweenSettings().enabled, true);
  await saveHalloweenSettings({ enabled: false }); assert.equal(readHalloweenSettings().enabled, false);
  await saveHalloweenSettings({ enabled: true }); assert.equal(readHalloweenSettings().enabled, true);
  for (const key of untouched) assert.deepEqual(JSON.parse(readStorageString(key)!), { sentinel: key });
});
test('every round remains a fair permutation with exactly one candy and no immediate undo of the preceding swap', () => {
  let seed = 38;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let play = 0; play < 60; play++) for (let round = 0; round < 3; round++) {
    const plan = makeHalloweenRound(round, random); assert.equal(plan.swaps.length, 3 + round);
    assert([0, 1, 2].includes(plan.target)); let order: PumpkinOrder = [0, 1, 2];
    for (let step = 0; step < plan.swaps.length; step++) {
      const swap = plan.swaps[step]; assert.notEqual(swap[0], swap[1]); assert(swap.every(slot => slot >= 0 && slot < 3));
      if (step) assert.notDeepEqual([...swap].sort(), [...plan.swaps[step - 1]].sort());
      const before = [...order]; order = swapPumpkins(order, swap);
      assert.deepEqual([...order].sort(), [0, 1, 2]); assert.deepEqual(swapPumpkins(order, swap), before);
    }
    assert.equal(order.filter(cup => cup === plan.target).length, 1);
  }
});
test('a repeated or lower score cannot erase a best result, and invalid scores are never saved', () => {
  assert.equal(readHalloweenBest(), undefined);
  assert.equal(keepHalloweenBest(2), 2); assert.equal(keepHalloweenBest(0), 2); assert.equal(keepHalloweenBest(2), 2);
  assert.equal(keepHalloweenBest(3), 3); assert.equal(readHalloweenBest(), 3);
  const before = readStorageString(HALLOWEEN_BEST_KEY);
  for (const value of [-1, 4, 1.2, NaN, Infinity]) assert.throws(() => keepHalloweenBest(value), /无效/);
  assert.equal(readStorageString(HALLOWEEN_BEST_KEY), before);
});

test('candies accumulate across games, repeated settlement cannot duplicate earnings, and concurrent redemption charges only once', async () => {
  const protectedKeys = ['yyphone:beauty-settings', 'yyphone:wechat-chats', 'yyphone:inventory', 'yyphone:alipay-data'];
  for (const key of protectedKeys) writeStoredValue(key, { sentinel: key });
  assert.equal(readHalloweenReward().candies, 0);
  await completeHalloweenGame(1, 'first');
  await assert.rejects(redeemHalloweenTheme(), /再攒/);
  await Promise.all([completeHalloweenGame(2, 'second'), completeHalloweenGame(2, 'second')]);
  assert.equal(readHalloweenReward().candies, 3);
  await Promise.all([redeemHalloweenTheme(), redeemHalloweenTheme(), redeemHalloweenTheme()]);
  assert.equal(readHalloweenReward().candies, 0);
  assert.equal(readHalloweenReward().unlocked, true);
  await completeHalloweenGame(0, 'empty', 2027);
  await completeHalloweenGame(1, 'next-year', 2027);
  await redeemHalloweenTheme();
  assert.equal(readHalloweenReward().candies, 1, 'a permanent unlock is never charged again');
  assert.equal(readHalloweenReward().unlocked, true);
  assert.equal(readHalloweenBest(2027), 1);
  for (const key of protectedKeys) assert.deepEqual(JSON.parse(readStorageString(key)!), { sentinel: key });
});
test('legacy scores count once toward the reward, even after spending them and starting a new season', async () => {
  keepHalloweenBest(3, 2025);
  assert.equal(readHalloweenReward().candies, 3);
  await redeemHalloweenTheme();
  assert.equal(readHalloweenReward().candies, 0);
  await completeHalloweenGame(1, 'new-game', 2026);
  assert.equal(readHalloweenReward().candies, 1);
  assert.equal(readHalloweenReward().unlocked, true);
  assert.equal(readHalloweenBest(2025), 3);
});
test('failed saves leave candy, theme ownership and the best score intact and can be retried safely', async () => {
  await completeHalloweenGame(2, 'a');
  const before = readStorageString(HALLOWEEN_REWARD_KEY);
  const original = window.localStorage.setItem;
  window.localStorage.setItem = (key, value) => { if (key === HALLOWEEN_REWARD_KEY) throw new Error('quota'); original(key, value); };
  try {
    await assert.rejects(completeHalloweenGame(3, 'b'), /quota/);
    assert.equal(readStorageString(HALLOWEEN_REWARD_KEY), before);
    assert.equal(readHalloweenBest(), 2);
  } finally { window.localStorage.setItem = original; }
  await completeHalloweenGame(3, 'b');
  const earned = readStorageString(HALLOWEEN_REWARD_KEY);
  window.localStorage.setItem = (key, value) => { if (key === HALLOWEEN_REWARD_KEY) throw new Error('quota'); original(key, value); };
  try { await assert.rejects(redeemHalloweenTheme(), /quota/); assert.equal(readStorageString(HALLOWEEN_REWARD_KEY), earned); }
  finally { window.localStorage.setItem = original; }
  await redeemHalloweenTheme();
  assert.equal(readHalloweenReward().candies, 2);
  assert.equal(readHalloweenReward().unlocked, true);
});
