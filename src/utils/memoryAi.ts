import { requestConfiguredAiText } from './aiApi';
import { readDirectMessages } from './journalData';
import { readOfflineContacts } from './offlineData';
import {
  addMemoryCandidates,
  isMemoryCategory,
  MEMORY_CATEGORIES,
  MemoryCandidate,
  MemorySettings,
  readMemories,
  readMemorySettings,
  SHARED_MEMORY_ID,
  writeMemorySettings,
} from './memoryData';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

interface NewMessage {
  createdAt: string;
  line: string;
}

const MAX_MESSAGES_PER_RUN = 150;

const readNewMessages = (charId: string, cursor: string, charName: string, userName: string): NewMessage[] =>
  readDirectMessages(charId)
    .filter((m) => !cursor || m.createdAt > cursor)
    .map((m) => ({
      createdAt: m.createdAt,
      line: `${m.note ? '【记录】' : `${m.senderId === 'user' ? userName : charName}：`}${m.text.slice(0, 420)}`,
    }));

export const countNewMessages = (charId: string, settings: MemorySettings) =>
  readNewMessages(charId, settings.cursors[charId] ?? '', '', '').length;

const readUserName = () => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('yyphone:wechat-profile') ?? 'null');
    if (isRecord(parsed) && typeof parsed.name === 'string' && parsed.name) return parsed.name;
  } catch {
    // ignore
  }
  return '玩家';
};

export interface ExtractionResult {
  candidates: MemoryCandidate[];
  /** 处理到的最后一条消息时间；确认写入后才推进游标 */
  newCursor: string;
  messageCount: number;
}

/** 读取该角色上次整理之后的新聊天，让 AI 提炼值得长期记住的条目。 */
export const extractMemoryCandidates = async (charId: string): Promise<ExtractionResult> => {
  const settings = readMemorySettings();
  const contact = readOfflineContacts().find((c) => c.id === charId);
  const charName = contact?.name ?? '角色';
  const userName = readUserName();
  const all = readNewMessages(charId, settings.cursors[charId] ?? '', charName, userName);
  if (all.length === 0) return { candidates: [], newCursor: settings.cursors[charId] ?? '', messageCount: 0 };
  const batch = all.slice(0, MAX_MESSAGES_PER_RUN);
  const existing = readMemories()
    .filter((item) => item.charId === charId || item.charId === SHARED_MEMORY_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 40)
    .map((item) => `- ${item.content}`)
    .join('\n');

  const system = [
    `你是角色「${charName}」的记忆整理助手，负责从${charName}与玩家「${userName}」的聊天里，提炼出${charName}值得长期记住的信息。`,
    `角色设定：${contact?.persona || '（无）'}`,
    `只提炼长期有价值的内容：玩家的喜好与习惯、经历与背景、重要的人和事、承诺与约定、重要日期、关系和情绪上的里程碑、${charName}自己做出的承诺。忽略寒暄、一次性闲聊、无信息量的玩笑、以及已有记忆里已经存在的内容。`,
    `写法：每条 15~60 字，一条只讲一件事；用“玩家”指代${userName}，用“我”指代${charName}；客观陈述事实，不要加评价或升华。分类 category 只能是：${MEMORY_CATEGORIES.map((c) => `${c.id}（${c.label}：${c.hint}）`).join('；')}。importance 为 1~5（5=关系基石或重大事件，3=一般，1=琐碎）。pinned 只给身份、底线、重大承诺这类必须一直记得的内容，绝大多数为 false。最多 12 条，没有值得记的就返回空数组。`,
    '只返回 JSON：{"memories":[{"content":"…","category":"fact","importance":3,"pinned":false}]}',
  ].join('\n');
  const user = [
    existing ? `【已有记忆（不要重复）】\n${existing}` : '',
    `【新的聊天记录】\n${batch.map((m) => m.line).join('\n')}`,
  ].filter(Boolean).join('\n\n');

  const text = await requestConfiguredAiText(system, user, { json: true, temperature: 0.3 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
  } catch {
    throw new Error('AI 返回的记忆整理结果不是有效的 JSON，请重试。');
  }
  const list = isRecord(parsed) && Array.isArray(parsed.memories) ? parsed.memories : [];
  const candidates = list.flatMap((raw): MemoryCandidate[] => {
    if (!isRecord(raw) || typeof raw.content !== 'string' || !raw.content.trim()) return [];
    const importance = Number(raw.importance);
    return [{
      content: raw.content.trim().slice(0, 300),
      category: isMemoryCategory(raw.category) ? raw.category : 'fact',
      importance: Number.isFinite(importance) ? Math.min(5, Math.max(1, Math.round(importance))) : 3,
      pinned: raw.pinned === true,
    }];
  }).slice(0, 12);
  return { candidates, newCursor: batch[batch.length - 1].createdAt, messageCount: batch.length };
};

export const advanceMemoryCursor = (charId: string, cursor: string) => {
  const settings = readMemorySettings();
  writeMemorySettings({ ...settings, cursors: { ...settings.cursors, [charId]: cursor } });
};

const running = new Set<string>();

/** 聊天回复保存后调用：新消息累计够多时，在后台整理并直接写入。失败只记录，不打扰聊天。 */
export const maybeAutoExtractMemory = async (participantIds: string[], chatType: string) => {
  if (chatType !== 'direct' || participantIds.length !== 1) return;
  const charId = participantIds[0];
  const settings = readMemorySettings();
  if (!settings.autoExtract || running.has(charId)) return;
  if (countNewMessages(charId, settings) < settings.autoEvery) return;
  running.add(charId);
  try {
    const result = await extractMemoryCandidates(charId);
    if (result.candidates.length > 0) {
      await addMemoryCandidates(charId, result.candidates, 'chat', readMemorySettings());
    }
    if (result.newCursor) advanceMemoryCursor(charId, result.newCursor);
    const latest = readMemorySettings();
    if (latest.lastAutoError) writeMemorySettings({ ...latest, lastAutoError: '' });
  } catch (error) {
    console.error('Auto memory extraction failed.', error);
    const latest = readMemorySettings();
    writeMemorySettings({ ...latest, lastAutoError: error instanceof Error ? error.message : String(error) });
  } finally {
    running.delete(charId);
  }
};
