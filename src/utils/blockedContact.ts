import { requestConfiguredAiText } from './aiApi';
import { readChatRuntimeSettings } from './chatRuntime';
import { readStorageString, writeStoredValue } from './localStorage';

export const BLOCKED_CONTACTS_KEY = 'yyphone:blocked-contacts';
const CHATS_KEY = 'yyphone:wechat-chats';
const CONTACTS_KEY = 'pocketos:wechat-contacts';

export interface BlockedInteraction {
  id: string;
  chatId: string;
  charId: string;
  charName: string;
  type: 'friend-request' | 'paper';
  createdAt: string;
  status: 'pending' | 'drawer' | 'replied' | 'accepted' | 'rejected';
  message: string;
  thread?: Array<{ role: 'user' | 'character'; text: string; createdAt: string }>;
  answer?: string;
}

interface BlockChat extends Record<string, unknown> {
  id: string;
  type: string;
  blocked: boolean;
  updatedAt: string;
  participantIds: string[];
  messages: Array<Record<string, unknown>>;
  blockedSince?: string;
  blockedNextAt?: string;
  blockedDelayMinutes?: number;
  blockedTiming?: 'after' | 'within';
  blockedActivity?: 'friend' | 'paper' | 'both';
  blockedActivityCount?: number;
  blockedBacklogGeneratedAt?: string;
  blockedBacklogRetryAt?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readJson = (key: string): unknown => {
  const raw = readStorageString(key);
  return raw ? JSON.parse(raw) : [];
};

const readChats = (): BlockChat[] => {
  const value = readJson(CHATS_KEY);
  if (!Array.isArray(value)) throw new Error('聊天数据格式无效，拉黑后续互动已暂停。');
  return value.filter((item): item is BlockChat => isRecord(item) &&
    typeof item.id === 'string' && typeof item.type === 'string' &&
    typeof item.blocked === 'boolean' && typeof item.updatedAt === 'string' && Array.isArray(item.participantIds) &&
    Array.isArray(item.messages));
};

const writeChats = (chats: BlockChat[]) => writeStoredValue(CHATS_KEY, chats);

const readInteractions = (): BlockedInteraction[] => {
  const value = readJson(BLOCKED_CONTACTS_KEY);
  if (!Array.isArray(value) || !value.every((item) =>
    isRecord(item) && typeof item.id === 'string' && typeof item.chatId === 'string' &&
    typeof item.charId === 'string' && typeof item.charName === 'string' &&
    (item.type === 'friend-request' || item.type === 'paper') &&
    typeof item.createdAt === 'string' &&
    ['pending', 'drawer', 'replied', 'accepted', 'rejected'].includes(String(item.status)) &&
    typeof item.message === 'string')) {
    throw new Error('拉黑互动数据格式无效，未覆盖已有内容。');
  }
  return value as BlockedInteraction[];
};

export const readBlockedInteractions = () => readInteractions();

const writeInteractions = (items: BlockedInteraction[]) => writeStoredValue(BLOCKED_CONTACTS_KEY, items);

const readContact = (charId: string) => {
  const contacts = readJson(CONTACTS_KEY);
  if (!Array.isArray(contacts)) throw new Error('通讯录数据格式无效。');
  const contact = contacts.find((item) => isRecord(item) && item.id === charId);
  if (!isRecord(contact)) return { name: '角色', persona: '' };
  return {
    name: typeof contact.name === 'string' ? contact.name : '角色',
    persona: typeof contact.persona === 'string' ? contact.persona : '',
  };
};

const requestObject = async (system: string, user: string) => {
  const response = await requestConfiguredAiText(system, user, { json: true, temperature: 0.75, maxTokens: 1800 });
  try {
    const parsed: unknown = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] ?? response);
    if (!isRecord(parsed)) throw new Error('format');
    return parsed;
  } catch {
    throw new Error('拉黑期间的角色消息格式无效，请稍后重试。');
  }
};

