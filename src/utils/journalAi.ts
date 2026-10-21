import { requestMemoryAiText } from './memoryAi';
import {
  activeGrowthNote,
  COMPRESSION,
  countPendingForJournal,
  DirectMessage,
  entriesOf,
  GrowthNote,
  JournalEntry,
  JournalLevel,
  newJournalId,
  readDirectMessages,
  readGrowthNotes,
  readJournalEntries,
  readJournalSettings,
  unmergedOf,
  writeGrowthNotes,
  writeJournalEntries,
  writeJournalSettings,
} from './journalData';
import { readMemories } from './memoryData';
import { readOfflineContacts } from './offlineData';
import { guardMemoryArchive } from './memoryArchives';
import { replaceJournalRange, selectJournalRange, type JournalRange } from './journalRange';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readUserName = () => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('yyphone:wechat-profile') ?? 'null');
    if (isRecord(parsed) && typeof parsed.name === 'string' && parsed.name) return parsed.name;
  } catch {
    // ignore
  }
  return '玩家';
};

const charInfo = (charId: string) => {
  const contact = readOfflineContacts().find((c) => c.id === charId);
  return { name: contact?.name ?? '角色', persona: contact?.persona ?? '' };
};

const MAX_CHUNK = 250;
const MIN_MANUAL_CHUNK = 10;

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const transcript = (messages: DirectMessage[], charName: string, userName: string) =>
  messages
    .map((m) =>
      `[${stamp(m.createdAt)}] ${m.note ? '【记录】' : `${m.senderId === 'user' ? userName : charName}：`}${m.text.slice(0, 420)}`
    )
    .join('\n');

// ==================== 流水账 ====================
const setError = (message: string) => {
  const settings = readJournalSettings();
  if (settings.lastError !== message) writeJournalSettings({ ...settings, lastError: message });
};

/** 把还没整理的聊天（最多一段）写成一篇流水账。返回新条目，没有可写的返回 null。 */
export const createJournalEntry = async (
  charId: string,
  options: { minMessages: number } = { minMessages: MIN_MANUAL_CHUNK }
): Promise<JournalEntry | null> => {
  const assertArchive = guardMemoryArchive(charId);
  const settings = readJournalSettings();
  const cursor = settings.journalCursors[charId] ?? '';
  const messages = readDirectMessages(charId);
  const pending = messages.filter((m) => !cursor || m.createdAt > cursor);
  if (pending.length < options.minMessages) return null;
  const chunk = pending.slice(0, MAX_CHUNK);
  const original = entriesOf(charId);
  const { name, persona } = charInfo(charId);
  const userName = readUserName();

  const system = [
    `你是角色「${name}」的记忆整理助手。请把${name}与玩家「${userName}」的下面这段微信聊天，整理成一篇给${name}自己回忆用的“流水账”。`,
    `角色设定（仅用于理解语气和立场）：${persona || '（无）'}`,
    '【记录】也可能是群聊转私信背景。涉及这类经历时保留来源群名及相关成员，区分群内发言与后续私信，不把其他成员说的话或约定记到玩家或我身上，也不推断其他成员知道私信内容。',
    `写法：按时间顺序，120~250 字；用“玩家”指代${userName}，用“我”指代${name}；写清楚聊了哪些话题、发生了什么事、双方的情绪和相处氛围、做出的约定或留下的悬念；保留关键细节（人名、地点、数字、日期、专有名词）；客观陈述，不评价、不升华、不写成文学作品。聊天里标为【记录】的内容按各自来源理解，可能是线下剧情摘要、${name}手机内容的记忆或群聊转私信背景等；分享的论坛帖子、番茄钟战绩等卡片也都算发生过的事，一并纳入。只输出这篇流水账正文，不要标题和说明。`,
  ].join('\n');
  const text = await requestMemoryAiText(
    system,
    `【聊天记录（${stamp(chunk[0].createdAt)} 至 ${stamp(chunk[chunk.length - 1].createdAt)}，共 ${chunk.length} 条）】\n${transcript(chunk, name, userName)}`,
    { temperature: 0.4, maxTokens: 900 }
  );
  assertArchive();
  if (JSON.stringify(readDirectMessages(charId).slice(0, messages.length)) !== JSON.stringify(messages) ||
    JSON.stringify(entriesOf(charId)) !== JSON.stringify(original) ||
    (readJournalSettings().journalCursors[charId] ?? '') !== cursor) {
    throw new Error('生成期间聊天或流水账已变化，未保存旧摘要，请重试。');
  }
  const entry: JournalEntry = {
    id: newJournalId(),
    charId,
    level: 1,
    from: chunk[0].createdAt,
    to: chunk[chunk.length - 1].createdAt,
    fromMessageId: chunk[0].id,
    toMessageId: chunk[chunk.length - 1].id,
    messageCount: chunk.length,
    content: text.trim(),
    createdAt: new Date().toISOString(),
    source: options.minMessages >= readJournalSettings().journalEvery ? 'auto' : 'manual',
  };
  writeJournalEntries([
    ...readJournalEntries().filter((item) => item.charId !== charId),
    ...replaceJournalRange(original, entry.from, entry.to, [entry], {
      messages, range: { start: messages.indexOf(chunk[0]) + 1, end: messages.indexOf(chunk[chunk.length - 1]) + 1 },
    }),
  ]);
  const latest = readJournalSettings();
  writeJournalSettings({
    ...latest,
    lastError: '',
    journalCursors: { ...latest.journalCursors, [charId]: entry.to },
  });
  return entry;
};

