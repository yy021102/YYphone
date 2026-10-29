import { readStorageString } from './localStorage';
import { isWorldBookEntryActive, parseWorldBookActivation, type WorldBookActivation } from './worldBookActivation';

export type WorldBookDepth = 'front' | 'middle' | 'back';

interface StoredWorldBookEntry extends WorldBookActivation {
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

interface StoredWorldBookLink {
  bookId: string;
  entryId?: string;
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
      ).flatMap((entry: StoredWorldBookEntry) => { try { return [{ ...entry, ...parseWorldBookActivation(entry as unknown as Record<string, unknown>) }]; } catch { return []; } });
      return [{ id: book.id, name: book.name, isGlobal: book.isGlobal === true, entries }];
    });
  } catch (error) {
    console.error('Could not read global world books.', error);
    return [];
  }
};

// 全局世界书的条目会默认发送给所有需要 AI 生成的功能。
export const getGlobalWorldBookEntries = (depth: WorldBookDepth, scanMessages: readonly string[] = []): string[] =>
  readStoredWorldBooks()
    .filter((book) => book.isGlobal)
    .flatMap((book) =>
      book.entries
        .filter((entry) => entry.depth === depth && entry.content.trim() && isWorldBookEntryActive(entry, scanMessages))
        .map((entry) => `【${book.name} / ${entry.title}】\n${entry.content}`)
    );

export interface WorldBookOption {
  id: string;
  name: string;
  isGlobal: boolean;
}

export const readWorldBookOptions = (): WorldBookOption[] =>
  readStoredWorldBooks().map(({ id, name, isGlobal }) => ({ id, name, isGlobal: isGlobal === true }));

export const getAutomaticWorldBookIdsForContacts = (contactIds: string[]): string[] => {
  const books = readStoredWorldBooks();
  const linkedBookIds = new Set<string>();
  try {
    const raw = readStorageString('pocketos:wechat-contacts');
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      for (const contact of parsed as unknown[]) {
        if (!contact || typeof contact !== 'object' || !('id' in contact) ||
          typeof contact.id !== 'string' || !contactIds.includes(contact.id) ||
          !('worldBooks' in contact) || !Array.isArray(contact.worldBooks)) continue;
        for (const link of contact.worldBooks) {
          if (link && typeof link === 'object' && 'bookId' in link && typeof link.bookId === 'string') {
            linkedBookIds.add(link.bookId);
          }
        }
      }
    }
  } catch (error) {
    console.error('Could not read character world-book links.', error);
  }
  return books
    .filter((book) => book.isGlobal || linkedBookIds.has(book.id))
    .map((book) => book.id);
};

export const getWorldBookEntriesForContacts = (
  contactIds: string[],
  selectedBookIds?: string[],
  scanMessages: readonly string[] = readWorldBookScanMessages(contactIds)
): string[] => {
  const books = readStoredWorldBooks();
  if (selectedBookIds !== undefined) {
    const selected = new Set(selectedBookIds);
    return books
      .filter((book) => selected.has(book.id))
      .flatMap((book) =>
        book.entries
          .filter((entry) => entry.content.trim() && isWorldBookEntryActive(entry, scanMessages))
          .map((entry) => `【${book.name} / ${entry.title}】\n${entry.content}`)
      );
  }
  const contactSet = new Set(contactIds);
  const linksByContact = new Map<string, StoredWorldBookLink[]>();
  try {
    const raw = readStorageString('pocketos:wechat-contacts');
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      for (const contact of parsed as unknown[]) {
        if (!contact || typeof contact !== 'object' || !('id' in contact) ||
          typeof contact.id !== 'string' || !contactSet.has(contact.id) ||
          !('worldBooks' in contact) || !Array.isArray(contact.worldBooks)) continue;
        const links = contact.worldBooks.filter((link: unknown): link is StoredWorldBookLink =>
          !!link && typeof link === 'object' && 'bookId' in link && typeof link.bookId === 'string' &&
          (!('entryId' in link) || typeof link.entryId === 'string'));
        linksByContact.set(contact.id, links);
      }
    }
  } catch (error) {
    console.error('Could not read character world-book links.', error);
  }

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const book of books) {
    if (book.isGlobal) {
      for (const entry of book.entries) {
        const key = `${book.id}:${entry.id}`;
        if (!entry.content.trim() || seen.has(key) || !isWorldBookEntryActive(entry, scanMessages)) continue;
        seen.add(key);
        entries.push(`【${book.name} / ${entry.title}】\n${entry.content}`);
      }
    }
  }
  for (const contactId of contactIds) {
    for (const link of linksByContact.get(contactId) ?? []) {
      const book = books.find((item) => item.id === link.bookId);
      if (!book) continue;
      for (const entry of book.entries) {
        const key = `${book.id}:${entry.id}`;
        if (!entry.content.trim() || (link.entryId && link.entryId !== entry.id) || seen.has(key) || !isWorldBookEntryActive(entry, scanMessages)) continue;
        seen.add(key);
        entries.push(`【${book.name} / ${entry.title}】\n${entry.content}`);
      }
    }
  }
  return entries;
};

export const withWorldBooksForContacts = (
  systemPrompt: string,
  contactIds: string[],
  selectedBookIds?: string[],
  scanMessages?: readonly string[]
): string => {
  const entries = getWorldBookEntriesForContacts(contactIds, selectedBookIds, scanMessages);
  return entries.length > 0
    ? `可参考的世界书（仅用于理解设定与事实，优先遵守本次任务和聊天记录，不要复述无关条目）：\n${entries.join('\n\n')}\n\n${systemPrompt}`
    : systemPrompt;
};

export const withGlobalWorldBooks = (systemPrompt: string, scanMessages: readonly string[] = []): string => {
  const front = getGlobalWorldBookEntries('front', scanMessages);
  const after = [...getGlobalWorldBookEntries('middle', scanMessages), ...getGlobalWorldBookEntries('back', scanMessages)];
  return [
    front.length > 0 ? `全局世界书（前置）：\n${front.join('\n\n')}` : '',
    systemPrompt,
    after.length > 0 ? `全局世界书：\n${after.join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n');
};

// Auxiliary character features scan only that character's current direct chat,
// never another person's chat, an inactive archive or stored context summaries.
function readWorldBookScanMessages(contactIds: string[]): string[] {
  try {
    const chats = JSON.parse(readStorageString('yyphone:wechat-chats') || '[]');
    if (!Array.isArray(chats)) return [];
    return chats.filter(chat => chat?.type === 'direct' && chat.participantIds?.length === 1 && contactIds.includes(chat.participantIds[0]))
      .flatMap(chat => Array.isArray(chat.messages) ? chat.messages.filter((message: any) => typeof message?.text === 'string' && message.kind !== 'context-note').slice(-100).map((message: any) => message.text as string) : []);
  } catch { return []; }
}
