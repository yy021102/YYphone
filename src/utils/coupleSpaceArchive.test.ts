import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { clearCoupleSpace, exportCoupleSpace, importCoupleSpace, parseCoupleSpaceBackup, unbindCoupleSpace } from './coupleSpaceArchive';
import { COUPLE_SPACES_STORAGE_KEY, buildCoupleSpaceInjection, createEmptyCoupleSpace, readCoupleSpaces } from './coupleSpaceData';
import { COUPLE_REWARDS_KEY, buyCoupleCoupon, coupleBalance, couponStock, fulfillCoupleLetter, readCoupleWallet, rewardDay, settleCouplePoints, useCoupleCoupon } from './coupleRewards';
import { CHARACTER_CONTEXT_STORAGE_KEY, readPendingHighPriorityEvents } from './characterContext';
import { buildPrompt, toMessageContent } from './buildPrompt';
import { generateCoupleRewardAction } from './coupleRewardsAi';
import { generateCoupleLetter } from './coupleLetters';
import { invalidateMemoryArchive } from './memoryArchives';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: () => true, localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const read = (key: string) => JSON.parse(readStorageString(key) || 'null');
const chat = () => read('yyphone:wechat-chats')[0];
function fullSpace(charId = 'a') {
  const s = { ...createEmptyCoupleSpace(charId), bindStatus: 'bound' as const, startDate: '2026-01-01', headerBgUrl: 'https://images.invalid/header.png', pageBgUrl: 'https://images.invalid/page.png', calendarBgUrl: 'https://images.invalid/calendar.png' };
  for (let i = 0; i < 12; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); const day = rewardDay(d);
    s.moods[day] = { dateStr: day, userMoodId: 'happy_1', charMoodId: 'calm_1' };
    s.diaries.push({ id: `u${i}`, author: 'user', authorName: '小雨', dateStr: day, title: '一起看花', content: '等到花开', annotations: [{ id: `n${i}`, author: 'char', authorName: '林渡', content: '下次还等你', createdAt: d.toISOString() }] }, { id: `c${i}`, author: 'char', authorName: '林渡', dateStr: day, title: '小记', content: '今天很高兴' });
    s.qaList.push({ id: `q${i}`, dateStr: day, askedBy: 'system', question: '周末去哪', userAnswer: '看花', charAnswer: '好' });
  }
  s.anniversaries.push({ id: 'anniversary', title: '下次见面', targetDate: '2027-01-01', type: 'countdown' });
  s.stickyNotes.push({ id: 'sticky', author: 'user', authorName: '小雨', content: '记得带伞', colorBg: '#fee8ee', createdAt: new Date().toISOString() });
  return s;
}
beforeEach(async () => {
  await settleCouplePoints(); await clearDbStorage();
  const at = new Date().toISOString();
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts': [{ id: 'a', name: '林渡', persona: '嘴硬温柔', worldBooks: [], avatarUrl: '' }, { id: 'b', name: '时予', persona: '活泼', worldBooks: [] }],
    [COUPLE_SPACES_STORAGE_KEY]: { a: fullSpace(), b: { ...fullSpace('b'), stickyNotes: [{ id: 'b-only', author: 'char', authorName: '时予', content: 'OTHER_SPACE_SECRET', colorBg: '#fff', createdAt: at }] } },
    'yyphone:wechat-chats': [{ id: 'chat-a', type: 'direct', participantIds: ['a'], activeArchiveId: 'one', noteName: '', context: '', avatars: {}, blocked: false, updatedAt: at, messages: [{ id: 'm', senderId: 'user', text: '今天怎么样', createdAt: at }] }, { id: 'chat-b', type: 'direct', participantIds: ['b'], messages: [] }],
    'yyphone:api-presets': [{ id: 'api', name: 'API', endpoint: 'https://couple-management.invalid/v1', apiKey: 'SECRET_NEVER_BACKUP', model: 'test' }], 'yyphone:active-api-preset': 'api',
    [CHARACTER_CONTEXT_STORAGE_KEY]: [],
  });
  await settleCouplePoints(); await buyCoupleCoupon('a', 'user', 'kiss', 'bought-kiss');
});
afterEach(() => mock.restoreAll());

