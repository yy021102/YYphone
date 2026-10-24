import { removeCachedStorageItem } from './dbStorage';
import { readStoredValue, writeStoredValue } from './localStorage';

export const READING_LIBRARY_KEY = 'yyphone:wechat-reading:library-v1';
const contentKey = (id: string) => `yyphone:wechat-reading:book:${id}`;
export type ReadingFont = 'small' | 'normal' | 'large';
export type ReadingTheme = 'paper' | 'night';
export type ReadingStatus = 'reading' | 'paused' | 'finished';
export type ReadingLine = {
  id: string;
  senderId: string;
  name: string;
  text: string;
  pageStart: number;
  createdAt: string;
};
export type ReadingBook = {
  id: string;
  title: string;
  fileName: string;
  textLength: number;
  createdAt: string;
  updatedAt: string;
  status: ReadingStatus;
  position: number;
  maxReadOffset: number;
  font: ReadingFont;
  theme: ReadingTheme;
  companionId: string;
  coRead: boolean;
  autoComment: boolean;
  lastAutoOffset: number;
  dialogue: ReadingLine[];
  recap: string;
  recapOffset: number;
};
export type ReadingPage = { start: number; end: number; text: string };

const validLine = (value: unknown): value is ReadingLine => {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<ReadingLine>;
  return typeof line.id === 'string' && typeof line.senderId === 'string' &&
    typeof line.name === 'string' && typeof line.text === 'string' &&
    typeof line.pageStart === 'number' && typeof line.createdAt === 'string';
};
const validBook = (value: unknown): value is ReadingBook => {
  if (!value || typeof value !== 'object') return false;
  const book = value as Partial<ReadingBook>;
  return typeof book.id === 'string' && typeof book.title === 'string' && typeof book.fileName === 'string' &&
    Number.isSafeInteger(book.textLength) && book.textLength! > 0 &&
    typeof book.createdAt === 'string' && typeof book.updatedAt === 'string' &&
    ['reading', 'paused', 'finished'].includes(book.status ?? '') &&
    typeof book.position === 'number' && typeof book.maxReadOffset === 'number' &&
    ['small', 'normal', 'large'].includes(book.font ?? '') && ['paper', 'night'].includes(book.theme ?? '') &&
    typeof book.companionId === 'string' && typeof book.coRead === 'boolean' &&
    typeof book.autoComment === 'boolean' && typeof book.lastAutoOffset === 'number' &&
    Array.isArray(book.dialogue) && book.dialogue.every(validLine) &&
    typeof book.recap === 'string' && typeof book.recapOffset === 'number';
};
const isBookList = (value: unknown): value is ReadingBook[] => Array.isArray(value) && value.every(validBook);
export const readReadingLibrary = () => readStoredValue(READING_LIBRARY_KEY, [] as ReadingBook[], isBookList);
export const writeReadingLibrary = (books: ReadingBook[]) => writeStoredValue(READING_LIBRARY_KEY, books);
export const readReadingText = (id: string) => readStoredValue(contentKey(id), '', (value): value is string => typeof value === 'string');
export const writeReadingText = (id: string, content: string) => writeStoredValue(contentKey(id), content);
export const deleteReadingText = (id: string) => removeCachedStorageItem(contentKey(id));

export function normalizeReadingText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/[\t\u00a0]/g, ' ').trim();
}

export function paginateReadingText(text: string, target: number): ReadingPage[] {
  if (!text) return [];
  const pages: ReadingPage[] = [];
  const limit = Math.max(180, Math.floor(target));
  let start = 0;
  while (start < text.length) {
    while (start < text.length && text[start] === '\n') start++;
    if (start >= text.length) break;
    let end = Math.min(text.length, start + limit);
    if (end < text.length) {
      const lower = start + Math.floor(limit * 0.6);
      for (let index = end; index >= lower; index--) {
        if ('\n。！？.!?'.includes(text[index - 1])) { end = index; break; }
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) pages.push({ start, end, text: chunk });
    start = end;
  }
  return pages;
}

export function pageAtOffset(pages: ReadingPage[], offset: number): number {
  if (!pages.length) return 0;
  const safe = Math.max(0, offset);
  const found = pages.findIndex(page => safe >= page.start && safe < page.end);
  return found >= 0 ? found : safe >= pages.at(-1)!.end ? pages.length - 1 : 0;
}

export function readingPageContext(pages: ReadingPage[], pageIndex: number): string {
  return pages.slice(Math.max(0, pageIndex - 2), pageIndex + 1)
    .map((page, index, selected) => `${index === selected.length - 1 ? '【当前页】' : `【前${selected.length - 1 - index}页】`}\n${page.text}`)
    .join('\n\n');
}

export function readingChapter(text: string, offset: number): string {
  const prefix = text.slice(0, Math.max(0, offset) + 1);
  const found = [...prefix.matchAll(/(?:^|\n)\s*((?:第[一二三四五六七八九十百千零〇0-9]+[章节回卷篇]|Chapter\s+\d+)[^\n]{0,35})/gim)].at(-1);
  if (found?.[1]) return found[1].trim();
  const firstLine = text.split('\n', 1)[0];
  return /^(?:第[一二三四五六七八九十百千零〇0-9]+[章节回卷篇]|Chapter\s+\d+)/i.test(firstLine)
    ? firstLine.slice(0, 40).trim() : '正文';
}

export function readingShareText(book: ReadingBook, text: string, page: number, pages: number, companionName: string): string {
  const status = book.status === 'finished' ? '已读完' : '读到这里，暂时合上书';
  const lines = [
    `微信读书 · ${status}`,
    `《${book.title}》｜${book.coRead && book.companionId ? `与${companionName}共读` : '独自阅读'}`,
    `${readingChapter(text, book.position)} · 第 ${page + 1}/${pages} 页 · 已读 ${Math.round(book.maxReadOffset / Math.max(1, text.length) * 100)}%`,
    book.recap ? `\n已读梗概：${book.recap}` : '',
    ...(book.dialogue.length ? ['\n共读片段：', ...book.dialogue.slice(-8).map(line => `${line.name}：${line.text}`)] : []),
  ];
  return lines.filter(Boolean).join('\n');
}
