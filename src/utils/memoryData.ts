import { readStorageString, readStoredValue, writeStoredValue } from './localStorage';
import { archiveCursorsForWrite, guardMemoryArchive, readArchiveCursors, readArchiveRecords, writeArchiveRecords } from './memoryArchives';

export const MEMORY_ITEMS_KEY = 'yyphone:memory-items';
export const MEMORY_EMBEDDINGS_KEY = 'yyphone:memory-embeddings';
export const MEMORY_SETTINGS_KEY = 'yyphone:memory-settings';
/** 不属于某个角色、对所有角色都生效的玩家通用记忆 */
export const SHARED_MEMORY_ID = 'shared';

export type MemoryCategory = 'core' | 'fact' | 'preference' | 'promise' | 'date' | 'emotion' | 'event';

export const MEMORY_CATEGORIES: Array<{ id: MemoryCategory; label: string; emoji: string; hint: string }> = [
  { id: 'core', label: '核心', emoji: '💎', hint: '身份、关系基石、底线、重大事件（常驻）' },
  { id: 'fact', label: '事实', emoji: '📌', hint: '关于玩家或自己的事实信息' },
  { id: 'preference', label: '喜好', emoji: '🍵', hint: '喜欢/讨厌、习惯、雷区' },
  { id: 'promise', label: '约定', emoji: '🤝', hint: '承诺、约定、没做完的事' },
  { id: 'date', label: '日子', emoji: '📅', hint: '生日、纪念日、重要日期' },
  { id: 'emotion', label: '心事', emoji: '🫧', hint: '情绪里程碑、心结、被治愈的瞬间' },
  { id: 'event', label: '往事', emoji: '🎞️', hint: '一起经历过的事' },
];

export interface MemoryItem {
  id: string;
  charId: string;
  archiveKey?: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastRecalledAt?: string;
  recallCount: number;
  source: 'chat' | 'manual' | 'import';
}