const recentContext = (chat: BlockChat) => chat.messages
  .filter((message) => message.senderId === 'user' || message.senderId === chat.participantIds[0])
  .slice(-18)
  .map((message) => {
    const time = typeof message.createdAt === 'string' ? message.createdAt.slice(0, 16).replace('T', ' ') : '';
    const name = message.senderId === 'user' ? '玩家' : '角色';
    return `[${time}] ${name}：${typeof message.text === 'string' ? message.text.slice(0, 500) : ''}`;
  }).join('\n');

const nextDueDate = (delayMinutes: number, timing: 'after' | 'within') => {
  const delay = Math.max(1, Math.round(delayMinutes)) * 60_000;
  const offset = timing === 'within' ? Math.max(60_000, Math.floor(Math.random() * delay)) : delay;
  return new Date(Date.now() + offset).toISOString();
};

const dueBlockedChats = () => readChats().filter((chat) =>
  chat.type === 'direct' && chat.blocked && chat.participantIds.length === 1 &&
  typeof chat.blockedSince === 'string' && typeof chat.blockedNextAt === 'string' &&
  Date.parse(chat.blockedNextAt) <= Date.now() &&
  (chat.blockedTiming !== 'within' || readChatRuntimeSettings().keepAlive));

const running = new Set<string>();

const generateBlockedActivity = async (chat: BlockChat) => {
  const charId = chat.participantIds[0];
  const { name, persona } = readContact(charId);
  const context = recentContext(chat);
  const activity = chat.blockedActivity ?? 'both';
  const priorCount = chat.blockedActivityCount ?? 0;
  const hasPendingFriend = readInteractions().some((item) =>
    item.chatId === chat.id && item.type === 'friend-request' && item.status === 'pending');
  const hasPendingPaper = readInteractions().some((item) =>
    item.chatId === chat.id && item.type === 'paper' && item.status === 'pending');
  if (hasPendingPaper) return null;
  const type: BlockedInteraction['type'] = activity === 'both'
    ? (!priorCount || priorCount % 2 === 0) && !hasPendingFriend ? 'friend-request' : 'paper'
    : activity === 'friend' ? 'friend-request' : 'paper';

  if (type === 'friend-request' && hasPendingFriend) return null;
  const system = [
    `你正在扮演角色「${name}」，人设如下：${persona || '按最近相处表现保持一致。'}`,
    '玩家已经拉黑了你。尊重边界，不威胁、不骚扰、不要求玩家立即解除拉黑；表达符合角色个性的遗憾、歉意或想说的话。',
    `近期可见聊天记录：\n${context || '（没有可用的近期聊天记录）'}`,
    type === 'friend-request'
      ? `写一条微信好友申请附言，简短具体，像角色本人想对玩家说的话。只返回 JSON：{"message":"申请附言"}`
      : `写一张匿名小纸条，最多 180 字，像角色本人会写的内容。内容应适合玩家回复，提出至多一个自然的问题，不透露身份。只返回 JSON：{"message":"纸条内容"}`,
  ].join('\n\n');
  const result = await requestObject(system, '根据以上信息写出这次联系内容。');
  const content = typeof result.message === 'string' ? result.message.trim().slice(0, 1200) : '';
  if (!content) throw new Error('角色没有生成有效的拉黑联系内容。');
  return { type, content };
};