test('a backup includes only the selected couple, complete records, wallpaper, points and inventory', async () => {
  const backup = await exportCoupleSpace('a'), serialized = JSON.stringify(backup);
  assert.equal(backup.space.charId, 'a'); assert.equal(backup.character.name, '林渡');
  assert.equal(backup.space.diaries[0].annotations?.[0].content, '下次还等你'); assert.equal(backup.space.calendarBgUrl, 'https://images.invalid/calendar.png');
  assert.equal(coupleBalance(backup.wallet, 'user'), 33); assert.equal(couponStock(backup.wallet, 'user', 'kiss'), 1);
  assert(!serialized.includes('OTHER_SPACE_SECRET')); assert(!serialized.includes('SECRET_NEVER_BACKUP')); assert(!serialized.includes('chat-a'));
  const parsed = parseCoupleSpaceBackup(serialized, 'a'); assert.deepEqual(parsed.space, backup.space); assert.deepEqual(parsed.wallet, backup.wallet);
});

test('clear resets current records, points and stock while preserving binding, wallpaper, other couples and chat history', async () => {
  const other = JSON.stringify(readCoupleSpaces().b), otherWallet = JSON.stringify(readCoupleWallet('b')), beforeChat = JSON.stringify(chat().messages);
  await clearCoupleSpace('a'); const s = readCoupleSpaces().a;
  assert.equal(s.bindStatus, 'bound'); assert.equal(s.pageBgUrl, 'https://images.invalid/page.png'); assert.equal(s.startDate, '2026-01-01');
  assert.deepEqual(s.diaries, []); assert.deepEqual(s.moods, {}); assert.deepEqual(s.anniversaries, []); assert.deepEqual(s.stickyNotes, []); assert.deepEqual(s.qaList, []);
  assert.equal(coupleBalance(readCoupleWallet('a'), 'user'), 0); assert.equal(couponStock(readCoupleWallet('a'), 'user', 'kiss'), 0);
  assert.equal(JSON.stringify(readCoupleSpaces().b), other); assert.equal(JSON.stringify(readCoupleWallet('b')), otherWallet); assert.equal(JSON.stringify(chat().messages), beforeChat);
  assert.deepEqual(read(CHARACTER_CONTEXT_STORAGE_KEY), []); await settleCouplePoints(); assert.equal(readCoupleWallet('a').awards.length, 0);
});

test('import restores complete current data without duplicating awards or changing binding and unrelated spaces', async () => {
  const backup = parseCoupleSpaceBackup(JSON.stringify(await exportCoupleSpace('a')), 'a'), other = JSON.stringify(readCoupleSpaces().b);
  await clearCoupleSpace('a'); await importCoupleSpace('a', backup); await settleCouplePoints();
  assert.equal(readCoupleSpaces().a.diaries.length, 24); assert.equal(readCoupleWallet('a').awards.length, 36); assert.equal(coupleBalance(readCoupleWallet('a'), 'user'), 33);
  assert.equal(couponStock(readCoupleWallet('a'), 'user', 'kiss'), 1); assert.equal(JSON.stringify(readCoupleSpaces().b), other);
  await unbindCoupleSpace('a'); await importCoupleSpace('a', backup); assert.equal(readCoupleSpaces().a.bindStatus, 'unbound'); assert.equal(chat().messages.filter((m: any) => m.source === 'couple-unbind').length, 1);
});

test('legacy multi-character backups read only the selected entry and never restore another couple or a new binding', async () => {
  const legacy = JSON.stringify({ spacesMap: readCoupleSpaces(), selectedCharId: 'b' });
  await clearCoupleSpace('a'); const b = JSON.stringify(readCoupleSpaces().b);
  const parsed = parseCoupleSpaceBackup(legacy, 'a'); assert.equal(parsed.wallet, undefined);
  await importCoupleSpace('a', parsed); assert.equal(readCoupleSpaces().a.diaries.length, 24); assert.equal(JSON.stringify(readCoupleSpaces().b), b);
  assert.throws(() => parseCoupleSpaceBackup(legacy, 'missing'), /没有当前角色/);
});

test('wrong roles, malformed lists, negative ledgers and duplicate awards are rejected before any write', async () => {
  const backup = await exportCoupleSpace('a'), before = readStorageString(COUPLE_SPACES_STORAGE_KEY);
  assert.throws(() => parseCoupleSpaceBackup('{', 'a'), /JSON/);
  assert.throws(() => parseCoupleSpaceBackup(JSON.stringify(backup), 'b'), /林渡/);
  const invalid = [
    { ...backup, space: { ...backup.space, diaries: [{ id: 'bad' }] } },
    { ...backup, space: { ...backup.space, startDate: '2026-02-30' } },
    { ...backup, space: { ...backup.space, pageBgUrl: 'javascript:alert(1)' } },
    { ...backup, wallet: { ...backup.wallet, awards: [] } },
    { ...backup, wallet: { ...backup.wallet, awards: [...backup.wallet.awards, backup.wallet.awards[0]] } },
    { ...backup, version: 2 },
  ];
  for (const data of invalid) assert.throws(() => parseCoupleSpaceBackup(JSON.stringify(data), 'a'));
  assert.equal(readStorageString(COUPLE_SPACES_STORAGE_KEY), before);
});

