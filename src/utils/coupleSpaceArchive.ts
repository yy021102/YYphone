import type { CharacterCoupleSpace, DiaryAnnotation } from '../apps/CoupleSpaceApp';
import { createEmptyCoupleSpace, COUPLE_SPACES_STORAGE_KEY, readCoupleSpaces } from './coupleSpaceData';
import { COUPLE_PRODUCTS, COUPLE_REWARDS_KEY, COUPLE_REWARDS_EVENT, coupleBalance, couponStock, readCoupleWallets, settleCouplePoints, withCoupleDataWrite, type CoupleWallet, type CouponUse } from './coupleRewards';
import { initializeDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString } from './localStorage';
import { CHARACTER_CONTEXT_STORAGE_KEY, type CharacterContextEvent } from './characterContext';
import { activeMemoryArchive, guardMemoryArchive } from './memoryArchives';

const CHATS = 'yyphone:wechat-chats', CONTACTS = 'pocketos:wechat-contacts';
type Row = Record<string, any>;
const row = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const strings = (v: Row, keys: string[]) => keys.every(key => text(v[key]));
const optional = (v: Row, keys: string[], validator: (v: unknown) => boolean = text) => keys.every(key => v[key] === undefined || validator(v[key]));
const date = (v: unknown): v is string => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const instant = (v: unknown): v is string => text(v) && !Number.isNaN(Date.parse(v));
const unique = (list: Row[], key = 'id') => new Set(list.map(item => item[key])).size === list.length;
const clean = <T,>(value: T): T => structuredClone(value);
const image = (v: unknown): v is string => text(v) && (!v || /^(https?:\/\/|data:image\/)/i.test(v));
const emptyWallet = (): CoupleWallet => ({ awards: [], purchases: [], uses: [] });

export interface CoupleSpaceBackup {
  type: 'yyphone.couple-space'; version: 1; exportedAt: string;
  character: { id: string; name: string }; space: CharacterCoupleSpace; wallet: CoupleWallet;
}
export interface ParsedCoupleSpaceBackup { sourceCharId: string; sourceName: string; space: CharacterCoupleSpace; wallet?: CoupleWallet }