const mergeEntries = async (charId: string, entries: JournalEntry[], target: JournalLevel): Promise<JournalEntry> => {
  const { name, persona } = charInfo(charId);
  const userName = readUserName();
  const limit = target === 2 ? '150~250 字' : '200~320 字';
  const system = [
    `你是角色「${name}」的记忆整理助手。下面是${name}按时间顺序对与玩家「${userName}」相处经历写下的多篇记录，请把它们压缩合并成一篇更概括的“${target === 2 ? '阶段回顾' : '长篇回顾'}”。`,
    `角色设定（仅用于理解立场）：${persona || '（无）'}`,
    `要求：${limit}；按时间顺序保留脉络、重要事件、关系和情绪上的变化、仍然有效的约定与悬念；舍弃琐碎重复的细节，但保留关键的人名、地点、数字、日期；用“玩家”指代${userName}，用“我”指代${name}；客观陈述，不评价、不升华。只输出合并后的正文。`,
    '涉及群聊转私信的事件，压缩时仍保留原有的来源群名及相关成员，不能把群内发言改写为私聊，也不能合并不同人的发言、关系或承诺。',
  ].join('\n');
  const text = await requestMemoryAiText(
    system,
    entries.map((e, i) => `【第 ${i + 1} 篇（${stamp(e.from)} 至 ${stamp(e.to)}）】\n${e.content}`).join('\n\n'),
    { temperature: 0.3, maxTokens: 900 }
  );
  return {
    id: newJournalId(),
    charId,
    level: target,
    from: entries[0].from,
    to: entries[entries.length - 1].to,
    fromMessageId: entries[0].fromMessageId,
    toMessageId: entries[entries.length - 1].toMessageId,
    messageCount: entries.reduce((sum, e) => sum + e.messageCount, 0),
    content: text.trim(),
    createdAt: new Date().toISOString(),
    source: 'merge',
  };
};

/** 某一层未合并的篇数超过上限时，把最早的几篇合并成上一层的一篇，逐层向上。 */
export const compressJournal = async (charId: string): Promise<number> => {
  const assertArchive = guardMemoryArchive(charId);
  let merges = 0;
  for (let guard = 0; guard < 6; guard += 1) {
    let acted = false;
    for (const level of [1, 2, 3] as const) {
      const { cap, mergeCount } = COMPRESSION[level];
      const unmerged = unmergedOf(charId, level);
      if (unmerged.length <= cap) continue;
      const group = unmerged.slice(0, mergeCount);
      const target: JournalLevel = level === 1 ? 2 : 3;
      const merged = await mergeEntries(charId, group, target);
      assertArchive();
      const ids = new Set(group.map((e) => e.id));
      writeJournalEntries([
        ...readJournalEntries().map((e) => (ids.has(e.id) ? { ...e, mergedInto: merged.id } : e)),
        merged,
      ]);
      merges += 1;
      acted = true;
      break;
    }
    if (!acted) break;
  }
  return merges;
};

