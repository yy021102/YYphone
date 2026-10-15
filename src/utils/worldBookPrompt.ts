import { readStorageString } from './localStorage';

export type WorldBookDepth = 'front' | 'middle' | 'back';

interface StoredWorldBookEntry {
  id: string;
  title: string;
  content: string;
  depth: WorldBookDepth;
}

interface StoredWorldBook {
  id: string;
  name: string;
  isGlobal?: boolean;
  entries: StoredWorldBookEntry[];
}

export const WORLD_BOOKS_STORAGE_KEY = 'yyphone:world-books';

const isDepth = (value: unknown): value is WorldBookDepth =>
  value === 'front' || value === 'middle' || value === 'back';

const readStoredWorldBooks = (): StoredWorldBook[] => {
  try {
    const raw = readStorageString(WORLD_BOOKS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((book): StoredWorldBook[] => {
      if (
        !book || typeof book !== 'object' ||
        typeof book.id !== 'string' ||
        typeof book.name !== 'string' ||
        !Array.isArray(book.entries)
      ) {
        return [];
      }
      const entries = book.entries.filter(
        (entry: unknown): entry is StoredWorldBookEntry =>
          !!entry && typeof entry === 'object' &&
          typeof (entry as StoredWorldBookEntry).id === 'string' &&
          typeof (entry as StoredWorldBookEntry).title === 'string' &&
          typeof (entry as StoredWorldBookEntry).content === 'string' &&
          isDepth((entry as StoredWorldBookEntry).depth)
      );
      return [{ id: book.id, name: book.name, isGlobal: book.isGlobal === true, entries }];
    });
  } catch (error) {
    console.error('Could not read global world books.', error);
    return [];
  }
};

// 全局世界书的条目会默认发送给所有需要 AI 生成的功能。
export const getGlobalWorldBookEntries = (depth: WorldBookDepth): string[] =>
  readStoredWorldBooks()
    .filter((book) => book.isGlobal)
    .flatMap((book) =>
      book.entries
        .filter((entry) => entry.depth === depth && entry.content.trim())
        .map((entry) => `【${book.name} / ${entry.title}】\n${entry.content}`)
    );

export const withGlobalWorldBooks = (systemPrompt: string): string => {
  const front = getGlobalWorldBookEntries('front');
  const after = [...getGlobalWorldBookEntries('middle'), ...getGlobalWorldBookEntries('back')];
  return [
    front.length > 0 ? `全局世界书（前置）：\n${front.join('\n\n')}` : '',
    systemPrompt,
    after.length > 0 ? `全局世界书：\n${after.join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n');
};
