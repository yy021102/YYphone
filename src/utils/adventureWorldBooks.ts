import { isWorldBookEntryActive, type WorldBookActivation } from './worldBookActivation';

export function formatAdventureWorldBooks(
  bookIds: string[],
  books: Array<{ id: string; name: string; entries: Array<WorldBookActivation & { title: string; content: string }> }>,
  scanMessages: readonly string[] = []
): string {
  if (!bookIds.length) return '';
  const selected = new Set(bookIds);
  return books.filter(book => selected.has(book.id))
    .flatMap(book => {
      const entries = book.entries.filter(entry => isWorldBookEntryActive(entry, scanMessages));
      return entries.length ? [`【绑定世界书：${book.name}】\n${entries.map(entry => `〔${entry.title}〕${entry.content}`).join('\n')}`] : [];
    })
    .join('\n\n');
}