const journalRunning = new Set<string>();
const lastAutoAttempt = new Map<string, number>();
const COOLDOWN_MS = 10 * 60 * 1000;

/** 自动任务失败后冷却一段时间，避免每次回复都重试、反复消耗请求。 */
const coolingDown = (key: string) => Date.now() - (lastAutoAttempt.get(key) ?? 0) < COOLDOWN_MS;

export const regenerateJournal = async (charId: string, range?: JournalRange) => {
  if (journalRunning.has(charId)) throw new Error('这个角色的流水账正在整理，请稍后再试。');
  const assertArchive = guardMemoryArchive(charId);
  const messages = readDirectMessages(charId, { fullText: true });
  const selected = selectJournalRange(messages, range);
  const original = entriesOf(charId);
  const originalCursor = readJournalSettings().journalCursors[charId];
  const { name, persona } = charInfo(charId);
  const generated: JournalEntry[] = [];
  journalRunning.add(charId);
  try {
    for (let index = 0; index < selected.length; index += MAX_CHUNK) {
      const chunk = selected.slice(index, index + MAX_CHUNK);
      const content = (await requestMemoryAiText(
        `你是${name}的记忆整理助手。人设：${persona}。按时间顺序把以下聊天整理成120~250字流水账，用“我”指代${name}，“玩家”指代${readUserName()}。保留人物、事件、情绪、约定、关键数字和未完话题，不杜撰。背景记录及群聊转私信须保留群名、成员、发言归属与来源，不混淆为私聊。只输出正文。`,
        transcript(chunk, name, readUserName()), { temperature: 0.4, maxTokens: 1200 }
      )).trim();
      if (!content || content.length > 4000) throw new Error('流水账正文为空或过长，未保存本次重做。');
      assertArchive();
      generated.push({ id: newJournalId(), charId, level: 1, from: chunk[0].createdAt,
        to: chunk[chunk.length - 1].createdAt, messageCount: chunk.length,
        fromMessageId: chunk[0].id, toMessageId: chunk[chunk.length - 1].id,
        content, createdAt: new Date().toISOString(), source: 'manual' });
    }
    if (JSON.stringify(readDirectMessages(charId, { fullText: true }).slice(0, messages.length)) !== JSON.stringify(messages) ||
      JSON.stringify(entriesOf(charId)) !== JSON.stringify(original) ||
      readJournalSettings().journalCursors[charId] !== originalCursor) {
      throw new Error('生成期间聊天或流水账已变化，未覆盖现有数据，请重试。');
    }
    assertArchive();
    const from = selected[0].createdAt;
    const to = selected[selected.length - 1].createdAt;
    const others = readJournalEntries().filter((entry) => entry.charId !== charId);
    writeJournalEntries([...others, ...replaceJournalRange(original, from, to, generated,
      { messages, range: range ?? { start: 1, end: messages.length } })]);
    const settings = readJournalSettings();
    const start = range?.start ?? 1;
    const cursorIndex = originalCursor ? messages.reduce((last, message, index) =>
      message.createdAt <= originalCursor ? index : last, -1) : -1;
    writeJournalSettings({ ...settings, lastError: '', journalCursors: {
      ...settings.journalCursors,
      ...(start <= cursorIndex + 2 ? { [charId]: originalCursor && originalCursor > to ? originalCursor : to } : {}),
    } });
    return generated.length;
  } finally {
    journalRunning.delete(charId);
  }
};

/** 手动整理：连续整理最多 maxChunks 段待整理的聊天，再压缩。 */
export const runJournal = async (charId: string, maxChunks = 6): Promise<{ created: number; merged: number }> => {
  if (journalRunning.has(charId)) throw new Error('这个角色的流水账正在整理，请稍后再试。');
  const assertArchive = guardMemoryArchive(charId);
  journalRunning.add(charId);
  try {
    let created = 0;
    for (let i = 0; i < maxChunks; i += 1) {
      const entry = await createJournalEntry(charId);
      assertArchive();
      if (!entry) break;
      created += 1;
    }
    const merged = await compressJournal(charId);
    assertArchive();
    return { created, merged };
  } finally {
    journalRunning.delete(charId);
  }
};

