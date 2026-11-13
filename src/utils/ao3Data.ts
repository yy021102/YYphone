import { readStoredValue, writeStoredValue } from './localStorage';

export const AO3_KEY = 'yyphone:ao3';
export const AO3_DRAFT_KEY = 'yyphone:ao3-draft';
export const AO3_RATINGS = ['General Audiences', 'Teen And Up Audiences', 'Mature', 'Explicit', 'Not Rated'] as const;
export const AO3_CATEGORIES = ['Gen', 'F/M', 'M/M', 'F/F', 'Multi', 'Other'] as const;
export type Ao3Rating = typeof AO3_RATINGS[number];
export type Ao3Category = typeof AO3_CATEGORIES[number];
export interface Ao3Chapter { title: string; body: string }
export interface Ao3Comment {
  id: string; author: string; body: string; createdAt: string; replyTo?: string; chapter?: number;
  identity?: { type: 'character' | 'npc' | 'user'; id: string };
}
export interface Ao3Generation {
  authorType: 'passerby' | 'character'; topic: 'fandom' | 'couple';
  authorCharId?: string; authorCharName?: string; pairCharId?: string; pairCharName?: string; playerName?: string;
}
export interface Ao3Work {
  id: string; title: string; author: string; fandom: string; relationship: string;
  characters: string[]; tags: string[]; rating: Ao3Rating; category: Ao3Category;
  warning: string; summary: string; notes: string; chapters: Ao3Chapter[];
  complete: boolean; language: string; createdAt: string; updatedAt: string;
  kudos: number; hits: number; comments: Ao3Comment[]; owned: boolean; generation?: Ao3Generation;
}
export interface Ao3History { workId: string; chapter: number; readAt: string }
export interface Ao3State {
  version: 1; works: Ao3Work[]; kudosed: string[]; bookmarks: string[]; later: string[]; history: Ao3History[];
}
export interface Ao3Draft {
  workId?: string; title: string; author: string; fandom: string; relationship: string;
  characters: string; tags: string; rating: Ao3Rating; category: Ao3Category;
  warning: string; summary: string; notes: string; chapters: Ao3Chapter[]; complete: boolean;
}
export interface Ao3Filters {
  query: string; fandom: string; rating: string; category: string; complete: 'all' | 'complete' | 'ongoing';
  exclude: string; sort: 'updated' | 'kudos' | 'words';
}
export const emptyAo3Filters = (): Ao3Filters => ({ query: '', fandom: '', rating: '', category: '', complete: 'all', exclude: '', sort: 'updated' });
export const splitAo3Tags = (value: string) => [...new Set(value.split(/[,，;；\n]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 30);
export const ao3WordCount = (chapters: Ao3Chapter[]) => (chapters.map(c => c.body).join(' ').match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+/gu) ?? []).length;
const row = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const strings = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every(v => str(v, 200));
const date = (value: unknown) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
// Legacy archive-wide comments belong to the first chapter.
export const ao3CommentChapter = (comment: Ao3Comment) => comment.chapter ?? 0;
export const ao3ChapterComments = (work: Pick<Ao3Work, 'comments'>, chapter: number) => work.comments.filter(c => ao3CommentChapter(c) === chapter);
const commentsWithinChapters = (comments: Ao3Comment[], chapterCount: number) => comments.every(c => ao3CommentChapter(c) < chapterCount);
export const isAo3Comment = (c: unknown): c is Ao3Comment => row(c) &&
  str(c.id, 200) && !!c.id && str(c.author, 200) && !!c.author.trim() &&
  str(c.body, 5000) && !!c.body.trim() && date(c.createdAt) &&
  (c.chapter === undefined || count(c.chapter) && c.chapter < 100) &&
  (c.replyTo === undefined || str(c.replyTo, 200) && !!c.replyTo) &&
  (c.identity === undefined || row(c.identity) && ['character', 'npc', 'user'].includes(String(c.identity.type)) &&
    str(c.identity.id, 200) && !!c.identity.id);
export function isAo3Comments(value: unknown): value is Ao3Comment[] {
  if (!Array.isArray(value)) return false;
  const ids = new Map<string, number>();
  for (const comment of value) {
    if (!isAo3Comment(comment) || ids.has(comment.id) ||
      comment.replyTo && ids.get(comment.replyTo) !== ao3CommentChapter(comment)) return false;
    ids.set(comment.id, ao3CommentChapter(comment));
  }
  return true;
}
const chapters = (value: unknown): value is Ao3Chapter[] => Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(c => row(c) && str(c.title, 200) && str(c.body, 200_000));
const isGeneration = (v: unknown): v is Ao3Generation => row(v) && (v.authorType === 'passerby' || v.authorType === 'character') &&
  (v.topic === 'fandom' || v.topic === 'couple') &&
  ['authorCharId', 'authorCharName', 'pairCharId', 'pairCharName', 'playerName'].every(k => v[k] === undefined || str(v[k], 200)) &&
  (v.authorType !== 'character' || !!v.authorCharId && !!v.authorCharName) &&
  (v.topic !== 'couple' || !!v.pairCharId && !!v.pairCharName && !!v.playerName);
export const isAo3Work = (value: unknown): value is Ao3Work => row(value) &&
  typeof value.id === 'string' && !!value.id && value.id.length <= 200 &&
  ['title', 'author', 'fandom', 'relationship', 'warning', 'language'].every(key => str(value[key], 200)) &&
  str(value.summary, 10_000) && str(value.notes, 10_000) && strings(value.characters) && strings(value.tags) &&
  AO3_RATINGS.some(r => r === value.rating) && AO3_CATEGORIES.some(c => c === value.category) &&
  chapters(value.chapters) && typeof value.complete === 'boolean' && typeof value.owned === 'boolean' &&
  date(value.createdAt) && date(value.updatedAt) && count(value.kudos) && count(value.hits) &&
  (value.generation === undefined || isGeneration(value.generation)) &&
  isAo3Comments(value.comments) && commentsWithinChapters(value.comments, value.chapters.length);
export function isAo3State(value: unknown): value is Ao3State {
  if (!row(value) || value.version !== 1 || !Array.isArray(value.works) || !value.works.every(isAo3Work)) return false;
  const works = value.works;
  const ids = new Set(works.map(w => w.id));
  return ids.size === works.length && ['kudosed', 'bookmarks', 'later'].every(k =>
    Array.isArray(value[k]) && value[k].every(id => typeof id === 'string' && ids.has(id)) && new Set(value[k]).size === value[k].length) &&
    Array.isArray(value.history) && value.history.every(h => row(h) && typeof h.workId === 'string' && ids.has(h.workId) &&
      typeof h.chapter === 'number' && Number.isInteger(h.chapter) && h.chapter >= 0 && h.chapter < works.find(w => w.id === h.workId)!.chapters.length && date(h.readAt));
}
export const isAo3Draft = (value: unknown): value is Ao3Draft => row(value) &&
  (value.workId === undefined || str(value.workId, 200)) &&
  ['title', 'author', 'fandom', 'relationship', 'warning'].every(k => str(value[k], 200)) &&
  str(value.characters, 6000) && str(value.tags, 6000) && str(value.summary, 10_000) && str(value.notes, 10_000) &&
  AO3_RATINGS.some(r => r === value.rating) && AO3_CATEGORIES.some(c => c === value.category) && chapters(value.chapters) && typeof value.complete === 'boolean';

export function initialAo3State(): Ao3State {
  return { version: 1, kudosed: [], bookmarks: [], later: [], history: [], works: [] };
}
export function readAo3State(): Ao3State {
  const state = readStoredValue(AO3_KEY, initialAo3State(), isAo3State);
  const samples = new Set(['ao3-sample-rain', 'ao3-sample-moon', 'ao3-sample-breakfast']);
  const works = state.works.filter(w => !samples.has(w.id) || w.owned || w.generation);
  if (works.length === state.works.length) return state;
  const ids = new Set(works.map(w => w.id));
  const cleaned = { ...state, works, kudosed: state.kudosed.filter(id => ids.has(id)),
    bookmarks: state.bookmarks.filter(id => ids.has(id)), later: state.later.filter(id => ids.has(id)),
    history: state.history.filter(h => ids.has(h.workId)) };
  writeAo3State(cleaned);
  return cleaned;
}
export const writeAo3State = (state: Ao3State) => writeStoredValue(AO3_KEY, state);
export const readAo3Draft = () => readStoredValue<Ao3Draft | null>(AO3_DRAFT_KEY, null, (v): v is Ao3Draft | null => v === null || isAo3Draft(v));
export const writeAo3Draft = (draft: Ao3Draft | null) => writeStoredValue(AO3_DRAFT_KEY, draft);
export const newAo3Draft = (author: string): Ao3Draft => ({ title: '', author, fandom: 'Original Work', relationship: '',
  characters: '', tags: '', rating: 'General Audiences', category: 'Gen', warning: 'No Archive Warnings Apply',
  summary: '', notes: '', chapters: [{ title: '', body: '' }], complete: true });
export const ao3DraftFromWork = (work: Ao3Work): Ao3Draft => ({ ...work, workId: work.id,
  characters: work.characters.join(', '), tags: work.tags.join(', '), chapters: work.chapters.map(c => ({ ...c })) });

export function filterAo3Works(works: Ao3Work[], filters: Ao3Filters): Ao3Work[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const excluded = splitAo3Tags(filters.exclude).map(s => s.toLocaleLowerCase());
  return works.filter(work => {
    const haystack = [work.title, work.author, work.fandom, work.relationship, ...work.characters, ...work.tags, work.summary].join('\n').toLocaleLowerCase();
    return (!query || haystack.includes(query)) && (!filters.fandom || work.fandom === filters.fandom) &&
      (!filters.rating || work.rating === filters.rating) && (!filters.category || work.category === filters.category) &&
      (filters.complete === 'all' || work.complete === (filters.complete === 'complete')) && !excluded.some(s => haystack.includes(s));
  }).sort((a, b) => filters.sort === 'kudos' ? b.kudos - a.kudos || b.updatedAt.localeCompare(a.updatedAt) :
    filters.sort === 'words' ? ao3WordCount(b.chapters) - ao3WordCount(a.chapters) : b.updatedAt.localeCompare(a.updatedAt));
}
export type Ao3Action = { type: 'kudos' | 'bookmark' | 'later'; id: string } |
  { type: 'read'; id: string; chapter: number; now: string; countHit?: boolean } |
  { type: 'comment'; id: string; comment: Ao3Comment } | { type: 'publish'; work: Ao3Work } | { type: 'discover'; work: Ao3Work } |
  { type: 'comments'; work: Ao3Work; comments: Ao3Comment[] } |
  { type: 'regenerate-chapter'; work: Ao3Work; index: number; chapter: Ao3Chapter; comments: Ao3Comment[]; now: string } |
  { type: 'delete-chapter'; work: Ao3Work; index: number; now: string } |
  { type: 'continue'; work: Ao3Work; chapter: Ao3Chapter; comments?: Ao3Comment[]; now: string } | { type: 'delete'; id: string };
/** Pure archive operations: one kudos per reader, chapter-aware history, no chat/memory side effects. */
export function updateAo3(state: Ao3State, action: Ao3Action): Ao3State {
  if (action.type === 'regenerate-chapter' || action.type === 'delete-chapter') {
    const work = state.works.find(w => w.id === action.work.id), index = action.index;
    if (!work || work.updatedAt !== action.work.updatedAt || JSON.stringify(work.chapters) !== JSON.stringify(action.work.chapters) ||
      JSON.stringify(ao3ChapterComments(work, index)) !== JSON.stringify(ao3ChapterComments(action.work, index))) throw new Error('作品或本章评论已变化，请重新打开后操作。');
    if ((!work.owned && !work.generation) || !Number.isInteger(index) || index < 0 || index >= work.chapters.length || !date(action.now)) throw new Error('章节不可操作，请重新打开作品。');
    if (action.type === 'delete-chapter') {
      if (work.chapters.length === 1) return updateAo3(state, { type: 'delete', id: work.id });
      const next = { ...work, chapters: work.chapters.filter((_, i) => i !== index).map((chapter, i) => {
        const oldIndex = i < index ? i : i + 1;
        return chapter.title === `Chapter ${oldIndex + 1}` ? { ...chapter, title: `Chapter ${i + 1}` } : chapter;
      }), comments: work.comments.filter(c => ao3CommentChapter(c) !== index).map(c => ({ ...c, chapter: ao3CommentChapter(c) > index ? ao3CommentChapter(c) - 1 : ao3CommentChapter(c) })), updatedAt: action.now };
      return { ...state, works: state.works.map(w => w.id === work.id ? next : w), history: state.history.map(h => h.workId === work.id ? { ...h, chapter: Math.min(h.chapter > index ? h.chapter - 1 : h.chapter, next.chapters.length - 1) } : h) };
    }
    const remaining = work.comments.filter(c => ao3CommentChapter(c) !== index);
    if (!isAo3Comments(action.comments) || action.comments.length !== 5 || action.comments.some(c => ao3CommentChapter(c) !== index)) throw new Error('本章新评论不完整，原文与评论已保留。');
    const next = { ...work, chapters: work.chapters.map((c, i) => i === index ? action.chapter : c), comments: [...remaining, ...action.comments], updatedAt: action.now };
    if (!isAo3Work(next) || !action.chapter.body.trim()) throw new Error('新章节不完整，原文与评论已保留。');
    return { ...state, works: state.works.map(w => w.id === work.id ? next : w) };
  }
  if (action.type === 'comments') {
    const work = state.works.find(w => w.id === action.work.id);
    if (!work || work.updatedAt !== action.work.updatedAt || JSON.stringify(work.chapters) !== JSON.stringify(action.work.chapters)) {
      throw new Error('作品已修改或删除，评论未追加，请重新生成。');
    }
    const comments = [...work.comments, ...action.comments];
    if (!action.comments.length || !isAo3Comments(comments) || comments.some(c => ao3CommentChapter(c) >= work.chapters.length)) throw new Error('评论内容或回复关系无效，原评论已保留。');
    return { ...state, works: state.works.map(w => w.id === work.id ? { ...w, comments } : w) };
  }
  if (action.type === 'continue') {
    const work = state.works.find(w => w.id === action.work.id);
    if (!work || work.updatedAt !== action.work.updatedAt || JSON.stringify(work.chapters) !== JSON.stringify(action.work.chapters)) {
      throw new Error('作品已修改或删除，请重新打开作品后追更。');
    }
    const newComments = action.comments ?? [];
    if (action.comments && (newComments.length !== 5 || newComments.some(c => ao3CommentChapter(c) !== work.chapters.length ||
      c.replyTo && !newComments.some(parent => parent.id === c.replyTo)))) throw new Error('新章的五条评论不完整或回复跨章，原文已保留。');
    const next = { ...work, chapters: [...work.chapters, action.chapter], comments: [...work.comments, ...newComments], complete: false, updatedAt: action.now };
    if (!isAo3Work(next) || !action.chapter.body.trim()) throw new Error('续章内容不完整或已达 100 章上限，原文已保留。');
    return { ...state, works: state.works.map(w => w.id === work.id ? next : w) };
  }
  if (action.type === 'discover') {
    if (!isAo3Work(action.work) || action.work.owned || !action.work.generation) throw new Error('没有收到完整作品，请重新生成。');
    if (state.works.some(w => w.id === action.work.id)) return state;
    return { ...state, works: [action.work, ...state.works] };
  }
  if (action.type === 'publish') {
    if (!isAo3Work(action.work) || !action.work.owned) throw new Error('作品内容不完整，请检查后再发布。');
    const existing = state.works.find(w => w.id === action.work.id);
    if (existing && !existing.owned) throw new Error('只能编辑自己的作品。');
    return { ...state, works: existing ? state.works.map(w => w.id === action.work.id ? { ...action.work, kudos: w.kudos, hits: w.hits,
      comments: w.comments.filter(c => ao3CommentChapter(c) < action.work.chapters.length), createdAt: w.createdAt } : w) : [action.work, ...state.works],
      history: state.history.map(h => h.workId === action.work.id ? { ...h, chapter: Math.min(h.chapter, action.work.chapters.length - 1) } : h) };
  }
  const work = state.works.find(w => w.id === action.id);
  if (!work) {
    if (action.type === 'comment') throw new Error('作品已不存在，评论未保存。');
    return state;
  }
  if (action.type === 'delete') {
    if (!work.owned && !work.generation) return state;
    return { ...state, works: state.works.filter(w => w.id !== action.id), kudosed: state.kudosed.filter(id => id !== action.id),
      bookmarks: state.bookmarks.filter(id => id !== action.id), later: state.later.filter(id => id !== action.id), history: state.history.filter(h => h.workId !== action.id) };
  }
  if (action.type === 'kudos') return state.kudosed.includes(action.id) ? state : { ...state, kudosed: [...state.kudosed, action.id], works: state.works.map(w => w.id === action.id ? { ...w, kudos: w.kudos + 1 } : w) };
  if (action.type === 'bookmark' || action.type === 'later') {
    const key = action.type === 'bookmark' ? 'bookmarks' : 'later';
    return { ...state, [key]: state[key].includes(action.id) ? state[key].filter(id => id !== action.id) : [...state[key], action.id] };
  }
  if (action.type === 'comment') {
    const c = action.comment;
    if (!isAo3Comments([...work.comments, c]) || ao3CommentChapter(c) >= work.chapters.length) throw new Error('评论内容或回复关系无效，请检查后再发表。');
    return { ...state, works: state.works.map(w => w.id === action.id ? { ...w, comments: [...w.comments, c] } : w) };
  }
  if (action.type !== 'read' || !Number.isInteger(action.chapter) || action.chapter < 0 || action.chapter >= work.chapters.length || !date(action.now)) return state;
  return { ...state, works: action.countHit ? state.works.map(w => w.id === action.id ? { ...w, hits: w.hits + 1 } : w) : state.works,
    history: [{ workId: action.id, chapter: action.chapter, readAt: action.now }, ...state.history.filter(h => h.workId !== action.id)].slice(0, 200) };
}
export function publishAo3Draft(draft: Ao3Draft, existing?: Ao3Work): Ao3Work {
  if (!isAo3Draft(draft) || !draft.title.trim() || !draft.author.trim() || !draft.fandom.trim() || draft.chapters.some(c => !c.body.trim())) {
    throw new Error('请填写标题、作者、所属作品，以及每一章的正文。');
  }
  if (draft.workId && (!existing || existing.id !== draft.workId || !existing.owned)) throw new Error('原作品已不存在，请将内容另存为新作品。');
  const now = new Date().toISOString();
  return { id: existing?.id ?? `ao3-${crypto.randomUUID()}`, title: draft.title.trim(), author: draft.author.trim(), fandom: draft.fandom.trim(),
    relationship: draft.relationship.trim(), characters: splitAo3Tags(draft.characters), tags: splitAo3Tags(draft.tags),
    rating: draft.rating, category: draft.category, warning: draft.warning.trim() || 'Creator Chose Not To Use Archive Warnings',
    summary: draft.summary.trim(), notes: draft.notes.trim(), chapters: draft.chapters.map((c, i) => ({ title: c.title.trim() || `Chapter ${i + 1}`, body: c.body.trim() })),
    complete: draft.complete, language: existing?.language ?? '中文', createdAt: existing?.createdAt ?? now, updatedAt: now,
    kudos: existing?.kudos ?? 0, hits: existing?.hits ?? 0, comments: existing?.comments.filter(c => ao3CommentChapter(c) < draft.chapters.length) ?? [], owned: true };
}
