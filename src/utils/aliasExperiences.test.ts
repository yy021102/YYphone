import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { ALIAS_ACCOUNTS_KEY, aliasRoundThought, buildAliasMemoryContext, deleteAliasMessage, editAliasMessage, emptyAliasState, pendingAliasFollowup, readAliasState, sendAliasMessage, updateAliasThread, writeAliasState, type AliasThread } from './aliasAccounts';
import { newAliasMessageIds, rememberAliasMessages, syncAliasExperiences } from './aliasExperiences';
import { changeChatArchive } from './chatArchives';
import { invalidateMemoryArchive } from './memoryArchives';
import { buildPrompt } from './buildPrompt';
import { buildAliasPrompt } from './aliasAi';
import { readDirectMessages } from './journalData';
import { SETTINGS_KEYS } from './settings';
import { effectiveChatTimeZone, formatChatTimestamp, shouldShowTimestamp } from './chatTimestamp';
import { isVisibleChatMessage } from './chatHistory';

const values = new Map<string, string>(), events = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: events.dispatchEvent.bind(events), localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const read = (key: string) => JSON.parse(readStorageString(key) || 'null');
const history = () => read('yyphone:wechat-chats')[0].messages as Record<string, any>[];
const notes = () => history().filter(m => m.source === 'alias-experience');
const scope = JSON.stringify(['char', 'one']);
const at = '2026-10-28T01:00:00.000Z';
function thread(id = 'alias'): AliasThread {
  return { id, charId: 'char', userProfileId: 'player', archiveKey: scope, userAccountId: 'main', characterAccountId: 'disguise', requester: 'character', status: 'accepted', requestText: '你好 想认识一下', requestReply: '', identity: 'unknown', blocked: false, unread: 0, createdAt: at, updatedAt: at, revision: 0, contactMotive: '想知道她如何看待陌生人', messages: [] };
}
function appendMain(text = '主号这轮') {
  const chats = read('yyphone:wechat-chats'); chats[0].messages.push({ id: crypto.randomUUID(), senderId: 'user', text, createdAt: new Date().toISOString() }); writeStoredValue('yyphone:wechat-chats', chats);
}
const prompt = () => buildPrompt({ chatId: 'main', timeAwarenessEnabled: false }).map(m => m.content).join('\n');
beforeEach(async () => {
  await clearDbStorage();
  await setStorageItemsAtomically({
    [SETTINGS_KEYS.personas]: { activeProfileId: 'player', profiles: [{ id: 'player', nickname: '小雨', avatarUrl: '' }, { id: 'other', nickname: '别人', avatarUrl: '' }] },
    'pocketos:wechat-contacts': [{ id: 'char', name: '林渡', persona: '谨慎嘴硬', avatarUrl: '', worldBooks: [] }],
    'yyphone:wechat-chats': [{ id: 'main', type: 'direct', participantIds: ['char'], noteName: '', context: '', avatars: {}, blocked: false, currentChatHistoryCount: 20, activeArchiveId: 'one', updatedAt: at, messages: [{ id: 'before', senderId: 'char', text: '你今天怎么样', createdAt: at }] }],
    [ALIAS_ACCOUNTS_KEY]: { ...emptyAliasState(), profiles: [{ id: 'disguise', owner: 'character', charId: 'char', userProfileId: 'player', name: '晚风', handle: 'night', avatarUrl: '', bio: '', createdAt: at }], threads: [thread()] },
  });
  mock.method(globalThis, 'fetch', () => { throw new Error('Continuity must not call an API'); });
});
afterEach(() => mock.restoreAll());

