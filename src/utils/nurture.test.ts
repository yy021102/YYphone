import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { advance, generateRound, newSave as createEmptySave, persistSave, pickCard, readSave, saveKey, validatePlan } from './nurture';
import { BODY_PARTS, emptyPortrait, imagePoint, initialWallet, validPortrait, touchTargets, selectRoundTouches, validateTouchReplies } from './nurtureGame';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NurtureStage } from '../components/NurtureStage';
import { NurtureCardArt } from '../components/NurtureCardArt';
import { archiveRound, emptyMemory, makeRecap, memoryContext, memoryFor, relationshipStage } from './nurtureMemory';
import type { Save } from './nurture';
import { configureGame, currentPlan, defaultDesign, validateDesign, validateShopReactions } from './nurtureDesign';
import { NurtureModuleEditor } from '../components/NurtureModuleEditor';
import { NurtureSettings } from '../components/NurtureSettings';
import { cardsForDraw, generateCommonCards, mergeCommonCards, playbackDuration, prepareDrawSequence, isPityRare } from './nurtureGacha';
import { NurtureGacha } from '../components/NurtureGacha';
import { NurtureRecharge } from '../components/NurtureRecharge';
import { NurtureHeartBurst } from '../components/NurtureTouchEffects';
import { ownedProducts, readNurtureIdentity } from './nurtureInventory';
import { NurtureInventory, NurtureGiftPlayback } from '../components/NurtureInventory';
import { defaultPool, poolContext, poolStatus, publishPool } from './nurturePool';
import { NurturePreview } from '../components/NurturePreview';
import { NurtureGamePages } from '../components/NurtureGamePages';
import { NurtureStatusNote } from '../components/NurtureStatusNote';

