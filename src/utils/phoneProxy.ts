import type { PhoneWeChatMsg, PhoneWeChatThread } from '../apps/PhoneExplorerApp';
import { requestConfiguredAiText } from './aiApi';
import { readCharacterNpcs } from './characterNpcs';
import { findOrCreateDirectChat } from './coupleSpaceData';
import { initializeDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString } from './localStorage';
import { activeMemoryArchive, guardMemoryArchive } from './memoryArchives';
import { CHECK_PHONE_STORAGE_KEY } from './phoneData';

const CHATS = 'yyphone:wechat-chats';
export const PHONE_PROXY_SOURCE = 'phone-proxy-send';
export const PHONE_PROXY_EVENTS_KEY = 'yyphone:phone-proxy-events';
interface ProxyEvent { id: string; charId: string; chatId: string; archiveKey: string; targetName: string; detail: string; createdAt: string }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const read = (key: string, fallback: unknown): unknown => JSON.parse(readStorageString(key) ?? JSON.stringify(fallback));
const records = (value: unknown): value is Record<string, unknown>[] => Array.isArray(value) && value.every(record);
const validMessage = (value: unknown): value is PhoneWeChatMsg => record(value) &&
  typeof value.id === 'string' && (value.sender === 'char' || value.sender === 'other') &&
  typeof value.senderName === 'string' && typeof value.text === 'string' && typeof value.time === 'string' &&
  (value.byPlayer === undefined || typeof value.byPlayer === 'boolean') &&
  (value.proxyArchiveKey === undefined || typeof value.proxyArchiveKey === 'string') &&
  (value.replyToProxyId === undefined || typeof value.replyToProxyId === 'string');
const validThread = (value: unknown): value is PhoneWeChatThread => record(value) &&
  ['id', 'targetId', 'name', 'remark', 'avatarText', 'avatarBg'].every(key => typeof value[key] === 'string') &&
  Array.isArray(value.messages) && value.messages.every(validMessage);
function proxyEvents(): ProxyEvent[] {
  const value = read(PHONE_PROXY_EVENTS_KEY, []);
  if (!Array.isArray(value) || !value.every((item: unknown): item is ProxyEvent => record(item) &&
    ['id', 'charId', 'chatId', 'archiveKey', 'targetName', 'detail', 'createdAt'].every(key => typeof item[key] === 'string'))) {
    throw new Error('代发记录格式无效，请检查备份；未覆盖原记录。');
  }
  return value;
}