test('alternating alias and main conversations only appends new experiences, including messages with the same timestamp', async () => {
  sendAliasMessage('alias', 'FIRST_ALIAS_ONLY');
  assert.equal(await syncAliasExperiences('main'), 1);
  const first = notes()[0]; assert.match(first.aiContext, /FIRST_ALIAS_ONLY/); assert.match(first.aiContext, /角色小号「晚风」/); assert.match(first.aiContext, /不假定对方知道你是谁/);
  appendMain('第一次回主号');
  sendAliasMessage('alias', 'SECOND_ALIAS_ONLY');
  updateAliasThread('alias', t => ({ ...t, messages: t.messages.map(m => ({ ...m, createdAt: at })) }));
  assert.equal(await syncAliasExperiences('main'), 1);
  assert.equal(notes().length, 2); assert.equal(notes()[0].id, first.id);
  assert(!notes()[1].aiContext.includes('FIRST_ALIAS_ONLY')); assert.match(notes()[1].aiContext, /SECOND_ALIAS_ONLY/);
  appendMain('第二次回主号');
  assert.equal(await syncAliasExperiences('main'), 0); assert.equal(notes().length, 2);
  assert.deepEqual(history().filter(isVisibleChatMessage).map(m => m.text), ['你今天怎么样', '第一次回主号', '第二次回主号']);
  assert.equal(history().filter(isVisibleChatMessage).at(-1)?.text, '第二次回主号');
  assert(history().findIndex(m => m.id === first.id) < history().findIndex(m => m.text === '第一次回主号'));
  assert.equal(buildAliasMemoryContext(['char'], true), '');
  assert.equal(prompt().split('FIRST_ALIAS_ONLY').length - 1, 1); assert.equal(prompt().split('SECOND_ALIAS_ONLY').length - 1, 1);
  assert.equal(read('yyphone:memory-items'), null); assert.equal(readDirectMessages('char').some(m => m.note), false);
});

test('alias thoughts remain available to inspect but never enter either account prompt or follow-up context', async () => {
  const chats = read('yyphone:wechat-chats'); chats[0].includeLatestThought = true;
  chats[0].messages[0].thought = 'MAIN_ACCOUNT_THOUGHT'; writeStoredValue('yyphone:wechat-chats', chats);
  updateAliasThread('alias', t => ({ ...t, messages: [
    { id: 'private-answer', from: 'character', text: '窗外下雨了', thought: 'ALIAS_PRIVATE_THOUGHT', createdAt: at, replyBatchId: 'batch' },
    { id: 'private-image', from: 'character', kind: 'image', text: '雨落在窗台的花盆上', thought: 'ALIAS_IMAGE_THOUGHT', createdAt: at, replyBatchId: 'batch' },
    { id: 'private-system', from: 'system', text: '对方已将此账号移出通讯录', thought: 'ALIAS_SYSTEM_THOUGHT', createdAt: at },
  ] }));
  const t = readAliasState().threads[0];
  assert.equal(aliasRoundThought(t.messages[0], t.messages), 'ALIAS_PRIVATE_THOUGHT');
  assert.equal(await syncAliasExperiences('main'), 2);
  const payloads = [prompt(), buildAliasPrompt(t), buildAliasMemoryContext(['char']), buildAliasMemoryContext(['char'], true), pendingAliasFollowup('char').text, JSON.stringify(notes())];
  for (const payload of payloads) {
    for (const secret of ['ALIAS_PRIVATE_THOUGHT', 'ALIAS_IMAGE_THOUGHT', 'ALIAS_SYSTEM_THOUGHT']) assert(!payload.includes(secret));
  }
  assert.match(prompt(), /MAIN_ACCOUNT_THOUGHT/);
  assert.match(prompt(), /窗外下雨了/); assert.match(prompt(), /雨落在窗台的花盆上/);
  const oldEntry = notes()[0];
  assert.equal(isVisibleChatMessage(oldEntry), false);
  assert.equal(isVisibleChatMessage({ source: 'phone-inspection' }), true);
  updateAliasThread('alias', t => ({ ...t, messages: t.messages.map(m => ({ ...m, thought: 'CHANGED_PRIVATE_THOUGHT' })) }));
  assert.equal(await syncAliasExperiences('main'), 0);
  assert.deepEqual(notes()[0], oldEntry); assert(!prompt().includes('CHANGED_PRIVATE_THOUGHT'));
});

test('manual multi-select does not skip unselected messages or repeat an already remembered selection', async () => {
  sendAliasMessage('alias', '选一'); sendAliasMessage('alias', '选二'); sendAliasMessage('alias', '选三');
  const ids = newAliasMessageIds(readAliasState().threads[0]);
  assert.equal(await rememberAliasMessages('alias', [ids[0], ids[2]]), 2);
  assert.deepEqual(newAliasMessageIds(readAliasState().threads[0]), [ids[1]]);
  assert.equal(await rememberAliasMessages('alias', [ids[0], ids[2]]), 0);
  assert.equal(await syncAliasExperiences('main'), 1); assert.equal(notes().length, 2);
  assert.match(notes()[1].aiContext, /选二/); assert(!notes()[1].aiContext.includes('选三'));
});