function newSave(): Save {
  return { ...createEmptySave(), cards: [
    { id: 'fixture-r', name: 'Common fixture', rarity: 'R', weight: 75, image: '', description: 'An ordinary daily moment.' },
    { id: 'fixture-sr', name: 'Middle fixture', rarity: 'SR', weight: 22, image: '', description: 'An afternoon memory.' },
    { id: 'fixture-ssr', name: 'SSR fixture', rarity: 'SSR', weight: 3, image: '', description: 'A rare night memory.' },
  ] };
}
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
beforeEach(async () => {
  values.clear(); await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '林渡', persona: '细心' }, { id: 'b', name: '小夏', persona: 'OTHER_ACTOR_SECRET' }]);
  writeStoredValue('yyphone:api-presets', [{ id: 'main', name: '主 API', endpoint: 'https://nurture.invalid/v1', apiKey: 'fixture', model: 'model' }]);
});
afterEach(() => mock.restoreAll());
test('new games have no sample cards and old sample cards are removed only from live and pending pools', () => {
  assert.deepEqual(createEmptySave().cards, []);
  const samples = [
    { ...newSave().cards[0], id: 'first', name: '初见的微光' },
    { ...newSave().cards[1], id: 'afternoon', name: '只属于你的午后' },
    { ...newSave().cards[2], id: 'promise', name: '星夜约定' },
  ];
  const custom = { ...newSave().cards[2], id: 'custom', name: '自己上传的卡' };
  const renamed = { ...samples[0], name: '自己改名后的卡' };
  const save = { ...createEmptySave(), cards: [...samples, custom, renamed], collection: [...samples], pity: 59 };
  const plan = currentPlan(save); save.pending = undefined;
  persistSave(saveKey('a', 'user'), { ...save, pending: plan });
  const migrated = readSave(saveKey('a', 'user'));
  assert.deepEqual(migrated.cards.map(c => c.name), [custom.name, renamed.name]);
  assert.deepEqual(migrated.pending?.cards.map(c => c.name), [custom.name, renamed.name]);
  assert.equal(migrated.collection.length, 3); assert.equal(migrated.pity, 59);
  assert.equal(JSON.parse(readStorageString(saveKey('a', 'user'))!).cards.length, 2);
});
test('R duplicates remain ordinary, do not count as pity rares and are collected separately on repeated pulls', async () => {
  const save = newSave(); save.wallet!.gems = 2000; save.collection = Array.from({ length: 5 }, () => ({ ...save.cards[0] }));
  assert.equal(isPityRare({ ...save.cards[0], pityEligible: true }), false);
  mock.method(Math, 'random', () => 0);
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const body = JSON.parse(String(init?.body)), source = JSON.parse(body.messages[1].content);
    assert.ok(body.messages[0].content.includes('Duplicate R cards are normal'));
    const base = { action: '看看日常', thought: '今天也陪你一会儿', speech: '', kind: 'daily', draw: false, delta: { mood: 0, energy: 0, affection: 0, growth: 0 } };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [{ ...base, kind: 'draw', draw: true, drawCount: 10, drawResultIds: source.drawSequence.slice(0, 10), resultThought: '都是熟悉的普卡，先收起来，继续攒钻吧。' }, base, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  assert.ok(cardsForDraw(next.rounds[0].steps[0]).every(c => c.rarity === 'R'));
  next = advance(next); assert.equal(next.collection.length, 15); assert.equal(next.pity, 10); assert.equal(calls, 1);
  const draft = { ...createEmptySave(), cards: [save.cards[0]] };
  assert.doesNotThrow(() => validatePlan(currentPlan(draft)));
  const incomplete = await generateRound(draft, 'a', new AbortController().signal);
  assert.equal(incomplete.rounds[0].steps[0].draw, false); assert.equal(incomplete.wallet?.gems, 300);
  assert.equal(calls, 2); // Draft R cards can be saved without blocking other game activities.
});
test('character and user saves remain isolated, including pending plans', () => {
  const a = newSave(); a.stats.mood = 12; a.pending = { stats: a.stats, speech: '只给你', cards: [], event: a.event };
  persistSave(saveKey('a', 'user'), a);
  assert.equal(readSave(saveKey('a', 'user')).pending?.speech, '只给你');
  assert.equal(readSave(saveKey('b', 'user')).stats.mood, 70);
  assert.equal(readSave(saveKey('a', 'other-user')).pending, undefined);
});
test('playback gives longer text more reading time and paused dialogs preserve complete existing content', () => {
  const step = { kind: 'touch', target: '手' as const, action: '轻碰手心', thought: '想再陪你一会儿。', speech: '暖暖的。', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false };
  assert.ok(playbackDuration(step) >= 8000);
  const long = { ...step, thought: '角色原有的较长心理活动。'.repeat(40), speech: '用户设置的完整发言，不应该丢失。'.repeat(20) };
  assert.ok(playbackDuration(long) > playbackDuration(step));
  assert.ok(playbackDuration({ ...step, resultThought: '揭晓后的心理活动。'.repeat(40) }) > playbackDuration(step));
  const html = renderToStaticMarkup(createElement(NurtureStage, { save: newSave(), userName: '我', actorName: '林渡', step: long, playing: true, busy: false, paused: true, onSettings: () => {} }));
  assert.ok(html.includes(long.thought)); assert.ok(html.includes(long.speech));
  assert.ok(html.includes('data-playback-paused="true"'));
  assert.ok(!html.includes('今天，你会为我安排什么呢？'));
});
test('weighted draws respect boundaries and exclude zero weight cards', () => {
  const cards = newSave().cards;
  assert.equal(pickCard(cards, () => 0)?.rarity, 'R');
  assert.equal(pickCard(cards, () => .75)?.rarity, 'SR');
  assert.equal(pickCard(cards, () => .999)?.rarity, 'SSR');
  assert.equal(pickCard(cards.map(c => ({ ...c, weight: 0 }))), undefined);
});
test('planner validates numbers, duplicate cards and event deadlines', () => {
  const s = newSave(), plan = { stats: s.stats, speech: '', cards: s.cards, event: s.event };
  assert.doesNotThrow(() => validatePlan(plan));
  assert.throws(() => validatePlan({ ...plan, stats: { ...s.stats, mood: NaN } }));
  assert.throws(() => validatePlan({ ...plan, cards: [s.cards[0], s.cards[0]] }));
  assert.throws(() => validatePlan({ ...plan, event: { ...s.event, enabled: true, title: '过期', endsAt: '2000-01-01' } }));
});
test('generation uses only selected player and next-round content; playback resumes exactly once', async () => {
  const s = newSave();
  s.pending = { stats: { ...s.stats, mood: 99 }, speech: '想看花', cards: [s.cards[2]], event: { ...s.event, enabled: true, title: '花朝', endsAt: '2099-01-01T12:00', description: '赏花' } };
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)), source = JSON.parse(body.messages[1].content);
    assert.equal(source.player.id, 'a'); assert.equal(source.stats.mood, 99); assert.equal(source.greeting, '想看花'); assert.equal(source.event.title, '花朝');
    assert.ok(!String(init?.body).includes('OTHER_ACTOR_SECRET'));
    assert.ok(body.messages[0].content.includes('建议20～45个中文字'));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: Array.from({ length: 4 }, (_, i) => ({ action: '陪伴', thought: '今天也想照顾好你', speech: '谢谢', delta: { mood: 5, energy: -1, affection: 2, growth: 1 }, draw: i === 0, resultThought: 'Actual result reaction', drawResultIds: source.drawSequence.slice(0, 1) })) }) } }] });
  });
  const generated = await generateRound(s, 'a', new AbortController().signal);
  assert.equal(generated.rounds[0].steps[0].speech, '想看花');
  assert.equal(s.pending.speech, '想看花'); assert.equal(generated.pending, undefined); assert.equal(generated.collection.length, 0);
  const key = saveKey('a', 'user'); persistSave(key, advance(generated));
  let resumed = readSave(key);
  assert.equal(resumed.collection.length, 1); assert.equal(resumed.stats.mood, 100); assert.equal(resumed.rounds[0].cursor, 1);
  for (let i = 0; i < 6; i++) resumed = advance(resumed);
  assert.equal(resumed.collection.length, 1); assert.equal(resumed.rounds[0].cursor, 4); assert.deepEqual(resumed.stats, generated.rounds[0].after);
});
test('invalid AI results leave original archive and pending settings intact', async () => {
  const s = newSave(), original = JSON.stringify(s);
  mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: '{"steps":[]}' } }] }));
  await assert.rejects(generateRound(s, 'a', new AbortController().signal), /格式不完整/);
  assert.equal(JSON.stringify(s), original);
});
test('portrait coordinates stay aligned across display sizes, preserve all seven replies and reject bad points', () => {
  assert.deepEqual(imagePoint(60, 120, { left: 10, top: 20, width: 100, height: 200 }), { x: .5, y: .5 });
  assert.deepEqual(imagePoint(110, 220, { left: 10, top: 20, width: 200, height: 400 }), { x: .5, y: .5 });
  assert.deepEqual(imagePoint(-1, 500, { left: 10, top: 20, width: 100, height: 200 }), { x: 0, y: 1 });
  assert.throws(() => imagePoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }));
  const portrait = emptyPortrait();
  for (const part of BODY_PARTS) { portrait.points[part] = { x: .5, y: .5 }; portrait.replies[part] = `${part}的回应`; }
  assert.ok(validPortrait(portrait));
  const a = { ...newSave(), portrait };
  persistSave(saveKey('a', 'user'), a);
  assert.deepEqual(readSave(saveKey('a', 'user')).portrait, portrait);
  assert.equal(readSave(saveKey('b', 'user')).portrait?.image, '');
  assert.ok(!validPortrait({ ...portrait, points: { 头: { x: 2, y: .5 } } }));
});
test('touch uses exact per-part reply and shop, schedule, recharge settle only during playback', async () => {
  const s = newSave();
  s.portrait = { image: 'data:image/png;base64,fixture', points: { 头: { x: .5, y: .15 } }, replies: { 头: '头发要被你揉乱啦。', 手: 'HAND_REPLY_SECRET' } };
  const base = { action: '操作', thought: '想好好照顾你', speech: 'AI的发言', delta: { mood: 1, energy: 0, affection: 1, growth: 0 }, draw: false };
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.deepEqual(source.touchTargets[0], { target: '头', reply: '头发要被你揉乱啦。' });
    assert.ok(!String(init?.body).includes('data:image')); // Full portrait stays local.
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [
      { ...base, kind: 'touch', target: '头' }, { ...base, kind: 'shop', itemId: 'dress' },
      { ...base, kind: 'schedule', itemId: 'reading' }, { ...base, kind: 'recharge' },
    ] }) } }] });
  });
  const generated = await generateRound(s, 'a', new AbortController().signal);
  assert.equal(generated.rounds[0].steps[0].speech, '头发要被你揉乱啦。');
  assert.equal(generated.rounds[0].steps[0].target, '头');
  assert.equal(generated.inventory?.length ?? 0, 0);
  assert.equal(generated.wallet?.gems ?? initialWallet().gems, 300);
  let next = advance(advance(generated));
  assert.equal(next.wallet?.gems, 180); assert.deepEqual(next.inventory, ['dress']);
  const key = saveKey('a', 'user'); persistSave(key, next); next = advance(advance(readSave(key)));
  assert.equal(next.wallet?.gems, 240); assert.equal(next.wallet?.recharged, 60);
  assert.equal(next.stats.growth, 20); assert.equal(next.stats.energy, 75);
  assert.deepEqual(advance(next), next);
});
test('game stage renders full portrait, viewing-only modules and active touch position', () => {
  const save = newSave(); save.portrait = { image: '/portrait.png', points: { 脸: { x: .45, y: .2 } }, replies: { 脸: '好痒呀' } };
  const html = renderToStaticMarkup(createElement(NurtureStage, { save, userName: '小雨', actorName: '林渡', busy: false, playing: true, onSettings: () => {}, step: { action: '碰脸', thought: '小心一点', speech: '好痒呀', delta: save.stats, draw: false, kind: 'touch', target: '脸' } }));
  for (const label of ['小雨的立绘', '抽卡', '商城', '日程', '约会', '限时活动', '状态', '好痒呀', 'left:45%;top:20%']) assert.ok(html.includes(label), label);
  assert.ok(!html.includes('<meter'));
});
test('text and image card art persist separately and render consistently', () => {
  const s = newSave();
  s.cards[0] = { ...s.cards[0], artType: 'text', artText: '第一行\n第二行 <心动>', image: '/hidden-image.png' };
  validatePlan({ stats: s.stats, speech: '', cards: s.cards, event: s.event });
  const key = saveKey('a', 'user'); persistSave(key, s);
  const card = readSave(key).cards[0];
  assert.equal(card.artText, '第一行\n第二行 <心动>');
  const text = renderToStaticMarkup(createElement(NurtureCardArt, { card }));
  assert.ok(text.includes('第一行\n第二行 &lt;心动&gt;')); assert.ok(!text.includes('<img'));
  const image = renderToStaticMarkup(createElement(NurtureCardArt, { card: { ...card, artType: 'image' } }));
  assert.ok(image.includes('src="/hidden-image.png"')); assert.ok(!image.includes('第一行'));
  const legacy = renderToStaticMarkup(createElement(NurtureCardArt, { card: newSave().cards[0] }));
  assert.ok(legacy.includes(newSave().cards[0].description));
});
test('the status note is editable, displayed verbatim, read with a thought in one API call and preserved in history', async () => {
  const save = newSave(); save.design = { ...defaultDesign(), statusNote: '今天想安静地陪你一会儿。\n晚点一起看书吧。' };
  const note = save.design.statusNote!, originalStats = { ...save.stats }; let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.game.statusNote, note);
    const base = { kind: 'daily', action: '看看接下来的安排', thought: '那就把今天安排得安静一点', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ openingThought: '先看看今天的状态。', steps: [{ ...base, kind: 'status', action: '打开状态页读留言', thought: '读到想安静地陪我一会儿，今天先不安排太累的活动。', speech: 'AI不能改写的留言', delta: { mood: 15, energy: 15, affection: 15, growth: 15 } }, base, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  const step = next.rounds[0].steps[0];
  assert.equal(step.statusNote, note); assert.equal(step.speech, ''); assert.ok(step.thought.includes('安静'));
  assert.ok(playbackDuration(step) >= 5000);
  next = advance(next); assert.deepEqual(next.stats, originalStats);
  while (next.rounds[0].cursor < next.rounds[0].steps.length) next = advance(next);
  persistSave(saveKey('a', 'user'), next); next = readSave(saveKey('a', 'user'));
  assert.equal(next.design?.statusNote, note); assert.equal(next.rounds[0].steps[0].statusNote, note); assert.equal(calls, 1);
  const page = renderToStaticMarkup(createElement(NurtureGamePages, { panel: 'stats', save: next, userName: '我', onNavigate: () => {} }));
  assert.ok(page.includes(note)); assert.ok(!page.includes('<textarea'));
  const editor = renderToStaticMarkup(createElement(NurtureModuleEditor, { module: 'stats', save: next, userName: '我', onSave: () => {} }));
  assert.ok(editor.includes('状态页留言')); assert.ok(editor.includes(note));
  assert.equal(renderToStaticMarkup(createElement(NurtureStatusNote, { text: '  ' })), '');
});
test('a configured status note must have a reading action; missing it does not archive a round or make another request', async () => {
  const save = newSave(); save.design = { ...defaultDesign(), statusNote: '记得休息。' }; let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: Array.from({ length: 4 }, () => ({ action: '散步', thought: '先走一走', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false })) }) } }] });
  });
  await assert.rejects(generateRound(save, 'a', new AbortController().signal), /查看状态页留言/);
  assert.equal(calls, 1); assert.equal(save.rounds.length, 0);
  assert.throws(() => validateDesign({ ...save.design, statusNote: 'a'.repeat(3001) }));
});
test('eye preview displays browsable game pages without editors, scripted playback, API calls or save changes', () => {
  const save = newSave(); save.design = defaultDesign('小月');
  const original = JSON.stringify(save);
  const network = mock.method(globalThis, 'fetch', async () => { throw new Error('Preview must not call AI'); });
  const preview = renderToStaticMarkup(createElement(NurturePreview, { save, actorName: '林渡', userName: '小月', onClose: () => {} }));
  for (const label of ['游戏页面预览', '抽卡', '商城', '日程', '约会', '物品栏']) assert.ok(preview.includes(label));
  for (const label of ['nurture-stage-dialog', '角色操作预览', '自动切换场景', 'nurture-role-opening', '<form', '<textarea', '定位部位']) assert.ok(!preview.includes(label), label);
  const expected = { draw: '单抽', shop: '购买', stats: '心情', schedule: '安排', date: '赴约', recharge: '确认支付', cards: '我的卡册', inventory: '物品栏' };
  for (const [panel, label] of Object.entries(expected)) {
    const html = renderToStaticMarkup(createElement(NurtureGamePages, { panel, save, userName: '小月', onNavigate: () => {} }));
    assert.ok(html.includes(label), panel);
    if (panel === 'draw') {
      assert.ok(html.includes('nurture-pool-feature'));
      assert.ok(html.includes(save.cards[2].name));
      assert.ok(!html.includes(save.cards[0].name));
      assert.ok(!html.includes(save.cards[1].name));
      assert.ok(html.includes('60')); assert.ok(html.includes('十连'));
    }
    for (const forbidden of ['<form', '<input', '<textarea', '新增商品', '新增日程', '保存 · 下一轮生效']) assert.ok(!html.includes(forbidden), `${panel}: ${forbidden}`);
  }
  assert.equal(network.mock.callCount(), 0); assert.equal(JSON.stringify(save), original);
  const limited = { ...save.cards[2], id: 'featured-limited', name: '优先展示的限定', limited: true, image: '/limited-art.png' };
  const featured = renderToStaticMarkup(createElement(NurtureGamePages, { panel: 'draw', save: { ...save, cards: [...save.cards, limited] }, userName: '小月', onNavigate: () => {} }));
  assert.ok(featured.includes('src="/limited-art.png"')); assert.ok(featured.includes('上一张稀有卡')); assert.ok(featured.includes('下一张稀有卡'));
  assert.equal((featured.match(/class="nurture-pool-feature"/g) ?? []).length, 1);
  assert.ok(!featured.includes(save.cards[0].name));
});
test('pool publishing records new cards and dates, recognizes owned limited copies and respects availability windows', () => {
  const save = newSave(), plan = currentPlan(save), now = Date.parse('2026-11-18T12:00:00Z');
  plan.cards.push({ ...plan.cards[2], id: 'new-limited', name: '新限定', limited: true });
  const published = publishPool(plan, save);
  assert.ok(published.pool?.updatedAt); assert.ok(published.cards.at(-1)?.releasedAt);
  assert.ok(poolContext(published, save).isNew); assert.deepEqual(poolContext(published, save).limitedMissing, ['new-limited']);
  save.collection = [published.cards.at(-1)!, published.cards.at(-1)!];
  const owned = poolContext(published, save);
  assert.equal(owned.allLimitedOwned, true); assert.equal(owned.cards.at(-1)?.ownedCount, 2);
  assert.equal(poolStatus({ ...defaultPool(), startsAt: '2026-11-19T00:00:00Z' }, now), 'upcoming');
  assert.equal(poolStatus({ ...defaultPool(), endsAt: '2026-11-18T12:00:00Z' }, now), 'ended');
  assert.equal(poolStatus(defaultPool(), now), 'open');
  validatePlan(published);
  assert.throws(() => validatePlan({ ...published, pool: { ...defaultPool(), startsAt: '2099-02-01', endsAt: '2099-01-01' } }));
  const unchanged = publishPool(published, { ...save, pending: published });
  assert.equal(unchanged.pool?.updatedAt, published.pool?.updatedAt);
});
test('an opening thought precedes sampled touches, survives logs and is carried to the next round with pool continuity', async () => {
  const save = newSave(); save.portrait = { image: '', points: { 手: { x: .4, y: .5 } }, replies: { 手: '手心暖暖的。' } };
  const plan = currentPlan(save); plan.pool = { ...defaultPool(), name: '初冬限定', updatedAt: new Date().toISOString() };
  plan.cards[2].limited = true; save.pending = plan;
  let reversed = false, calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.campaign.name, '初冬限定'); assert.equal(source.campaign.isNew, true); assert.equal(source.campaign.allLimitedOwned, false);
    const base = { action: '看看今天的日程', thought: '想把今天安排好', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, kind: 'daily', draw: false };
    const touch = { ...base, kind: 'touch', target: '手', action: '轻碰屏幕里的手', thought: '读到手心暖暖的，忽然很想真的握住它。' };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ openingThought: '又打开了游戏，看看今天的你和新卡池。', steps: reversed ? [base, touch, base, base] : [touch, base, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  assert.equal(next.rounds[0].openingThought, '又打开了游戏，看看今天的你和新卡池。'); assert.equal(next.rounds[0].steps[0].kind, 'touch');
  assert.equal(next.rounds[0].steps[0].speech, '手心暖暖的。');
  const intro = renderToStaticMarkup(createElement(NurtureStage, { save: next, userName: '我', actorName: '林渡', busy: false, playing: true, onSettings: () => {}, step: { ...next.rounds[0].steps[0], kind: 'open', thought: next.rounds[0].openingThought! } }));
  assert.ok(intro.includes('角色打开游戏')); assert.ok(intro.includes(next.rounds[0].openingThought!));
  while (next.rounds[0].cursor < next.rounds[0].steps.length) next = advance(next);
  persistSave(saveKey('a', 'user'), next); next = readSave(saveKey('a', 'user'));
  assert.equal(memoryContext(next).previousRound?.openingThought, '又打开了游戏，看看今天的你和新卡池。');
  assert.equal(poolContext(currentPlan(next), next).isNew, false); assert.ok(next.rounds[0].recap?.summary.includes('轻碰屏幕里的手'));
  reversed = true; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /先完成立绘触碰/);
  assert.equal(calls, 2);
});
test('expired pools cannot spend gems or lose pity and existing limited collections', async () => {
  const save = newSave(); save.pool = { ...defaultPool(), name: '已结束的限定', endsAt: '2000-01-01T00:00:00Z' }; save.pity = 59;
  save.cards[2].limited = true; save.collection = [save.cards[2]];
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.campaign.status, 'ended'); assert.equal(source.campaign.allLimitedOwned, true); assert.deepEqual(source.drawSequence, []);
    const base = { action: '看看是否还能抽', thought: '已经过期了，留着钻石吧', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, kind: 'daily', draw: false };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ openingThought: '打开游戏，看看新的安排。', steps: [{ ...base, kind: 'draw', draw: true, drawCount: 10 }, base, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  assert.equal(next.rounds[0].steps[0].draw, false);
  while (next.rounds[0].cursor < next.rounds[0].steps.length) next = advance(next);
  assert.equal(next.wallet?.gems, 300); assert.equal(next.pity, 59); assert.equal(next.collection.length, 1); assert.equal(calls, 1);
});
test('purchases enter inventory and only sending applies the uploaded reaction and configured effects, exactly once', async () => {
  const save = newSave(); save.design = defaultDesign();
  const product = { id: 'gift', name: '小兔玩偶', description: '柔软的小兔', type: '道具' as const, currency: 'coins' as const, price: 20, image: 'data:image/png;base64,LOCAL_PRODUCT_IMAGE', reaction: '抱住小兔，这个真的好软呀。', effectsEnabled: true, effects: { mood: 8, energy: 0, affection: 5, growth: 0 } };
  save.design.shop = [product]; let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.shop[0].reaction, product.reaction); assert.deepEqual(source.shop[0].effects, product.effects);
    assert.ok(!String(init?.body).includes('LOCAL_PRODUCT_IMAGE')); assert.deepEqual(source.inventory, []);
    const base = { action: '陪伴', thought: '收到后抱着小兔的样子让我想再陪你一会儿', speech: 'AI不应替user写的反应', delta: { mood: 15, energy: 15, affection: 15, growth: 15 }, draw: false, kind: 'daily' };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [{ ...base, kind: 'shop', itemId: 'gift' }, { ...base, kind: 'gift', itemId: 'gift' }, { ...base, delta: { mood: 0, energy: 0, affection: 0, growth: 0 } }, { ...base, delta: { mood: 0, energy: 0, affection: 0, growth: 0 } }] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  assert.equal(ownedProducts(next).length, 0); assert.equal(next.rounds[0].steps[1].speech, product.reaction);
  next = advance(next); assert.equal(next.wallet?.coins, 980); assert.equal(next.stats.mood, 70); assert.equal(ownedProducts(next)[0].status, 'owned');
  assert.deepEqual(next.inventory, ['gift']); assert.deepEqual(next.stats, save.stats);
  const key = saveKey('a', 'user'); persistSave(key, next); next = readSave(key);
  next.design!.shop[0].reaction = '新配置不改旧物品'; next.design!.shop[0].effects!.mood = 1;
  next = advance(next); assert.equal(ownedProducts(next)[0].status, 'sent'); assert.deepEqual(next.inventory, []);
  assert.equal(next.stats.mood, 78); assert.equal(next.stats.affection, 25); assert.equal(next.rounds[0].steps[1].speech, product.reaction);
  next = advance(advance(next)); assert.equal(next.stats.mood, 78); assert.equal(calls, 1); assert.deepEqual(advance(next), next);
  persistSave(key, next); assert.equal(ownedProducts(readSave(key))[0].status, 'sent'); assert.equal(ownedProducts(readSave(saveKey('b', 'user'))).length, 0);
  assert.ok(memoryFor(next).events.some(e => e.kind === 'gift-received' && e.detail.includes(product.reaction)));
  const playback = renderToStaticMarkup(createElement(NurtureGiftPlayback, { step: next.rounds[0].steps[1], actorName: '林渡' }));
  assert.ok(playback.includes(product.reaction)); assert.ok(playback.includes('小兔玩偶'));
});
test('missing reactions, unowned gifts and repeated sending cannot be bypassed by AI', async () => {
  const save = newSave(); save.design = defaultDesign();
  save.design.shop = [{ id: 'gift', name: '礼物', description: '', type: '道具', currency: 'coins', price: 1, reaction: '谢谢你', effectsEnabled: false, effects: { mood: 15, energy: 15, affection: 15, growth: 15 } }];
  let mode = 'duplicate';
  mock.method(globalThis, 'fetch', async () => {
    const base = { action: '送礼', thought: '想送给你', speech: 'AI补写', delta: { mood: 15, energy: 15, affection: 15, growth: 15 }, draw: false, kind: 'daily' };
    const steps = [{ ...base, kind: mode === 'unowned' ? 'gift' : 'shop', itemId: 'gift' }, { ...base, kind: 'gift', itemId: 'gift' }, mode === 'duplicate' ? { ...base, kind: 'gift', itemId: 'gift' } : { ...base, delta: { mood: 0, energy: 0, affection: 0, growth: 0 } }, { ...base, delta: { mood: 0, energy: 0, affection: 0, growth: 0 } }];
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps }) } }] });
  });
  await assert.rejects(generateRound(save, 'a', new AbortController().signal), /已经送出/); assert.equal(save.wallet?.coins, 1000);
  mode = 'unowned'; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /不在物品栏/);
  mode = 'valid'; let next = await generateRound(save, 'a', new AbortController().signal); next = advance(advance(next)); assert.deepEqual(next.stats, save.stats);
  save.design.shop[0].reaction = '  '; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /还没有收到后的反应/);
  assert.throws(() => validateShopReactions(save.design!.shop), /请填写/);
  assert.equal(save.rounds.length, 0);
  const inventory = renderToStaticMarkup(createElement(NurtureInventory, { save: { ...newSave(), inventory: ['cake'] } }));
  assert.ok(inventory.includes('草莓小蛋糕')); assert.ok(inventory.includes('待送出'));
});
test('generation uses character persona and global world books but excludes chats, memories, external user profiles and non-global books', async () => {
  writeStoredValue('pocketos:personas', { activeProfileId: 'scope', profiles: [{ id: 'scope', realName: 'EXTERNAL_PERSONA_SECRET', identity: 'EXTERNAL_IDENTITY_SECRET' }] });
  writeStoredValue('yyphone:wechat-chats', [{ messages: [{ text: 'WECHAT_CHAT_SECRET' }] }]);
  writeStoredValue('yyphone:memory-items', [{ content: 'EXTERNAL_MEMORY_SECRET' }]);
  writeStoredValue('yyphone:wechat-profile', { name: 'WECHAT_PROFILE_SECRET' });
  writeStoredValue('yyphone:world-books', [{ id: 'global', name: '全局', isGlobal: true, entries: [{ id: 'entry', title: '背景', content: 'GLOBAL_WORLD_ALLOWED', depth: 'front' }] }, { id: 'private', name: '其他世界书', isGlobal: false, entries: [{ id: 'entry2', title: '背景', content: 'NON_GLOBAL_SECRET', depth: 'front' }] }]);
  assert.deepEqual(readNurtureIdentity(), { id: 'scope', name: '我' });
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const serialized = String(init?.body), body = JSON.parse(serialized), source = JSON.parse(body.messages[1].content);
    assert.equal(source.player.persona, '细心'); assert.equal(source.raised.name, '我'); assert.ok(serialized.includes('GLOBAL_WORLD_ALLOWED'));
    for (const secret of ['EXTERNAL_PERSONA_SECRET', 'EXTERNAL_IDENTITY_SECRET', 'WECHAT_CHAT_SECRET', 'EXTERNAL_MEMORY_SECRET', 'WECHAT_PROFILE_SECRET', 'NON_GLOBAL_SECRET', 'OTHER_ACTOR_SECRET']) assert.ok(!serialized.includes(secret), secret);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: Array.from({ length: 4 }, () => ({ action: '照顾游戏里的你', thought: '想好好陪伴', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false })) }) } }] });
  });
  await generateRound(newSave(), 'a', new AbortController().signal); assert.equal(calls, 1);
});
test('recharge prepares checkout thoughts in the same API call and settles only once during playback', async () => {
  const save = newSave(); let apiCalls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    apiCalls++;
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.game.rechargePriceYuan, 6);
    const base = { action: '看看今天', thought: '先安排好日常', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false, kind: 'daily' };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [{ ...base, kind: 'recharge', thought: '这次补一点星钻，留着买衣服。', paymentThought: '确认一下金额，正好够这一份。', resultThought: '到账了，下次给你挑件喜欢的。' }, base, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  const step = next.rounds[0].steps[0];
  assert.equal(apiCalls, 1); assert.ok(step.paymentThought?.includes('确认一下金额'));
  assert.ok(playbackDuration(step) >= 16000); assert.equal(next.wallet?.gems, 300);
  const html = renderToStaticMarkup(createElement(NurtureRecharge, { step, actorName: '林渡', gems: 60, orderId: 'order-1' }));
  for (const label of ['模拟充值收银台', '确认充值订单', '6.00', '60 星钻', '零钱（模拟）', '这次补一点星钻']) assert.ok(html.includes(label), label);
  assert.ok(html.includes('disabled')); assert.ok(!html.includes('<input')); assert.ok(!html.includes('下次给你挑件喜欢的'));
  next = advance(next); persistSave(saveKey('a', 'user'), next); next = readSave(saveKey('a', 'user'));
  assert.equal(next.wallet?.gems, 360); assert.equal(next.rounds[0].steps[0].paymentThought, step.paymentThought);
  next = advance(advance(advance(next))); assert.equal(next.wallet?.gems, 360); assert.equal(next.wallet?.recharged, 60);
  assert.ok(memoryFor(next).thoughts.includes('充值后：到账了')); assert.equal(apiCalls, 1); assert.deepEqual(advance(next), next);
});
test('playback tap feedback is visual only and heart bursts stay attached to mapped portrait coordinates', () => {
  const save = newSave();
  const base = { action: '安排日程', thought: '读一会儿书', speech: '', delta: save.stats, kind: 'schedule', itemId: 'reading', draw: false };
  const html = renderToStaticMarkup(createElement(NurtureStage, { save, userName: '小雨', actorName: '林渡', step: base, busy: false, playing: true, onSettings: () => {} }));
  assert.ok(html.includes('nurture-screen-tap')); assert.ok(!html.includes('<form'));
  const idle = renderToStaticMarkup(createElement(NurtureStage, { save, userName: '小雨', actorName: '林渡', busy: false, playing: false, onSettings: () => {} }));
  assert.ok(!idle.includes('nurture-screen-tap')); assert.ok(!idle.includes('nurture-stage-dialog'));
  const hearts = renderToStaticMarkup(createElement(NurtureHeartBurst, { x: .4, y: .2, part: '手' }));
  assert.ok(hearts.includes('left:40%;top:20%')); assert.equal((hearts.match(/<svg/g) ?? []).length, 7);
  assert.ok(hearts.includes('--heart-x')); assert.ok(hearts.includes('爱心散开'));
});
test('sixty-pull pity is counted card by card, resets on rare drops and supports custom eligible cards', () => {
  const cards = newSave().cards;
  const sixty = prepareDrawSequence(cards, 0, pool => pool[0], 120);
  assert.equal(sixty.cards[58].rarity, 'R'); assert.equal(sixty.counters[58], 59);
  assert.equal(sixty.cards[59].rarity, 'SSR'); assert.equal(sixty.counters[59], 0);
  assert.equal(sixty.cards[119].rarity, 'SSR'); assert.equal(sixty.counters[119], 0);
  const early = prepareDrawSequence(cards, 59, pool => pool.find(c => c.rarity === 'SSR'), 2);
  assert.deepEqual(early.counters, [0, 0]);
  const custom = [{ ...cards[0], pityEligible: false }, { ...cards[1], rarity: 'SPECIAL', pityEligible: true }, { ...cards[2], pityEligible: false }];
  const guaranteed = prepareDrawSequence(custom, 59, pool => pool[0], 1);
  assert.equal(guaranteed.cards[0].rarity, 'SPECIAL'); assert.ok(isPityRare(guaranteed.cards[0]));
  assert.throws(() => prepareDrawSequence([cards[0]], 0, pool => pool[0]), /至少一张/);
});
test('twenty-pull SR guarantee stays independent and yields to simultaneous SSR guarantee', () => {
  const cards = newSave().cards;
  const draws = prepareDrawSequence(cards, 0, pool => pool[0], 120);
  for (const index of [19, 39, 79, 99]) {
    assert.equal(draws.cards[index].rarity, 'SR');
    assert.equal(draws.srCounters[index], 0);
    assert.equal(draws.counters[index], (index + 1) % 60);
  }
  for (const index of [59, 119]) {
    assert.equal(draws.cards[index].rarity, 'SSR');
    assert.equal(draws.counters[index], 0); assert.equal(draws.srCounters[index], 0);
  }
  const simultaneous = prepareDrawSequence(cards, 59, pool => pool[0], 1, 19);
  assert.equal(simultaneous.cards[0].rarity, 'SSR');
  assert.deepEqual(simultaneous.srCounters, [0]);
  const early = prepareDrawSequence(cards, 10, pool => pool.find(c => c.rarity === 'SSR'), 1, 18);
  assert.deepEqual(early.counters, [0]); assert.deepEqual(early.srCounters, [0]);
  const noSr = prepareDrawSequence(cards.filter(c => c.rarity !== 'SR'), 0, pool => pool[0], 20);
  assert.equal(noSr.cards[19].rarity, 'SSR');
  assert.equal(isPityRare({ ...cards[1], pityEligible: true }), false);
});

