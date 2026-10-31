import { parseWorldBookActivation, type WorldBookActivation } from './worldBookActivation';

export interface PortableWorldBook {
  id: string;
  name: string;
  isGlobal?: boolean;
  entries: Array<WorldBookActivation & { id: string; title: string; content: string; depth: 'front' | 'middle' | 'back' }>;
}

interface WorldBookLink {
  bookId: string;
  entryId?: string;
}

interface PortableCharacter {
  id: string;
  name: string;
  avatarUrl: string;
  persona: string;
  group: string;
  starred: boolean;
  worldBooks: WorldBookLink[];
  bio?: string;
  forumNickname?: string;
  forumHandle?: string;
  stickerCategories?: string[];
  voiceEnabled?: boolean;
  voiceId?: string;
  voiceLanguage?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const parsePortableWorldBooks = (value: unknown): PortableWorldBook[] => {
  if (!Array.isArray(value)) throw new Error('角色包中的世界书列表无效。');
  return value.map((book) => {
    if (!isRecord(book) || typeof book.id !== 'string' || typeof book.name !== 'string' || !Array.isArray(book.entries)) {
      throw new Error('角色包中的世界书格式无效。');
    }
    return {
      id: book.id, name: book.name, isGlobal: book.isGlobal === true,
      entries: book.entries.map((entry) => {
        if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.title !== 'string' ||
          typeof entry.content !== 'string' || (entry.depth !== 'front' && entry.depth !== 'middle' && entry.depth !== 'back')) {
          throw new Error('角色包中的世界书条目格式无效。');
        }
        return { id: entry.id, title: entry.title, content: entry.content, depth: entry.depth, ...parseWorldBookActivation(entry) };
      }),
    };
  });
};

export const buildCharacterExport = (
  contact: PortableCharacter, selectedIds: string[], books: PortableWorldBook[], options: { includeVoice?: boolean } = {}
) => {
  const selected = books.filter((book) => selectedIds.includes(book.id));
  if (selected.length !== new Set(selectedIds).size) throw new Error('部分所选世界书已不存在，请重新选择。');
  return {
    format: 'yyphone-contacts', version: 1,
    contacts: [{
      id: contact.id, name: contact.name, avatarUrl: contact.avatarUrl,
      persona: contact.persona, group: contact.group, starred: contact.starred,
      bio: contact.bio, forumNickname: contact.forumNickname, forumHandle: contact.forumHandle,
      stickerCategories: contact.stickerCategories,
      ...(options.includeVoice !== false ? { voiceEnabled: contact.voiceEnabled, voiceId: contact.voiceId, voiceLanguage: contact.voiceLanguage } : {}),
      worldBooks: contact.worldBooks.filter((link) => selectedIds.includes(link.bookId)),
    }],
    worldBooks: selected,
  };
};

export const remapImportedWorldBooks = (books: PortableWorldBook[]) => {
  const ids = new Map<string, string>();
  const entries = new Map<string, Map<string, string>>();
  const mapped = books.map((book) => {
    if (ids.has(book.id)) throw new Error('角色包中包含重复世界书 ID。');
    const id = `book-${crypto.randomUUID()}`;
    ids.set(book.id, id);
    const entryIds = new Map<string, string>();
    entries.set(book.id, entryIds);
    return {
      ...book, id, isGlobal: false,
      entries: book.entries.map((entry) => {
        if (entryIds.has(entry.id)) throw new Error('角色包中包含重复条目 ID。');
        const entryId = `entry-${crypto.randomUUID()}`;
        entryIds.set(entry.id, entryId);
        return { ...entry, id: entryId };
      }),
    };
  });
  return {
    books: mapped,
    links: (links: WorldBookLink[]): WorldBookLink[] => [
      ...links.map((link) => {
        const bookId = ids.get(link.bookId);
        if (!bookId) throw new Error('角色包包含缺失的世界书引用。');
        const entryId = link.entryId ? entries.get(link.bookId)?.get(link.entryId) : undefined;
        if (link.entryId && !entryId) throw new Error('角色包包含缺失的世界书条目引用。');
        return { bookId, ...(entryId ? { entryId } : {}) };
      }),
      // Imported global books stay scoped to the imported character.
      ...books.filter((book) => book.isGlobal && !links.some((link) => link.bookId === book.id))
        .map((book) => ({ bookId: ids.get(book.id)! })),
    ],
  };
};
