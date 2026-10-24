export function formatAdventureWorldBooks(
  bookIds: string[],
  books: Array<{ id: string; name: string; entries: Array<{ title: string; content: string }> }>
): string {
  if (!bookIds.length) return '';
  const selected = new Set(bookIds);
  return books.filter(book => selected.has(book.id))
    .map(book => `【绑定世界书：${book.name}】\n${book.entries.map(entry => `〔${entry.title}〕${entry.content}`).join('\n')}`)
    .join('\n\n');
}
