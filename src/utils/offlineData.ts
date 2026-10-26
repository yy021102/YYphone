import { readStorageString, readStoredValue, writeStoredValue } from './localStorage';
import { readSetting, SETTINGS_KEYS } from './settings';
import { WORLD_BOOKS_STORAGE_KEY } from './worldBookPrompt';
import { removeContextNote, upsertContextNote } from './chatNotes';

export const OFFLINE_STORIES_KEY = 'yyphone:offline-stories';
export const OFFLINE_PRESETS_KEY = 'yyphone:offline-presets';
export const OFFLINE_MEMORIES_KEY = 'yyphone:offline-memories';

export interface OfflinePresetEntry {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
}

export interface OfflinePreset {
  id: string;
  name: string;
  entries: OfflinePresetEntry[];
  targetWords: number;
  temperature: number;
}

export interface OfflineMessage {
  id: string;
  role: 'user' | 'ai';
  /** AI 消息可以有多个版本（swipe）；用户消息只有一个。 */
  versions: string[];
  versionIndex: number;
  createdAt: string;
  choices?: string[];
}

export interface OfflineStory {
  id: string;
  title: string;
  characterIds: string[];
  personaId: string;
  worldBookIds: string[];
  presetId: string;
  /** 带入微信最近聊天的条数，0 为不带入 */
  wechatContextCount: number;
  autoChoices: boolean;
  /** 每次生成时带入的最近剧情条数 */
  contextMessages: number;
  ended: boolean;
  messages: OfflineMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface OfflineMemory {
  id: string;
  storyId: string;
  storyTitle: string;
  characterIds: string[];
  summary: string;
  createdAt: string;
}

export interface OfflineContact {
  id: string;
  name: string;
  persona: string;
  avatarUrl: string;
}

export interface OfflineWorldBookInfo {
  id: string;
  name: string;
  isGlobal: boolean;
  entryCount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const newOfflineId = uid;

// ==================== 预设 ====================
const entry = (title: string, content: string, enabled = true): OfflinePresetEntry => ({
  id: uid('pe'),
  title,
  content,
  enabled,
});

export const createDefaultPresets = (): OfflinePreset[] => [
  {
    id: 'preset-immersive',
    name: '沉浸长篇（默认）',
    targetWords: 800,
    temperature: 0.9,
    entries: [
      entry('文风', '使用细腻、有画面感的中文小说文风：把环境、光线、气味、动作、神态与对白自然交织，节奏舒缓，细节扎实，用外在表现传达情绪，不单独写角色心声，避免流水账式的概括。'),
      entry('叙事视角', '采用第三人称限知视角，以玩家所在的场景为中心推进；多角色同场时，通过各自的动作与对白区分，不要写成统一口吻。'),
      entry('不替玩家行动', '绝对不要替玩家角色说话、做决定、描写其内心活动或动作；只写世界、环境与其他角色对玩家行为的反应，把选择权留给玩家。'),
      entry('角色一致', '严格遵守角色设定：说话方式、口头禅、价值观、情绪反应都要符合人设与当前关系；角色有自己的立场、小脾气和生活，不是只围着玩家转的工具人。'),
      entry('避免套话', '不要以总结、升华、点题、“未完待续”式的话收尾；不要反复使用相同的句式和比喻；不要复述玩家刚刚说过的话；剧情停在一个自然、可以继续接话的位置。'),
      entry('剧情推进', '每次生成都要让场景有一点实质性的变化（新的信息、小冲突、情绪变化或环境变化），不要原地踏步，也不要一口气跳过太多时间。', true),
    ],
  },
  {
    id: 'preset-daily',
    name: '轻松日常',
    targetWords: 400,
    temperature: 0.95,
    entries: [
      entry('文风', '语言轻松自然、带一点幽默与生活气息，像在读一篇治愈系日常小说，对话占比较高，少用晦涩的修辞。'),
      entry('叙事视角', '采用第三人称视角，叙述简洁，让对话和小动作推动场景。'),
      entry('不替玩家行动', '不要替玩家角色说话或做决定，只写其他角色和环境的反应。'),
      entry('避免套话', '不要总结升华，不要“未完待续”式收尾，停在自然可以接话的位置。'),
    ],
  },
  {
    id: 'preset-literary',
    name: '文艺细腻',
    targetWords: 1200,
    temperature: 0.85,
    entries: [
      entry('文风', '文艺、克制、留白的文学化叙事：重视意象、通感与情绪的暗流，用环境与细节烘托情感，少直白抒情，多用动作和沉默表达。'),
      entry('叙事视角', '采用第二人称“你”指代玩家角色，第三人称叙述其他角色，沉浸感强。'),
      entry('不替玩家行动', '不替“你”做决定，不写“你”的具体台词，只写“你”感知到的世界与他人的反应。'),
      entry('避免套话', '不要总结升华，不要说教；不要堆砌华丽辞藻，保持真实、克制。'),
    ],
  },
];

const isPresetList = (value: unknown): value is OfflinePreset[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      Array.isArray(item.entries) &&
      typeof item.targetWords === 'number'
  );

export const readOfflinePresets = (): OfflinePreset[] => {
  const stored = readStoredValue(OFFLINE_PRESETS_KEY, [] as OfflinePreset[], isPresetList);
  if (stored.length > 0) return stored;
  const defaults = createDefaultPresets();
  writeStoredValue(OFFLINE_PRESETS_KEY, defaults);
  return defaults;
};

export const writeOfflinePresets = (presets: OfflinePreset[]) => writeStoredValue(OFFLINE_PRESETS_KEY, presets);

/** 导入时校验并补全一个预设，失败返回 null。 */
export const normalizePreset = (value: unknown): OfflinePreset | null => {
  if (!isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.entries)) return null;
  const entries = value.entries.flatMap((item): OfflinePresetEntry[] =>
    isRecord(item) && typeof item.title === 'string' && typeof item.content === 'string'
      ? [{ id: uid('pe'), title: item.title.slice(0, 40), content: item.content, enabled: item.enabled !== false }]
      : []
  );
  const words = Number(value.targetWords);
  const temperature = Number(value.temperature);
  return {
    id: uid('preset'),
    name: value.name.slice(0, 30) || '导入的预设',
    entries,
    targetWords: Number.isFinite(words) && words > 0 ? Math.min(6000, Math.round(words)) : 800,
    temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : 0.9,
  };
};

// ==================== 故事 ====================
const isStoryList = (value: unknown): value is OfflineStory[] =>
  Array.isArray(value) &&
  value.every((item) => isRecord(item) && typeof item.id === 'string' && Array.isArray(item.messages));

export const readOfflineStories = (): OfflineStory[] =>
  readStoredValue(OFFLINE_STORIES_KEY, [] as OfflineStory[], isStoryList);

export const writeOfflineStories = (stories: OfflineStory[]) => writeStoredValue(OFFLINE_STORIES_KEY, stories);

export const normalizeStory = (value: unknown): OfflineStory | null => {
  if (!isRecord(value) || !Array.isArray(value.messages) || !Array.isArray(value.characterIds)) return null;
  const messages = value.messages.flatMap((item): OfflineMessage[] => {
    if (!isRecord(item) || !Array.isArray(item.versions)) return [];
    const versions = item.versions.filter((v): v is string => typeof v === 'string');
    if (versions.length === 0) return [];
    const index = Number(item.versionIndex);
    return [{
      id: uid('om'),
      role: item.role === 'user' ? 'user' : 'ai',
      versions,
      versionIndex: Number.isInteger(index) && index >= 0 && index < versions.length ? index : 0,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }];
  });
  const now = new Date().toISOString();
  return {
    id: uid('story'),
    title: typeof value.title === 'string' && value.title ? value.title.slice(0, 40) : '导入的故事',
    characterIds: value.characterIds.filter((id): id is string => typeof id === 'string'),
    personaId: typeof value.personaId === 'string' ? value.personaId : '',
    worldBookIds: Array.isArray(value.worldBookIds) ? value.worldBookIds.filter((id): id is string => typeof id === 'string') : [],
    presetId: typeof value.presetId === 'string' ? value.presetId : '',
    wechatContextCount: Number.isFinite(Number(value.wechatContextCount)) ? Math.max(0, Math.min(200, Number(value.wechatContextCount))) : 20,
    autoChoices: value.autoChoices === true,
    contextMessages: Number.isFinite(Number(value.contextMessages)) ? Math.max(4, Math.min(100, Number(value.contextMessages))) : 30,
    ended: false,
    messages,
    createdAt: now,
    updatedAt: now,
  };
};

export const currentVersionText = (message: OfflineMessage) => message.versions[message.versionIndex] ?? '';

// ==================== 外部数据：角色 / 玩家身份 / 世界书 ====================
export const readOfflineContacts = (): OfflineContact[] => {
  try {
    const parsed: unknown = JSON.parse(readStorageString('pocketos:wechat-contacts') ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): OfflineContact[] =>
      isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string'
        ? [{
            id: item.id,
            name: item.name,
            persona: typeof item.persona === 'string' ? item.persona : '',
            avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : '',
          }]
        : []
    );
  } catch {
    return [];
  }
};