test('unbinding atomically keeps records and wallet, withdraws pending invitations and writes one visible historical card plus one notice', async () => {
  const c = read('yyphone:wechat-chats'); c[0].messages.push({ id: 'pending', kind: 'couple-invite', senderId: 'a', text: '邀请', inviteFrom: 'char', inviteStatus: 'pending', createdAt: new Date().toISOString() }); c[0].blocked = true;
  await setStorageItemsAtomically({ 'yyphone:wechat-chats': c }); const wallet = JSON.stringify(readCoupleWallet('a'));
  assert.equal(await unbindCoupleSpace('a'), true); assert.equal(await unbindCoupleSpace('a'), false);
  assert.equal(readCoupleSpaces().a.bindStatus, 'unbound'); assert.equal(readCoupleSpaces().a.diaries.length, 24); assert.equal(JSON.stringify(readCoupleWallet('a')), wallet);
  const cards = chat().messages.filter((m: any) => m.source === 'couple-unbind'); assert.equal(cards.length, 1); assert.equal(cards[0].senderId, 'narrator'); assert.equal(cards[0].title, '情侣空间已解绑');
  assert.equal(chat().blocked, true); assert.equal(chat().messages.find((m: any) => m.id === 'pending').inviteStatus, 'withdrawn');
  assert.equal(readPendingHighPriorityEvents(['a'], 'couple').length, 1); assert.equal(readPendingHighPriorityEvents(['b'], 'couple').length, 0);
  assert.match(buildCoupleSpaceInjection(['a'], 'direct', () => '林渡').text, /不等于玩家明确提出分手/);
  assert.equal(buildCoupleSpaceInjection(['a'], 'group', () => '林渡').text, '');
  assert.match(toMessageContent(cards[0]), /不是玩家刚发来的台词/);
  assert.match(buildPrompt({ chatId: 'chat-a' }).map(m => m.content).join('\n'), /情侣空间解绑/);
});

test('unbinding can create the missing direct chat but cannot resurrect a deleted character or write across a switched archive', async () => {
  await setStorageItemsAtomically({ 'yyphone:wechat-chats': [] }); await unbindCoupleSpace('a');
  const chats = read('yyphone:wechat-chats'); assert.equal(chats.length, 1); assert.deepEqual(chats[0].participantIds, ['a']); assert.equal(chats[0].messages[0].source, 'couple-unbind');
  const spaces = readCoupleSpaces(); spaces.a.bindStatus = 'bound'; await setStorageItemsAtomically({ [COUPLE_SPACES_STORAGE_KEY]: spaces });
  const pending = unbindCoupleSpace('a'); invalidateMemoryArchive('a'); await assert.rejects(pending, /存档/);
  assert.equal(readCoupleSpaces().a.bindStatus, 'bound');
  await setStorageItemsAtomically({ 'pocketos:wechat-contacts': [] }); await assert.rejects(unbindCoupleSpace('a'), /角色已不存在/);
});

test('the unbind notice stays in its originating archive instead of leaking into another branch', async () => {
  await unbindCoupleSpace('a'); const chats = read('yyphone:wechat-chats'); chats[0].activeArchiveId = 'two'; chats[0].messages = [];
  await setStorageItemsAtomically({ 'yyphone:wechat-chats': chats });
  assert.equal(readPendingHighPriorityEvents(['a'], 'couple').length, 0); assert(!buildCoupleSpaceInjection(['a'], 'direct', () => '林渡').text.includes('解绑'));
});

test('a failed save rolls back unbind state, chat card and notification together and permits one clean retry', async () => {
  const spaces = readStorageString(COUPLE_SPACES_STORAGE_KEY), chats = readStorageString('yyphone:wechat-chats'), events = readStorageString(CHARACTER_CONTEXT_STORAGE_KEY);
  const original = window.localStorage.setItem;
  mock.method(window.localStorage, 'setItem', (key: string, value: string) => { if (key === CHARACTER_CONTEXT_STORAGE_KEY) throw new Error('quota'); original(key, value); });
  await assert.rejects(unbindCoupleSpace('a'), /quota/);
  assert.equal(readStorageString(COUPLE_SPACES_STORAGE_KEY), spaces); assert.equal(readStorageString('yyphone:wechat-chats'), chats); assert.equal(readStorageString(CHARACTER_CONTEXT_STORAGE_KEY), events);
  mock.restoreAll(); assert.equal(await unbindCoupleSpace('a'), true); assert.equal(chat().messages.filter((m: any) => m.source === 'couple-unbind').length, 1);
});