function parseSpace(v: unknown, charId: string): CharacterCoupleSpace {
  if (!row(v) || !['bound', 'unbound', 'pending_char', 'pending_user'].includes(v.bindStatus) || !date(v.startDate) || !image(v.headerBgUrl) || !optional(v, ['pageBgUrl', 'calendarBgUrl'], image) || !optional(v, ['inviteMessage']) || !row(v.moods) ||
    !Object.entries(v.moods).every(([day, m]) => date(day) && row(m) && m.dateStr === day && optional(m, ['userMoodId', 'userNote', 'charMoodId', 'charNote']) && optional(m, ['seenByChar'], n => typeof n === 'boolean'))) throw new Error('情侣空间资料或心情数据格式有误。');
  const list = (key: string, check: (r: Row) => boolean) => Array.isArray(v[key]) && v[key].every((item: unknown) => row(item) && text(item.id) && !!item.id && check(item)) && unique(v[key]);
  if (!list('anniversaries', r => strings(r, ['title']) && date(r.targetDate) && ['countdown', 'elapsed'].includes(r.type)) ||
    !list('diaries', r => strings(r, ['authorName', 'title', 'content']) && ['user', 'char'].includes(r.author) && date(r.dateStr) && optional(r, ['replyComment']) && optional(r, ['seenByChar'], n => typeof n === 'boolean') &&
      (r.annotations === undefined || Array.isArray(r.annotations) && r.annotations.every((a: unknown) => row(a) && strings(a, ['id', 'authorName', 'content', 'createdAt']) && ['user', 'char'].includes(a.author)) && unique(r.annotations))) ||
    !list('qaList', r => strings(r, ['question']) && date(r.dateStr) && ['user', 'char', 'system'].includes(r.askedBy) && optional(r, ['userAnswer', 'charAnswer']) && optional(r, ['seenByChar'], n => typeof n === 'boolean')) ||
    !list('stickyNotes', r => strings(r, ['authorName', 'content', 'colorBg', 'createdAt']) && ['user', 'char'].includes(r.author) && optional(r, ['seenByChar'], n => typeof n === 'boolean'))) throw new Error('纪念日、日记、问答或便签数据格式有误。');
  // Whitelist app data; a backup cannot smuggle other storage keys or identifiers into the space.
  return clean({ charId, bindStatus: v.bindStatus, startDate: v.startDate, headerBgUrl: v.headerBgUrl,
    ...(v.pageBgUrl !== undefined ? { pageBgUrl: v.pageBgUrl } : {}), ...(v.calendarBgUrl !== undefined ? { calendarBgUrl: v.calendarBgUrl } : {}),
    ...(v.inviteMessage !== undefined ? { inviteMessage: v.inviteMessage } : {}),
    moods: Object.fromEntries(Object.entries(v.moods).map(([day, raw]) => { const m = raw as Row; return [day, { dateStr: day, ...Object.fromEntries(['userMoodId', 'userNote', 'charMoodId', 'charNote', 'seenByChar'].filter(k => m[k] !== undefined).map(k => [k, m[k]])) }]; })),
    anniversaries: v.anniversaries.map((r: Row) => ({ id: r.id, title: r.title, targetDate: r.targetDate, type: r.type })),
    diaries: v.diaries.map((r: Row) => ({ id: r.id, author: r.author, authorName: r.authorName, dateStr: r.dateStr, title: r.title, content: r.content,
      ...Object.fromEntries(['replyComment', 'seenByChar'].filter(k => r[k] !== undefined).map(k => [k, r[k]])),
      ...(r.annotations ? { annotations: r.annotations.map((a: DiaryAnnotation) => ({ id: a.id, author: a.author, authorName: a.authorName, content: a.content, createdAt: a.createdAt })) } : {}) })),
    qaList: v.qaList.map((r: Row) => ({ id: r.id, dateStr: r.dateStr, question: r.question, askedBy: r.askedBy, ...Object.fromEntries(['userAnswer', 'charAnswer', 'seenByChar'].filter(k => r[k] !== undefined).map(k => [k, r[k]])) })),
    stickyNotes: v.stickyNotes.map((r: Row) => ({ id: r.id, author: r.author, authorName: r.authorName, content: r.content, colorBg: r.colorBg, createdAt: r.createdAt, ...(r.seenByChar !== undefined ? { seenByChar: r.seenByChar } : {}) })),
  });
}
function parseWallet(v: unknown): CoupleWallet {
  if (!row(v) || !['awards', 'purchases', 'uses'].every(k => Array.isArray(v[k]) && v[k].every(row)) || !unique(v.awards, 'key') || !unique(v.purchases) || !unique(v.uses) ||
    !v.awards.every((a: Row) => date(a.day) && ['mood', 'diary', 'qa'].includes(a.kind) && a.key === `${a.day}:${a.kind}` && instant(a.at)) ||
    !v.purchases.every((p: Row) => strings(p, ['id']) && !!p.id && ['user', 'char'].includes(p.owner) && COUPLE_PRODUCTS.some(item => item.id === p.productId) && Number.isSafeInteger(p.cost) && p.cost >= 3 && instant(p.at) && optional(p, ['reason'])) ||
    !v.uses.every((u: Row) => strings(u, ['id', 'chatId', 'archiveId', 'note']) && !!u.id && ['user', 'char'].includes(u.owner) && COUPLE_PRODUCTS.some(item => item.id === u.productId) && instant(u.at) && optional(u, ['respondedAt', 'fulfilledAt'], instant) && optional(u, ['fulfillmentMessageId']) && optional(u, ['noticeSeen'], n => typeof n === 'boolean'))) throw new Error('积分或心愿券账本格式有误。');
  const wallet = clean(v as CoupleWallet);
  for (const owner of ['user', 'char'] as const) {
    if (coupleBalance(wallet, owner) < 0 || COUPLE_PRODUCTS.some(p => couponStock(wallet, owner, p.id) < 0)) throw new Error('积分余额或心愿券库存异常，未导入。');
  }
  return wallet;
}
function stored(key: string, fallback: unknown): unknown {
  try { const raw = readStorageString(key); return raw === null ? fallback : JSON.parse(raw); }
  catch { throw new Error('当前关联数据格式异常，未改动已有记录。'); }
}
function storedObject(key: string): Row {
  const value = stored(key, {});
  if (!row(value)) throw new Error('当前空间数据异常，未覆盖已有记录。');
  return value;
}
function storedRows(key: string): Row[] {
  const value = stored(key, []);
  if (!Array.isArray(value) || !value.every(row)) throw new Error('关联记录格式异常，未改动数据。');
  return value;
}
function requireCharacter(charId: string) {
  const character = storedRows(CONTACTS).find(c => c.id === charId);
  if (!character) throw new Error('角色已不存在，未改动空间数据。');
  return character;
}
function notify() { window.dispatchEvent(new Event(COUPLE_REWARDS_EVENT)); window.dispatchEvent(new Event('yyphone:blocked-interactions')); }
const bumpChats = (chats: Row[], charId: string, revision: string) => chats.map(c => c.type === 'direct' && c.participantIds?.length === 1 && c.participantIds[0] === charId ? { ...c, coupleCouponRevision: revision } : c);