export interface OfflinePersona {
  id: string;
  name: string;
  text: string;
}

export const readOfflinePersonas = (): { profiles: OfflinePersona[]; activeId: string } => {
  const value = readSetting<unknown>(SETTINGS_KEYS.personas, null, (_v): _v is unknown => true);
  if (!isRecord(value) || !Array.isArray(value.profiles)) return { profiles: [], activeId: '' };
  const profiles = value.profiles.flatMap((p): OfflinePersona[] => {
    if (!isRecord(p) || typeof p.id !== 'string' || typeof p.name !== 'string') return [];
    const text = [
      `名称：${p.name}`,
      typeof p.identity === 'string' && p.identity && `身份：${p.identity}`,
      typeof p.personality === 'string' && p.personality && `个性：${p.personality}`,
      typeof p.background === 'string' && p.background && `背景：${p.background}`,
      typeof p.speakingStyle === 'string' && p.speakingStyle && `说话风格：${p.speakingStyle}`,
    ].filter(Boolean).join('\n');
    return [{ id: p.id, name: p.name, text }];
  });
  return { profiles, activeId: typeof value.activeProfileId === 'string' ? value.activeProfileId : profiles[0]?.id ?? '' };
};

interface RawWorldBook {
  id: string;
  name: string;
  isGlobal: boolean;
  entries: Array<{ title: string; content: string; depth: string }>;
}

