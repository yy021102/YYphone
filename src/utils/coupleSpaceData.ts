import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';
import {
  markCharacterContextEventsConsumed,
  readPendingHighPriorityEvents,
} from './characterContext';
import { readStorageString, readStoredValue, writeStorageString, writeStoredValue } from './localStorage';
import { readSetting, SETTINGS_KEYS } from './settings';
import { readDirectMessages } from './journalData';

export const COUPLE_SPACES_STORAGE_KEY = 'yyphone:couple-spaces';
const CHATS_STORAGE_KEY = 'yyphone:wechat-chats';
const CONTACTS_STORAGE_KEY = 'pocketos:wechat-contacts';

export type CoupleInviteStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const pad = (value: number) => String(value).padStart(2, '0');

/** 本地时区的 YYYY-MM-DD（toISOString 会在凌晨按 UTC 算成前一天）。 */
export const localDateString = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const createEmptyCoupleSpace = (charId: string): CharacterCoupleSpace => ({
  charId,
  bindStatus: 'unbound',
  startDate: localDateString(),
  headerBgUrl: '',
  pageBgUrl: '',
  calendarBgUrl: '',
  moods: {},
  anniversaries: [],
  diaries: [],
  qaList: [],
  stickyNotes: [],
});

const normalizeSpace = (charId: string, value: unknown): CharacterCoupleSpace => {
  const base = createEmptyCoupleSpace(charId);
  if (!isRecord(value)) return base;
  const list = <T,>(item: unknown): T[] => (Array.isArray(item) ? (item as T[]) : []);
  return {
    ...base,
    ...(value as Partial<CharacterCoupleSpace>),
    charId,
    moods: isRecord(value.moods) ? (value.moods as CharacterCoupleSpace['moods']) : {},
    anniversaries: list(value.anniversaries),
    diaries: list(value.diaries),
    qaList: list(value.qaList),
    stickyNotes: list(value.stickyNotes),
  };
};

export const readCoupleSpaces = (): Record<string, CharacterCoupleSpace> => {
  const stored = readStoredValue<Record<string, unknown>>(COUPLE_SPACES_STORAGE_KEY, {}, isRecord);
  return Object.fromEntries(Object.entries(stored).map(([charId, space]) => [charId, normalizeSpace(charId, space)]));
};

export const writeCoupleSpaces = (spaces: Record<string, CharacterCoupleSpace>) => {
  writeStoredValue(COUPLE_SPACES_STORAGE_KEY, spaces);
};

export const updateCoupleSpace = (
  charId: string,
  updater: (space: CharacterCoupleSpace) => CharacterCoupleSpace
) => {
  const spaces = readCoupleSpaces();
  writeCoupleSpaces({ ...spaces, [charId]: updater(spaces[charId] ?? createEmptyCoupleSpace(charId)) });
};

// ==================== 微信「我」的资料 / 角色资料 ====================
export const readWeChatUserProfile = () => {
  const value = readSetting<unknown>(SETTINGS_KEYS.personas, null, (_value): _value is unknown => true);
  if (isRecord(value) && Array.isArray(value.profiles)) {
    const active = value.profiles.find(
      (profile) => isRecord(profile) && profile.id === value.activeProfileId
    );
    if (isRecord(active)) {
      return {
        name: typeof active.name === 'string' && active.name.trim() ? active.name.trim() : '我',
        avatarUrl: typeof active.avatarUrl === 'string' ? active.avatarUrl : '',
      };
    }
  }
  return { name: '我', avatarUrl: '' };
};

