import { readStoredValue, writeStoredValue } from './localStorage';
import { activeMemoryArchive } from './memoryArchives';
import { SETTINGS_KEYS } from './settings';

export const ALIAS_ACCOUNTS_KEY = 'yyphone:alias-accounts';
export const ALIAS_EVENT = 'yyphone:alias-accounts';
export type AliasProfile = { id: string; owner: 'user' | 'character'; userProfileId: string; charId?: string; name: string; handle: string; avatarUrl: string; bio: string; createdAt: string };
export type AliasMessage = { id: string; from: 'user' | 'character' | 'system'; text: string; createdAt: string; identityAtTime?: 'unknown' | 'suspected' | 'revealed'; kind?: 'text' | 'image'; thought?: string; replyBatchId?: string; editedAt?: string };
export type AliasIdentityEvidence = { messageId: string; quote: string; referenceQuote: string; kind: 'shared-memory' | 'signature-phrase' };
export type AliasThread = {
  id: string; charId: string; userProfileId: string; archiveKey: string;
  userAccountId: string; characterAccountId: string; requester: 'user' | 'character';
  status: 'pending' | 'accepted' | 'rejected'; requestText: string; requestReply: string;
  identity: 'unknown' | 'suspected' | 'revealed'; blocked: boolean; unread: number;
  createdAt: string; updatedAt: string; revision: number; messages: AliasMessage[];
  identityEvidence?: AliasIdentityEvidence[];
  contactMotive?: string;
  removedByCharacterAt?: string;
  activityId?: string;
  mainMentionedActivityId?: string;
  experienceKey?: string;
  rememberedMessageIds?: string[];
  rememberedRequestStamp?: string;
};
export type AliasState = { profiles: AliasProfile[]; threads: AliasThread[]; autoEnabled: boolean; switcherHidden?: boolean; checks: Record<string, number>; lastError: string };
export const ALIAS_MEMORY_RULES = '【账号来源与记忆边界】主号、小号是独立的消息来源。涉及其他账号时，保留账号昵称、谁用哪个账号向谁说了什么，以及当时是否知道真实身份；不把小号原话改写成主号当面说过的话，不把主号的转述当作新的小号发言。未确认身份的陌生账号，其喜好、承诺和经历不能归给玩家；角色自己使用小号时的经历，也不能记成发生在角色主号里。相似语气、猜测和试探不等于身份确认；后来坦白只能记作后来得知，不改写之前的认知。资料没有说明来源或确认经过时，保留未知，不补造认出身份的经过。';
export const row = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const aliasId = () => crypto.randomUUID();
const strings = (v: Record<string, any>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
export const emptyAliasState = (): AliasState => ({ profiles: [], threads: [], autoEnabled: false, checks: {}, lastError: '' });
export function isAliasState(v: unknown): v is AliasState {
  return row(v) && typeof v.autoEnabled === 'boolean' && (v.switcherHidden === undefined || typeof v.switcherHidden === 'boolean') && typeof v.lastError === 'string' && row(v.checks) && Object.values(v.checks).every(n => typeof n === 'number' && Number.isFinite(n)) &&
    Array.isArray(v.profiles) && new Set(v.profiles.map(p => row(p) ? p.id : null)).size === v.profiles.length && v.profiles.every(p => row(p) && strings(p, ['id', 'userProfileId', 'name', 'handle', 'avatarUrl', 'bio', 'createdAt']) && ['user', 'character'].includes(p.owner) && (p.owner === 'user' || typeof p.charId === 'string')) &&
    Array.isArray(v.threads) && new Set(v.threads.map(t => row(t) ? t.id : null)).size === v.threads.length && v.threads.every(t => row(t) && strings(t, ['id', 'charId', 'userProfileId', 'archiveKey', 'userAccountId', 'characterAccountId', 'requestText', 'requestReply', 'createdAt', 'updatedAt']) && ['user', 'character'].includes(t.requester) && ['pending', 'accepted', 'rejected'].includes(t.status) && ['unknown', 'suspected', 'revealed'].includes(t.identity) && typeof t.blocked === 'boolean' && Number.isInteger(t.unread) && Number.isInteger(t.revision) && Array.isArray(t.messages) && t.messages.every(m => row(m) && strings(m, ['id', 'text', 'createdAt']) && ['user', 'character', 'system'].includes(m.from) && (m.identityAtTime === undefined || ['unknown', 'suspected', 'revealed'].includes(m.identityAtTime))) &&
      (t.identityEvidence === undefined || Array.isArray(t.identityEvidence) && t.identityEvidence.every(e => row(e) && strings(e, ['messageId', 'quote', 'referenceQuote']) && ['shared-memory', 'signature-phrase'].includes(e.kind))) &&
      ['contactMotive', 'removedByCharacterAt', 'activityId', 'mainMentionedActivityId', 'experienceKey', 'rememberedRequestStamp'].every(key => t[key] === undefined || typeof t[key] === 'string') &&
      (t.rememberedMessageIds === undefined || Array.isArray(t.rememberedMessageIds) && t.rememberedMessageIds.every(id => typeof id === 'string')) &&
      t.messages.every(m => (m.kind === undefined || ['text', 'image'].includes(m.kind)) && ['thought', 'replyBatchId', 'editedAt'].every(key => m[key] === undefined || typeof m[key] === 'string')));
}
export function readAliasState(): AliasState {
  const stored = readStoredValue<unknown>(ALIAS_ACCOUNTS_KEY, null, (_v): _v is unknown => true);
  if (stored === null) return emptyAliasState();
  if (!isAliasState(stored)) throw new Error('小号数据格式异常，未覆盖已有记录。');
  return stored;
}
export function writeAliasState(next: AliasState): void {
  if (!isAliasState(next)) throw new Error('小号数据无效，未保存。');
  writeStoredValue(ALIAS_ACCOUNTS_KEY, next);
  if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(ALIAS_EVENT));
}
export function setAliasSwitcherHidden(hidden: boolean): void {
  writeAliasState({ ...readAliasState(), switcherHidden: hidden });
}
export const aliasRows = (key: string): Record<string, any>[] => readStoredValue(key, [], (v): v is Record<string, any>[] => Array.isArray(v) && v.every(row));
export function currentAliasUser() {
  const collection = readStoredValue(SETTINGS_KEYS.personas, {}, row);
  const profile = Array.isArray(collection.profiles) ? collection.profiles.find((p: unknown) => row(p) && p.id === collection.activeProfileId) : undefined;
  return { id: typeof profile?.id === 'string' ? profile.id : 'persona-default', name: profile?.nickname?.trim() || '我', avatarUrl: typeof profile?.avatarUrl === 'string' ? profile.avatarUrl : '', bio: typeof profile?.description === 'string' ? profile.description : '' };
}
export const canReadAliasExperience = (message: { source?: string; aliasExperience?: unknown }) => message.source !== 'alias-experience' || row(message.aliasExperience) && message.aliasExperience.userProfileId === currentAliasUser().id;
export const aliasCharacter = (id: string) => aliasRows('pocketos:wechat-contacts').find(c => c.id === id);
export const visibleAliasThreads = (state = readAliasState()) => state.threads.filter(t => t.userProfileId === currentAliasUser().id && aliasCharacter(t.charId) && t.archiveKey === activeMemoryArchive(t.charId));
export function aliasPeer(thread: AliasThread, state = readAliasState()) {
  if (thread.characterAccountId !== 'main') return state.profiles.find(p => p.id === thread.characterAccountId);
  const char = aliasCharacter(thread.charId);
  return char ? { name: char.name, handle: char.wechatId || '', avatarUrl: char.avatarUrl || '', bio: char.intro || '' } : undefined;
}
export function aliasSelf(thread: AliasThread, state = readAliasState()) {
  return thread.userAccountId === 'main' ? currentAliasUser() : state.profiles.find(p => p.id === thread.userAccountId);
}
export function saveUserAlias(input: Pick<AliasProfile, 'name' | 'handle' | 'avatarUrl' | 'bio'>, id?: string): AliasProfile {
  const state = readAliasState(), user = currentAliasUser();
  const existing = id ? state.profiles.find(p => p.id === id && p.owner === 'user' && p.userProfileId === user.id) : undefined;
  if (id && !existing) throw new Error('这个小号已不存在。');
  const name = input.name.trim(), handle = input.handle.trim();
  if (!name || name.length > 30 || !/^[a-zA-Z0-9_-]{3,40}$/.test(handle)) throw new Error('请填写昵称，微信号需为3～40位字母、数字、下划线或短横线。');
  if (state.profiles.some(p => p.id !== id && p.handle.toLowerCase() === handle.toLowerCase())) throw new Error('这个微信号已经被使用。');
  const profile: AliasProfile = { ...input, name, handle, bio: input.bio.trim().slice(0, 1000), id: existing?.id || aliasId(), owner: 'user', userProfileId: user.id, createdAt: existing?.createdAt || new Date().toISOString() };
  writeAliasState({ ...state, profiles: existing ? state.profiles.map(p => p.id === id ? profile : p) : [...state.profiles, profile] });
  return profile;
}
export function deleteUserAlias(id: string) {
  const state = readAliasState();
  if (!state.profiles.some(p => p.id === id && p.owner === 'user' && p.userProfileId === currentAliasUser().id)) throw new Error('这个小号已不存在。');
  writeAliasState({ ...state, profiles: state.profiles.filter(p => p.id !== id), threads: state.threads.filter(t => t.userAccountId !== id) });
}
export function updateAliasThread(id: string, update: (thread: AliasThread) => AliasThread) {
  const state = readAliasState(), thread = state.threads.find(t => t.id === id);
  if (!thread || !visibleAliasThreads(state).some(t => t.id === id)) throw new Error('对话或聊天存档已经变化，请重新打开。');
  const next = update(thread);
  writeAliasState({ ...state, threads: state.threads.map(t => t.id === id ? { ...next, revision: thread.revision + 1 } : t) });
}
export function respondAliasRequest(id: string, accepted: boolean) {
  updateAliasThread(id, t => {
    if (t.requester !== 'character' || t.status !== 'pending') throw new Error('这条好友申请已经处理过了。');
    return { ...t, status: accepted ? 'accepted' : 'rejected', unread: 0, updatedAt: new Date().toISOString() };
  });
}
export function sendAliasMessage(id: string, text: string, kind: 'text' | 'image' = 'text') {
  const value = text.trim(); if (!value || value.length > 4000) throw new Error('消息需为1～4000字。');
  updateAliasThread(id, t => {
    if (t.status !== 'accepted' || t.blocked || t.removedByCharacterAt) throw new Error('请先通过好友验证并解除此小号对话的拉黑。');
    const now = new Date().toISOString();
    const name = currentAliasUser().name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const explicitDisclosure = kind === 'text' && t.userAccountId !== 'main' && new RegExp(`^(?:其实[，,\\s]*)?我(?:就)?是\\s*${name}(?:[\\s，,。.!！]|$)`).test(value);
    return { ...t, identity: explicitDisclosure ? 'revealed' : t.identity, updatedAt: now, unread: 0, activityId: aliasId(), messages: [...t.messages, { id: aliasId(), from: 'user', kind, text: value, createdAt: now, identityAtTime: explicitDisclosure ? 'revealed' : t.identity }] };
  });
}
export function revealUserAlias(id: string) {
  updateAliasThread(id, t => {
    if (t.userAccountId === 'main' || t.status !== 'accepted' || t.blocked || t.removedByCharacterAt || t.identity === 'revealed') throw new Error('当前无法坦白身份。');
    const now = new Date().toISOString();
    return { ...t, identity: 'revealed', activityId: aliasId(), updatedAt: now, messages: [...t.messages, { id: aliasId(), from: 'user', text: `我是${currentAliasUser().name} 这是我的小号`, createdAt: now, identityAtTime: 'revealed' }] };
  });
}
const aliasActivityStamp = (thread: AliasThread) => thread.activityId || thread.messages.at(-1)?.id || `request:${thread.updatedAt}`;
function withEditedAliasHistory(thread: AliasThread, messages: AliasMessage[]) {
  const evidence = thread.identityEvidence?.filter(e => messages.some(m => m.id === e.messageId && m.from === 'user' && m.text.includes(e.quote)));
  const activityId = aliasId();
  return { ...thread, messages, activityId, mainMentionedActivityId: thread.mainMentionedActivityId === aliasActivityStamp(thread) ? activityId : thread.mainMentionedActivityId, identityEvidence: evidence,
    identity: thread.identity === 'suspected' && !evidence?.length ? 'unknown' as const : thread.identity };
}
export function editAliasMessage(id: string, messageId: string, text: string) {
  const value = text.trim(); if (!value || value.length > 4000) throw new Error('消息需为1～4000字。');
  updateAliasThread(id, t => {
    const message = t.messages.find(m => m.id === messageId && m.from !== 'system');
    if (!message) throw new Error('这条消息已经不存在。');
    return withEditedAliasHistory(t, t.messages.map(m => m.id === messageId ? { ...m, text: value, editedAt: new Date().toISOString() } : m));
  });
}
export function deleteAliasMessage(id: string, messageId: string) {
  updateAliasThread(id, t => {
    if (!t.messages.some(m => m.id === messageId)) throw new Error('这条消息已经不存在。');
    return withEditedAliasHistory(t, t.messages.filter(m => m.id !== messageId));
  });
}
export const aliasMessageContext = (message: AliasMessage) => message.kind === 'image' ? `[图片内容：${message.text}]` : message.text;
export const aliasRoundThought = (message: AliasMessage, messages: AliasMessage[]) => message.thought?.trim() || (message.replyBatchId ? messages.find(m => m.from === 'character' && m.replyBatchId === message.replyBatchId && m.thought?.trim())?.thought : '') || '';