const readRawWorldBooks = (): RawWorldBook[] => {
  try {
    const parsed: unknown = JSON.parse(readStorageString(WORLD_BOOKS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((book): RawWorldBook[] => {
      if (!isRecord(book) || typeof book.id !== 'string' || typeof book.name !== 'string' || !Array.isArray(book.entries)) return [];
      return [{
        id: book.id,
        name: book.name,
        isGlobal: book.isGlobal === true,
        entries: book.entries.flatMap((e) =>
          isRecord(e) && typeof e.title === 'string' && typeof e.content === 'string'
            ? [{ title: e.title, content: e.content, depth: typeof e.depth === 'string' ? e.depth : 'middle' }]
            : []
        ),
      }];
    });
  } catch {
    return [];
  }
};

export const readOfflineWorldBooks = (): OfflineWorldBookInfo[] =>
  readRawWorldBooks().map((book) => ({ id: book.id, name: book.name, isGlobal: book.isGlobal, entryCount: book.entries.length }));

/** 玩家勾选的世界书条目，按深度分组（全局世界书由 requestConfiguredAiText 自动带入，这里不重复）。 */
export const readSelectedWorldBookText = (bookIds: string[]) => {
  const books = readRawWorldBooks().filter((book) => bookIds.includes(book.id) && !book.isGlobal);
  const pick = (depths: string[]) =>
    books
      .flatMap((book) =>
        book.entries
          .filter((e) => depths.includes(e.depth) && e.content.trim())
          .map((e) => `【${book.name} / ${e.title}】\n${e.content}`)
      )
      .join('\n\n');
  return { front: pick(['front']), middle: pick(['middle']), back: pick(['back']) };
};

// ==================== 外观 ====================
export const OFFLINE_STYLE_KEY = 'yyphone:offline-style';

export interface OfflineStyle {
  wallpaperUrl: string;
  aiBubbleColor: string;
  aiBubbleOpacity: number;
  aiTextColor: string;
  userBubbleColor: string;
  userBubbleOpacity: number;
  userTextColor: string;
}

export const DEFAULT_OFFLINE_STYLE: OfflineStyle = {
  wallpaperUrl: '',
  aiBubbleColor: '#ffffff',
  aiBubbleOpacity: 0.75,
  aiTextColor: '#475569',
  userBubbleColor: '#fde2ec',
  userBubbleOpacity: 0.8,
  userTextColor: '#7a5d6a',
};

export const readOfflineStyle = (): OfflineStyle =>
  readStoredValue(
    OFFLINE_STYLE_KEY,
    DEFAULT_OFFLINE_STYLE,
    (value): value is OfflineStyle => isRecord(value) && typeof value.aiBubbleColor === 'string'
  );

export const writeOfflineStyle = (style: OfflineStyle) => writeStoredValue(OFFLINE_STYLE_KEY, style);

// ==================== 线下记忆（写回微信） ====================
const isMemoryList = (value: unknown): value is OfflineMemory[] =>
  Array.isArray(value) &&
  value.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.summary === 'string');

export const readOfflineMemories = (): OfflineMemory[] =>
  readStoredValue(OFFLINE_MEMORIES_KEY, [] as OfflineMemory[], isMemoryList);

const noteIdOf = (storyId: string, charId: string) => `offline-note-${storyId}-${charId}`;

/** 同一个故事只保留一条摘要，重新结束时覆盖；同时把摘要写进每个登场角色的微信单聊上下文。 */
export const saveOfflineMemory = (story: OfflineStory, summary: string) => {
  const others = readOfflineMemories().filter((memory) => memory.storyId !== story.id);
  writeStoredValue(OFFLINE_MEMORIES_KEY, [
    ...others,
    {
      id: uid('om'),
      storyId: story.id,
      storyTitle: story.title,
      characterIds: story.characterIds,
      summary,
      createdAt: new Date().toISOString(),
    },
  ]);
  const known = new Set(readOfflineContacts().map((c) => c.id));
  story.characterIds.filter((id) => known.has(id)).forEach((charId) => {
    upsertContextNote(charId, {
      id: noteIdOf(story.id, charId),
      source: 'offline',
      title: `线下剧情《${story.title}》`,
      content: summary,
      detail: summary,
    });
  });
};

export const deleteOfflineMemory = (storyId: string) => {
  const memory = readOfflineMemories().find((item) => item.storyId === storyId);
  memory?.characterIds.forEach((charId) => removeContextNote(charId, noteIdOf(storyId, charId)));
  writeStoredValue(OFFLINE_MEMORIES_KEY, readOfflineMemories().filter((item) => item.storyId !== storyId));
};

