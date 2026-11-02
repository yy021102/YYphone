import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { buildPrompt } from './buildPrompt';
import { captureSipChatScope, recordSipResult, sipChatChanges } from './littleSipContext';
import { copySipRecipe, createSipDrink, freshSipRecipe, loadSip, serveSipDrink, SIP_KEY, updateSip, type SipRecipe } from './littleSip';

const values = new Map<string, string>(); let failKey = '';
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: () => true, localStorage: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (key === failKey) { failKey = ''; throw new Error('QUOTA_TEST'); } values.set(key, value); },
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const read = (key: string) => JSON.parse(readStorageString(key) || 'null');
const chats = () => read('yyphone:wechat-chats');
const recipe = (): SipRecipe => ({ ...freshSipRecipe('林渡'), name: '晚风桃桃', maker: { name: '林渡', actorId: 'a', note: '为你留一点桃香。' },
  parts: [{ id: 'oolong', amount: 150 }, { id: 'peach', amount: 100 }] });
beforeEach(async () => {
  failKey = ''; await clearDbStorage();
  writeStoredValue('pocketos:personas', { activeProfileId: 'player', profiles: [{ id: 'player', nickname: '小雨' }] });
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '温柔', worldBooks: [] }, { id: 'b', name: '另一位', persona: '', worldBooks: [] }]);
  writeStoredValue('yyphone:wechat-chats', ['a', 'b'].map(id => ({
    id: `chat-${id}`, type: 'direct', participantIds: [id], noteName: '', context: '', blocked: false,
    activeArchiveId: 'archive-default', archiveRevision: 'rev-one', messages: [], updatedAt: new Date().toISOString(),
    archives: [{ id: 'archive-other', name: '其他存档', messages: [] }],
  })));
});
test('confirming a character proposal saves recipe and finished drink at once, without touching chat or long-term memory when unchecked', async () => {
  const before = readStorageString('yyphone:wechat-chats'), scope = captureSipChatScope('a'), proposed = recipe();
  const drink = await recordSipResult({ kind: 'recipe', recipe: proposed, scope, syncToChat: false });
  assert.equal(loadSip().recipes.length, 1); assert.equal(loadSip().drinks.length, 1);
  assert.equal(drink.recipe.maker.actorId, 'a'); assert.equal(drink.recipe.adapted, false);
  proposed.parts[0].amount = 5; assert.equal(loadSip().recipes[0].parts[0].amount, 150);
  assert.equal(readStorageString('yyphone:wechat-chats'), before); assert.equal(read('yyphone:memory-items'), null);
});
test('selected creation sync is a truthful visible card in the chosen chat, survives reloading storage and reaches the actual prompt', async () => {
  const scope = captureSipChatScope('a'), proposed = recipe();
  const drink = await recordSipResult({ kind: 'recipe', recipe: proposed, scope, syncToChat: true });
  await recordSipResult({ kind: 'recipe', recipe: copySipRecipe(proposed), scope, syncToChat: true });
  assert.equal(loadSip().drinks.length, 1); assert.equal(loadSip().recipes.length, 1);
  const current = chats()[0]; assert.equal(current.messages.length, 1); assert.equal(current.messages[0].senderId, 'user');
  assert.match(current.messages[0].text, /林渡为小雨调制/); assert.match(current.messages[0].text, /为你留一点桃香/);
  assert.equal(chats()[1].messages.length, 0); assert.equal(current.archives[0].messages.length, 0);
  assert.match(JSON.stringify(buildPrompt({ chatId: 'chat-a', timeAwarenessEnabled: false })), /晚风桃桃|制作经历记录/);
  assert.equal(loadSip().drinks[0].id, drink.id); assert.equal(read('yyphone:memory-items'), null);
});
test('adjusted character recipes retain actual attribution and save to the menu instead of overwriting originals', async () => {
  const proposed = recipe(), scope = captureSipChatScope('a');
  await recordSipResult({ kind: 'recipe', recipe: proposed, scope, syncToChat: false });
  const changed = { ...copySipRecipe(proposed), id: 'adjusted', name: '桃香稍淡', adapted: true };
  await recordSipResult({ kind: 'recipe', recipe: changed, scope, syncToChat: true });
  assert.equal(loadSip().recipes.length, 2); assert.equal(loadSip().recipes[1].name, '晚风桃桃');
  assert.match(chats()[0].messages[0].text, /小雨在此基础上调整并完成/);
});
test('selected sync can open a missing private chat without changing another character conversation', async () => {
  const other = chats()[1]; writeStoredValue('yyphone:wechat-chats', [other]);
  const scope = captureSipChatScope('a'); assert.equal(scope.chatId, '');
  await recordSipResult({ kind: 'recipe', recipe: recipe(), scope, syncToChat: true });
  assert.equal(chats().length, 2); assert.equal(chats()[0].participantIds[0], 'a');
  assert.deepEqual(chats()[1], other);
  assert.match(JSON.stringify(buildPrompt({ chatId: chats()[0].id, timeAwarenessEnabled: false })), /晚风桃桃/);
});
async function tastingFixture() {
  let drink = serveSipDrink(createSipDrink(recipe()), { id: 'a', name: '林渡' });
  drink = serveSipDrink(drink, { id: 'b', name: '另一位' });
  drink.servings[0].tastings.push({ id: 'taste-one', createdAt: drink.createdAt, status: 'pending', text: '' });
  drink.servings[1].tastings.push({ id: 'other', createdAt: drink.createdAt, status: 'done', text: 'OTHER_RECIPIENT_SECRET' });
  await updateSip(s => ({ ...s, drinks: [drink] }));
  return drink;
}
test('unchecked tasting stays local; checked tasting appends a recent card with only its real completed feedback', async () => {
  const drink = await tastingFixture(), scope = captureSipChatScope('a');
  await recordSipResult({ kind: 'taste', drinkId: drink.id, tastingId: 'taste-one', text: 'LOCAL_ONLY_FEEDBACK', scope, syncToChat: false });
  assert.equal(chats()[0].messages.length, 0);
  await updateSip(s => ({ ...s, drinks: s.drinks.map(d => ({ ...d, servings: d.servings.map(v => v.actorId === 'a'
    ? { ...v, tastings: [...v.tastings, { id: 'taste-two', createdAt: new Date().toISOString(), status: 'pending', text: '' }] } : v) })) }));
  await recordSipResult({ kind: 'taste', drinkId: drink.id, tastingId: 'taste-two', text: 'CURRENT_TASTING', scope, syncToChat: true });
  const text = chats()[0].messages[0].text; assert.match(text, /CURRENT_TASTING/);
  assert.doesNotMatch(text, /LOCAL_ONLY_FEEDBACK|OTHER_RECIPIENT_SECRET/); assert.equal(chats()[1].messages.length, 0);
  assert.match(JSON.stringify(buildPrompt({ chatId: 'chat-a', timeAwarenessEnabled: false })), /CURRENT_TASTING/);
  assert.equal(loadSip().drinks[0].servings[0].tastings.length, 2);
});
test('existing serving cards remain duplicate-safe and keep the original timestamp', async () => {
  const drink = await tastingFixture(), scope = captureSipChatScope('a');
  const first = sipChatChanges(scope, drink, 'serve'); writeStoredValue('yyphone:wechat-chats', first['yyphone:wechat-chats']);
  const before = chats()[0].messages[0].createdAt;
  const second = sipChatChanges(scope, drink, 'serve'); writeStoredValue('yyphone:wechat-chats', second['yyphone:wechat-chats']);
  assert.equal(chats()[0].messages.length, 1); assert.equal(chats()[0].messages[0].createdAt, before);
  assert.doesNotMatch(chats()[0].messages[0].text, /OTHER_RECIPIENT_SECRET/);
});
test('switches, deleted characters, player changes and blocked chats cannot leak selected sync into a different context', async () => {
  for (const change of ['archive', 'revision', 'player', 'deleted', 'blocked']) {
    const scope = captureSipChatScope('a'), all = chats(), profiles = read('pocketos:personas'), contacts = read('pocketos:wechat-contacts');
    if (change === 'archive') all[0].activeArchiveId = 'different';
    if (change === 'revision') all[0].archiveRevision = 'new-revision';
    if (change === 'blocked') all[0].blocked = true;
    writeStoredValue('yyphone:wechat-chats', all);
    if (change === 'player') writeStoredValue('pocketos:personas', { ...profiles, activeProfileId: 'other' });
    if (change === 'deleted') writeStoredValue('pocketos:wechat-contacts', []);
    await assert.rejects(recordSipResult({ kind: 'recipe', recipe: recipe(), scope, syncToChat: true }), /变化|拉黑/);
    assert.equal(loadSip().drinks.length, 0); assert.equal(chats()[0].messages.length, 0);
    all[0].activeArchiveId = 'archive-default'; all[0].archiveRevision = 'rev-one'; all[0].blocked = false;
    writeStoredValue('yyphone:wechat-chats', all); writeStoredValue('pocketos:personas', profiles); writeStoredValue('pocketos:wechat-contacts', contacts);
  }
});
test('atomic persistence failures cannot leave a saved drink without its selected context card, and retries succeed', async () => {
  const input = { kind: 'recipe' as const, recipe: recipe(), scope: captureSipChatScope('a'), syncToChat: true };
  const before = readStorageString('yyphone:wechat-chats'); failKey = SIP_KEY;
  await assert.rejects(recordSipResult(input), /QUOTA_TEST/);
  assert.equal(readStorageString('yyphone:wechat-chats'), before); assert.equal(loadSip().recipes.length, 0);
  failKey = 'yyphone:wechat-chats'; await assert.rejects(recordSipResult(input), /QUOTA_TEST/);
  assert.equal(loadSip().drinks.length, 0); assert.equal(readStorageString('yyphone:wechat-chats'), before);
  await recordSipResult(input); assert.equal(loadSip().drinks.length, 1); assert.equal(chats()[0].messages.length, 1);
});
test('cancelled or replaced tasting attempts cannot be marked successful or synced', async () => {
  const drink = await tastingFixture(), scope = captureSipChatScope('a'), controller = new AbortController();
  controller.abort();
  await assert.rejects(recordSipResult({ kind: 'taste', drinkId: drink.id, tastingId: 'taste-one', text: 'CANCELLED', scope, syncToChat: true, signal: controller.signal }), /abort/i);
  await assert.rejects(recordSipResult({ kind: 'taste', drinkId: drink.id, tastingId: 'missing', text: 'INVALID', scope, syncToChat: true }), /已变化/);
  assert.equal(loadSip().drinks[0].servings[0].tastings[0].status, 'pending'); assert.equal(chats()[0].messages.length, 0);
});
test('a failed tasting sync rolls back its feedback and card together instead of reporting local-only success', async () => {
  const drink = await tastingFixture();
  const input = { kind: 'taste' as const, drinkId: drink.id, tastingId: 'taste-one', text: '真实反馈', scope: captureSipChatScope('a'), syncToChat: true };
  failKey = 'yyphone:wechat-chats'; await assert.rejects(recordSipResult(input), /QUOTA_TEST/);
  assert.equal(loadSip().drinks[0].servings[0].tastings[0].status, 'pending'); assert.equal(chats()[0].messages.length, 0);
  await recordSipResult(input);
  assert.equal(loadSip().drinks[0].servings[0].tastings[0].status, 'done'); assert.equal(chats()[0].messages.length, 1);
});
