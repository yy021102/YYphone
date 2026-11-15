import { setStorageItemsAtomically } from './dbStorage';
import { ANTHOLOGY_KEY, ANTHOLOGY_DRAFT_KEY, defaultAnthologyDraft, isAnthologyArticle, isAnthologyDraft,
  readAnthologyArticles, readAnthologyDraft, type AnthologyArticle, type AnthologyDraft } from './anthology';

export interface AnthologyArchive {
  format: 'yyphone-anthology'; version: 1; exportedAt: string; articles: AnthologyArticle[]; draft: AnthologyDraft;
}
export const createAnthologyArchive = (): AnthologyArchive => ({ format: 'yyphone-anthology', version: 1,
  exportedAt: new Date().toISOString(), articles: readAnthologyArticles(), draft: readAnthologyDraft() });
export function parseAnthologyArchive(value: unknown): AnthologyArchive {
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 'yyphone-anthology' ||
    !('version' in value) || value.version !== 1 || !('articles' in value) || !Array.isArray(value.articles) ||
    !value.articles.every(isAnthologyArticle) || new Set(value.articles.map(a => a.id)).size !== value.articles.length ||
    !('draft' in value) || !isAnthologyDraft(value.draft) || !('exportedAt' in value) || typeof value.exportedAt !== 'string')
    throw new Error('这不是有效的文集备份文件，现有数据未改动。');
  return value as AnthologyArchive;
}
export async function importAnthologyArchive(value: unknown, mode: 'merge' | 'replace') {
  const archive = parseAnthologyArchive(value);
  const current = mode === 'replace' ? [] : readAnthologyArticles();
  const known = new Set(current.map(a => a.id));
  const added = archive.articles.filter(a => !known.has(a.id));
  await setStorageItemsAtomically({ [ANTHOLOGY_KEY]: [...current, ...added], [ANTHOLOGY_DRAFT_KEY]: archive.draft });
  return { added: added.length, kept: archive.articles.length - added.length };
}
export async function clearAnthologyData() {
  await setStorageItemsAtomically({ [ANTHOLOGY_KEY]: [], [ANTHOLOGY_DRAFT_KEY]: defaultAnthologyDraft() });
}
