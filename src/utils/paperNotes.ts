import { getStorageItem, setStorageItem } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { localDateString } from './coupleSpaceData';
import { activeMemoryArchive, guardMemoryArchive } from './memoryArchives';
import { isRecordDate } from './coupleRecords';

export const PAPER_NOTES_KEY = 'yyphone:paper-notes';
const CHATS_KEY = 'yyphone:wechat-chats';
const CONTACTS_KEY = 'pocketos:wechat-contacts';

export interface PaperAuthor {
  charId: string;
  chatId: string;
  archiveKey: string;
}
export interface PaperContent {
  kind: 'question' | 'thought' | 'unsaid';
  content: string;
}
export interface PaperNote extends PaperAuthor, PaperContent {
  id: string;
  date: string;
  answer?: string;
  reply?: string;
}
interface PaperDay extends PaperAuthor { noteId?: string }
export interface PaperNotesState {
  version: 1;
  days: Record<string, PaperDay>;
  notes: PaperNote[];
  memories: PaperNote[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const author = (value: unknown): value is PaperAuthor & Record<string, unknown> =>
  record(value) && typeof value.charId === 'string' && typeof value.chatId === 'string' && typeof value.archiveKey === 'string';
const note = (value: unknown): value is PaperNote =>
  record(value) && author(value) && typeof value.id === 'string' && typeof value.date === 'string' &&
  isRecordDate(value.date) && ['question', 'thought', 'unsaid'].includes(String(value.kind)) &&
  typeof value.content === 'string' && !!value.content.trim() &&
  (value.answer === undefined || typeof value.answer === 'string') &&
  (value.reply === undefined || typeof value.reply === 'string');

const validState = (value: unknown): value is PaperNotesState =>
  record(value) && value.version === 1 && record(value.days) &&
  Object.entries(value.days).every(([date, day]) => isRecordDate(date) && author(day) &&
    (day.noteId === undefined || typeof day.noteId === 'string')) &&
  Array.isArray(value.notes) && value.notes.every(note) &&
  Array.isArray(value.memories) && value.memories.every(note);

export const parsePaperNotesState = (value: unknown): PaperNotesState => {
  if (value === undefined || value === null) return { version: 1, days: {}, notes: [], memories: [] };
  if (!validState(value)) {
    throw new Error('小纸条数据格式无效，请先备份数据后检查，未覆盖原有纸条。');
  }
  return value;
};

export const readPaperNotes = (): PaperNotesState => {
  const raw = readStorageString(PAPER_NOTES_KEY);
  return parsePaperNotesState(raw ? JSON.parse(raw) : undefined);
};

export const paperCandidates = (): PaperAuthor[] => {
  const contacts: unknown = JSON.parse(readStorageString(CONTACTS_KEY) ?? '[]');
  const chats: unknown = JSON.parse(readStorageString(CHATS_KEY) ?? '[]');
  if (!Array.isArray(contacts) || !Array.isArray(chats)) throw new Error('通讯录或聊天数据格式无效。');
  const ids = new Set(contacts.filter((item) => record(item) && typeof item.id === 'string' &&
    !item.id.startsWith('npc:')).map((item) => item.id));
  const used = new Set<string>();
  return chats.flatMap((chat): PaperAuthor[] => {
    if (!record(chat) || chat.type !== 'direct' || chat.blocked || typeof chat.id !== 'string' ||
      !Array.isArray(chat.participantIds) || chat.participantIds.length !== 1 ||
      !Array.isArray(chat.messages)) return [];
    const charId: unknown = chat.participantIds[0];
    if (typeof charId !== 'string' || !ids.has(charId) || used.has(charId) ||
      !chat.messages.some((message) => record(message) && message.kind !== 'context-note' &&
        (message.senderId === 'user' || message.senderId === charId))) return [];
    used.add(charId);
    return [{ charId, chatId: chat.id, archiveKey: activeMemoryArchive(charId) }];
  });
};

let serial: Promise<unknown> = Promise.resolve();
const exclusive = <T,>(task: () => Promise<T>): Promise<T> => {
  const run = () => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(PAPER_NOTES_KEY, task)
    : task();
  const result = serial.then(run, run);
  // Return the original rejection to the caller without poisoning the next operation.
  serial = result.catch(() => undefined);
  return result;
};
const freshState = async () => {
  await Promise.all([CHATS_KEY, CONTACTS_KEY].map((key) => getStorageItem(key, { fresh: true })));
  return parsePaperNotesState(await getStorageItem(PAPER_NOTES_KEY, { fresh: true }));
};
const eligible = (selected: PaperAuthor) => {
  if (!paperCandidates().some((candidate) => candidate.charId === selected.charId && candidate.chatId === selected.chatId)) {
    throw new Error('写纸条的角色已不可用，请检查私聊是否被删除或拉黑。');
  }
  if (activeMemoryArchive(selected.charId) !== selected.archiveKey) {
    throw new Error('聊天存档已变化，这张纸条不能在其他存档中继续生成或传递。');
  }
};
const validateContent = (value: PaperContent) => {
  if (!['question', 'thought', 'unsaid'].includes(value.kind) || !value.content.trim() || value.content.length > 2000) {
    throw new Error('纸条内容格式无效，请重试。');
  }
};

export const openDailyPaper = (
  generate: (selected: PaperAuthor, date: string) => Promise<PaperContent>,
  options: { now?: () => Date; random?: () => number } = {}
): Promise<PaperNote | undefined> => exclusive(async () => {
  const now = options.now ?? (() => new Date());
  const date = localDateString(now());
  let state = await freshState();
  let selected = state.days[date];
  if (selected?.noteId) return state.notes.find((item) => item.id === selected.noteId);
  if (!selected) {
    const candidates = paperCandidates();
    if (!candidates.length) throw new Error('还没有可以写纸条的角色，先去微信和角色聊聊天吧。');
    const index = Math.min(candidates.length - 1, Math.max(0, Math.floor((options.random ?? Math.random)() * candidates.length)));
    selected = candidates[index];
    state = { ...state, days: { ...state.days, [date]: selected } };
    await setStorageItem(PAPER_NOTES_KEY, state);
  }
  eligible(selected);
  const assertArchive = guardMemoryArchive(selected.charId);
  const content = await generate(selected, date);
  validateContent(content);
  state = await freshState();
  assertArchive();
  eligible(selected);
  if (date !== localDateString(now())) throw new Error('已过零点，请打开今天的小纸条。');
  if (state.days[date]?.noteId) return state.notes.find((item) => item.id === state.days[date].noteId);
  const paper: PaperNote = { ...selected, ...content, id: `paper-${date}`, date };
  await setStorageItem(PAPER_NOTES_KEY, {
    ...state, days: { ...state.days, [date]: { ...selected, noteId: paper.id } },
    notes: [...state.notes, paper], memories: [...state.memories, paper],
  } satisfies PaperNotesState);
  return paper;
});

export const answerPaper = (
  id: string, input: string,
  generate: (paper: PaperNote) => Promise<string>,
  now: () => Date = () => new Date()
): Promise<PaperNote> => exclusive(async () => {
  let state = await freshState();
  let paper = state.notes.find((item) => item.id === id);
  if (!paper) throw new Error('纸条已不存在。');
  if (paper.kind !== 'question') throw new Error('只有提问纸条可以传回。');
  if (paper.reply !== undefined) throw new Error('这张纸条已经完成一次往返，不能再传递。');
  if (paper.date !== localDateString(now())) throw new Error('这张纸条已过期，只能在收到当天回答。');
  if (!state.memories.some((item) => item.id === id)) throw new Error('这张纸条关联的角色记忆已被清除，不能继续传递。');
  eligible(paper);
  const answer = paper.answer ?? input.trim();
  if (!answer || answer.length > 2000) throw new Error('请输入回答，最多 2000 字。');
  const assertArchive = guardMemoryArchive(paper.charId);
  if (paper.answer === undefined) {
    paper = { ...paper, answer };
    const sent = paper;
    state = { ...state, notes: state.notes.map((item) => item.id === id ? sent : item),
      memories: state.memories.map((item) => item.id === id ? sent : item) };
    await setStorageItem(PAPER_NOTES_KEY, state);
  }
  const reply = (await generate(paper)).trim();
  if (!reply || reply.length > 2000) throw new Error('纸条回复为空或过长，请重试。');
  state = await freshState();
  assertArchive();
  eligible(paper);
  if (!state.notes.some((item) => item.id === id)) throw new Error('纸条已被删除，未保存回复。');
  const finished = { ...paper, reply };
  await setStorageItem(PAPER_NOTES_KEY, { ...state,
    notes: state.notes.map((item) => item.id === id ? finished : item),
    memories: state.memories.map((item) => item.id === id ? finished : item),
  } satisfies PaperNotesState);
  return finished;
});

export const discardPaper = (id: string): Promise<void> => exclusive(async () => {
  const state = await freshState();
  await setStorageItem(PAPER_NOTES_KEY, { ...state, notes: state.notes.filter((item) => item.id !== id) });
});

export const forgetPaperMemories = (scope: { archiveKey?: string; charId?: string }) => {
  const state = readPaperNotes();
  const matches = (item: PaperAuthor) => scope.charId ? item.charId === scope.charId : item.archiveKey === scope.archiveKey;
  if (!state.memories.some(matches) && !Object.values(state.days).some(matches)) return;
  writeStoredValue(PAPER_NOTES_KEY, { ...state,
    memories: state.memories.filter((item) => !matches(item)),
    days: Object.fromEntries(Object.entries(state.days).map(([date, day]) =>
      [date, matches(day) && !day.noteId ? { ...day, noteId: 'expired' } : day])),
  } satisfies PaperNotesState);
};

export const buildPaperMemoryInjection = (charIds: string[], chatType: string): string => {
  if (chatType !== 'direct' || charIds.length !== 1) return '';
  const memories = readPaperNotes().memories.filter((item) =>
    item.charId === charIds[0] && item.archiveKey === activeMemoryArchive(item.charId)).slice(-20);
  if (!memories.length) return '';
  return [
    '【你私下写过的匿名小纸条】',
    '这些是你自己的私密经历，不是聊天消息。玩家不知道作者是谁；通常不要在聊天里提起、认领或暗示作者身份，不主动复述纸条。其他角色不知道这些事。只有玩家明确谈起时才结合人设自然回应，不因这些记录主动发起新的纸条或私信。',
    ...memories.map((item) => JSON.stringify({ date: item.date, writtenByYou: item.content, playerAnswer: item.answer, yourReply: item.reply })),
  ].join('\n');
};