export async function exportCoupleSpace(charId: string): Promise<CoupleSpaceBackup> {
  await settleCouplePoints();
  return withCoupleDataWrite(async () => {
    const character = requireCharacter(charId), space = storedObject(COUPLE_SPACES_STORAGE_KEY)[charId] || createEmptyCoupleSpace(charId);
    return { type: 'yyphone.couple-space', version: 1, exportedAt: new Date().toISOString(), character: { id: charId, name: character.name }, space: parseSpace(space, charId), wallet: parseWallet(readCoupleWallets()[charId] || emptyWallet()) };
  });
}
export function parseCoupleSpaceBackup(contents: string, targetCharId: string): ParsedCoupleSpaceBackup {
  let raw: unknown; try { raw = JSON.parse(contents); } catch { throw new Error('文件不是有效的 JSON 备份。'); }
  if (!row(raw)) throw new Error('找不到情侣空间数据。');
  if (raw.type === 'yyphone.couple-space') {
    if (raw.version !== 1 || !row(raw.character) || !strings(raw.character, ['id', 'name']) || !row(raw.space) || raw.space.charId !== raw.character.id) throw new Error('不支持这份备份的格式或版本。');
    if (raw.character.id !== targetCharId) throw new Error(`这份备份属于「${raw.character.name}」，请先切换到对应角色再导入。`);
    return { sourceCharId: raw.character.id, sourceName: raw.character.name, space: parseSpace(raw.space, targetCharId), wallet: parseWallet(raw.wallet) };
  }
  // Earlier exports contained every character. Read only the selected character's entry.
  if (row(raw.spacesMap) && Object.hasOwn(raw.spacesMap, targetCharId)) return { sourceCharId: targetCharId, sourceName: '', space: parseSpace(raw.spacesMap[targetCharId], targetCharId) };
  throw new Error('备份中没有当前角色的情侣空间。');
}

export function importCoupleSpace(charId: string, backup: ParsedCoupleSpaceBackup) {
  const snapshot = clean(backup);
  return withCoupleDataWrite(async () => {
    await initializeDbStorage(); requireCharacter(charId);
    if (snapshot.sourceCharId !== charId) throw new Error('当前角色已变化，请重新选择备份。');
    const spaces = storedObject(COUPLE_SPACES_STORAGE_KEY), current = readCoupleSpaces()[charId] || createEmptyCoupleSpace(charId), allWallets = readCoupleWallets();
    const revision = crypto.randomUUID(), chats = storedRows(CHATS), restored = parseSpace(snapshot.space, charId);
    const space = { ...restored, bindStatus: current.bindStatus, inviteMessage: current.inviteMessage, dataRevision: revision };
    let wallet = snapshot.wallet ? parseWallet(snapshot.wallet) : allWallets[charId] || emptyWallet();
    // Chat is not rolled back by a space import: completed letters/gifts and bell notices cannot replay.
    const liveUses = allWallets[charId]?.uses || [];
    wallet = { ...wallet, uses: wallet.uses.map((use): CouponUse => {
      const live = liveUses.find(u => u.id === use.id);
      const history = chats.filter(c => c.type === 'direct' && c.participantIds?.length === 1 && c.participantIds[0] === charId).flatMap(c => [
        ...(Array.isArray(c.messages) ? c.messages : []), ...(Array.isArray(c.archives) ? c.archives.flatMap((slot: Row) => Array.isArray(slot.messages) ? slot.messages : []) : []),
      ]).filter(row);
      const fulfillment = history.find((m: Row) => m.kind === 'couple-letter' && m.couponUseId === use.id);
      const completedCard = history.find((m: Row) => m.kind === 'couple-coupon' && m.couponUseId === use.id && instant(m.couponCompletedAt));
      return { ...use, noticeSeen: true,
        ...(live?.respondedAt ? { respondedAt: live.respondedAt } : {}),
        ...(live?.fulfilledAt ? { fulfilledAt: live.fulfilledAt, fulfillmentMessageId: live.fulfillmentMessageId } : completedCard ? { fulfilledAt: completedCard.couponCompletedAt, fulfillmentMessageId: completedCard.couponFulfillmentId } : fulfillment ? { fulfilledAt: fulfillment.createdAt, fulfillmentMessageId: fulfillment.id } : {}) };
    }) };
    await setStorageItemsAtomically({ [COUPLE_SPACES_STORAGE_KEY]: { ...spaces, [charId]: space }, [COUPLE_REWARDS_KEY]: { ...allWallets, [charId]: wallet }, [CHATS]: bumpChats(chats, charId, revision) });
    notify(); return space;
  });
}
export const clearCoupleSpace = (charId: string) => withCoupleDataWrite(async () => {
  await initializeDbStorage(); requireCharacter(charId);
  const spaces = storedObject(COUPLE_SPACES_STORAGE_KEY), current = readCoupleSpaces()[charId] || createEmptyCoupleSpace(charId), wallets = readCoupleWallets(), revision = crypto.randomUUID();
  const space = { ...current, moods: {}, anniversaries: [], diaries: [], qaList: [], stickyNotes: [], dataRevision: revision };
  await setStorageItemsAtomically({ [COUPLE_SPACES_STORAGE_KEY]: { ...spaces, [charId]: space }, [COUPLE_REWARDS_KEY]: { ...wallets, [charId]: emptyWallet() }, [CHATS]: bumpChats(storedRows(CHATS), charId, revision) });
  notify(); return space;
});