const readJsonArray = (key: string): Array<Record<string, unknown>> => {
  try {
    const parsed: unknown = JSON.parse(readStorageString(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
};

/** 默认保留情侣空间的轻量摘要；查手机使用聊天设置的条数和完整正文。 */
export const readCharacterBrief = (charId: string, options: { configuredHistory?: boolean } = {}) => {
  const contact = readJsonArray(CONTACTS_STORAGE_KEY).find((item) => item.id === charId);
  const name = typeof contact?.name === 'string' ? contact.name : '角色';
  const pad = (n: number) => String(n).padStart(2, '0');
  const history = readDirectMessages(charId, {
    configuredHistory: options.configuredHistory,
    fullText: options.configuredHistory,
  }).filter((message) => !message.note);
  const recent = (options.configuredHistory ? history : history.slice(-5))
    .map((message) => {
      const time = new Date(message.createdAt);
      const stamp = Number.isNaN(time.getTime()) ? '' : `[${time.getMonth() + 1}/${time.getDate()} ${pad(time.getHours())}:${pad(time.getMinutes())}] `;
      return `${stamp}${message.senderId === 'user' ? '玩家' : name}：${options.configuredHistory ? message.text : message.text.slice(0, 120)}`;
    });
  return {
    name,
    persona: typeof contact?.persona === 'string' ? contact.persona : '',
    recentChat: recent.join('\n'),
  };
};

// ==================== 微信单聊里的邀请卡片 ====================
const findOrCreateDirectChat = (chats: Array<Record<string, unknown>>, charId: string) => {
  let chat = chats.find(
    (item) =>
      item.type === 'direct' &&
      Array.isArray(item.participantIds) &&
      item.participantIds.length === 1 &&
      item.participantIds[0] === charId
  );
  if (!chat) {
    chat = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'direct',
      participantIds: [charId],
      noteName: '',
      context: '',
      narratorEnabled: false,
      blocked: false,
      pinned: false,
      avatars: {},
      messages: [],
      updatedAt: new Date().toISOString(),
      groupTitle: '',
      groupNicknames: {},
      allowAgentGroupRename: false,
      attachHistory: false,
      attachedHistoryCount: 10,
    };
    chats.unshift(chat);
  }
  if (!Array.isArray(chat.messages)) chat.messages = [];
  return chat as Record<string, unknown> & { messages: Array<Record<string, unknown>> };
};

const newMessageId = () => `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const mutateDirectChat = (
  charId: string,
  mutate: (chat: Record<string, unknown> & { messages: Array<Record<string, unknown>> }) => void
) => {
  const chats = readJsonArray(CHATS_STORAGE_KEY);
  const chat = findOrCreateDirectChat(chats, charId);
  mutate(chat);
  chat.updatedAt = new Date().toISOString();
  writeStorageString(CHATS_STORAGE_KEY, JSON.stringify(chats));
};

export const postCoupleInviteCard = (charId: string, from: 'user' | 'char', charName: string) => {
  mutateDirectChat(charId, (chat) => {
    chat.messages.push({
      id: newMessageId(),
      senderId: from === 'user' ? 'user' : charId,
      kind: 'couple-invite',
      text: from === 'user' ? '我向你发送了情侣空间邀请' : `${charName}邀请你开通情侣空间`,
      title: '情侣空间邀请',
      content: from === 'user' ? '想和你拥有一个只属于我们两个人的小天地，可以吗？' : '想和你拥有一个只属于我们两个人的小天地，愿意吗？',
      inviteFrom: from,
      inviteStatus: 'pending' satisfies CoupleInviteStatus,
      createdAt: new Date().toISOString(),
    });
  });
};

/** 把该角色单聊里最近一张仍待处理的邀请卡片置为新状态。 */
export const setCoupleInviteCardStatus = (charId: string, status: CoupleInviteStatus) => {
  mutateDirectChat(charId, (chat) => {
    const card = [...chat.messages].reverse().find(
      (message) => message.kind === 'couple-invite' && message.inviteStatus === 'pending'
    );
    if (card) card.inviteStatus = status;
  });
};

export const postUserChatNote = (charId: string, text: string) => {
  mutateDirectChat(charId, (chat) => {
    chat.messages.push({ id: newMessageId(), senderId: 'user', text, createdAt: new Date().toISOString() });
  });
};

// ==================== 注入到聊天提示词 ====================
const MOOD_LABELS: Record<string, string> = {
  happy: '开心',
  calm: '平静',
  sad: '伤心',
  angry: '生气',
  tired: '疲惫',
};

const moodLabel = (moodId?: string) => (moodId ? MOOD_LABELS[moodId.split('_')[0]] ?? moodId : '');

export interface CoupleInjectionItem {
  kind: 'mood' | 'diary' | 'qa' | 'note';
  id: string;
  /** 注入时内容的指纹；生成回复期间玩家又改过则不标记为已读。 */
  fingerprint: string;
}

export interface CoupleInjectionMark {
  charId: string;
  items: CoupleInjectionItem[];
  eventIds: string[];
}

export interface CoupleInjection {
  text: string;
  marks: CoupleInjectionMark[];
}

export const EMPTY_COUPLE_INJECTION: CoupleInjection = { text: '', marks: [] };

const moodFingerprint = (record: { userMoodId?: string; userNote?: string }) =>
  `${record.userMoodId ?? ''}|${record.userNote ?? ''}`;
const diaryFingerprint = (entry: { title: string; content: string; annotations?: Array<{ id: string; author: string; content: string }> }) =>
  `${entry.title}|${entry.content}${entry.annotations?.some(note => note.author === 'user') ? `|${JSON.stringify(entry.annotations.filter(note => note.author === 'user').map(note => [note.id, note.content]))}` : ''}`;
const qaFingerprint = (entry: { question: string; userAnswer?: string }) => `${entry.question}|${entry.userAnswer ?? ''}`;

const clip = (value: string, length: number) => (value.length > length ? `${value.slice(0, length)}…` : value);

export const buildCoupleSpaceInjection = (
  participantIds: string[],
  chatType: 'direct' | 'group' | 'observer',
  nameOf: (charId: string) => string | undefined,
  allowCharInvite = false
): CoupleInjection => {
  // 情侣空间只属于玩家和这一位角色，群聊与旁观群聊里不注入。
  if (chatType !== 'direct' || participantIds.length !== 1) return EMPTY_COUPLE_INJECTION;
  const charId = participantIds[0];
  if (charId.startsWith('npc:')) return EMPTY_COUPLE_INJECTION;

  const space = readCoupleSpaces()[charId];
  const lines: string[] = [];
  const items: CoupleInjectionItem[] = [];

  if ((!space || space.bindStatus === 'unbound') && allowCharInvite) {
    lines.push('【情侣空间】你和玩家之间可以开通一个专属的“情侣空间”（共享心情日历、交换日记、问答、便签）。只有当你们的关系已经足够亲密、当下气氛浪漫或情绪到位、并且符合你的人设时，你才可以主动邀请玩家开通：在 JSON 回复里额外加 "coupleSpaceAction":"invite"，并在 reply 里用自己的方式自然地提出邀请。这是一件郑重的事，大多数时候不要邀请；关系未到位、玩家情绪不佳、话题无关时绝对不要提；邀请发出后不要重复提起。');
  }
  if (space?.bindStatus === 'pending_char') {
    lines.push('玩家向你发送了情侣空间邀请，正在等你回应。请结合人设和你们现在的关系自然决定：愿意就在 JSON 回复里加 "coupleSpaceAction":"accept"，不愿意则加 "coupleSpaceAction":"decline"，并在 reply 里用自己的方式回应。');
  } else if (space?.bindStatus === 'pending_user') {
    lines.push('你已经向玩家发出情侣空间邀请，正在等玩家回应，不要重复邀请。');
  }

  if (space?.bindStatus === 'bound') {
    const moodLines = Object.values(space.moods)
      .filter((record) => record.seenByChar === false && (record.userMoodId || record.userNote))
      .sort((left, right) => right.dateStr.localeCompare(left.dateStr))
      .slice(0, 5)
      .map((record) => {
        items.push({ kind: 'mood', id: record.dateStr, fingerprint: moodFingerprint(record) });
        return `· ${record.dateStr} 玩家的心情：${moodLabel(record.userMoodId) || '未选'}${record.userNote ? `，心情小记：${clip(record.userNote, 80)}` : ''}`;
      });
    const diaryLines = space.diaries
      .filter((entry) => entry.seenByChar === false && (entry.author === 'user' || entry.annotations?.some(note => note.author === 'user')))
      .slice(0, 3)
      .map((entry) => {
        items.push({ kind: 'diary', id: entry.id, fingerprint: diaryFingerprint(entry) });
        const annotations = entry.annotations?.filter(note => note.author === 'user').slice(-4).map(note => clip(note.content, 180)).join('；');
        return `· ${entry.author === 'user' ? '玩家写了交换日记' : '玩家批注了你的日记'}《${entry.title}》（${entry.dateStr}）：${clip(entry.content, 300)}${annotations ? `；玩家批注：${annotations}` : ''}`;
      });
    const qaLines = space.qaList
      .filter((entry) => entry.seenByChar === false && (entry.userAnswer || entry.askedBy === 'user'))
      .slice(0, 3)
      .map((entry) => {
        items.push({ kind: 'qa', id: entry.id, fingerprint: qaFingerprint(entry) });
        const asker = entry.askedBy === 'user' ? '玩家提的问题' : entry.askedBy === 'char' ? '你提的问题' : '每日问题';
        return `· ${asker}「${entry.question}」${entry.userAnswer ? `；玩家的回答：${clip(entry.userAnswer, 200)}` : '；玩家想听你回答'}`;
      });
    const noteLines = space.stickyNotes
      .filter((note) => note.author === 'user' && note.seenByChar === false)
      .slice(0, 4)
      .map((note) => {
        items.push({ kind: 'note', id: note.id, fingerprint: note.content });
        return `· 玩家贴了一张碎碎念便签：${clip(note.content, 120)}`;
      });
    const newLines = [...moodLines, ...diaryLines, ...qaLines, ...noteLines];
    if (newLines.length > 0) {
      lines.push(
        '你和玩家开通了情侣空间。玩家在里面留下了你还没看过的新内容（只告知这一次，之后不会重复提供）。可以在回复里自然地提及或回应，不要逐条复述：',
        ...newLines
      );
    }
  }

  const events = readPendingHighPriorityEvents([charId], 'couple');
  if (events.length > 0) {
    lines.push('【重要事件】', ...events.map((event) => `· ${event.content}`), '请根据人设自然地做出反应，只在这一次提到。');
  }

  if (lines.length === 0) return EMPTY_COUPLE_INJECTION;
  return {
    text: `【情侣空间】角色「${nameOf(charId) ?? charId}」与玩家：\n${lines.join('\n')}`,
    marks: [{ charId, items, eventIds: events.map((event) => event.id) }],
  };
};

/** 回复成功保存后调用：把已送达的内容标记为角色已读，防止重复注入。 */
export const applyCoupleSeenAfterChat = (injection: CoupleInjection) => {
  injection.marks.forEach((mark) => {
    if (mark.items.length > 0) {
      updateCoupleSpace(mark.charId, (space) => ({
        ...space,
        moods: Object.fromEntries(
          Object.entries(space.moods).map(([date, record]) => {
            const hit = mark.items.some(
              (item) => item.kind === 'mood' && item.id === date && item.fingerprint === moodFingerprint(record)
            );
            return [date, hit ? { ...record, seenByChar: true } : record];
          })
        ),
        diaries: space.diaries.map((entry) =>
          mark.items.some((item) => item.kind === 'diary' && item.id === entry.id && item.fingerprint === diaryFingerprint(entry))
            ? { ...entry, seenByChar: true }
            : entry
        ),
        qaList: space.qaList.map((entry) =>
          mark.items.some((item) => item.kind === 'qa' && item.id === entry.id && item.fingerprint === qaFingerprint(entry))
            ? { ...entry, seenByChar: true }
            : entry
        ),
        stickyNotes: space.stickyNotes.map((note) =>
          mark.items.some((item) => item.kind === 'note' && item.id === note.id && item.fingerprint === note.content)
            ? { ...note, seenByChar: true }
            : note
        ),
      }));
    }
    markCharacterContextEventsConsumed(mark.eventIds);
  });
};