export const processBlockedContactSchedules = async () => {
  const chats = dueBlockedChats();
  for (const chat of chats) {
    if (running.has(chat.id)) continue;
    running.add(chat.id);
    try {
      const { name } = readContact(chat.participantIds[0]);
      const generated = await generateBlockedActivity(chat);
      const freshChats = readChats();
      const latest = freshChats.find((item) => item.id === chat.id);
      if (!latest || !latest.blocked || latest.blockedSince !== chat.blockedSince ||
        latest.blockedNextAt !== chat.blockedNextAt) continue;
      const delay = latest.blockedDelayMinutes ?? 60;
      if (!generated) {
        writeChats(freshChats.map((item) => item.id === latest.id ? {
          ...item, blockedNextAt: nextDueDate(delay, latest.blockedTiming ?? 'after'),
        } : item));
        continue;
      }
      const interaction: BlockedInteraction = {
        id: crypto.randomUUID(),
        chatId: latest.id,
        charId: latest.participantIds[0],
        charName: name,
        type: generated.type,
        createdAt: new Date().toISOString(),
        status: 'pending',
        message: generated.content || '角色暂时没有新的申请内容。',
        ...(generated.type === 'paper'
          ? { thread: [{ role: 'character' as const, text: generated.content, createdAt: new Date().toISOString() }] }
          : {}),
      };
      writeInteractions([...readInteractions(), interaction]);
      writeChats(freshChats.map((item) => item.id === latest.id ? {
        ...item,
        blockedActivityCount: (item.blockedActivityCount ?? 0) + 1,
        blockedNextAt: nextDueDate(delay, item.blockedTiming ?? 'after'),
      } : item));
      window.dispatchEvent(new Event('yyphone:blocked-interactions'));
    } catch (error) {
      console.error('Could not generate a blocked-contact interaction.', error);
      const freshChats = readChats();
      writeChats(freshChats.map((item) => item.id === chat.id
        ? { ...item, blockedNextAt: nextDueDate(5, 'after') } : item));
    } finally {
      running.delete(chat.id);
    }
  }
};

export const storePaperInDrawer = (id: string) => {
  const interactions = readInteractions();
  const target = interactions.find((item) => item.id === id && item.type === 'paper' && item.status === 'pending');
  if (!target) return;
  writeInteractions(interactions.map((item) => item.id === id ? { ...item, status: 'drawer' } : item));
  const chats = readChats();
  writeChats(chats.map((chat) => chat.id === target.chatId && chat.blocked ? {
    ...chat, blockedNextAt: nextDueDate(chat.blockedDelayMinutes ?? 60, chat.blockedTiming ?? 'after'),
  } : chat));
  window.dispatchEvent(new Event('yyphone:blocked-interactions'));
};

export const respondToBlockedPaper = async (id: string, answer: string) => {
  const normalized = answer.trim();
  if (!normalized || normalized.length > 2000) throw new Error('回复不能为空或超过 2000 字。');
  const interactions = readInteractions();
  const target = interactions.find((item) => item.id === id && item.type === 'paper' && item.status === 'pending');
  if (!target) throw new Error('这张小纸条已处理或不存在。');
  const chat = readChats().find((item) => item.id === target.chatId);
  const { persona } = readContact(target.charId);
  const system = [
    `你是角色「${target.charName}」，人设：${persona || '依据已知互动自然回应。'}`,
    '你正通过匿名小纸条和拉黑你的玩家进行私密对话。保持匿名，尊重玩家边界，不逼迫解除拉黑，不自报身份。',
    `最近聊天背景：\n${chat ? recentContext(chat) : ''}`,
    `对话记录：\n${(target.thread ?? []).map((line) => `${line.role === 'user' ? '玩家' : '匿名角色'}：${line.text}`).join('\n')}`,
    `玩家刚刚回复：${normalized}`,
    '用角色口吻自然接话，允许继续提出一个问题以便对话继续。只返回 JSON：{"reply":"回复内容"}',
  ].join('\n\n');
  const result = await requestObject(system, normalized);
  const reply = typeof result.reply === 'string' ? result.reply.trim().slice(0, 2000) : '';
  if (!reply) throw new Error('角色没有生成有效的纸条回复，请重试。');
  const latest = readInteractions();
  const latestTarget = latest.find((item) => item.id === id && item.status === 'pending');
  if (!latestTarget) throw new Error('小纸条状态已改变，回复未保存。');
  writeInteractions(latest.map((item) => item.id === id ? {
    ...item,
    message: normalized,
    thread: [
      ...(item.thread ?? []),
      { role: 'user' as const, text: normalized, createdAt: new Date().toISOString() },
      { role: 'character' as const, text: reply, createdAt: new Date().toISOString() },
    ],
  } : item));
  window.dispatchEvent(new Event('yyphone:blocked-interactions'));
  return reply;
};