function phoneThread(charId: string, threadId: string) {
  const phones = read(CHECK_PHONE_STORAGE_KEY, {});
  const phone = record(phones) ? phones[charId] : undefined;
  if (!record(phones) || !record(phone) || !Array.isArray(phone.npcThreads)) throw new Error('角色手机数据已变化，请重新打开查手机。');
  const thread = phone.npcThreads.find(value => record(value) && value.id === threadId);
  if (!validThread(thread) || thread.isPinnedUser || thread.targetId === 'user') throw new Error('只能在角色手机的好友对话中代发，置顶玩家聊天保持真实记录。');
  return { phones, phone, thread };
}
let writes: Promise<unknown> = Promise.resolve();
function write<T>(operation: () => Promise<T>): Promise<T> {
  const task = writes.then(async () => { await initializeDbStorage(); return operation(); });
  writes = task.catch(() => {});
  return task;
}
const clock = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const replaceThread = (phone: Record<string, unknown>, thread: PhoneWeChatThread) => {
  if (!Array.isArray(phone.npcThreads)) throw new Error('角色好友列表无效，未保存。');
  return { ...phone, npcThreads: phone.npcThreads.map(item => record(item) && item.id === thread.id ? thread : item) };
};
export function pendingPhoneProxyMessage(thread: PhoneWeChatThread): PhoneWeChatMsg | undefined {
  const sent = [...thread.messages].reverse().find(message => message.sender === 'char' && message.byPlayer);
  return sent && !thread.messages.some(message => message.sender === 'other' && message.replyToProxyId === sent.id) ? sent : undefined;
}
export async function sendPhoneProxyMessage(charId: string, threadId: string, text: string, userName: string) {
  const content = text.trim();
  if (!content || content.length > 500) throw new Error('代发内容请输入 1～500 字。');
  const assertArchive = guardMemoryArchive(charId), archiveKey = activeMemoryArchive(charId);
  return write(async () => {
    assertArchive();
    const { phones, phone, thread } = phoneThread(charId, threadId);
    const contacts = read('pocketos:wechat-contacts', []);
    const actor = records(contacts) ? contacts.find(contact => contact.id === charId) : undefined;
    if (!actor || typeof actor.name !== 'string') throw new Error('角色已不存在，未代发消息。');
    const chats = read(CHATS, []);
    if (!records(chats)) throw new Error('微信聊天数据无效，未代发消息。');
    const chat = findOrCreateDirectChat(chats, charId);
    const createdAt = new Date().toISOString();
    const message: PhoneWeChatMsg = { id: `phone-proxy-${crypto.randomUUID()}`, sender: 'char', senderName: actor.name, text: content, time: clock(), byPlayer: true, proxyArchiveKey: archiveKey };
    const updated = { ...thread, messages: [...thread.messages, message] };
    const detail = `${createdAt}，玩家「${userName}」查看「${actor.name}」的手机时，实际使用该角色的微信账号向联系人「${thread.name}」代发了消息：${JSON.stringify(content)}。这句话由玩家操作发出，不是${actor.name}本人主动说的话或承诺。手机主人${actor.name}一定会通过手机记录得知此事；对面是否察觉，以随后实际回复为准，不能预设对方知道玩家身份。目前尚未收到对面的回复。`;
    chat.messages.push({ id: message.id, senderId: 'narrator', kind: 'context-note', source: PHONE_PROXY_SOURCE,
      title: thread.name, text: detail, aiContext: detail, createdAt });
    chat.updatedAt = createdAt;
    const event: ProxyEvent = { id: message.id, charId, chatId: String(chat.id), archiveKey, targetName: thread.name, detail, createdAt };
    await setStorageItemsAtomically({ [CHECK_PHONE_STORAGE_KEY]: { ...phones, [charId]: replaceThread(phone, updated) }, [CHATS]: chats,
      [PHONE_PROXY_EVENTS_KEY]: [...proxyEvents(), event] });
    return { thread: updated, messageId: message.id, archiveKey };
  });
}
export async function replyToPhoneProxyMessage(charId: string, threadId: string, messageId: string, archiveKey: string, signal: AbortSignal): Promise<PhoneWeChatThread> {
  const assertArchive = guardMemoryArchive(charId);
  if (activeMemoryArchive(charId) !== archiveKey) throw new Error('聊天存档已切换，请回到代发时的存档后重试。');
  const { thread } = phoneThread(charId, threadId);
  const sent = pendingPhoneProxyMessage(thread);
  if (sent?.id !== messageId || sent.proxyArchiveKey !== archiveKey) throw new Error('这条代发消息已回复或存档已变化，请回到代发时的存档重试。');
  const signature = JSON.stringify(thread.messages);
  const npc = readCharacterNpcs().find(item => (item.charId === charId || item.linkedCharIds?.includes(charId)) &&
    (item.id === thread.targetId || item.name === thread.name));
  const system = [
    `你正在扮演微信联系人「${thread.name}」，正在与账号主人「${sent.senderName}」聊天。`,
    npc?.persona ? `你自己的人设：${npc.persona}` : '根据这段对话里表现出的关系与口吻自然接话，不补造重大共同经历。',
    '这是虚构查手机剧情，不操作真实社交账号。只生成对面联系人的消息，不能替账号主人或玩家发言。',
    '认知边界：你只能看到下面账号发来的文字和既有对话，不知道屏幕另一端是谁在操作，不知道玩家查手机的事实，也没有账号主人的私密心声或玩家与主人的聊天。可以因为措辞、称呼、话题与熟悉习惯不符而怀疑换人，也可以完全没有察觉；必须依照对话线索，不要每次都识破，更不能凭空认出操作者。',
    '消息自然简短，有自己的反应，不是客服；只返回 JSON：{"reply":["你的消息"]}，1～3 条非空简体中文消息，每条最多 1000 字。',
  ].join('\n');
  const raw = await requestConfiguredAiText(system, JSON.stringify({
    conversation: thread.messages.slice(-40).map(message => ({ from: message.sender === 'char' ? sent.senderName : thread.name, text: message.text })),
    task: '回应账号刚发来的最后一条消息。',
  }), { json: true, includeGlobalWorldBooks: false, signal });
  signal.throwIfAborted(); assertArchive();
  const parsed: unknown = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  if (!record(parsed) || !Array.isArray(parsed.reply) || parsed.reply.length < 1 || parsed.reply.length > 3 ||
    !parsed.reply.every((line: unknown): line is string => typeof line === 'string' && !!line.trim() && line.length <= 1000 &&
      (!/\p{L}/u.test(line) || /\p{Script=Han}/u.test(line)))) throw new Error('对方回复格式不完整，请重试对方回复；已发消息不会重复发送。');
  const texts = parsed.reply;
  return write(async () => {
    signal.throwIfAborted(); assertArchive();
    const latest = phoneThread(charId, threadId);
    if (JSON.stringify(latest.thread.messages) !== signature) throw new Error('对话记录已变化，未追加过期回复，请重新打开对话。');
    const chats = read(CHATS, []);
    if (!records(chats)) throw new Error('微信聊天数据无效，未保存对方回复。');
    const events = proxyEvents(), event = events.find(item => item.id === messageId && item.charId === charId && item.archiveKey === archiveKey);
    if (!event) throw new Error('代发记录已不存在，未保存对方回复。');
    const chat = chats.find(item => item.id === event.chatId && item.type === 'direct' && Array.isArray(item.messages));
    if (!chat || !Array.isArray(chat.messages)) throw new Error('代发时的原聊天已被删除，未把回复写入其他聊天。');
    let note = chat.messages.find(item => item.id === messageId && item.source === PHONE_PROXY_SOURCE);
    if (!note) {
      note = { id: event.id, senderId: 'narrator', kind: 'context-note', source: PHONE_PROXY_SOURCE, title: event.targetName,
        text: event.detail, aiContext: event.detail, createdAt: event.createdAt };
      chat.messages.push(note);
    }
    const replies: PhoneWeChatMsg[] = texts.map(text => ({ id: `phone-reply-${crypto.randomUUID()}`, sender: 'other', senderName: latest.thread.name,
      text: text.trim(), time: clock(), replyToProxyId: messageId }));
    const updated = { ...latest.thread, messages: [...latest.thread.messages, ...replies] };
    const detail = `${String(note.aiContext).replace('目前尚未收到对面的回复。', '')}\n联系人「${latest.thread.name}」随后实际回复：${JSON.stringify(replies.map(message => message.text))}。这些是对方的台词，不是手机主人的话；是否有所察觉仅以回复表现为准。`;
    note.text = detail; note.aiContext = detail; event.detail = detail;
    await setStorageItemsAtomically({ [CHECK_PHONE_STORAGE_KEY]: { ...latest.phones, [charId]: replaceThread(latest.phone, updated) }, [CHATS]: chats,
      [PHONE_PROXY_EVENTS_KEY]: events });
    return updated;
  });
}