export interface EmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface MemorySettings {
  embedding: EmbeddingConfig;
  useSecondaryApi: boolean;
  secondaryApi: EmbeddingConfig;
  /** 每轮最多注入的「相关往事」条数 */
  topK: number;
  /** 向量相似度阈值，低于它不算相关 */
  threshold: number;
  autoExtract: boolean;
  /** 自动整理：累计多少条新消息触发一次 */
  autoEvery: number;
  /** 手动整理后先让玩家确认再写入 */
  confirmManual: boolean;
  /** 每个角色上次整理到的消息时间 */
  cursors: Record<string, string>;
  lastAutoError: string;
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  embedding: { endpoint: 'https://api.siliconflow.cn/v1', apiKey: '', model: 'BAAI/bge-m3' },
  useSecondaryApi: false,
  secondaryApi: { endpoint: '', apiKey: '', model: 'gpt-4o-mini' },
  topK: 5,
  threshold: 0.4,
  autoExtract: false,
  autoEvery: 30,
  confirmManual: true,
  cursors: {},
  lastAutoError: '',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const newMemoryId = () => `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const CATEGORY_IDS = MEMORY_CATEGORIES.map((c) => c.id);
export const isMemoryCategory = (value: unknown): value is MemoryCategory =>
  typeof value === 'string' && (CATEGORY_IDS as string[]).includes(value);

// ==================== 存取 ====================
const isMemoryList = (value: unknown): value is MemoryItem[] =>
  Array.isArray(value) &&
  value.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.content === 'string' && typeof item.charId === 'string');

export const readMemories = (): MemoryItem[] => readArchiveRecords(MEMORY_ITEMS_KEY, isMemoryList);
export const writeMemories = (items: MemoryItem[]) => writeArchiveRecords(MEMORY_ITEMS_KEY, items, isMemoryList);

type EmbeddingStore = Record<string, { m: string; v: number[] }>;
export const readEmbeddings = (): EmbeddingStore =>
  readStoredValue(MEMORY_EMBEDDINGS_KEY, {} as EmbeddingStore, (value): value is EmbeddingStore => isRecord(value));
export const writeEmbeddings = (store: EmbeddingStore) => writeStoredValue(MEMORY_EMBEDDINGS_KEY, store);

export const readMemorySettings = (): MemorySettings => {
  const stored = readStoredValue(MEMORY_SETTINGS_KEY, null as unknown, (value): value is unknown => true);
  if (!isRecord(stored)) return DEFAULT_MEMORY_SETTINGS;
  const embedding = isRecord(stored.embedding) ? stored.embedding : {};
  const secondaryApi = isRecord(stored.secondaryApi) ? stored.secondaryApi : {};
  const num = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    useSecondaryApi: stored.useSecondaryApi === true,
    secondaryApi: {
      endpoint: typeof secondaryApi.endpoint === 'string' ? secondaryApi.endpoint : '',
      apiKey: typeof secondaryApi.apiKey === 'string' ? secondaryApi.apiKey : '',
      model: typeof secondaryApi.model === 'string' ? secondaryApi.model : 'gpt-4o-mini',
    },
    embedding: {
      endpoint: typeof embedding.endpoint === 'string' ? embedding.endpoint : DEFAULT_MEMORY_SETTINGS.embedding.endpoint,
      apiKey: typeof embedding.apiKey === 'string' ? embedding.apiKey : '',
      model: typeof embedding.model === 'string' && embedding.model ? embedding.model : DEFAULT_MEMORY_SETTINGS.embedding.model,
    },
    topK: Math.round(num(stored.topK, 5, 1, 15)),
    threshold: num(stored.threshold, 0.4, 0.1, 0.9),
    autoExtract: stored.autoExtract === true,
    autoEvery: Math.round(num(stored.autoEvery, 30, 10, 300)),
    confirmManual: stored.confirmManual !== false,
    cursors: readArchiveCursors(MEMORY_SETTINGS_KEY, 'cursors'),
    lastAutoError: typeof stored.lastAutoError === 'string' ? stored.lastAutoError : '',
  };
};

export const writeMemorySettings = (settings: MemorySettings) => writeStoredValue(MEMORY_SETTINGS_KEY, {
  ...settings, cursors: archiveCursorsForWrite(MEMORY_SETTINGS_KEY, 'cursors', settings.cursors),
});

// ==================== Embedding ====================
export const embeddingConfigured = (config: EmbeddingConfig) =>
  !!config.endpoint.trim() && !!config.apiKey.trim() && !!config.model.trim();

const embeddingsUrl = (endpoint: string) => {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  return /\/embeddings$/i.test(trimmed) ? trimmed : `${trimmed}/embeddings`;
};

/** 返回与 texts 等长的向量数组；失败抛错。 */
export const embedTexts = async (texts: string[], config: EmbeddingConfig, signal?: AbortSignal): Promise<number[][]> => {
  if (texts.length === 0) return [];
  const result: number[][] = [];
  for (let start = 0; start < texts.length; start += 16) {
    const batch = texts.slice(start, start + 16);
    const response = await fetch(embeddingsUrl(config.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` },
      body: JSON.stringify({ model: config.model.trim(), input: batch }),
      signal,
    });
    if (!response.ok) throw new Error(`向量化请求失败（HTTP ${response.status}）：${(await response.text()).slice(0, 300)}`);
    const payload: unknown = await response.json();
    const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
    const sorted = data
      .filter((item): item is Record<string, unknown> => isRecord(item) && Array.isArray(item.embedding))
      .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
    if (sorted.length !== batch.length) throw new Error('向量化接口返回的数量和请求不一致，请检查模型名称。');
    sorted.forEach((item) => result.push((item.embedding as number[]).map((n) => Math.round(n * 10000) / 10000)));
  }
  return result;
};

