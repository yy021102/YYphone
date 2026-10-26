import { readStoredValue, writeStoredValue } from './localStorage';
import { readWechatChatsRaw } from './memoryData';
import { archiveCursorsForWrite, readArchiveCursors, readArchiveRecords, writeArchiveRecords } from './memoryArchives';
import { resolveChatHistoryCount } from './chatHistory';

export const JOURNAL_ENTRIES_KEY = 'yyphone:memory-journal';
export const GROWTH_NOTES_KEY = 'yyphone:memory-growth';
export const JOURNAL_SETTINGS_KEY = 'yyphone:memory-journal-settings';

/** 1=流水账（每 N 条消息一篇）  2=阶段回顾  3=长篇回顾 */
export type JournalLevel = 1 | 2 | 3;

export const JOURNAL_LEVEL_LABEL: Record<JournalLevel, string> = {
  1: '流水账',
  2: '阶段回顾',
  3: '长篇回顾',
};

export interface JournalEntry {
  id: string;
  charId: string;
  archiveKey?: string;
  level: JournalLevel;
  /** 覆盖的聊天时间范围 */
  from: string;
  to: string;
  fromMessageId?: string;
  toMessageId?: string;
  messageCount: number;
  content: string;
  createdAt: string;
  /** 被合并进更高一层的哪一篇；已合并的不再注入 */
  mergedInto?: string;
  source: 'auto' | 'manual' | 'merge';
}

export interface GrowthNote {
  id: string;
  charId: string;
  archiveKey?: string;
  relationship: string;
  changes: string;
  habits: string;
  createdAt: string;
  status: 'pending' | 'active' | 'archived';
  /** 这份笔记基于到哪条消息为止的聊天 */
  basedOnUntil: string;
}

export interface JournalSettings {
  journalAuto: boolean;
  /** 累计多少条新消息写一篇流水账 */
  journalEvery: number;
  /** First-level summary character limit; higher levels receive modestly larger budgets. */
  journalMaxChars: number;
  journalPrompt: string;
  journalCursors: Record<string, string>;
  growthAuto: boolean;
  /** 隔多少天才提醒/生成一次成长笔记 */
  growthIntervalDays: number;
  /** 生成后先让玩家确认再生效 */
  growthConfirm: boolean;
  lastError: string;
}

export const DEFAULT_JOURNAL_SETTINGS: JournalSettings = {
  journalAuto: true,
  journalEvery: 100,
  journalMaxChars: 400,
  journalPrompt: '',
  journalCursors: {},
  growthAuto: true,
  growthIntervalDays: 14,
  growthConfirm: true,
  lastError: '',
};