export const updateBlockedInteraction = (id: string, status: 'accepted' | 'rejected') => {
  const interactions = readInteractions();
  writeInteractions(interactions.map((item) => item.id === id && item.type === 'friend-request'
    ? { ...item, status } : item));
  const target = interactions.find((item) => item.id === id);
  if (target && status === 'accepted') {
    const chats = readChats();
    writeChats(chats.map((chat) => chat.id === target.chatId ? {
      ...chat,
      blocked: false,
      blockedSince: chat.blockedSince ?? chat.updatedAt,
      blockedBacklogGeneratedAt: undefined,
      blockedNextAt: undefined,
    } : chat));
  }
  window.dispatchEvent(new Event('yyphone:blocked-interactions'));
};

export const generateBlockedPeriodBacklog = async () => {
  for (const chat of readChats().filter((item) =>
    item.type === 'direct' && !item.blocked && typeof item.blockedSince === 'string' &&
    !item.blockedBacklogGeneratedAt && item.participantIds.length === 1 &&
    (!item.blockedBacklogRetryAt || Date.parse(item.blockedBacklogRetryAt) <= Date.now()))) {
    if (running.has(`backlog:${chat.id}`)) continue;
    running.add(`backlog:${chat.id}`);
    try {
      const charId = chat.participantIds[0];
      const { name, persona } = readContact(charId);
      const start = Date.parse(chat.blockedSince ?? '');
      const end = Date.now();
      const result = await requestObject([
        `你是角色「${name}」，人设：${persona || '结合聊天记录自然表达。'}`,
        '玩家刚解除对你的拉黑。请生成你在无法联系玩家期间积攒但没有发出的微信消息，语气要符合角色和具体经历，不责怪、不施压。',
        `拉黑时间：${new Date(start).toLocaleString('zh-CN')} 至 ${new Date(end).toLocaleString('zh-CN')}`,
        `此前聊天：\n${recentContext(chat)}`,
        '生成 2 到 5 条不同时间的短消息，日期必须落在拉黑期间，内容具体、自然，表现期间发生的日常或想对玩家说的话。只返回 JSON：{"messages":[{"text":"消息","createdAt":"ISO日期"}]}',
      ].join('\n\n'), '生成拉黑期间未发出的消息。');
      const entries = Array.isArray(result.messages) ? result.messages : [];
      const freshChats = readChats();
      const latest = freshChats.find((item) => item.id === chat.id);
      if (!latest || latest.blocked || latest.blockedSince !== chat.blockedSince ||
        latest.blockedBacklogGeneratedAt) continue;
      const messages = entries.flatMap((item) => {
        if (!isRecord(item) || typeof item.text !== 'string' || !item.text.trim()) return [];
        const parsedTime = typeof item.createdAt === 'string' ? Date.parse(item.createdAt) : NaN;
        const createdAt = Number.isFinite(parsedTime) && parsedTime >= start && parsedTime <= end
          ? new Date(parsedTime).toISOString()
          : new Date(start + Math.max(0, end - start) * Math.random()).toISOString();
        return [{ id: crypto.randomUUID(), senderId: charId, text: item.text.trim().slice(0, 2000),
          createdAt, kind: 'text' }];
      }).slice(0, 8);
      const chronological = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const stamp = new Date().toISOString();
      writeChats(freshChats.map((item) => item.id === chat.id ? {
        ...item,
        messages: [...item.messages, ...chronological],
        updatedAt: stamp,
        blockedBacklogGeneratedAt: stamp,
        blockedBacklogRetryAt: undefined,
      } : item));
      window.dispatchEvent(new Event('yyphone:blocked-interactions'));
    } catch (error) {
      console.error('Could not generate blocked-period chat messages.', error);
      const freshChats = readChats();
      writeChats(freshChats.map((item) => item.id === chat.id && !item.blocked
        ? { ...item, blockedBacklogRetryAt: new Date(Date.now() + 5 * 60_000).toISOString() }
        : item));
    } finally {
      running.delete(`backlog:${chat.id}`);
    }
  }
};