/** 聊天回复保存后调用：新消息累计够多时在后台写一篇流水账并压缩。失败只记录。 */
export const maybeAutoJournal = async (participantIds: string[], chatType: string) => {
  if (chatType !== 'direct' || participantIds.length !== 1) return;
  const charId = participantIds[0];
  const settings = readJournalSettings();
  if (!settings.journalAuto || journalRunning.has(charId)) return;
  if (countPendingForJournal(charId, settings) < settings.journalEvery) return;
  if (coolingDown(`journal:${charId}`)) return;
  journalRunning.add(charId);
  const assertArchive = guardMemoryArchive(charId);
  try {
    await createJournalEntry(charId, { minMessages: settings.journalEvery });
    assertArchive();
    await compressJournal(charId);
  } catch (error) {
    lastAutoAttempt.set(`journal:${charId}`, Date.now());
    console.error('Auto journal failed.', error);
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    journalRunning.delete(charId);
  }
};

export const updateJournalEntryContent = (id: string, content: string) => {
  if (!content.trim() || content.trim().length > 4000) throw new Error('流水账正文不能为空或超过4000字。');
  const entries = readJournalEntries();
  if (!entries.some((entry) => entry.id === id)) throw new Error('流水账已不存在，无法保存。');
  writeJournalEntries(entries.map((entry) => entry.id === id ? { ...entry, content: content.trim() } : entry));
};

// ==================== 角色成长笔记 ====================
export const growthStatus = (charId: string) => {
  const settings = readJournalSettings();
  const notes = readGrowthNotes().filter((n) => n.charId === charId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = notes[notes.length - 1];
  const messages = readDirectMessages(charId);
  const since = last?.basedOnUntil ?? '';
  const newMessages = messages.filter((m) => !since || m.createdAt > since).length;
  const baseline = Date.parse(last?.createdAt ?? messages[0]?.createdAt ?? '') || Date.now();
  const days = Math.floor((Date.now() - baseline) / (24 * 3600 * 1000));
  const hasPending = notes.some((n) => n.status === 'pending');
  return {
    days,
    newMessages,
    hasPending,
    due: !hasPending && days >= settings.growthIntervalDays && newMessages >= 80,
  };
};

const cleanField = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** 生成一份新的成长笔记：按设置直接生效，或先作为待确认。 */
export const generateGrowthNote = async (charId: string): Promise<GrowthNote> => {
  const assertArchive = guardMemoryArchive(charId);
  const settings = readJournalSettings();
  const { name, persona } = charInfo(charId);
  const userName = readUserName();
  const previous = activeGrowthNote(charId);
  const messages = readDirectMessages(charId);
  if (messages.length < 20) throw new Error('聊天还太少，多相处一阵再来整理成长笔记吧。');
  const recent = messages.slice(-60);
  const journal = [3, 2, 1]
    .flatMap((level) => unmergedOf(charId, level as JournalLevel))
    .map((e) => `- ${stamp(e.from)}至${stamp(e.to)}：${e.content}`)
    .join('\n')
    .slice(-2600);
  const anchors = readMemories()
    .filter((m) => m.charId === charId && (m.pinned || m.category === 'core'))
    .slice(0, 12)
    .map((m) => `- ${m.content}`)
    .join('\n');

  const system = [
    `你在帮角色「${name}」回顾自己最近和玩家「${userName}」相处中，发生了哪些幽微的变化。这是“${name}”随着经历自然的成长，不是改写人设。`,
    `【人设（根，不可推翻）】${persona || '（无）'}`,
    previous
      ? `【上一版笔记】\n关系现状：${previous.relationship}\n近来的变化：${previous.changes}\n你们之间的默契：${previous.habits}`
      : '【上一版笔记】（还没有，这是第一份）',
    '写作要求：',
    '1. 变化要幽微、渐进、有事件依据，不是性格大变；也不一定是性格层面——更多是习惯、关注点、说话的小细节、对某类话题的态度、在意玩家的方式，以及你们之间形成的默契、称呼和梗。',
    '2. 人设是根，核心保持不变；相比上一版只调整有依据的一两处，其余自然延续。如果这段时间没什么新变化，就保持原样。',
    '3. 不夸大、不讨好、不写成恋爱剧情总结，不用“成长为”“蜕变”这类宣告式词语。用“我”指角色自己，用“玩家”指代玩家。',
    '4. 字数限制：relationship ≤ 60 字（关系现状），changes ≤ 160 字（近来的变化），habits ≤ 120 字（默契、称呼、梗，没有可留空）。',
    '只返回 JSON：{"relationship":"…","changes":"…","habits":"…"}',
  ].join('\n');
  const user = [
    anchors ? `【重要事实】\n${anchors}` : '',
    journal ? `【相处流水账（由远到近）】\n${journal}` : '',
    `【最近的聊天（${recent.length} 条）】\n${transcript(recent, name, userName)}`,
  ].filter(Boolean).join('\n\n');

  const text = await requestMemoryAiText(system, user, { json: true, temperature: 0.5 });
  assertArchive();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
  } catch {
    throw new Error('AI 返回的成长笔记不是有效的 JSON，请重试。');
  }
  if (!isRecord(parsed)) throw new Error('AI 返回的成长笔记格式不对，请重试。');
  const relationship = cleanField(parsed.relationship, 80);
  const changes = cleanField(parsed.changes, 220);
  const habits = cleanField(parsed.habits, 160);
  if (!relationship && !changes) throw new Error('AI 没有给出有效的成长笔记，请重试。');

  const note: GrowthNote = {
    id: newJournalId('gr'),
    charId,
    relationship,
    changes,
    habits,
    createdAt: new Date().toISOString(),
    status: settings.growthConfirm ? 'pending' : 'active',
    basedOnUntil: messages[messages.length - 1].createdAt,
  };
  const all = readGrowthNotes();
  writeGrowthNotes([
    ...all.map((n) =>
      note.status === 'active' && n.charId === charId && n.status === 'active' ? { ...n, status: 'archived' as const } : n
    ),
    note,
  ]);
  return note;
};