/** 每一层未合并的篇数上限与一次合并的篇数 */
export const COMPRESSION = {
  1: { cap: 8, mergeCount: 5 },
  2: { cap: 6, mergeCount: 4 },
  3: { cap: 6, mergeCount: 4 },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const newJournalId = (prefix = 'jr') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ==================== 存取 ====================
const isJournalEntries = (v: unknown): v is JournalEntry[] =>
  Array.isArray(v) && v.every((e) => isRecord(e) && typeof e.id === 'string' && typeof e.charId === 'string' && typeof e.content === 'string');
export const readJournalEntries = (): JournalEntry[] => readArchiveRecords(JOURNAL_ENTRIES_KEY, isJournalEntries);
export const writeJournalEntries = (items: JournalEntry[]) => writeArchiveRecords(JOURNAL_ENTRIES_KEY, items, isJournalEntries);

const isGrowthNotes = (v: unknown): v is GrowthNote[] =>
  Array.isArray(v) && v.every((n) => isRecord(n) && typeof n.id === 'string' && typeof n.charId === 'string' && typeof n.status === 'string');
export const readGrowthNotes = (): GrowthNote[] => readArchiveRecords(GROWTH_NOTES_KEY, isGrowthNotes);
export const writeGrowthNotes = (items: GrowthNote[]) => writeArchiveRecords(GROWTH_NOTES_KEY, items, isGrowthNotes);

export const readJournalSettings = (): JournalSettings => {
  const stored = readStoredValue(JOURNAL_SETTINGS_KEY, null as unknown, (v): v is unknown => true);
  if (!isRecord(stored)) return DEFAULT_JOURNAL_SETTINGS;
  const num = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  return {
    journalAuto: stored.journalAuto !== false,
    journalEvery: num(stored.journalEvery, 100, 30, 400),
    journalMaxChars: num(stored.journalMaxChars, 400, 200, 1200),
    journalPrompt: typeof stored.journalPrompt === 'string' ? stored.journalPrompt.slice(0, 6000) : '',
    journalCursors: readArchiveCursors(JOURNAL_SETTINGS_KEY, 'journalCursors'),
    growthAuto: stored.growthAuto !== false,
    growthIntervalDays: num(stored.growthIntervalDays, 14, 3, 90),
    growthConfirm: stored.growthConfirm !== false,
    lastError: typeof stored.lastError === 'string' ? stored.lastError : '',
  };
};
export const writeJournalSettings = (settings: JournalSettings) => writeStoredValue(JOURNAL_SETTINGS_KEY, {
  ...settings, journalCursors: archiveCursorsForWrite(JOURNAL_SETTINGS_KEY, 'journalCursors', settings.journalCursors),
});

// ==================== 读取聊天 ====================
export interface DirectMessage {
  id?: string;
  createdAt: string;
  senderId: string;
  text: string;
  /** 线下剧情 / 手机记忆这类“上下文记录”，不是任何人说的话 */
  note: boolean;
}

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** 把一条聊天消息（含各类分享卡片、上下文记录）转成适合总结的文字。 */
export const describeForSummary = (m: Record<string, unknown>, maxLength = 300): string => {
  const title = clip(m.title, 60);
  const detail = clip(m.aiContext, maxLength === Infinity ? Infinity : 320);
  const text = clip(m.text, maxLength);
  switch (m.kind) {
    case 'couple-letter':
      return `[情书「${title || '给你的一封信'}」] ${clip(m.content, maxLength)}`;
    case 'context-note':
      return `${title}${m.source === 'offline' ? '（线下剧情摘要）' : m.source === 'phone-memory' ? '（手机内容记忆）' : m.source === 'pomodoro' ? '（番茄钟陪伴）' : m.source === 'group-private' ? '（群聊转私信背景）' : m.source === 'xianyu' ? '（闲鱼对话）' : '（上下文记录）'}：${[
        ...(m.source === 'group-private' && m.aiContext && m.text !== m.aiContext ? [text] : []),
        clip(m.aiContext, maxLength === Infinity ? Infinity : 400) || text,
      ].join('\n')}`;
    case 'forum-forward':
      return `[玩家分享了论坛帖子「${title}」] ${detail}`;
    case 'pomodoro-share':
      return `[玩家分享了番茄钟战绩「${title}」] ${detail}`;
    case 'phone-share':
      return `[玩家转发了查到的手机内容「${title}」] ${detail}`;
    case 'red-packet':
    case 'transfer':
      return `[${m.kind === 'red-packet' ? '红包' : '转账'} ¥${typeof m.amount === 'string' || typeof m.amount === 'number' ? m.amount : ''}；${m.paymentStatus === 'pending' ? '待领取/收款，未到账' : m.paymentStatus === 'returned' ? '已退回，未到账' : m.senderId === 'user' ? '已发出' : '已领取/收款'}] ${text}`;
    case 'intimate-pay':
      return `[亲密付${m.senderId === 'user' ? '申请' : '决定'}；${m.intimateStatus === 'pending' ? '待回应' : m.intimateStatus === 'granted' ? '已同意' : '已拒绝'}] ${text}`;
    case 'order':
      return `[${text || title}]${typeof m.content === 'string' && m.content ? ` ${clip(m.content, 80)}` : ''}`;
    default:
      return text || (title ? `[${title}]` : '[消息]');
  }
};

export const readDirectMessages = (
  charId: string,
  options: { configuredHistory?: boolean; fullText?: boolean } = {}
): DirectMessage[] => {
  const chat = readWechatChatsRaw().find(
    (item) =>
      isRecord(item) &&
      item.type === 'direct' &&
      Array.isArray(item.participantIds) &&
      item.participantIds.length === 1 &&
      item.participantIds[0] === charId
  );
  if (!isRecord(chat) || !Array.isArray(chat.messages)) return [];
  const messages = options.configuredHistory
    ? chat.messages.slice(-resolveChatHistoryCount(chat.currentChatHistoryCount))
    : chat.messages;
  return messages
    .filter((m): m is Record<string, unknown> =>
      isRecord(m) && typeof m.createdAt === 'string' && (m.senderId !== 'narrator' || m.kind === 'context-note'))
    .map((m) => ({
      ...(typeof m.id === 'string' ? { id: m.id } : {}),
      createdAt: m.createdAt as string,
      senderId: typeof m.senderId === 'string' ? m.senderId : '',
      text: describeForSummary(m, options.fullText ? Infinity : 300),
      note: m.kind === 'context-note',
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const countPendingForJournal = (charId: string, settings: JournalSettings) => {
  const cursor = settings.journalCursors[charId] ?? '';
  return readDirectMessages(charId).filter((m) => !cursor || m.createdAt > cursor).length;
};

// ==================== 条目操作 ====================
export const entriesOf = (charId: string) =>
  readJournalEntries()
    .filter((e) => e.charId === charId)
    .sort((a, b) => a.from.localeCompare(b.from));

export const unmergedOf = (charId: string, level: JournalLevel) =>
  entriesOf(charId).filter((e) => e.level === level && !e.mergedInto);

/** 删除一篇；被它合并过的下层篇章恢复为未合并。 */
export const deleteJournalEntry = (id: string) => {
  writeJournalEntries(
    readJournalEntries()
      .filter((e) => e.id !== id)
      .map((e) => (e.mergedInto === id ? { ...e, mergedInto: undefined } : e))
  );
};

// ==================== 注入 ====================
const formatSpan = (from: string, to: string) => {
  const f = new Date(from);
  const t = new Date(to);
  const fmt = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return '';
  return fmt(f) === fmt(t) ? fmt(f) : `${fmt(f)}–${fmt(t)}`;
};

/**
 * 古法流水账：只注入完全落在「原文窗口」之外的篇章，避免和最近 N 条原文重复；
 * 每层只带最近几篇，保证总量封顶。
 */
export const buildJournalInjection = (
  participantIds: string[],
  chatType: string,
  rawWindowStart: string | undefined
): string => {
  if (chatType !== 'direct' || participantIds.length !== 1) return '';
  const charId = participantIds[0];
  const eligible = (level: JournalLevel) =>
    unmergedOf(charId, level)
      .filter((e) => !rawWindowStart || e.to < rawWindowStart)
      .slice(-(COMPRESSION[level].cap + 2));
  const long = eligible(3);
  const mid = eligible(2);
  const recent = eligible(1);
  if (long.length + mid.length + recent.length === 0) return '';
  const lines = (list: JournalEntry[]) => list.map((e) => `- ${formatSpan(e.from, e.to)}：${e.content}`).join('\n');
  return [
    '【你和玩家相处的流水账（你的记忆）】',
    '以下按时间从远到近，是对更早相处经历的客观记录。记录使用第三人称和真实姓名，具体年月日与事件不得省略或模糊化；更近的内容在下面聊天记录里。将其作为已发生的往事，不要每轮都复述。',
    long.length > 0 ? `久远的时光：\n${lines(long)}` : '',
    mid.length > 0 ? `一段时间以来：\n${lines(mid)}` : '',
    recent.length > 0 ? `不久之前：\n${lines(recent)}` : '',
  ].filter(Boolean).join('\n');
};

export const activeGrowthNote = (charId: string) =>
  readGrowthNotes().find((n) => n.charId === charId && n.status === 'active');

export const buildGrowthInjection = (participantIds: string[], chatType: string): string => {
  if (chatType !== 'direct' || participantIds.length !== 1) return '';
  const note = activeGrowthNote(participantIds[0]);
  if (!note) return '';
  return [
    '【你近来的变化与相处状态（属于你自己的成长）】',
    '这是你随着和玩家的相处，自然发生的幽微变化，已经是“你”的一部分：让它悄悄体现在语气、关注点、小习惯和默契里；不要刻意宣告“我变了”，也不要因此违背你的核心人设。',
    note.relationship && `关系现状：${note.relationship}`,
    note.changes && `近来的变化：${note.changes}`,
    note.habits && `你们之间的默契：${note.habits}`,
  ].filter(Boolean).join('\n');
};
