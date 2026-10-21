import { requestConfiguredAiText } from './aiApi';
import { readDirectMessages } from './journalData';
import { readOfflineContacts } from './offlineData';
import { guardMemoryArchive } from './memoryArchives';
import { getWorldBookEntriesForContacts } from './worldBookPrompt';
import { readStoredValue } from './localStorage';
import { getChatRelationContexts } from './chatContext';
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

export const requestMemoryAiText: typeof requestConfiguredAiText = (system, user, options = {}) => {
  const settings = readMemorySettings();
  return requestConfiguredAiText(system, user, {
    ...options,
    ...(settings.useSecondaryApi ? { api: settings.secondaryApi } : {}),
  });
};

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

const readActiveUserPersona = () => {
  const parsed = readStoredValue('pocketos:personas', null, isRecord);
  if (!parsed || !Array.isArray(parsed.profiles) || typeof parsed.activeProfileId !== 'string') return '';
  const persona = parsed.profiles.find((item) =>
    isRecord(item) && item.id === parsed.activeProfileId);
  if (!isRecord(persona)) return '';
  return [
    `名称：${typeof persona.name === 'string' ? persona.name : ''}`,
    typeof persona.identity === 'string' && persona.identity ? `身份：${persona.identity}` : '',
    typeof persona.personality === 'string' && persona.personality ? `个性：${persona.personality}` : '',
    typeof persona.background === 'string' && persona.background ? `背景：${persona.background}` : '',
    typeof persona.speakingStyle === 'string' && persona.speakingStyle ? `说话风格：${persona.speakingStyle}` : '',
  ].filter(Boolean).join('\n');
};

export interface ExtractionResult {
  candidates: MemoryCandidate[];
  /** 处理到的最后一条消息时间；确认写入后才推进游标 */
  newCursor: string;
  messageCount: number;
}

/** 读取该角色上次整理之后的新聊天，让 AI 提炼值得长期记住的条目。 */
export const extractMemoryCandidates = async (charId: string): Promise<ExtractionResult> => {
  const assertArchive = guardMemoryArchive(charId);
  const settings = readMemorySettings();
  const contact = readOfflineContacts().find((c) => c.id === charId);
  const charName = contact?.name ?? '角色';
  const userName = readUserName();
  const userPersona = readActiveUserPersona();
  const worldBooks = getWorldBookEntriesForContacts([charId]);
  const relationContexts = getChatRelationContexts([charId]);
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
    `玩家「${userName}」当前人设：${userPersona || '（无）'}`,
    worldBooks.length
      ? `相关世界书（用于理解设定和核对事实，不要复述无关内容）：\n${worldBooks.join('\n\n')}`
      : '',
    relationContexts.length
      ? `对话设置中的关系补充（用于理解双方关系和聊天背景，不要把未在聊天中发生的内容写成事件）：\n${relationContexts.join('\n\n')}`
      : '',
    `只提炼长期有价值的内容：玩家的喜好与习惯、经历与背景、重要的人和事、承诺与约定、重要日期、关系和情绪上的里程碑、${charName}自己做出的承诺。忽略寒暄、一次性闲聊、无信息量的玩笑、以及已有记忆里已经存在的内容。`,
    '若【记录】包含群聊转私信背景，保留来源群名及相关成员身份；群里的话仍属于原发言者，不要改写成玩家与你在私聊中说过的话或约定，不推断其他群成员知道私信内容。',
    `写法：精简、去冗余，不重复上下文或世界书；本次所有记忆正文合计不得超过 500 个汉字/字符，最多 8 条，每条只保留一个关键事实。用“玩家”指代${userName}，用“我”指代${charName}；客观陈述事实，不要评价、铺垫或升华。只记录聊天中明确发生或表达的事实；人设和世界书只作消歧与事实背景，不得把未在聊天中出现的设定凭空总结成事件。分类 category 只能是：${MEMORY_CATEGORIES.map((c) => `${c.id}（${c.label}：${c.hint}）`).join('；')}。importance 为 1~5（5=关系基石或重大事件，3=一般，1=琐碎）。pinned 只给身份、底线、重大承诺这类必须一直记得的内容，绝大多数为 false。没有值得记的就返回空数组。`,
    '只返回 JSON：{"memories":[{"content":"…","category":"fact","importance":3,"pinned":false}]}',
  ].join('\n');
  const user = [
    existing ? `【已有记忆（不要重复）】\n${existing}` : '',
    `【新的聊天记录】\n${batch.map((m) => m.line).join('\n')}`,
  ].filter(Boolean).join('\n\n');

  const text = await requestMemoryAiText(system, user, { json: true, temperature: 0.3 });
  assertArchive();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
  } catch {
    throw new Error('AI 返回的记忆整理结果不是有效的 JSON，请重试。');
  }
  const list = isRecord(parsed) && Array.isArray(parsed.memories) ? parsed.memories : [];
  let totalContentLength = 0;
  const candidates: MemoryCandidate[] = [];
  for (const raw of list) {
    if (candidates.length >= 8 || totalContentLength >= 500) break;
    if (!isRecord(raw) || typeof raw.content !== 'string' || !raw.content.trim()) continue;
    const content = Array.from(raw.content.trim()).slice(0, 300).join('');
    const contentLength = Array.from(content).length;
    if (totalContentLength + contentLength > 500) continue;
    const importance = Number(raw.importance);
    candidates.push({
      content,
      category: isMemoryCategory(raw.category) ? raw.category : 'fact',
      importance: Number.isFinite(importance) ? Math.min(5, Math.max(1, Math.round(importance))) : 3,
      pinned: raw.pinned === true,
    });
    totalContentLength += contentLength;
  }
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
  const assertArchive = guardMemoryArchive(charId);
  try {
    const result = await extractMemoryCandidates(charId);
    assertArchive();
    if (result.candidates.length > 0) {
      await addMemoryCandidates(charId, result.candidates, 'chat', readMemorySettings());
    }
    assertArchive();
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