export function unbindCoupleSpace(charId: string) {
  const assertArchive = guardMemoryArchive(charId), scope = activeMemoryArchive(charId);
  return withCoupleDataWrite(async () => {
    await initializeDbStorage(); assertArchive(); const character = requireCharacter(charId);
    const spaces = storedObject(COUPLE_SPACES_STORAGE_KEY), current = readCoupleSpaces()[charId];
    if (!current || current.bindStatus === 'unbound') return false;
    if (current.bindStatus !== 'bound') throw new Error('请先处理或撤回当前邀请。');
    const chats = storedRows(CHATS), revision = crypto.randomUUID(), at = new Date().toISOString(), eventId = `couple-unbind:${revision}`;
    let chat = chats.find(c => c.type === 'direct' && c.participantIds?.length === 1 && c.participantIds[0] === charId);
    if (chat && (!Array.isArray(chat.messages) || !chat.messages.every(row))) throw new Error('聊天记录异常，未解除绑定。');
    if (!chat) { chat = { id: `chat-${crypto.randomUUID()}`, type: 'direct', participantIds: [charId], noteName: '', context: '', blocked: false, pinned: false, avatars: {}, narratorEnabled: false, messages: [], updatedAt: at }; chats.unshift(chat); }
    const fact = `玩家于${at}解除了与${character.name}的情侣空间绑定，当时空间状态变为已解绑。这是空间绑定的实际变化，不等于玩家明确提出分手，也不等于微信被拉黑或删除；请依照当下关系、人设和真实情境自然回应，不预设争吵、不强迫复绑。若此后尚未重新开通，不宣称空间仍在运作；重新开通必须经过新的邀请与同意，以后来实际发生的状态变化为准。`;
    const card = { id: eventId, senderId: 'narrator', kind: 'context-note', source: 'couple-unbind', title: '情侣空间已解绑', text: fact, aiContext: fact, content: `你已解除与${character.name}的情侣空间绑定`, createdAt: at };
    const events = storedRows(CHARACTER_CONTEXT_STORAGE_KEY);
    if (!events.every(e => strings(e, ['id', 'charId', 'content', 'createdAt']))) throw new Error('角色通知记录异常，未解除绑定。');
    const notification: CharacterContextEvent = { id: eventId, charId, content: fact, createdAt: at, source: 'couple', priority: 'high' };
    assertArchive();
    await setStorageItemsAtomically({ [COUPLE_SPACES_STORAGE_KEY]: { ...spaces, [charId]: { ...current, bindStatus: 'unbound', inviteMessage: undefined, dataRevision: revision } },
      [CHATS]: chats.map(c => c.id === chat!.id ? { ...c, coupleCouponRevision: revision, updatedAt: at, messages: [...c.messages.map((m: Row) => m.kind === 'couple-invite' && m.inviteStatus === 'pending' ? { ...m, inviteStatus: 'withdrawn' } : m), card] } : c),
      [CHARACTER_CONTEXT_STORAGE_KEY]: [...events, { ...notification, archiveKey: scope }],
    });
    notify(); return true;
  });
}
