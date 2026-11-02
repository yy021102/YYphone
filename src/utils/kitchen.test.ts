import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KitchenArt, kitchenFoodPieces } from '../components/KitchenArt';
import { clearDbStorage, getAllCachedStorageItems } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { captureActivityChatScope } from './activityChat';
import { buildPrompt } from './buildPrompt';
import { kitchenChatChanges, recordKitchenResult } from './kitchenContext';
import {
  copyKitchenRecipe, createKitchenMeal, freshKitchenRecipe, isKitchenMeal, isKitchenRecipe, isKitchenStore,
  KITCHEN_INGREDIENTS, KITCHEN_KEY, KITCHEN_TYPES, kitchenIngredient, kitchenIngredients, kitchenPrompt, kitchenRecipeText,
  loadKitchen, parseKitchenRecipe, patchKitchenMeal, recoverKitchen, saveKitchenMeal, serveKitchenMeal, subscribeKitchen, updateKitchen, validateKitchenRecipe,
  type KitchenRecipe,
} from './kitchen';

const values = new Map<string, string>();
let failKey = '';
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: () => true, localStorage: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (key === failKey) { failKey = ''; throw new Error('KITCHEN_QUOTA_TEST'); } values.set(key, value); },
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const actor = { id: 'a', name: '林渡' };
const read = (key: string) => JSON.parse(readStorageString(key) ?? 'null');
const chats = () => read('yyphone:wechat-chats');
const recipe = (role = false): KitchenRecipe => ({
  ...freshKitchenRecipe('小雨'), name: '为你留的一碗饭', parts: [{ id: 'rice', amount: 2 }, { id: 'egg', amount: 2 }, { id: 'tomato', amount: 1 }],
  maker: role ? { name: actor.name, actorId: actor.id, note: '趁热吃，今天辛苦啦。' } : { name: '小雨' },
});
beforeEach(async () => {
  failKey = ''; await clearDbStorage();
  writeStoredValue('pocketos:personas', { activeProfileId: 'player', profiles: [{ id: 'player', nickname: '小雨' }] });
  writeStoredValue('pocketos:wechat-contacts', [actor, { id: 'b', name: '另一位' }]);
  writeStoredValue('yyphone:wechat-chats', ['a', 'b'].map(id => ({
    id: `chat-${id}`, type: 'direct', participantIds: [id], noteName: '', context: '', blocked: false,
    activeArchiveId: 'archive-default', archiveRevision: 'rev-one', messages: [], updatedAt: new Date().toISOString(),
    archives: [{ id: 'archive-other', name: '其他存档', messages: [] }],
  })));
});
test('all eight kitchen types have valid food-only defaults, compatible methods and independent ingredient cabinets', () => {
  assert.equal(KITCHEN_TYPES.filter(t => t.category === 'dish').length, 4);
  assert.equal(KITCHEN_TYPES.filter(t => t.category === 'dessert').length, 4);
  assert.equal(new Set(KITCHEN_INGREDIENTS.map(i => i.id)).size, KITCHEN_INGREDIENTS.length);
  for (const ingredient of KITCHEN_INGREDIENTS) assert.match(ingredient.color, /^#[0-9a-f]{6}$/i);
  for (const type of KITCHEN_TYPES) {
    const r = { ...freshKitchenRecipe('玩家', type.id), name: type.name };
    validateKitchenRecipe(r); assert.ok(isKitchenRecipe(r));
    for (const method of type.methods) assert.ok(isKitchenRecipe({ ...r, method }));
    assert.ok(r.parts.every(p => kitchenIngredients(type.id).some(i => i.id === p.id)));
    if (type.category === 'dessert') assert.ok(!kitchenIngredients(type.id).some(i => ['soy', 'beef', 'salt'].includes(i.id)));
  }
  assert.throws(() => kitchenIngredient('unknown'), /食材/);
});
test('incomplete drafts are supported but required bases, names and real main ingredients are enforced at completion', () => {
  const blank = freshKitchenRecipe('玩家', 'cake');
  validateKitchenRecipe(blank, false);
  assert.throws(() => createKitchenMeal(blank), /名字/);
  assert.throws(() => validateKitchenRecipe({ ...blank, name: '蛋糕', parts: [{ id: 'cream', amount: 2 }] }), /面粉.*鸡蛋.*黄油/);
  assert.throws(() => validateKitchenRecipe({ ...recipe(), typeId: 'soup', method: 'boil', parts: [{ id: 'broth', amount: 1 }] }), /主要食材/);
});
test('expanded cabinets include pork, everyday vegetables and dessert additions in valid recipes and AI requests', () => {
  assert.ok(KITCHEN_INGREDIENTS.length >= 100);
  for (const id of ['pork', 'pork-belly', 'ribs', 'lamb', 'duck', 'squid', 'tofu-skin', 'cabbage', 'eggplant', 'lotus-root', 'garlic', 'chili']) {
    assert.ok(kitchenIngredients('saute').some(i => i.id === id), id);
    assert.ok(isKitchenRecipe({ ...freshKitchenRecipe('玩家', 'saute'), name: '家常小菜', parts: [{ id: 'egg', amount: 1 }, { id, amount: 2 }] }));
    assert.ok(!kitchenIngredients('cake').some(i => i.id === id), id);
  }
  for (const id of ['yogurt', 'mochi', 'taro', 'raspberry', 'cherry', 'pistachio', 'vanilla', 'coconut-flakes', 'wafer']) {
    const r = freshKitchenRecipe('玩家', 'cake');
    assert.ok(kitchenIngredients('cake').some(i => i.id === id), id);
    assert.ok(isKitchenRecipe({ ...r, name: '小蛋糕', parts: [...r.parts, { id, amount: 1 }] }));
  }
  const prompt = kitchenPrompt({ kind: 'recipe', category: 'dish', requirements: '猪肉配莲藕', actorId: actor.id, signal: new AbortController().signal });
  assert.match(prompt, /pork=猪肉/); assert.match(prompt, /lotus-root=莲藕/);
  const parsed = parseKitchenRecipe(JSON.stringify({ ...recipe(), parts: [{ id: 'rice', amount: 2 }, { id: 'pork', amount: 3 }], note: '给你多夹一点肉。' }), actor, 'dish');
  assert.match(kitchenRecipeText(parsed), /猪肉（多一点）/);
});
test('one ingredient click yields multiple scattered pieces, with strictly increasing density and stable existing positions', () => {
  const base = { ...freshKitchenRecipe('玩家', 'saute'), name: '小炒' };
  const layouts = [1, 2, 3].map(amount => kitchenFoodPieces({ ...base, parts: [{ id: 'pork', amount }] }));
  assert.deepEqual(layouts.map(pieces => pieces.length), [5, 10, 15]);
  for (const pieces of layouts) {
    assert.equal(new Set(pieces.map(p => `${p.x},${p.y}`)).size, pieces.length);
    assert.ok(Math.max(...pieces.map(p => p.x)) - Math.min(...pieces.map(p => p.x)) > 70);
    assert.ok(Math.max(...pieces.map(p => p.y)) - Math.min(...pieces.map(p => p.y)) > 15);
    assert.ok(new Set(pieces.map(p => p.rotation)).size > 1);
    assert.ok(pieces.every(p => ((p.x - 160) / 77) ** 2 + ((p.y - 144) / 32) ** 2 <= 1));
  }
  for (const piece of layouts[0]) assert.deepEqual(layouts[2].find(p => p.index === piece.index), piece);
  assert.deepEqual(kitchenFoodPieces({ ...base, parts: [{ id: 'pork', amount: 3 }] }), layouts[2]);
});
test('mixed food is depth-sorted and interleaved rather than grouped, including all 16 ingredients and all eight dish shapes', () => {
  const r = { ...recipe(), parts: [{ id: 'pork', amount: 2 }, { id: 'broccoli', amount: 2 }, { id: 'carrot', amount: 2 }] };
  const pieces = kitchenFoodPieces(r);
  assert.equal(pieces.length, 30);
  assert.ok(pieces.every((p, index) => !index || p.y >= pieces[index - 1].y));
  assert.ok(pieces.filter((p, index) => index > 0 && p.id !== pieces[index - 1].id).length > 12);
  assert.deepEqual(kitchenFoodPieces({ ...r, parts: [...r.parts].reverse() }), pieces);
  const art = renderToStaticMarkup(createElement(KitchenArt, { recipe: r }));
  assert.equal((art.match(/data-ingredient="pork"/g) ?? []).length, 10);
  assert.equal((art.match(/data-ingredient="broccoli"/g) ?? []).length, 10);
  for (const type of KITCHEN_TYPES) {
    const parts = kitchenIngredients(type.id).slice(0, 16).map(i => ({ id: i.id, amount: 3 }));
    const scattered = kitchenFoodPieces({ ...freshKitchenRecipe('玩家', type.id), parts });
    assert.ok(scattered.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.size > 0));
    assert.ok(scattered.length <= 384);
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(KitchenArt, { recipe: { ...freshKitchenRecipe('玩家', type.id), parts } })));
  }
  const cake = freshKitchenRecipe('玩家', 'cake');
  assert.deepEqual([1, 2, 3].map(amount => kitchenFoodPieces({ ...cake, parts: [{ id: 'strawberry', amount }] }).length), [2, 4, 6]);
  assert.equal(kitchenFoodPieces({ ...cake, parts: [{ id: 'heart', amount: 1 }] }).length, 1);
});
test('rice and noodle bases also increase visible density with their selected amount', () => {
  for (const id of ['rice', 'noodles'] as const) {
    const counts = [1, 2, 3].map(amount => {
      const markup = renderToStaticMarkup(createElement(KitchenArt, { recipe: { ...freshKitchenRecipe('玩家', id), parts: [{ id, amount }] } }));
      const base = markup.match(new RegExp(`<g data-kitchen-base="${id}"[^>]*>(.*?)</g>`))?.[1];
      assert.ok(base);
      return (base.match(/<path /g) ?? []).length;
    });
    assert.deepEqual(counts, id === 'rice' ? [24, 48, 72] : [5, 10, 15]);
  }
});
test('recipe guards reject invalid amounts, duplicate or wrong-category ingredients, methods, covers and provenance', () => {
  const r = recipe();
  for (const patch of [
    { typeId: 'unknown' }, { parts: [null] }, { parts: [{ id: 'beef', amount: 0 }] }, { parts: [{ id: 'rice', amount: 4 }] },
    { parts: [{ id: 'rice', amount: 1.5 }] }, { parts: [{ id: 'rice', amount: '2' }] },
    { parts: [...r.parts, r.parts[0]] }, { parts: [{ id: 'unknown', amount: 2 }] },
    { method: 'freeze' }, { heat: 4 }, { sweetness: 30 }, { plate: '__proto__' }, { maker: { name: '' } },
    { maker: { name: '玩家', actorId: 1 } }, { maker: { name: '玩家', note: '' } }, { origin: 1 },
    { cover: 'javascript:alert(1)' }, { cover: 'data:image/svg+xml;base64,AAAA' }, { adapted: 'false' }, { name: 'a'.repeat(41) },
  ]) assert.equal(isKitchenRecipe({ ...r, ...patch }), false, JSON.stringify(patch));
  assert.equal(isKitchenRecipe({ ...r, cover: 'https://example.test/plate.png' }), true);
  const maximum = { ...r, parts: kitchenIngredients('rice').slice(0, 16).map(i => ({ id: i.id, amount: 3 })) };
  assert.equal(isKitchenRecipe(maximum), true);
  assert.equal(isKitchenRecipe({ ...maximum, parts: kitchenIngredients('rice').slice(0, 17).map(i => ({ id: i.id, amount: 2 })) }), false);
});
test('AI parsing enforces the requested category, trusted authorship and recipe schema without saving unsolicited fields', () => {
  const proposal = { ...recipe(), note: '想让你吃一份热乎的。', maker: { name: '冒充玩家' }, transfer: { amount: 100 }, cover: 'https://example.test/ignored.png' };
  const parsed = parseKitchenRecipe(JSON.stringify(proposal), actor, 'dish');
  assert.equal(parsed.maker.name, actor.name); assert.equal(parsed.maker.actorId, actor.id); assert.equal(parsed.adapted, false);
  assert.equal(parsed.cover, undefined); assert.equal(Object.hasOwn(parsed, 'transfer'), false);
  assert.throws(() => parseKitchenRecipe('not json', actor, 'dish'), /JSON/);
  assert.throws(() => parseKitchenRecipe(JSON.stringify(proposal), actor, 'dessert'), /未采用/);
  assert.throws(() => parseKitchenRecipe(JSON.stringify({ ...proposal, parts: [{ id: 'rice', amount: 99 }] }), actor, 'dish'), /未采用/);
  assert.throws(() => parseKitchenRecipe(JSON.stringify({ ...proposal, note: '' }), actor, 'dish'), /留言/);
  assert.deepEqual(loadKitchen(), { recipes: [], meals: [] });
});
test('each AI recipe prompt provides an actually valid example for its requested category and tasting omits other feedback', () => {
  for (const category of ['dish', 'dessert'] as const) {
    const text = kitchenPrompt({ kind: 'recipe', category, requirements: '不辣，想吃热乎的', actorId: actor.id, signal: new AbortController().signal });
    const json = text.match(/对象格式示例：(\{[^\n]+\})。/)?.[1];
    assert.ok(json); parseKitchenRecipe(json, actor, category);
    assert.match(text, /不辣，想吃热乎的/);
  }
  const meal = serveKitchenMeal(createKitchenMeal(recipe()), actor);
  meal.servings[0].tastings.push({ id: 'private', createdAt: meal.createdAt, text: 'OTHER_FEEDBACK_SECRET', status: 'done' });
  assert.doesNotMatch(kitchenPrompt({ kind: 'taste', meal, actorId: actor.id, signal: new AbortController().signal }), /OTHER_FEEDBACK_SECRET/);
});
test('every type has distinct original SVG artwork with noncolliding clip IDs and optional cover rendering', () => {
  const art = new Set<string>();
  for (const type of KITCHEN_TYPES) {
    const r = { ...freshKitchenRecipe('玩家', type.id), name: type.name };
    const markup = renderToStaticMarkup(createElement(KitchenArt, { recipe: r }));
    assert.match(markup, /role="img"/); assert.match(markup, /料理插画/); art.add(markup.replace(/aria-label="[^"]+"/g, ''));
  }
  assert.equal(art.size, 8);
  const pair = renderToStaticMarkup(createElement('div', null, createElement(KitchenArt, { recipe: recipe() }), createElement(KitchenArt, { recipe: recipe() })));
  const ids = [...pair.matchAll(/clipPath id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 2); assert.equal(new Set(ids).size, 2);
  const cover = renderToStaticMarkup(createElement(KitchenArt, { recipe: { ...recipe(), cover: 'https://example.test/plate.png' } }));
  assert.match(cover, /成品封面/); assert.doesNotMatch(cover, /<svg/);
});
test('dessert artwork reflects selected cream, fruit and caramel rather than inventing toppings', () => {
  const cake = { ...freshKitchenRecipe('玩家', 'cake'), name: '小蛋糕' };
  const plain = { ...cake, parts: cake.parts.filter(p => p.id !== 'cream') };
  const frosted = renderToStaticMarkup(createElement(KitchenArt, { recipe: cake }));
  const bare = renderToStaticMarkup(createElement(KitchenArt, { recipe: plain }));
  assert.notEqual(frosted, bare);
  assert.doesNotMatch(bare, /fill="#d58a8b"/);
  const pudding = { ...freshKitchenRecipe('玩家', 'pudding'), name: '布丁' };
  assert.doesNotMatch(renderToStaticMarkup(createElement(KitchenArt, { recipe: pudding })), /fill="#c69d75"/);
  assert.match(renderToStaticMarkup(createElement(KitchenArt, { recipe: { ...pudding, parts: [...pudding.parts, { id: 'sugar', amount: 1 }] } })), /fill="#c69d75"/);
  const icecream = { ...freshKitchenRecipe('玩家', 'icecream'), name: '冰淇淋' };
  assert.doesNotMatch(renderToStaticMarkup(createElement(KitchenArt, { recipe: icecream })), /fill="#d58a8b"/);
  assert.match(renderToStaticMarkup(createElement(KitchenArt, { recipe: { ...icecream, parts: [...icecream.parts, { id: 'strawberry', amount: 1 }] } })), /fill="#d58a8b"/);
});
test('completed recipes and remakes retain independent snapshots, and conflicting IDs cannot overwrite saved food', async () => {
  const r = recipe(), meal = createKitchenMeal(r);
  await updateKitchen(state => saveKitchenMeal(state, meal));
  r.name = '改掉的名字'; r.parts[0].amount = 1; r.maker.name = '改掉的署名';
  assert.equal(loadKitchen().meals[0].recipe.name, '为你留的一碗饭');
  const edited = { ...copyKitchenRecipe(meal.recipe), id: 'new-version', name: '第二份', origin: '参考原来的配方' };
  await updateKitchen(state => saveKitchenMeal(state, createKitchenMeal(edited)));
  assert.equal(loadKitchen().recipes.length, 2); assert.equal(loadKitchen().meals.length, 2);
  await assert.rejects(updateKitchen(state => saveKitchenMeal(state, createKitchenMeal({ ...edited, name: '冲突' }))), /已变化/);
  assert.equal(loadKitchen().meals[0].recipe.name, '第二份');
  await updateKitchen(state => ({ ...state, recipes: state.recipes.filter(item => item.id !== edited.id) }));
  assert.equal(loadKitchen().meals.length, 2);
});
test('confirming character cooking saves finished food and the recipe at once, with opt-in chat sync only', async () => {
  const before = readStorageString('yyphone:wechat-chats'), scope = captureActivityChatScope(actor.id), r = recipe(true);
  const made = await recordKitchenResult({ kind: 'recipe', recipe: r, scope, syncToChat: false });
  assert.equal(loadKitchen().recipes.length, 1); assert.equal(loadKitchen().meals.length, 1);
  assert.equal(readStorageString('yyphone:wechat-chats'), before);
  r.parts[0].amount = 1; assert.equal(loadKitchen().recipes[0].parts[0].amount, 2);
  assert.equal(made.recipe.maker.actorId, actor.id); assert.equal(read('yyphone:memory-items'), null);
});
test('creation sync is duplicate-safe, truthful and reaches the actual next-chat context without writing long-term memory', async () => {
  const r = recipe(true), scope = captureActivityChatScope(actor.id);
  const made = await recordKitchenResult({ kind: 'recipe', recipe: r, scope, syncToChat: true });
  await recordKitchenResult({ kind: 'recipe', recipe: r, scope, syncToChat: true });
  assert.equal(loadKitchen().meals.length, 1); assert.equal(loadKitchen().meals[0].id, made.id);
  assert.equal(chats()[0].messages.length, 1); assert.equal(chats()[1].messages.length, 0);
  assert.match(chats()[0].messages[0].text, /林渡为小雨做了/);
  assert.match(JSON.stringify(buildPrompt({ chatId: 'chat-a', timeAwarenessEnabled: false })), /为你留的一碗饭/);
  assert.equal(read('yyphone:memory-items'), null);
});
test('adjusted character recipes keep real attribution while self remakes can carry their source', async () => {
  const r = { ...recipe(true), adapted: true };
  await recordKitchenResult({ kind: 'recipe', recipe: r, scope: captureActivityChatScope(actor.id), syncToChat: true });
  assert.match(chats()[0].messages[0].text, /林渡提供配方，小雨调整后完成/);
  assert.match(kitchenRecipeText({ ...recipe(), origin: '参考林渡的配方' }), /参考林渡的配方/);
});
test('first selected sync can create a private chat without modifying another recipient', async () => {
  const other = chats()[1]; writeStoredValue('yyphone:wechat-chats', [other]);
  await recordKitchenResult({ kind: 'recipe', recipe: recipe(true), scope: captureActivityChatScope(actor.id), syncToChat: true });
  assert.equal(chats()[0].participantIds[0], actor.id); assert.deepEqual(chats()[1], other);
});
async function tastingFixture() {
  let meal = serveKitchenMeal(createKitchenMeal(recipe()), actor);
  meal = serveKitchenMeal(meal, { id: 'b', name: '另一位' });
  meal.servings[0].tastings.push({ id: 'one', createdAt: meal.createdAt, status: 'pending', text: '' });
  meal.servings[1].tastings.push({ id: 'other', createdAt: meal.createdAt, status: 'done', text: 'OTHER_RECIPIENT_SECRET' });
  await updateKitchen(state => saveKitchenMeal(state, meal));
  return meal;
}
test('serving cards are duplicate-safe and never include another recipient feedback', async () => {
  const meal = await tastingFixture(), scope = captureActivityChatScope(actor.id);
  const first = kitchenChatChanges(scope, meal, 'serve'); writeStoredValue('yyphone:wechat-chats', first['yyphone:wechat-chats']);
  const createdAt = chats()[0].messages[0].createdAt;
  const second = kitchenChatChanges(scope, meal, 'serve'); writeStoredValue('yyphone:wechat-chats', second['yyphone:wechat-chats']);
  assert.equal(chats()[0].messages.length, 1); assert.equal(chats()[0].messages[0].createdAt, createdAt);
  assert.doesNotMatch(chats()[0].messages[0].text, /OTHER_RECIPIENT_SECRET/);
  assert.equal(serveKitchenMeal(meal, actor).servings.length, 2);
});
test('tastings preserve multiple dated attempts and optional sync includes only the selected real feedback', async () => {
  const meal = await tastingFixture(), scope = captureActivityChatScope(actor.id);
  await recordKitchenResult({ kind: 'taste', mealId: meal.id, tastingId: 'one', text: 'LOCAL_ONLY_FEEDBACK', scope, syncToChat: false });
  await patchKitchenMeal(meal.id, item => ({ ...item, servings: item.servings.map(s => s.actorId === actor.id
    ? { ...s, tastings: [...s.tastings, { id: 'two', createdAt: meal.createdAt, status: 'pending', text: '' }] } : s) }));
  await recordKitchenResult({ kind: 'taste', mealId: meal.id, tastingId: 'two', text: '这一口番茄很香。', scope, syncToChat: true });
  assert.equal(loadKitchen().meals[0].servings[0].tastings.length, 2);
  assert.match(chats()[0].messages[0].text, /这一口番茄很香/);
  assert.doesNotMatch(chats()[0].messages[0].text, /LOCAL_ONLY_FEEDBACK|OTHER_RECIPIENT_SECRET|\$\{tasting/);
  assert.equal(chats()[1].messages.length, 0);
});
test('archive, revision, player or contact changes prevent stale confirmations, even without selected sync', async () => {
  for (const change of ['archive', 'revision', 'player', 'contact']) {
    const scope = captureActivityChatScope(actor.id), all = chats(), profiles = read('pocketos:personas'), contacts = read('pocketos:wechat-contacts');
    if (change === 'archive') all[0].activeArchiveId = 'another';
    if (change === 'revision') all[0].archiveRevision = 'new-revision';
    writeStoredValue('yyphone:wechat-chats', all);
    if (change === 'player') writeStoredValue('pocketos:personas', { ...profiles, activeProfileId: 'another' });
    if (change === 'contact') writeStoredValue('pocketos:wechat-contacts', []);
    await assert.rejects(recordKitchenResult({ kind: 'recipe', recipe: recipe(true), scope, syncToChat: false }), /变化/);
    assert.equal(loadKitchen().meals.length, 0);
    all[0].activeArchiveId = 'archive-default'; all[0].archiveRevision = 'rev-one';
    writeStoredValue('yyphone:wechat-chats', all); writeStoredValue('pocketos:personas', profiles); writeStoredValue('pocketos:wechat-contacts', contacts);
  }
});
test('blocked chats and storage failures roll back food and selected chat cards together, and explicit retries work', async () => {
  const scope = captureActivityChatScope(actor.id), r = recipe(true), input = { kind: 'recipe' as const, recipe: r, scope, syncToChat: true };
  const all = chats(); all[0].blocked = true; writeStoredValue('yyphone:wechat-chats', all);
  await assert.rejects(recordKitchenResult(input), /拉黑/); assert.equal(loadKitchen().meals.length, 0);
  all[0].blocked = false; writeStoredValue('yyphone:wechat-chats', all);
  for (const key of [KITCHEN_KEY, 'yyphone:wechat-chats']) {
    failKey = key; await assert.rejects(recordKitchenResult(input), /KITCHEN_QUOTA_TEST/);
    assert.equal(loadKitchen().meals.length, 0); assert.equal(chats()[0].messages.length, 0);
  }
  await recordKitchenResult(input); assert.equal(loadKitchen().meals.length, 1); assert.equal(chats()[0].messages.length, 1);
});
test('aborted, missing and already completed tasting attempts cannot be marked successful', async () => {
  const meal = await tastingFixture(), scope = captureActivityChatScope(actor.id), controller = new AbortController(); controller.abort();
  await assert.rejects(recordKitchenResult({ kind: 'taste', mealId: meal.id, tastingId: 'one', text: '取消', scope, syncToChat: true, signal: controller.signal }), /abort/i);
  await assert.rejects(recordKitchenResult({ kind: 'taste', mealId: meal.id, tastingId: 'missing', text: '无效', scope, syncToChat: true }), /已变化/);
  assert.equal(loadKitchen().meals[0].servings[0].tastings[0].status, 'pending');
  assert.equal(chats()[0].messages.length, 0);
});
test('failed tasting sync rolls back its feedback and card instead of silently reporting local success', async () => {
  const meal = await tastingFixture(), input = { kind: 'taste' as const, mealId: meal.id, tastingId: 'one', text: '真实反馈', scope: captureActivityChatScope(actor.id), syncToChat: true };
  failKey = 'yyphone:wechat-chats'; await assert.rejects(recordKitchenResult(input), /KITCHEN_QUOTA_TEST/);
  assert.equal(loadKitchen().meals[0].servings[0].tastings[0].status, 'pending');
  await recordKitchenResult(input); assert.equal(chats()[0].messages.length, 1);
  await assert.rejects(recordKitchenResult(input), /已变化/);
});
test('interrupted attempts recover explicitly, serialization preserves history, and corrupt data is never replaced with an empty kitchen', async () => {
  const meal = await tastingFixture();
  await updateKitchen(recoverKitchen);
  assert.equal(loadKitchen().meals[0].servings[0].tastings[0].status, 'error');
  assert.equal(meal.servings[0].tastings[0].status, 'pending');
  assert.ok(isKitchenMeal(loadKitchen().meals[0])); assert.ok(isKitchenStore(JSON.parse(JSON.stringify(loadKitchen()))));
  assert.equal(Object.hasOwn(getAllCachedStorageItems(), KITCHEN_KEY), true);
  writeStoredValue(KITCHEN_KEY, { meals: 'corrupted', recipes: [] });
  const before = readStorageString(KITCHEN_KEY);
  assert.throws(() => loadKitchen(), /原数据已保留/);
  await assert.rejects(updateKitchen(() => ({ recipes: [], meals: [] })), /原数据已保留/);
  assert.equal(readStorageString(KITCHEN_KEY), before);
});
test('queued saves preserve concurrent meals, notify only successful writes and reject transaction-key collisions', async () => {
  let notifications = 0; const unsubscribe = subscribeKitchen(() => { notifications += 1; });
  await Promise.all([recipe(), { ...recipe(), id: 'other-recipe' }].map(r => updateKitchen(state => saveKitchenMeal(state, createKitchenMeal(r)))));
  assert.equal(loadKitchen().meals.length, 2); assert.equal(notifications, 2);
  await assert.rejects(updateKitchen(state => state, () => ({ [KITCHEN_KEY]: {} })), /不能覆盖/);
  assert.equal(notifications, 2); unsubscribe();
});