test('a failed import cannot leave restored records with the cleared wallet', async () => {
  const backup = parseCoupleSpaceBackup(JSON.stringify(await exportCoupleSpace('a')), 'a'); await clearCoupleSpace('a');
  const before = readStorageString(COUPLE_SPACES_STORAGE_KEY), original = window.localStorage.setItem;
  mock.method(window.localStorage, 'setItem', (key: string, value: string) => { if (key === COUPLE_REWARDS_KEY) throw new Error('quota'); original(key, value); });
  await assert.rejects(importCoupleSpace('a', backup), /quota/); assert.equal(readStorageString(COUPLE_SPACES_STORAGE_KEY), before); assert.equal(readCoupleWallet('a').awards.length, 0);
});

test('an imported older backup cannot replay an already delivered letter or reopen its request', async () => {
  await buyCoupleCoupon('a', 'user', 'letter', 'buy-letter'); const use = await useCoupleCoupon('a', 'user', 'letter', 'letter-request');
  const backup = parseCoupleSpaceBackup(JSON.stringify(await exportCoupleSpace('a')), 'a');
  await fulfillCoupleLetter('a', use.id, 'char', { title: '给你', body: '我仍记得你那天等花开的样子。' });
  await importCoupleSpace('a', backup); const restored = readCoupleWallet('a').uses.find(u => u.id === use.id)!;
  assert(restored.fulfilledAt); assert.equal(restored.fulfillmentMessageId, `letter:${use.id}`); assert.equal(restored.noticeSeen, true);
  assert.equal(chat().messages.filter((m: any) => m.kind === 'couple-letter').length, 1);
});

test('a late character purchase decision is cancelled after clear and restore, even when the old balance returns', async () => {
  const backup = parseCoupleSpaceBackup(JSON.stringify(await exportCoupleSpace('a')), 'a'); let finish!: () => void, started!: () => void;
  const ready = new Promise<void>(r => { started = r; });
  mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { finish = () => resolve(Response.json({ choices: [{ message: { content: '{"action":"buy","productId":"kiss","reason":"想亲一下"}' } }] })); started(); }));
  const decision = generateCoupleRewardAction('a'); await ready; await clearCoupleSpace('a'); await importCoupleSpace('a', backup); finish();
  await assert.rejects(decision, /情侣空间已变化/); assert.equal(readCoupleWallet('a').purchases.filter(p => p.owner === 'char').length, 0);
});

test('restoring after clear recognizes a completed gift card in saved chat archives instead of replaying delivery', async () => {
  await buyCoupleCoupon('a', 'user', 'gift', 'buy-gift'); const use = await useCoupleCoupon('a', 'user', 'gift', 'gift-request');
  const backup = parseCoupleSpaceBackup(JSON.stringify(await exportCoupleSpace('a')), 'a'), chats = read('yyphone:wechat-chats');
  const completed = chats[0].messages.find((m: any) => m.couponUseId === use.id); completed.couponCompletedAt = new Date().toISOString(); completed.couponFulfillmentId = 'gift-delivered';
  chats[0].archives = [{ id: 'one', name: '原存档', messages: chats[0].messages }]; chats[0].activeArchiveId = 'two'; chats[0].messages = [];
  await setStorageItemsAtomically({ 'yyphone:wechat-chats': chats }); await clearCoupleSpace('a'); await importCoupleSpace('a', backup);
  const restored = readCoupleWallet('a').uses.find(u => u.id === use.id)!; assert(restored.fulfilledAt); assert.equal(restored.fulfillmentMessageId, 'gift-delivered');
});

test('a late letter cannot be delivered after an unbind and subsequent rebind', async () => {
  await buyCoupleCoupon('a', 'user', 'letter', 'buy-letter'); const use = await useCoupleCoupon('a', 'user', 'letter', 'late-letter');
  let finish!: () => void, started!: () => void; const ready = new Promise<void>(r => { started = r; });
  mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { finish = () => resolve(Response.json({ choices: [{ message: { content: JSON.stringify({ title: '给你', body: '我仍记得你等花开时的样子。'.repeat(17) }) } }] })); started(); }));
  const task = generateCoupleLetter('a', use.id); await ready; await unbindCoupleSpace('a'); const spaces = readCoupleSpaces(); spaces.a.bindStatus = 'bound'; await setStorageItemsAtomically({ [COUPLE_SPACES_STORAGE_KEY]: spaces }); finish();
  await assert.rejects(task, /空间数据已变化/); assert.equal(chat().messages.filter((m: any) => m.kind === 'couple-letter').length, 0);
});