export const cosine = (a: number[], b: number[]) => {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

/** 给还没有（或模型已变更）向量的记忆补全向量，返回成功数量。 */
export const embedMissingMemories = async (
  items: MemoryItem[],
  config: EmbeddingConfig,
  onProgress?: (done: number, total: number) => void
): Promise<number> => {
  if (!embeddingConfigured(config)) return 0;
  const store = readEmbeddings();
  const missing = items.filter((item) => store[item.id]?.m !== config.model);
  if (missing.length === 0) return 0;
  let done = 0;
  for (let start = 0; start < missing.length; start += 16) {
    const batch = missing.slice(start, start + 16);
    const vectors = await embedTexts(batch.map((item) => item.content), config);
    const latest = readEmbeddings();
    const existingIds = new Set(readMemories().map((item) => item.id));
    batch.forEach((item, index) => {
      if (existingIds.has(item.id)) latest[item.id] = { m: config.model, v: vectors[index] };
    });
    writeEmbeddings(latest);
    done += batch.length;
    onProgress?.(done, missing.length);
  }
  return done;
};

export const removeEmbeddings = (ids: string[]) => {
  const store = readEmbeddings();
  let changed = false;
  ids.forEach((id) => {
    if (id in store) {
      delete store[id];
      changed = true;
    }
  });
  if (changed) writeEmbeddings(store);
};

// ==================== 关键词兜底 ====================
const STOP_BIGRAMS = new Set(['玩家', '我们', '今天', '什么', '怎么', '可以', '一个', '自己', '没有', '不是', '就是', '觉得', '知道', '因为', '所以', '但是', '还是', '时候', '这个', '那个', '喜欢', '已经', '现在']);

const bigrams = (text: string) => {
  const cleaned = text.replace(/[\s，。！？、；：“”‘’（）()\-—…~,.!?;:'"]/g, '');
  const set = new Set<string>();
  for (let i = 0; i < cleaned.length - 1; i += 1) {
    const gram = cleaned.slice(i, i + 2);
    if (!STOP_BIGRAMS.has(gram)) set.add(gram);
  }
  return set;
};

const keywordScore = (query: Set<string>, content: string) => {
  const memory = bigrams(content);
  if (memory.size === 0 || query.size === 0) return 0;
  let shared = 0;
  memory.forEach((gram) => {
    if (query.has(gram)) shared += 1;
  });
  return shared === 0 ? 0 : Math.min(1, 0.35 + (shared / Math.min(memory.size, 8)) * 0.65);
};

// ==================== 检索 ====================
const DAY = 24 * 3600 * 1000;
const recencyScore = (item: MemoryItem) => {
  const base = Date.parse(item.lastRecalledAt ?? item.updatedAt) || Date.parse(item.createdAt) || 0;
  const days = Math.max(0, (Date.now() - base) / DAY);
  return Math.pow(0.5, days / 45);
};

export interface ScoredMemory {
  item: MemoryItem;
  score: number;
  similarity: number;
  mode: 'vector' | 'keyword';
}

const queryCache = new Map<string, number[]>();

/** 对某个角色（及玩家通用记忆）按查询语句排序，不含核心/置顶记忆。 */
export const rankMemories = async (
  charIds: string[],
  query: string,
  settings: MemorySettings,
  options: { signal?: AbortSignal; limit?: number; ignoreThreshold?: boolean; localOnly?: boolean } = {}
): Promise<ScoredMemory[]> => {
  const ids = new Set([...charIds, SHARED_MEMORY_ID]);
  const candidates = readMemories().filter((item) => ids.has(item.charId));
  if (candidates.length === 0 || !query.trim()) return [];
  const store = readEmbeddings();
  let queryVector: number[] | null = null;
  if (embeddingConfigured(settings.embedding) && !options.localOnly) {
    const cacheKey = `${settings.embedding.model}|${query}`;
    queryVector = queryCache.get(cacheKey) ?? null;
    if (!queryVector) {
      try {
        queryVector = (await embedTexts([query], settings.embedding, options.signal))[0] ?? null;
        if (queryVector) {
          if (queryCache.size > 50) queryCache.clear();
          queryCache.set(cacheKey, queryVector);
        }
      } catch (error) {
        console.warn('Memory query embedding failed, falling back to keywords.', error);
      }
    }
  }
  const queryGrams = bigrams(query);
  const scored: ScoredMemory[] = [];
  for (const item of candidates) {
    const vector = store[item.id];
    let similarity: number;
    let mode: ScoredMemory['mode'];
    let gate: number;
    if (queryVector && vector && vector.m === settings.embedding.model) {
      similarity = cosine(queryVector, vector.v);
      mode = 'vector';
      gate = settings.threshold;
    } else {
      similarity = keywordScore(queryGrams, item.content);
      mode = 'keyword';
      gate = 0.4;
    }
    if (!options.ignoreThreshold && similarity < gate) continue;
    const score = 0.65 * similarity + 0.2 * (item.importance / 5) + 0.15 * recencyScore(item);
    scored.push({ item, score, similarity, mode });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.limit ?? settings.topK);
};

export interface MemoryInjection {
  text: string;
  ids: string[];
}

const formatMemoryLine = (item: MemoryItem, prefix: string) =>
  `- ${prefix}${item.content}（${(item.createdAt || '').slice(0, 10)}）`;

/** 聊天提示词用：置顶/核心记忆常驻，其余按当前话题检索。失败时不影响聊天。 */
export const buildMemoryInjection = async (
  charIds: string[],
  chatType: string,
  query: string,
  nameOf: (id: string) => string | undefined,
  options: { localOnly?: boolean } = {}
): Promise<MemoryInjection> => {
  const empty: MemoryInjection = { text: '', ids: [] };
  if (chatType === 'observer' || charIds.length === 0) return empty;
  try {
    const settings = readMemorySettings();
    const all = readMemories();
    const allowed = new Set([...charIds, SHARED_MEMORY_ID]);
    const mine = all.filter((item) => allowed.has(item.charId));
    if (mine.length === 0) return empty;
    const multi = charIds.length > 1;
    const prefixOf = (item: MemoryItem) =>
      multi && item.charId !== SHARED_MEMORY_ID ? `[${nameOf(item.charId) ?? '角色'}] ` : '';

    const always = mine
      .filter((item) => item.pinned || item.category === 'core')
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.importance - a.importance || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 12);
    const alwaysIds = new Set(always.map((item) => item.id));

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    let related: ScoredMemory[] = [];
    try {
      related = (await rankMemories(charIds, query, settings, { signal: controller.signal, limit: settings.topK + always.length, localOnly: options.localOnly }))
        .filter((entry) => !alwaysIds.has(entry.item.id))
        .slice(0, settings.topK);
    } finally {
      window.clearTimeout(timer);
    }

    if (always.length === 0 && related.length === 0) return empty;
    const text = [
      '【你的长期记忆】',
      '下面是你自己真实记得的事（“我”指你，“玩家”指正在和你聊天的人）。像人自然想起往事那样融入对话：不要逐条复述，不要说“我记得系统里写着”，也不要每轮都提；和当下话题无关就不要硬提。如果玩家现在说的和记忆不一致，以当下为准，并可以自然地表现出“咦，变了”。',
      always.length > 0 ? `你一直记在心里的事：\n${always.map((item) => formatMemoryLine(item, prefixOf(item))).join('\n')}` : '',
      related.length > 0 ? `与此刻话题相关、你想起的往事：\n${related.map((entry) => formatMemoryLine(entry.item, prefixOf(entry.item))).join('\n')}` : '',
    ].filter(Boolean).join('\n');
    return { text, ids: [...always, ...related.map((entry) => entry.item)].map((item) => item.id) };
  } catch (error) {
    console.error('Could not build memory injection.', error);
    return empty;
  }
};

export const markMemoriesRecalled = (ids: string[]) => {
  if (ids.length === 0) return;
  const set = new Set(ids);
  const now = new Date().toISOString();
  writeMemories(
    readMemories().map((item) =>
      set.has(item.id) ? { ...item, lastRecalledAt: now, recallCount: (item.recallCount ?? 0) + 1 } : item
    )
  );
};

// ==================== 写入（含去重） ====================
export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
  importance: number;
  pinned: boolean;
}

const normalizeText = (text: string) => text.replace(/\s+/g, '').toLowerCase();

/** 写入候选记忆：与已有记忆高度相似的合并（更新时间/重要度），否则新增。返回新增和合并数量。 */
export const addMemoryCandidates = async (
  charId: string,
  candidates: MemoryCandidate[],
  source: MemoryItem['source'],
  settings: MemorySettings
): Promise<{ added: number; merged: number }> => {
  const assertArchive = guardMemoryArchive(charId);
  const sameOwner = (item: MemoryItem) => item.charId === charId;
  const useVectors = embeddingConfigured(settings.embedding);
  let vectors: number[][] = [];
  if (useVectors) {
    try {
      vectors = await embedTexts(candidates.map((c) => c.content), settings.embedding);
    } catch (error) {
      console.warn('Could not embed new memories for dedupe.', error);
    }
  }
  assertArchive();
  const items = readMemories();
  const store = readEmbeddings();
  const now = new Date().toISOString();
  let added = 0;
  let merged = 0;
  candidates.forEach((candidate, index) => {
    const content = candidate.content.trim().slice(0, 300);
    if (!content) return;
    const vector = vectors[index];
    const grams = bigrams(content);
    const duplicate = items.filter(sameOwner).find((item) => {
      if (normalizeText(item.content) === normalizeText(content)) return true;
      const existing = store[item.id];
      if (vector && existing && existing.m === settings.embedding.model) return cosine(vector, existing.v) >= 0.88;
      const other = bigrams(item.content);
      if (other.size === 0 || grams.size === 0) return false;
      let shared = 0;
      grams.forEach((gram) => {
        if (other.has(gram)) shared += 1;
      });
      return shared / Math.min(grams.size, other.size) >= 0.75;
    });
    if (duplicate) {
      duplicate.updatedAt = now;
      duplicate.importance = Math.max(duplicate.importance, candidate.importance);
      duplicate.pinned = duplicate.pinned || candidate.pinned;
      merged += 1;
      return;
    }
    const item: MemoryItem = {
      id: newMemoryId(),
      charId,
      content,
      category: candidate.category,
      importance: candidate.importance,
      pinned: candidate.pinned,
      createdAt: now,
      updatedAt: now,
      recallCount: 0,
      source,
    };
    items.push(item);
    if (vector) store[item.id] = { m: settings.embedding.model, v: vector };
    added += 1;
  });
  writeMemories(items);
  writeEmbeddings(store);
  return { added, merged };
};

// ==================== 导入 / 导出 ====================
export const exportMemories = (charId: string | 'all') => {
  const items = readMemories().filter((item) => charId === 'all' || item.charId === charId);
  return { type: 'yyphone-memories', version: 1, exportedAt: new Date().toISOString(), memories: items };
};

export const importMemories = (
  data: unknown,
  fallbackCharId: string,
  knownCharIds: string[]
): { items: MemoryItem[]; skipped: number } => {
  const rawList = isRecord(data) && Array.isArray(data.memories) ? data.memories : Array.isArray(data) ? data : [];
  const existing = readMemories();
  const seen = new Set(existing.map((item) => `${item.charId}|${normalizeText(item.content)}`));
  const now = new Date().toISOString();
  const items: MemoryItem[] = [];
  let skipped = 0;
  rawList.forEach((raw) => {
    if (!isRecord(raw) || typeof raw.content !== 'string' || !raw.content.trim()) {
      skipped += 1;
      return;
    }
    const rawChar = typeof raw.charId === 'string' ? raw.charId : '';
    const charId = rawChar === SHARED_MEMORY_ID || knownCharIds.includes(rawChar) ? rawChar : fallbackCharId;
    const content = raw.content.trim().slice(0, 300);
    const key = `${charId}|${normalizeText(content)}`;
    if (seen.has(key)) {
      skipped += 1;
      return;
    }
    seen.add(key);
    const importance = Number(raw.importance);
    items.push({
      id: newMemoryId(),
      charId,
      content,
      category: isMemoryCategory(raw.category) ? raw.category : 'fact',
      importance: Number.isFinite(importance) ? Math.min(5, Math.max(1, Math.round(importance))) : 3,
      pinned: raw.pinned === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
      updatedAt: now,
      recallCount: 0,
      source: 'import',
    });
  });
  if (items.length > 0) writeMemories([...existing, ...items]);
  return { items, skipped };
};

export const readWechatChatsRaw = (): unknown[] => {
  try {
    const parsed: unknown = JSON.parse(readStorageString('yyphone:wechat-chats') ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