test('SR guarantee settles once, survives reload and migrates old collection history', async () => {
  const save = newSave(); save.srPity = 19; save.pity = 25;
  mock.method(Math, 'random', () => 0);
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.pity.srCount, 19); assert.equal(source.pity.srLimit, 20);
    assert.equal(source.drawSequence[0], save.cards[1].id);
    const base = { action: 'Draw', thought: 'One more.', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false, kind: 'daily' };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [{ ...base, kind: 'draw', draw: true, drawCount: 1, drawResultIds: source.drawSequence.slice(0, 1), resultThought: 'An SR.' }, base, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  assert.equal(next.srPity, 19); assert.equal(next.pity, 25);
  const key = saveKey('a', 'sr-user'); persistSave(key, next); next = readSave(key);
  next = advance(next); assert.equal(next.srPity, 0); assert.equal(next.pity, 26);
  persistSave(key, next); next = readSave(key);
  next = advance(advance(advance(next))); assert.equal(next.srPity, 0); assert.equal(next.collection.length, 1); assert.equal(calls, 1);
  const legacy = newSave(); delete legacy.srPity;
  legacy.collection = [legacy.cards[1], ...Array.from({ length: 17 }, () => legacy.cards[0])];
  persistSave(key, legacy); assert.equal(readSave(key).srPity, 17);
  legacy.collection = Array.from({ length: 45 }, () => legacy.cards[0]);
  persistSave(key, legacy); assert.equal(readSave(key).srPity, 19);
});