test('old experiences expire with the main history window; explicit selection can recall one without restoring the whole alias', async () => {
  sendAliasMessage('alias', 'OLD_ALIAS_SECRET'); const id = newAliasMessageIds(readAliasState().threads[0])[0];
  await syncAliasExperiences('main');
  for (let i = 0; i < 25; i++) appendMain(`主号后续${i}`);
  assert(!prompt().includes('OLD_ALIAS_SECRET'));
  assert.equal(pendingAliasFollowup('char', new Set()).text, '');
  assert.equal(await syncAliasExperiences('main'), 0); assert(!prompt().includes('OLD_ALIAS_SECRET'));
  assert.equal(await rememberAliasMessages('alias', [id]), 1); assert.match(prompt(), /OLD_ALIAS_SECRET/);
  assert.equal(await rememberAliasMessages('alias', [id]), 0);
});

test('edits and deletion update the existing historical entry without adding a new event or leaking private thoughts', async () => {
  updateAliasThread('alias', t => ({ ...t, messages: [{ id: 'answer', from: 'character', text: '原来如此', thought: 'PRIVATE_THOUGHT', createdAt: at, identityAtTime: 'unknown' }, { id: 'other', from: 'user', text: '第二句', createdAt: at }] }));
  await syncAliasExperiences('main'); const first = notes()[0];
  assert(!JSON.stringify(first).includes('PRIVATE_THOUGHT'));
  editAliasMessage('alias', 'answer', '改后的内容'); await syncAliasExperiences('main');
  assert.equal(notes().length, 1); assert.equal(notes()[0].createdAt, first.createdAt); assert.match(notes()[0].aiContext, /改后的内容/); assert(!notes()[0].aiContext.includes('原来如此'));
  deleteAliasMessage('alias', 'answer'); await syncAliasExperiences('main'); assert(!notes()[0].aiContext.includes('改后的内容')); assert.match(notes()[0].aiContext, /第二句/);
});

test('later disclosure does not rewrite an older experience into an already known identity', async () => {
  sendAliasMessage('alias', '身份未公开时的对话'); await syncAliasExperiences('main'); const first = notes()[0];
  updateAliasThread('alias', t => ({ ...t, identity: 'revealed', messages: [...t.messages, { id: 'reveal', from: 'character', text: '其实我是林渡', createdAt: new Date().toISOString(), identityAtTime: 'revealed' }] }));
  await syncAliasExperiences('main'); assert.equal(notes()[0].aiContext, first.aiContext); assert.match(notes()[1].aiContext, /目前已向对方公开/);
  editAliasMessage('alias', readAliasState().threads[0].messages[0].id, '稍微修正旧内容'); await syncAliasExperiences('main');
  assert.match(notes()[0].aiContext, /对方尚未得到你的身份确认/); assert(!notes()[0].aiContext.includes('目前已向对方公开'));
});

test('user-owned unknown aliases remain strangers and only character-owned aliases know their own disguise', async () => {
  const state = readAliasState(); writeAliasState({ ...state, profiles: [...state.profiles, { id: 'user-alias', owner: 'user', userProfileId: 'player', name: '路人甲', handle: 'passer', avatarUrl: '', bio: '', createdAt: at }], threads: [{ ...thread(), userAccountId: 'user-alias', characterAccountId: 'main', requester: 'user' }] });
  sendAliasMessage('alias', '来自路人账号的承诺'); await syncAliasExperiences('main');
  assert.match(notes()[0].aiContext, /陌生账号「路人甲」/); assert.match(notes()[0].aiContext, /身份尚未确认/);
  assert(!notes()[0].aiContext.includes('玩家主号「小雨」：来自路人账号'));
  const followup = pendingAliasFollowup('char'); assert.match(followup.text, /真实身份未确认/);
});

test('character-owned alias follow-up keeps a fresh nudge and acknowledges only the actual activity snapshot', async () => {
  sendAliasMessage('alias', '今天睡不着'); await syncAliasExperiences('main');
  const followup = pendingAliasFollowup('char', new Set(['alias'])); assert.equal(followup.items.length, 1);
  assert.match(followup.text, /不强迫坦白/); assert.match(followup.text, /你自己使用的小号/);
  const p = buildAliasPrompt(readAliasState().threads[0]); assert.match(p, /角色人设/); assert.match(p, /你清楚自己是谁/);
  assert(!p.includes('【角色亲历的账号来往'));
});