/** A fresh contact is a possible topic for the next main-account reply, never evidence of ownership. */
export function pendingAliasFollowup(charId: string, visibleExperienceKeys?: Set<string>) {
  const state = readAliasState();
  const threads = visibleAliasThreads(state).filter(t => t.charId === charId && (t.status === 'accepted' || t.requester === 'user' && t.status === 'rejected') &&
    (!visibleExperienceKeys || visibleExperienceKeys.has(t.experienceKey || t.id)) &&
    (t.activityId || t.messages.at(-1)?.id || t.requestReply) && aliasActivityStamp(t) !== t.mainMentionedActivityId)
    .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 1);
  const items = threads.map(t => ({ threadId: t.id, activityId: aliasActivityStamp(t) }));
  return { charId, userProfileId: currentAliasUser().id, archiveKey: activeMemoryArchive(charId), items, text: !threads.length ? '' : [
    '【刚发生的账号来往 · 主号可以主动聊起】你刚与下面的账号实际接触过。接下来这轮主号回复，请优先找一个自然的空隙顺嘴提一句，分享你的感受或问问玩家的看法；不必等玩家问到小号，也不必长篇汇报。结合对方真说过的话和你的人设，语气可以是好奇、觉得好笑、困惑或随口一说，不统一写成“奇怪的人”。若玩家正在求助、处理急事或说沉重的话，先回应眼前的人，暂缓提及。',
    '先辨别下面是谁的小号。陌生账号未明确公开身份时，只当作另一个陌生人，不能说“刚才你的小号”或利用这件事套出身份。若是你自己使用的小号，你知道与玩家的来往，但玩家不自动知道你的身份：让这些经历影响你的关心、情绪与话题，必要时自然提一个由头，不假装是某个陌生人向你转述、不强迫坦白，也不直接说“你刚才对我小号说了”。只引用实际存在的内容，不编造后续。已提过的同一批来往不机械重提。',
    ...threads.map(t => `${t.characterAccountId === 'main' && t.identity !== 'revealed' ? '真实身份未确认。' : ''}${t.removedByCharacterAt ? '你已将此账号移出通讯录。' : ''}${buildAliasThreadContext(t, state, t.messages.filter(m => m.from !== 'system').slice(-6))}`),
    `只有本轮 reply 确实提及或自然承接了对应账号来往，才返回顶层 aliasFollowupIds 数组标记已承接。若是你自己的小号，可以通过与真实经历有关的话题、关心或感受自然延续，不必点出账号或坦白。仅仅看到了背景、说了一句无关的问候不算承接，未承接则省略。可用记录ID：${items.map(item => item.threadId).join('、')}。ID仅用于动作字段，不写进台词。`,
  ].join('\n') };
}
export function acknowledgeAliasFollowup(snapshot: ReturnType<typeof pendingAliasFollowup>, ids: unknown) {
  if (!Array.isArray(ids) || !ids.length || snapshot.userProfileId !== currentAliasUser().id || snapshot.archiveKey !== activeMemoryArchive(snapshot.charId)) return;
  const state = readAliasState();
  writeAliasState({ ...state, threads: state.threads.map(t => {
    const item = snapshot.items.find(item => item.threadId === t.id && ids.includes(t.id));
    return item && t.charId === snapshot.charId && t.userProfileId === snapshot.userProfileId && t.archiveKey === snapshot.archiveKey
      ? { ...t, mainMentionedActivityId: item.activityId } : t;
  }) });
}
/** Knowledge projection only: never serialize account owners or internal character IDs into this text. */
export const aliasRequestStamp = (t: AliasThread) => JSON.stringify([t.status, t.requestText, t.requestReply, t.identity, t.removedByCharacterAt || '']);
export function buildAliasThreadContext(t: AliasThread, state: AliasState, messages: AliasMessage[], includeRequest = true): string {
    const self = aliasSelf(t, state), peer = aliasPeer(t, state), char = aliasCharacter(t.charId);
    const context = t.characterAccountId !== 'main'
      ? `${char?.name}自己使用账号「${peer?.name}」与主号相识者联系。来源：角色小号「${peer?.name}」↔ 玩家主号「${currentAliasUser().name}」。${t.contactMotive ? `你当初的私下动机：${t.contactMotive}。对方不自动知道这个动机。` : ''}${t.identity === 'revealed' ? '目前已向对方公开自己的身份，不能因此认定对方从一开始就知道。' : '对方尚未得到你的身份确认，不假定对方知道你是谁；主号发言也不要直接接续小号的语境或假定对方认出了你。'}`
      : `${char?.name}与账号「${self?.name}」有过接触。来源：角色主号「${char?.name}」↔ ${t.identity === 'revealed' ? '已公开身份的账号' : '陌生账号'}「${self?.name}」。${t.identity === 'revealed' ? `对方已明确坦白自己是${currentAliasUser().name}的小号；此前的发言仍属于这个账号，当时不一定已知身份。` : t.identity === 'suspected' && t.identityEvidence?.length ? '存在实际线索，最多谨慎怀疑，没有确证。' : '对方身份尚未确认，只能记作这个陌生账号；没有明确线索时不猜测主号身份。'}`;
    const characterLabel = t.characterAccountId === 'main' ? `角色主号「${char?.name}」` : `角色小号「${peer?.name}」`;
    const userLabel = t.userAccountId === 'main' ? `玩家主号「${currentAliasUser().name}」` : `账号「${self?.name}」`;
    return `${context}\n${includeRequest ? `好友验证：${t.status === 'accepted' ? '已通过' : '未通过'}。${t.removedByCharacterAt ? '后来角色已删除了这个联系人，对话历史仍属于这个账号。' : ''}申请附言来自${t.requester === 'character' ? characterLabel : userLabel}：「${t.requestText}」。${t.requestReply ? `角色的验证回复：「${t.requestReply}」。` : ''}` : ''}\n${messages.map(m => `[${m.createdAt}] [${m.identityAtTime === 'revealed' ? '此时身份已公开' : m.identityAtTime === 'suspected' ? '当时仅怀疑身份' : m.identityAtTime === 'unknown' ? '当时身份未确认' : '当时身份状态未记录'}] ${m.from === 'character' ? characterLabel : userLabel}：${aliasMessageContext(m)}`).join('\n')}`;
}
export function buildAliasMemoryContext(charIds: string[], pendingOnly = false): string {
  const state = readAliasState();
  const threads = visibleAliasThreads(state).filter(t => charIds.includes(t.charId) && (t.status === 'accepted' || t.requester === 'user' && t.status === 'rejected') && (t.messages.length || t.requestReply || t.requestText))
    .filter(t => !pendingOnly || t.rememberedRequestStamp !== aliasRequestStamp(t) || t.messages.some(m => !t.rememberedMessageIds?.includes(m.id)))
    .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  if (!threads.length) return '';
  return '【你亲历的其他账号对话】以下不是主号当前对话，也不代表眼前的人说过这些话。未公开身份的陌生账号不能归到主号玩家身上，不把怀疑当成确认。\n' + ALIAS_MEMORY_RULES + '\n' + threads.map(t => buildAliasThreadContext(t, state,
    t.messages.filter(m => m.from !== 'system' && (!pendingOnly || !t.rememberedMessageIds?.includes(m.id))).slice(-10).map(m => ({ ...m, text: m.text.slice(0, 500) })), !pendingOnly || t.rememberedRequestStamp !== aliasRequestStamp(t))).join('\n\n');
}

export function aliasStateWithoutCharacter(state: AliasState, charId: string): AliasState {
  return { ...state, profiles: state.profiles.filter(p => p.charId !== charId), threads: state.threads.filter(t => t.charId !== charId), checks: Object.fromEntries(Object.entries(state.checks).filter(([key]) => { try { return JSON.parse(key)[0] !== charId; } catch { return false; } })) };
}