test('ten-pull pity carries across rounds and reloads with one API request and no premature reset', async () => {
  const save = newSave(); save.pity = 55; save.wallet!.gems = 2000;
  mock.method(Math, 'random', () => 0);
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++;
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.pity.count, 55); assert.equal(source.pity.limit, 60);
    assert.equal(source.drawSequence[4], save.cards[2].id); // 56,57,58,59,60.
    const base = { action: '十连抽卡', thought: '快到保底了', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false, kind: 'daily' };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [{ ...base, kind: 'draw', draw: true, drawCount: 10, drawResultIds: source.drawSequence.slice(0, 10), resultThought: '第五张终于来了，想好好收藏。' }, base, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  assert.equal(calls, 1); assert.equal(next.pity, 55); assert.equal(save.pity, 55);
  next = advance(next); assert.equal(next.pity, 5); assert.equal(next.collection.length, 10);
  const key = saveKey('a', 'user'); persistSave(key, next); next = readSave(key);
  assert.equal(next.pity, 5); assert.equal(readSave(saveKey('b', 'user')).pity, 0);
  next = advance(advance(advance(next))); assert.equal(next.pity, 5); assert.equal(calls, 1);
  const editor = renderToStaticMarkup(createElement(NurtureModuleEditor, { module: 'draw', save: next, userName: '我', onSave: () => {} }));
  assert.ok(editor.includes('计入 60 抽保底稀有')); assert.ok(editor.includes('60 抽保底'));
});
test('bulk common cards are R text drafts, validate uniqueness and preserve the rare-card weight share', async () => {
  const existing = newSave().cards, design = defaultDesign('小月');
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.task, 'common-cards'); assert.equal(source.count, 3); assert.equal(source.hero.name, '小月');
    return Response.json({ choices: [{ message: { content: JSON.stringify({ cards: Array.from({ length: 3 }, (_, i) => ({ name: `日常${i}`, description: '阳光洒在书页上。', artText: '今天也有小小的快乐。', rarity: 'SSR', weight: 9999, image: 'AI不可指定' })) }) } }] });
  });
  const drafts = await generateCommonCards(design, existing, 3, '日常阅读', new AbortController().signal);
  assert.ok(drafts.every(c => c.rarity === 'R' && c.artType === 'text' && c.image === ''));
  assert.equal(existing.length, 3);
  const merged = mergeCommonCards(existing, drafts);
  assert.equal(merged.length, 6); assert.equal(merged.find(c => c.rarity === 'SSR')?.weight, 3);
  assert.equal(merged.filter(c => c.rarity === 'R').reduce((n, c) => n + c.weight, 0), 75);
  assert.equal(merged.reduce((n, c) => n + c.weight, 0), 100);
  assert.equal(existing[0].weight, 75);
  await assert.rejects(generateCommonCards(design, merged, 3, '', new AbortController().signal), /重复卡名/);
});
test('single and ten pulls settle exact costs once, preserve all cards across resume and react to actual results', async () => {
  const save = newSave(); save.wallet!.gems = 2000;
  const original = JSON.stringify(save); let sample = 0, apiCalls = 0;
  mock.method(Math, 'random', () => sample++ % 2 ? .999 : 0);
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    apiCalls++;
    assert.equal(source.drawSequence.length, 80);
    assert.equal(source.pool.find((c: { id: string }) => c.id === source.drawSequence[1]).rarity, 'SSR');
    const outcome = (start: number, count: number) => ({ drawResultIds: source.drawSequence.slice(start, start + count), resultThought: `真的抽到了${source.drawSequence.slice(start, start + count).map((id: string) => source.pool.find((c: { id: string }) => c.id === id).name).join('、')}，想再看一会儿。` });
    const base = { action: '看看今天的星愿', thought: '会抽到什么呢', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false, kind: 'daily' };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [{ ...base, kind: 'draw', draw: true, drawCount: 10, ...outcome(0, 10) }, { ...base, kind: 'draw', draw: true, drawCount: 1, ...outcome(10, 1) }, base, base] }) } }] });
  });
  let next = await generateRound(save, 'a', new AbortController().signal);
  assert.equal(apiCalls, 1); assert.equal(sample, 80); assert.equal(JSON.stringify(save), original);
  assert.equal(next.collection.length, 0); assert.equal(cardsForDraw(next.rounds[0].steps[0]).length, 10);
  assert.ok(playbackDuration(next.rounds[0].steps[0]) >= 14000); assert.ok(playbackDuration(next.rounds[0].steps[1]) >= 11000);
  next = advance(next); assert.equal(next.collection.length, 10); assert.equal(next.wallet?.gems, 1000);
  const key = saveKey('a', 'user'); persistSave(key, next); next = readSave(key);
  next = advance(next); assert.equal(next.collection.length, 11); assert.equal(next.wallet?.gems, 900);
  next = advance(advance(next)); assert.equal(next.memory?.events.filter(e => e.kind === 'rare-card').length, 5);
  assert.ok(memoryContext(next).playerThoughts.includes('真的抽到了'));
  assert.deepEqual(advance(next), next);
  assert.equal(apiCalls, 1); // No network calls during playback, resume or archiving.
});
test('unaffordable pulls and incomplete single-response thoughts never spend or trigger a second API call', async () => {
  const save = newSave(), original = JSON.stringify(save); let count: unknown = 10, apiCalls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    apiCalls++;
    const base = { action: '抽卡', thought: '先试试', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false, kind: 'daily' };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [{ ...base, kind: 'draw', draw: true, drawCount: count }, base, base, base] }) } }] });
  });
  const next = await generateRound(save, 'a', new AbortController().signal);
  assert.equal(next.rounds[0].steps[0].draw, false); assert.equal(next.rounds[0].steps[0].wallet?.gems, 300); assert.equal(apiCalls, 1);
  count = 1; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /揭晓后心声不完整/);
  assert.equal(apiCalls, 2);
  count = 2; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /只能是单抽或十连/);
  assert.equal(JSON.stringify(save), original);
  assert.equal(apiCalls, 3);
});
test('ten-pull animation starts with card backs and never reveals outcomes in advance', () => {
  const card = { ...newSave().cards[2], name: '动画结束才揭晓的卡名' };
  const step = { action: '十连', thought: '攒了很久，试一次吧', resultThought: '终于抽到了', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: true, drawnCards: Array.from({ length: 10 }, () => card), drawCount: 10 as const };
  const html = renderToStaticMarkup(createElement(NurtureGacha, { step, actorName: '林渡' }));
  assert.equal((html.match(/nurture-flip-inner/g) ?? []).length, 10);
  assert.ok(html.includes('十连抽卡动画')); assert.ok(html.includes(step.thought));
  assert.ok(!html.includes(card.name)); assert.ok(!html.includes(step.resultThought));
});
test('edited game introduction and catalogs reach AI and drive actual activity, purchase and draw settlement', async () => {
  const s = newSave(), design = defaultDesign('游戏名字');
  design.description = '一个在月亮书店经营日常的养成游戏'; design.hero = { name: '月', nickname: '小月', setting: '书店里的魔法学徒' };
  design.schedules = [{ id: 'new-reading', name: '月光阅读', description: '读一页魔法书', price: 3, delta: { mood: 1, energy: -2, affection: 2, growth: 12 } }];
  design.dates = [{ id: 'new-date', name: '屋顶赏月', description: '安静看月亮', price: 7, delta: { mood: 4, energy: -1, affection: 9, growth: 0 } }];
  design.shop = [{ id: 'new-gift', name: '羽毛笔', description: '写下日常', type: '道具', currency: 'coins', price: 10 }]; design.drawCost = 1; design.rechargeGems = 5;
  const plan = currentPlan(s); plan.stats.energy = 90; plan.cards = [s.cards[2]];
  const configured = configureGame(s, plan, design);
  assert.equal(s.design, undefined); assert.equal(s.pending, undefined);
  persistSave(saveKey('a', 'user'), configured);
  assert.deepEqual(readSave(saveKey('a', 'user')).design, design);
  assert.equal(readSave(saveKey('b', 'user')).design, undefined);
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(source.game.description, design.description); assert.deepEqual(source.raised, design.hero); assert.equal(source.stats.energy, 90);
    assert.deepEqual(source.schedules, design.schedules); assert.deepEqual(source.dates, design.dates); assert.deepEqual(source.shop, design.shop);
    assert.equal(source.game.drawCost, 1); assert.equal(source.game.rechargeGems, 5); assert.ok(!source.schedules.some((a: { id: string }) => a.id === 'reading'));
    const base = { action: '安排游戏', thought: '记住书店里的这一刻', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false };
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [
      { ...base, kind: 'schedule', itemId: 'new-reading' }, { ...base, kind: 'date', itemId: 'new-date' },
      { ...base, kind: 'shop', itemId: 'new-gift' }, { ...base, kind: 'draw', draw: true, resultThought: 'Actual result reaction', drawResultIds: source.drawSequence.slice(0, 1) }, { ...base, kind: 'recharge' },
    ] }) } }] });
  });
  let next = await generateRound(configured, 'a', new AbortController().signal);
  assert.equal(next.stats.energy, 90); assert.equal(next.wallet?.coins, 1000);
  while (next.rounds[0].cursor < next.rounds[0].steps.length) next = advance(next);
  assert.equal(next.stats.growth, 22); assert.equal(next.stats.energy, 87); assert.equal(next.stats.affection, 31);
  assert.equal(next.wallet?.coins, 980); assert.equal(next.wallet?.gems, 304); assert.equal(next.wallet?.recharged, 5);
  assert.deepEqual(next.inventory, ['new-gift']); assert.equal(next.collection[0].rarity, 'SSR');
});
test('deleted activities cannot be invented, settings validate, and configuration is locked during unfinished playback', async () => {
  const s = newSave(), design = defaultDesign('我'); design.schedules = []; s.design = design;
  mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: JSON.stringify({ steps: Array.from({ length: 4 }, () => ({ kind: 'schedule', itemId: 'reading', action: '旧日程', thought: '不应成功', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false })) }) } }] }));
  await assert.rejects(generateRound(s, 'a', new AbortController().signal), /活动不存在/);
  assert.equal(s.rounds.length, 0);
  const invalid = defaultDesign(); invalid.schedules[0].delta.growth = 99;
  assert.throws(() => validateDesign(invalid));
  assert.throws(() => validateDesign({ ...design, hero: { ...design.hero, name: ' ' } }));
  const locked = { ...s, rounds: [{ id: 'busy', createdAt: new Date().toISOString(), cursor: 0, steps: [{ action: '陪伴', thought: '今天', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false }], before: s.stats, after: s.stats }] };
  assert.throws(() => configureGame(locked, currentPlan(locked), design), /播放完成/);
  const original = defaultDesign(); original.schedules[0].delta.growth = 0;
  assert.equal(defaultDesign().schedules[0].delta.growth, 10);
});
test('settings fold game information and leave modules in their own editing panels; playback shows effects without edit controls', () => {
  const save = newSave();
  const settings = renderToStaticMarkup(createElement(NurtureSettings, { save, userName: '小月', onSave: () => {}, onClose: () => {} }));
  assert.equal((settings.match(/<details/g) ?? []).length, 4);
  for (const label of ['游戏描述', '游戏里的我', '人物设定与介绍', '立绘、部位定位与触碰发言']) assert.ok(settings.includes(label));
  assert.ok(!settings.includes('概率权重'));
  const expected: Record<string, string> = { draw: '概率权重', stats: '当前数值', schedule: '新增日程', date: '新增约会', shop: '新增商品', event: '结束时间' };
  for (const [module, label] of Object.entries(expected)) {
    const editor = renderToStaticMarkup(createElement(NurtureModuleEditor, { module, save, userName: '小月', onSave: () => {} }));
    assert.ok(editor.includes(label), module); assert.ok(editor.includes('<form'));
  }
  const effect = renderToStaticMarkup(createElement(NurtureStage, { save, userName: '小月', actorName: '林渡', busy: false, playing: true, onSettings: () => {}, step: { kind: 'schedule', itemId: 'reading', action: '翻开书', thought: '把这一章读给你听', speech: '', receipt: '午后阅读', delta: save.stats, draw: false } }));
  assert.ok(effect.includes('把这一章读给你听')); assert.ok(!effect.includes('<form')); assert.ok(!effect.includes('<input')); assert.ok(!effect.includes('新增日程'));
  const buttons = effect.match(/<button[^>]*>/g) ?? [];
  assert.ok(buttons.length >= 7); assert.ok(buttons.every(b => b.includes('disabled')));
});
test('continuity carries actual previous stats, feelings, open threads and special memories into the next request', async () => {
  let count = 0, threadId = '';
  const base = { action: '翻开书', thought: '下次想继续读完这一章', speech: '', delta: { mood: 2, energy: -1, affection: 1, growth: 2 }, draw: false, kind: 'daily' };
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)), source = JSON.parse(body.messages[1].content);
    assert.ok(body.messages[0].content.includes('memory:'));
    if (count++ === 0) { assert.equal(source.continuity.stage.id, 'first'); assert.equal(source.continuity.previousRound, null); }
    else {
      assert.equal(source.continuity.completedRounds, 1);
      assert.equal(source.continuity.stage.id, 'explore');
      assert.equal(source.continuity.previousRound.after.energy, 76);
      assert.ok(source.continuity.previousRound.summary.includes('翻开书'));
      assert.equal(source.continuity.playerMood, '安静又期待');
      assert.equal(source.continuity.playerThoughts, '希望下次还能接着读。');
      assert.equal(source.continuity.unfinished[0].text, '下次读完这一章');
      threadId = source.continuity.unfinished[0].id;
      assert.ok(source.continuity.recentSpecialEvents.some((e: { title: string }) => e.title === '开始期待下次登录'));
      assert.ok(!String(init?.body).includes('OTHER_ACTOR_SECRET'));
    }
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: Array.from({ length: 4 }, () => base), memory: {
      mood: '安静又期待', thoughts: '希望下次还能接着读。',
      threads: count === 1 ? [{ id: '', text: '下次读完这一章', status: 'open' }] : [{ id: threadId, text: '读完了这一章', status: 'done', stepIndexes: [0] }],
      specialEvents: [{ title: '开始期待下次登录', detail: '发现自己开始期待下一次读书。', stepIndexes: [3] }],
    } }) } }] });
  });
  const finish = (s: Save) => { while (s.rounds[0].cursor < s.rounds[0].steps.length) s = advance(s); return s; };
  let s = await generateRound(newSave(), 'a', new AbortController().signal);
  assert.equal(memoryFor(s).completedRounds, 0); assert.equal(memoryFor(s).events.length, 0);
  s = advance(s); const key = saveKey('a', 'user'); persistSave(key, s);
  assert.equal(memoryFor(readSave(key)).events.length, 0);
  s = finish(readSave(key));
  assert.equal(s.memory?.completedRounds, 1); assert.equal(s.memory?.threads.length, 1);
  const again = advance(s); assert.deepEqual(again, s);
  const other = readSave(saveKey('b', 'user')); assert.equal(memoryFor(other).events.length, 0);
  s = await generateRound(s, 'a', new AbortController().signal);
  assert.equal(s.rounds[0].number, 2); assert.equal(s.memory?.threads[0].status, 'open');
  s = finish(s); assert.equal(s.memory?.threads[0].status, 'done'); assert.equal(s.memory?.completedRounds, 2);
  assert.equal(s.memory?.events.filter(e => e.kind === 'first-login').length, 1);
  persistSave(key, s); assert.deepEqual(readSave(key).memory, s.memory);
});
test('relationship guidance needs time and closeness, and special memories survive trimmed detailed logs', () => {
  const stats = newSave().stats;
  assert.equal(relationshipStage(0, { ...stats, affection: 100 }).id, 'first');
  assert.equal(relationshipStage(3, { ...stats, affection: 100 }).id, 'explore');
  assert.equal(relationshipStage(20, { ...stats, affection: 20 }).id, 'familiar');
  assert.equal(relationshipStage(12, { ...stats, affection: 60 }).id, 'attached');
  const step = { action: '陪伴', thought: '想念', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false };
  let memory = emptyMemory();
  for (let i = 0; i < 105; i++) memory = archiveRound(memory, { id: `r${i}`, createdAt: '2026-11-18T00:00:00Z', steps: [step], cursor: 1, before: stats, after: stats });
  const save = { ...newSave(), memory, rounds: [] };
  assert.equal(memoryContext(save).completedRounds, 105);
  assert.ok(memoryContext(save).milestones.some(e => e.round === 1));
  assert.equal(memory.events.filter(e => e.kind === 'first-login').length, 1);
});
test('legacy saves infer continuity and pending threads cannot disappear or be falsely completed', () => {
  const stats = newSave().stats;
  const steps = [{ action: '买衣服', thought: '还要再攒一点', speech: '', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false, receipt: '余额不足，本次未购买' }];
  const round = { id: 'old', createdAt: '2026-11-18T00:00:00Z', steps, cursor: 1, before: stats, after: stats };
  const old = { ...newSave(), rounds: [round] };
  assert.equal(memoryFor(old).completedRounds, 1); assert.equal(memoryContext(old).previousRound?.thoughts, '还要再攒一点');
  const memory = { ...emptyMemory(), threads: [{ id: 'todo', text: '给你买裙子', status: 'open' as const, startedRound: 1, updatedRound: 1 }] };
  const recap = makeRecap({ mood: '有点遗憾', thoughts: '以后再试试', threads: [{ id: 'todo', text: '买裙子', status: 'done', stepIndexes: [0] }], specialEvents: [] }, steps, memory);
  assert.equal(recap.threads[0].status, 'open');
  const continued = archiveRound(memory, { ...round, recap });
  assert.equal(continued.threads[0].status, 'open');
  const unchanged = archiveRound(memory, { ...round, recap: makeRecap(undefined, steps, memory) });
  assert.equal(unchanged.threads[0].text, '给你买裙子');
  assert.throws(() => makeRecap({ mood: '', thoughts: '', threads: [{ id: 'invented', text: '凭空约定', status: 'done' }], specialEvents: [] }, steps, memory));
  assert.throws(() => makeRecap({ mood: '', thoughts: '', threads: [], specialEvents: [{ title: '未来', detail: '没有发生', stepIndexes: [7] }] }, steps, memory));
});
test('all thirteen parts require a user-authored reply once positioned', () => {
  assert.equal(BODY_PARTS.length, 13);
  const portrait = emptyPortrait();
  for (const part of BODY_PARTS) {
    portrait.points[part] = { x: .5, y: .5 };
    assert.throws(() => validateTouchReplies(portrait), new RegExp(part));
    portrait.replies[part] = `触碰${part}的原文`;
  }
  assert.doesNotThrow(() => validateTouchReplies(portrait));
  assert.equal(touchTargets(portrait).length, 13);
  delete portrait.points.臀部;
  portrait.replies.大腿 = '  ';
  assert.ok(!touchTargets(portrait).some(t => t.target === '臀部' || t.target === '大腿'));
});
test('random touches select at most three distinct configured positions and preserve their exact replies', () => {
  const portrait = emptyPortrait();
  for (const part of BODY_PARTS) { portrait.points[part] = { x: .5, y: .5 }; portrait.replies[part] = `触碰${part}的原文`; }
  const first = selectRoundTouches(portrait, () => 0), next = selectRoundTouches(portrait, () => .99);
  assert.equal(first.length, 3); assert.equal(new Set(first.map(t => t.target)).size, 3);
  assert.notDeepEqual(first, next);
  for (const t of first) assert.equal(t.reply, portrait.replies[t.target]);
  assert.equal(touchTargets(portrait).length, 13); // Selection does not mutate settings.
  const two = { ...emptyPortrait(), points: { 头: { x: .5, y: .5 }, 脸: { x: .5, y: .5 } }, replies: { 头: '头的原文', 脸: '脸的原文', 手: '未定位不可选' } };
  assert.equal(selectRoundTouches(two).length, 2);
  assert.deepEqual(selectRoundTouches(emptyPortrait()), []);
});
test('round generation enforces the three sampled positions and independent thoughts for each reply', async () => {
  const save = newSave(); save.portrait = emptyPortrait();
  for (const part of BODY_PARTS) { save.portrait.points[part] = { x: .5, y: .5 }; save.portrait.replies[part] = `这是${part}对应的发言`; }
  let mode = 'valid';
  const base = { action: '陪伴', thought: '安排今天的日常', speech: '', delta: { mood: 0, energy: 0, affection: 1, growth: 0 }, draw: false, kind: 'daily' };
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)), source = JSON.parse(body.messages[1].content);
    assert.equal(source.touchTargets.length, 3);
    assert.ok(body.messages[0].content.includes('读到该部位reply原文之后'));
    const touches = source.touchTargets.map((t: { target: string; reply: string }) => ({ ...base, kind: 'touch', target: t.target, thought: `碰到${t.target}，读到「${t.reply}」，我想把这个瞬间记下来。` }));
    if (mode === 'repeat') touches[1].target = touches[0].target;
    if (mode === 'missing') touches.pop();
    if (mode === 'same-thought') touches[1].thought = touches[0].thought;
    if (mode === 'outside') touches[0].target = BODY_PARTS.find(part => !source.touchTargets.some((t: { target: string }) => t.target === part));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: [...touches, base, ...(mode === 'missing' ? [base] : [])] }) } }] });
  });
  const result = await generateRound(save, 'a', new AbortController().signal);
  const touches = result.rounds[0].steps.filter(s => s.kind === 'touch');
  assert.equal(touches.length, 3);
  for (const step of touches) { assert.equal(step.speech, save.portrait.replies[step.target!]); assert.ok(step.thought.includes(step.speech)); assert.ok(step.thought.includes(step.target!)); }
  mode = 'repeat'; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /次数或位置不符/);
  mode = 'missing'; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /次数或位置不符/);
  mode = 'same-thought'; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /重复独白/);
  mode = 'outside'; await assert.rejects(generateRound(save, 'a', new AbortController().signal), /未随机选中/);
  assert.equal(save.rounds.length, 0);
});
test('unpositioned and reply-less targets never reach AI; undeclared touches are rejected and AI speech discarded', async () => {
  const s = newSave();
  s.portrait = { image: 'local', points: { 肩: { x: .3, y: .3 } }, replies: { 臀部: 'UNPOSITIONED_REPLY_SECRET', 肩: '   ' } };
  const base = { action: '查看日程', thought: '安排一下今天', speech: 'AI_USER_SPEECH', delta: { mood: 0, energy: 0, affection: 0, growth: 0 }, draw: false, kind: 'daily' };
  let target = '臀部';
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const source = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.deepEqual(source.touchTargets, []);
    assert.ok(!String(init?.body).includes('UNPOSITIONED_REPLY_SECRET'));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ steps: Array.from({ length: 4 }, (_, i) => target && i === 0 ? { ...base, kind: 'touch', target } : base) }) } }] });
  });
  await assert.rejects(generateRound(s, 'a', new AbortController().signal), /未填写触碰发言/);
  target = '肩';
  await assert.rejects(generateRound(s, 'a', new AbortController().signal), /未填写触碰发言/);
  target = '';
  const next = await generateRound(s, 'a', new AbortController().signal);
  assert.ok(next.rounds[0].steps.every(step => step.speech === ''));
  assert.equal(s.rounds.length, 0);
});
