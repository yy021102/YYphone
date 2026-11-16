import { readStorageString, readStoredValue, writeStoredValue } from './localStorage';
import { setStorageItemsAtomically } from './dbStorage';
import { readAnthologyUser } from './anthologyUser';

export const ANTHOLOGY_KEY = 'yyphone:anthology';
export const ANTHOLOGY_DRAFT_KEY = 'yyphone:anthology-draft';
export const ANTHOLOGY_GENRES = [
  { id: 'lyrical', label: '抒情散文', hint: '从景物与日常细节生发情绪，情感有来处，避免空泛的美。' },
  { id: 'narrative', label: '叙事散文', hint: '写人、记事、日常见闻，以具体细节和白描见意味，不虚构作者的重要人生经历。' },
  { id: 'philosophy', label: '哲理散文', hint: '由一个真实疑问展开追问，允许犹疑、自我反驳，不写概念讲义。' },
  { id: 'culture', label: '文化散文', hint: '从器物、地方、作品或文化现象切入，辨析其意味；历史事实不确定时不编造。' },
  { id: 'essay', label: '杂文', hint: '面对一种现象或观念提出自己的判断，以细节和论证形成锋芒，不把辱骂当批评。' },
  { id: 'commentary', label: '时评短打', hint: '围绕给定事件区分事实与判断，集中讨论关键问题，承认信息局限，不杜撰新闻细节。' },
  { id: 'poetry', label: '诗歌', hint: '通过准确的意象、节奏和留白形成张力，保持诗行，不堆砌抽象大词。' },
] as const;
export const ANTHOLOGY_STYLES = [
  { id: 'clear', label: '清丽婉约', hint: '语言清透，观察细，情绪从景物与细小动作中透出；节制修辞，避免甜腻与套句。' },
  { id: 'somber', label: '沉郁内省', hint: '感受深而克制，允许迟疑、反复与自我审视；轻重缓急有变化，不刻意制造苦难。' },
  { id: 'plain', label: '质朴白描', hint: '写实在的人、事、物，语句自然，少形容，多有意味的具体细节，余味留给读者。' },
  { id: 'leisurely', label: '幽默闲适', hint: '从小事中发现荒诞与趣味，轻松、含蓄、带一点自嘲，不强行抖机灵。' },
  { id: 'ironic', label: '冷峻讽刺', hint: '用反差、反讽和黑色幽默揭示矛盾，观察准确，讽刺有对象与依据，不滥用刻薄。' },
  { id: 'sharp', label: '锋利思辨', hint: '直面问题，拆解前提与权力关系，论证清楚，敢于反驳，也审视自己的立场。' },
  { id: 'restrained', label: '克制平实', hint: '表达清楚、诚实、留有分寸，允许复杂性和不确定，不用漂亮结论掩盖问题。' },
  { id: 'custom', label: '自定义', hint: '依据读者填写的风格要求，保留作者自身的语言习惯和人格。' },
] as const;
export interface AnthologyDraft {
  authorId: string; genre: string; style: string; customStyle: string; direction: string; material: string;
  length: 'short' | 'medium' | 'long'; attachChats: boolean; chatCount: number; attachMemories: boolean;
  manuscriptId?: string;
}
export const defaultAnthologyDraft = (): AnthologyDraft => ({ authorId: '', genre: 'narrative', style: 'plain', customStyle: '',
  direction: '', material: '', length: 'medium', attachChats: false, chatCount: 100, attachMemories: false });