/** 采纳待确认的笔记（可带修改）：它成为当前生效版本，旧版本归档。 */
export const activateGrowthNote = (id: string, edits?: Partial<Pick<GrowthNote, 'relationship' | 'changes' | 'habits'>>) => {
  const all = readGrowthNotes();
  const target = all.find((n) => n.id === id);
  if (!target) return;
  writeGrowthNotes(
    all.map((n) => {
      if (n.id === id) return { ...n, ...edits, status: 'active' as const };
      if (n.charId === target.charId && n.status === 'active') return { ...n, status: 'archived' as const };
      return n;
    })
  );
};

export const archiveGrowthNote = (id: string) =>
  writeGrowthNotes(readGrowthNotes().map((n) => (n.id === id ? { ...n, status: 'archived' as const } : n)));

export const deleteGrowthNote = (id: string) => writeGrowthNotes(readGrowthNotes().filter((n) => n.id !== id));

export const updateActiveGrowthNote = (
  id: string,
  edits: Partial<Pick<GrowthNote, 'relationship' | 'changes' | 'habits'>>
) => writeGrowthNotes(readGrowthNotes().map((n) => (n.id === id ? { ...n, ...edits } : n)));

const growthRunning = new Set<string>();

/** 聊天回复保存后调用：隔得够久、聊得够多时，后台生成一份成长笔记（默认待确认）。 */
export const maybeAutoGrowth = async (participantIds: string[], chatType: string) => {
  if (chatType !== 'direct' || participantIds.length !== 1) return;
  const charId = participantIds[0];
  const settings = readJournalSettings();
  if (!settings.growthAuto || growthRunning.has(charId)) return;
  if (!growthStatus(charId).due) return;
  if (coolingDown(`growth:${charId}`)) return;
  growthRunning.add(charId);
  try {
    await generateGrowthNote(charId);
  } catch (error) {
    lastAutoAttempt.set(`growth:${charId}`, Date.now());
    console.error('Auto growth note failed.', error);
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    growthRunning.delete(charId);
  }
};

export { entriesOf };