test('persona switching prevents alias events from appearing in the other persona prompt', async () => {
  sendAliasMessage('alias', 'PERSONA_ONE_SECRET'); await syncAliasExperiences('main');
  const personas = read(SETTINGS_KEYS.personas); personas.activeProfileId = 'other'; writeStoredValue(SETTINGS_KEYS.personas, personas);
  assert.equal(await syncAliasExperiences('main'), 0); assert(!prompt().includes('PERSONA_ONE_SECRET'));
  personas.activeProfileId = 'player'; writeStoredValue(SETTINGS_KEYS.personas, personas); assert.match(prompt(), /PERSONA_ONE_SECRET/);
});

test('branches retain independent synchronization receipts, and restart does not inherit alias experiences', async () => {
  sendAliasMessage('alias', 'SOURCE_ONLY'); await syncAliasExperiences('main');
  const branch = await changeChatArchive('main', { mode: 'branch', name: '分支' });
  assert.equal(await syncAliasExperiences('main'), 0); assert.equal(notes().length, 1);
  const t = readAliasState().threads.find(t => t.archiveKey === JSON.stringify(['char', branch]))!;
  assert.notEqual(t.id, 'alias'); sendAliasMessage(t.id, 'BRANCH_ONLY'); await syncAliasExperiences('main'); assert.equal(notes().length, 2);
  await changeChatArchive('main', { mode: 'switch', targetId: 'one' }); assert.equal(notes().length, 1); assert(!prompt().includes('BRANCH_ONLY'));
  assert.equal(await syncAliasExperiences('main'), 0);
  await changeChatArchive('main', { mode: 'restart' }); assert.equal(await syncAliasExperiences('main'), 0); assert.equal(notes().length, 0);
});

test('queued work rejects an archive or persona change before writing and cannot consume synchronization progress', async () => {
  sendAliasMessage('alias', '不能串档'); const task = syncAliasExperiences('main'); invalidateMemoryArchive('char');
  await assert.rejects(task, /存档/); assert.equal(notes().length, 0); assert.equal(newAliasMessageIds(readAliasState().threads[0]).length, 1);
  const next = syncAliasExperiences('main'); const personas = read(SETTINGS_KEYS.personas); personas.activeProfileId = 'other'; writeStoredValue(SETTINGS_KEYS.personas, personas);
  await assert.rejects(next, /身份/); assert.equal(notes().length, 0);
});

test('failed atomic storage leaves both history and synchronization receipts unchanged and supports retry', async () => {
  sendAliasMessage('alias', '待保存'); const before = JSON.stringify(readAliasState());
  await new Promise(resolve => setTimeout(resolve, 0));
  const storage = window.localStorage, original = storage.setItem;
  mock.method(storage, 'setItem', (key: string, value: string) => { if (key === ALIAS_ACCOUNTS_KEY) throw new Error('quota'); original(key, value); });
  await assert.rejects(syncAliasExperiences('main'), /quota/); assert.equal(notes().length, 0); assert.equal(JSON.stringify(readAliasState()), before);
  mock.restoreAll(); assert.equal(await syncAliasExperiences('main'), 1);
});

test('large legacy conversations are migrated in bounded entries without losing or duplicating messages', async () => {
  updateAliasThread('alias', t => ({ ...t, messages: Array.from({ length: 40 }, (_, i) => ({ id: `old-${i}`, from: 'user', text: `${i}:` + '话'.repeat(3000), createdAt: at })) }));
  assert.equal(await syncAliasExperiences('main'), 40); assert.equal(readAliasState().threads[0].rememberedMessageIds?.length, 40);
  assert(notes().every(n => n.aliasExperience.messageIds.length <= 2)); assert.equal(await syncAliasExperiences('main'), 0);
});

test('timestamps share the main account gap, timezone, yesterday and invalid-date behavior', () => {
  assert.equal(shouldShowTimestamp(undefined, at), true); assert.equal(shouldShowTimestamp(at, '2026-10-28T01:09:59Z'), false);
  assert.equal(shouldShowTimestamp(at, '2026-10-28T01:10:00Z'), true); assert.equal(shouldShowTimestamp(at, 'invalid'), false);
  assert.equal(shouldShowTimestamp('invalid', at), true); assert.equal(formatChatTimestamp('invalid'), 'invalid');
  const now = new Date(); assert.match(formatChatTimestamp(now.toISOString(), 'Asia/Shanghai'), /^\d{2}:\d{2}$/);
  assert.match(formatChatTimestamp(new Date(now.getTime() - 86400000).toISOString(), 'Asia/Shanghai'), /^昨天 \d{2}:\d{2}$/);
  assert.equal(effectiveChatTimeZone(), 'Asia/Shanghai'); assert.equal(effectiveChatTimeZone('local'), undefined);
});