export interface AnthologyAuthor { id: string; name: string; persona: string; avatarUrl: string }
export interface AnthologyArticle {
  id: string; authorId: string; authorName: string; authorAvatar: string; title: string; body: string;
  genre: string; style: string; favorite: boolean; createdAt: string; updatedAt: string; draft: AnthologyDraft;
  authorKind?: 'character' | 'user';
  sourceManuscript?: { id: string; title: string; authorName: string };
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function isAnthologyDraft(v: unknown): v is AnthologyDraft {
  return record(v) && ['authorId', 'genre', 'style', 'customStyle', 'direction', 'material'].every(k => typeof v[k] === 'string') &&
    ANTHOLOGY_GENRES.some(g => g.id === v.genre) && ANTHOLOGY_STYLES.some(s => s.id === v.style) &&
    ['short', 'medium', 'long'].includes(String(v.length)) && typeof v.attachChats === 'boolean' && typeof v.attachMemories === 'boolean' &&
    Number.isInteger(v.chatCount) && Number(v.chatCount) >= 1 && Number(v.chatCount) <= 300 &&
    (v.manuscriptId === undefined || typeof v.manuscriptId === 'string');
}
export function isAnthologyArticle(v: unknown): v is AnthologyArticle {
  return record(v) && ['id', 'authorId', 'authorName', 'authorAvatar', 'title', 'body', 'genre', 'style', 'createdAt', 'updatedAt'].every(k => typeof v[k] === 'string') &&
    !!v.id && !!v.title && !!v.body && typeof v.favorite === 'boolean' && isAnthologyDraft(v.draft) &&
    (v.authorKind === undefined || v.authorKind === 'character' || v.authorKind === 'user') &&
    (v.sourceManuscript === undefined || record(v.sourceManuscript) && ['id', 'title', 'authorName'].every(k => typeof (v.sourceManuscript as Record<string, unknown>)[k] === 'string'));
}
export function readAnthologyArticles(): AnthologyArticle[] {
  const raw = readStorageString(ANTHOLOGY_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('文集数据无法读取，原数据已保留，请先导出整机备份。'); }
  if (!Array.isArray(parsed) || !parsed.every(isAnthologyArticle)) throw new Error('文集数据格式无效，原数据已保留。');
  return parsed;
}
export const readAnthologyDraft = () => readStoredValue(ANTHOLOGY_DRAFT_KEY, defaultAnthologyDraft(), isAnthologyDraft);
export function readAnthologyAuthors(): AnthologyAuthor[] {
  return readStoredValue<unknown[]>('pocketos:wechat-contacts', [], Array.isArray).flatMap(v =>
    record(v) && typeof v.id === 'string' && typeof v.name === 'string'
      ? [{ id: v.id, name: v.name, persona: typeof v.persona === 'string' ? v.persona : '', avatarUrl: typeof v.avatarUrl === 'string' ? v.avatarUrl : '' }] : []);
}
function prepareArticleSave(article: AnthologyArticle, original?: AnthologyArticle) {
  if (!isAnthologyArticle(article)) throw new Error('文章内容不完整，未保存。');
  const current = readAnthologyArticles(), existing = current.find(a => a.id === article.id);
  if (original && (!existing || existing.body !== original.body || existing.title !== original.title)) throw new Error('原稿已修改或删除，本次内容未覆盖原稿。');
  if (!original && existing) throw new Error('文章编号重复，原稿已保留。');
  const saved = { ...article, favorite: existing?.favorite ?? article.favorite };
  return { saved, articles: existing ? current.map(a => a.id === article.id ? saved : a) : [saved, ...current] };
}
export function saveAnthologyArticle(article: AnthologyArticle, original?: AnthologyArticle) {
  const { saved, articles } = prepareArticleSave(article, original);
  writeStoredValue(ANTHOLOGY_KEY, articles);
  return saved;
}
export async function saveGeneratedAnthologyArticle(article: AnthologyArticle, original?: AnthologyArticle) {
  const { saved, articles } = prepareArticleSave(article, original);
  await setStorageItemsAtomically({ [ANTHOLOGY_KEY]: articles, [ANTHOLOGY_DRAFT_KEY]: defaultAnthologyDraft() });
  return saved;
}
export const isUserManuscript = (article: AnthologyArticle) => article.authorKind === 'user';
export function createAnthologyManuscript(): AnthologyArticle {
  const user = readAnthologyUser(), now = new Date().toISOString();
  return { id: crypto.randomUUID(), authorId: 'anthology:user', authorKind: 'user', authorName: user.name, authorAvatar: user.avatarUrl,
    title: '', body: '', genre: 'narrative', style: 'custom', favorite: false, createdAt: now, updatedAt: now,
    draft: { ...defaultAnthologyDraft(), style: 'custom' } };
}
export function favoriteAnthologyArticle(id: string) {
  const current = readAnthologyArticles();
  writeStoredValue(ANTHOLOGY_KEY, current.map(a => a.id === id ? { ...a, favorite: !a.favorite } : a));
}
export function deleteAnthologyArticle(id: string) {
  writeStoredValue(ANTHOLOGY_KEY, readAnthologyArticles().filter(a => a.id !== id));
}
export const anthologyGenre = (id: string) => ANTHOLOGY_GENRES.find(g => g.id === id)?.label ?? '随笔';
export const anthologyStyle = (id: string) => ANTHOLOGY_STYLES.find(s => s.id === id)?.label ?? '自定义';
export const anthologyExportText = (article: AnthologyArticle) => `${article.title}\n${article.authorName} · ${anthologyGenre(article.genre)} · ${article.createdAt.slice(0, 10)}\n\n${article.body}\n`;