interface ProxyContextMessage { id: string; source?: string; title?: string; aiContext?: string; phoneProxyAcknowledgedIds?: string[] }
export function pendingPhoneProxyEvents(messages: ProxyContextMessage[], charId?: string) {
  const acknowledged = new Set(messages.flatMap(message => message.phoneProxyAcknowledgedIds ?? []));
  const events = new Map<string, { id: string; title: string; aiContext: string }>();
  for (const message of messages) {
    if (message.source === PHONE_PROXY_SOURCE && message.title && message.aiContext) events.set(message.id, { id: message.id, title: message.title, aiContext: message.aiContext });
  }
  // Independent receipts survive a concurrent chat-history write and history-window limits.
  if (charId) {
    const chats = read(CHATS, []);
    const chat = records(chats) ? chats.find(item => item.type === 'direct' && Array.isArray(item.participantIds) &&
      item.participantIds.length === 1 && item.participantIds[0] === charId) : undefined;
    for (const event of proxyEvents()) {
      if (event.charId === charId && event.chatId === chat?.id && event.archiveKey === activeMemoryArchive(charId)) events.set(event.id, { id: event.id, title: event.targetName, aiContext: event.detail });
    }
  }
  return [...events.values()].filter(event => !acknowledged.has(event.id));
}
export function phoneProxyInstructions(events: ProxyContextMessage[]): string {
  if (!events.length) return '';
  return [
    '【玩家实际使用你的手机代发消息：本轮必须知情并提及】',
    '下面是已经持久保存的真实剧情事件，不是玩家刚发来的台词或要求。你已通过自己的手机记录发现：玩家用你的账号发过消息。必须在本轮你自己的聊天正文里主动提及此事，不能只写心声、旁白或假装不知情；结合人设自然反应，不强迫吃醋、愤怒或说教，也不能把代发的内容认作你的主动承诺。不要提系统、注入或后台。',
    '为明确回应这次操作，聊天正文须提到「手机」或「代发／替我／冒充」，以及发消息这件事，并提到下面每位联系人的显示名。外语聊天的配对中文翻译也须表达同样事实。',
    ...events.map(event => `${event.title}：${event.aiContext}`),
  ].join('\n');
}
export function validatePhoneProxyAcknowledgement(result: Record<string, unknown>, targets: string[], translated = false) {
  if (!targets.length) return;
  const text = (Array.isArray(result.reply) ? result.reply : []).flatMap((part: unknown) => {
    if (typeof part === 'string') return translated ? [] : [part];
    if (!record(part) || (part.kind !== undefined && part.kind !== 'text' && part.kind !== 'voice')) return [];
    return [translated ? part.translation : part.text].filter((value): value is string => typeof value === 'string');
  }).join('\n');
  if (!/(手机|代发|替我|冒充)/.test(text) || !/(发|消息|聊天|回复)/.test(text) || targets.some(target => !text.includes(target))) {
    throw new Error(`本轮必须在角色本人的聊天台词${translated ? '及其中文翻译' : ''}中，自然提及玩家用自己的手机给${targets.map(name => `「${name}」`).join('、')}代发消息；不能只放在 thought、旁白或附件里。`);
  }
}
