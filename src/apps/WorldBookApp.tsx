import React, { useEffect, useRef, useState } from 'react';
import {
  BookPlus,
  Check,
  Download,
  Globe2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { useErrorDialog } from '../components/ErrorDialog';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

interface WorldBookEntry {
  id: string;
  title: string;
  content: string;
  depth: 'front' | 'middle' | 'back';
}

interface WorldBook {
  id: string;
  name: string;
  isGlobal?: boolean;
  entries: WorldBookEntry[];
}

type EntryDraft = Omit<WorldBookEntry, 'id'> & { id?: string };

const STORAGE_KEY = 'yyphone:world-books';
const DEPTH_LABELS: Record<WorldBookEntry['depth'], string> = {
  front: '前置',
  middle: '中置',
  back: '后置',
};

const isWorldBookEntry = (value: unknown): value is WorldBookEntry =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as WorldBookEntry).id === 'string' &&
  typeof (value as WorldBookEntry).title === 'string' &&
  typeof (value as WorldBookEntry).content === 'string' &&
  ['front', 'middle', 'back'].includes((value as WorldBookEntry).depth);

const isWorldBookList = (value: unknown): value is WorldBook[] =>
  Array.isArray(value) &&
  value.every(
    (book) =>
      !!book &&
      typeof book === 'object' &&
      typeof (book as WorldBook).id === 'string' &&
      typeof (book as WorldBook).name === 'string' &&
      Array.isArray((book as WorldBook).entries) &&
      (book as WorldBook).entries.every(isWorldBookEntry) &&
      ((book as WorldBook).isGlobal === undefined || typeof (book as WorldBook).isGlobal === 'boolean')
  );

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface WorldBookAppProps {
  onBack: () => void;
}

export const WorldBookApp: React.FC<WorldBookAppProps> = ({ onBack }) => {
  const [books, setBooks] = useState(() =>
    readStoredValue(STORAGE_KEY, [] as WorldBook[], isWorldBookList)
  );
  const [selectedBookId, setSelectedBookId] = useState(() => books[0]?.id ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [editor, setEditor] = useState<EntryDraft | null>(null);
  const [editorBookId, setEditorBookId] = useState('');
  const [newBookName, setNewBookName] = useState('');
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookGlobal, setNewBookGlobal] = useState(false);
  const [moveTargetBookId, setMoveTargetBookId] = useState('');
  const [message, setMessage] = useState('');
  const [bookEditor, setBookEditor] = useState<{ id: string; name: string; isGlobal: boolean } | null>(null);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [error, setError] = useState('');
  useErrorDialog(error);
  const importInputRef = useRef<HTMLInputElement>(null);

  const selectedBook = books.find((book) => book.id === selectedBookId);

  useEffect(() => {
    if (!showNewBook) setNewBookGlobal(false);
  }, [showNewBook]);
  const persistBooks = (nextBooks: WorldBook[]): boolean => {
    try {
      writeStoredValue(STORAGE_KEY, nextBooks);
      setBooks(nextBooks);
      setError('');
      return true;
    } catch (storageError) {
      console.error('Could not save world books.', storageError);
      setError('保存失败，请检查浏览器本地存储空间后重试。');
      return false;
    }
  };

  const handleSaveEntry = () => {
    if (!editor || !editor.title.trim()) {
      setError('请填写条目标题。');
      return;
    }

    let targetBook = books.find((book) => book.id === editorBookId);
    const requestedBookName = newBookName.trim();
    if (!targetBook && requestedBookName) {
      targetBook = books.find(
        (book) => book.name.toLocaleLowerCase() === requestedBookName.toLocaleLowerCase()
      );
      if (!targetBook) {
        targetBook = { id: newId(), name: requestedBookName, entries: [] };
      }
    }
    if (!targetBook) {
      setError('请选择或输入世界书名称。');
      return;
    }

    const entry: WorldBookEntry = {
      id: editor.id ?? newId(),
      title: editor.title.trim(),
      content: editor.content,
      depth: editor.depth,
    };
    const booksWithoutEditedEntry = editor.id
      ? books.map((book) => ({
          ...book,
          entries: book.entries.filter((item) => item.id !== editor.id),
        }))
      : books;
    const targetExists = booksWithoutEditedEntry.some((book) => book.id === targetBook?.id);
    const nextBooks = targetExists
      ? booksWithoutEditedEntry.map((book) =>
          book.id === targetBook?.id ? { ...book, entries: [...book.entries, entry] } : book
        )
      : [...booksWithoutEditedEntry, { ...targetBook, entries: [entry] }];

    if (persistBooks(nextBooks)) {
      setSelectedBookId(targetBook.id);
      setEditor(null);
      setMessage(editor.id ? '条目已更新。' : '条目已添加。');
      setError('');
    }
  };

  const handleCreateBook = () => {
    const name = newBookName.trim();
    if (!name) {
      setError('请填写世界书名称。');
      return;
    }
    if (books.some((book) => book.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('该世界书已存在。');
      return;
    }
    const book: WorldBook = { id: newId(), name, entries: [], ...(newBookGlobal ? { isGlobal: true } : {}) };
    if (persistBooks([...books, book])) {
      setSelectedBookId(book.id);
      setShowNewBook(false);
      setNewBookName('');
      setNewBookGlobal(false);
      setMessage('世界书已创建。');
      setError('');
    }
  };

  const handleToggleGlobal = () => {
    if (!selectedBook) return;
    const nextGlobal = !selectedBook.isGlobal;
    const nextBooks = books.map((book) =>
      book.id === selectedBook.id ? { ...book, isGlobal: nextGlobal } : book
    );
    if (persistBooks(nextBooks)) {
      setMessage(
        nextGlobal
          ? `「${selectedBook.name}」已设为全局世界书，所有 AI 生成都会默认带上它。`
          : `「${selectedBook.name}」已取消全局，需在角色中单独关联才会发送。`
      );
    }
  };

  const handleDeleteBook = () => {
    if (!selectedBook) return;
    if (!window.confirm(`删除「${selectedBook.name}」及其中全部条目？此操作无法撤销。`)) return;
    const nextBooks = books.filter((book) => book.id !== selectedBook.id);
    if (persistBooks(nextBooks)) {
      setSelectedBookId(nextBooks[0]?.id ?? '');
      setSelectedEntryIds([]);
      setMessage('世界书已删除。');
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedBook || selectedEntryIds.length === 0) return;
    const nextBooks = books.map((book) =>
      book.id === selectedBook.id
        ? { ...book, entries: book.entries.filter((entry) => !selectedEntryIds.includes(entry.id)) }
        : book
    );
    if (persistBooks(nextBooks)) {
      setSelectedEntryIds([]);
      setMessage(`已删除 ${selectedEntryIds.length} 个条目。`);
    }
  };

  const handleMoveSelected = () => {
    if (!selectedBook || !moveTargetBookId || selectedEntryIds.length === 0) return;
    if (moveTargetBookId === selectedBook.id) {
      setError('请选择另一本文世界书进行归类。');
      return;
    }
    const targetBook = books.find((book) => book.id === moveTargetBookId);
    if (!targetBook) return;
    const movingEntries = selectedBook.entries.filter((entry) => selectedEntryIds.includes(entry.id));
    const nextBooks = books.map((book) => {
      if (book.id === selectedBook.id) {
        return { ...book, entries: book.entries.filter((entry) => !selectedEntryIds.includes(entry.id)) };
      }
      if (book.id === targetBook.id) {
        return { ...book, entries: [...book.entries, ...movingEntries] };
      }
      return book;
    });
    if (persistBooks(nextBooks)) {
      setSelectedEntryIds([]);
      setSelectedBookId(targetBook.id);
      setMessage(`已将 ${movingEntries.length} 个条目归类到「${targetBook.name}」。`);
    }
  };

  const handleSaveBookEditor = () => {
    if (!bookEditor) return;
    const name = bookEditor.name.trim();
    if (!name) {
      setError('请填写世界书名称。');
      return;
    }
    if (books.some((book) => book.id !== bookEditor.id && book.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('该世界书已存在。');
      return;
    }
    const nextBooks = books.map((book) => {
      if (book.id !== bookEditor.id) return book;
      const { isGlobal: _previous, ...rest } = book;
      return { ...rest, name, ...(bookEditor.isGlobal ? { isGlobal: true } : {}) };
    });
    if (persistBooks(nextBooks)) {
      setBookEditor(null);
      setMessage(`「${name}」已更新。`);
      setError('');
    }
  };

  const handleExport = (target?: WorldBook) => {
    const selectedBook = target;
    if (!selectedBook) {
      setError('请先选择要导出的世界书。');
      return;
    }
    const entries = Object.fromEntries(
      selectedBook.entries.map((entry, index) => [
        String(index),
        {
          uid: index,
          comment: entry.title,
          content: entry.content,
          key: [],
          depth: entry.depth === 'front' ? 0 : entry.depth === 'middle' ? 4 : 8,
          position: entry.depth,
        },
      ])
    );
    const content = JSON.stringify(
      { format: 'yyphone-world-book', version: 1, name: selectedBook.name, entries },
      null,
      2
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedBook.name}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`「${selectedBook.name}」已导出。`);
    setError('');
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object') throw new Error('文件内容不是有效的世界书。');

      const root = parsed as Record<string, unknown>;
      const isYyphone = root.format === 'yyphone-world-book' && root.version === 1;
      if (root.format !== undefined && !isYyphone) {
        throw new Error('文件格式不正确或版本不受支持。');
      }
      const rawBookName =
        (typeof root.name === 'string' && root.name) ||
        file.name.replace(/\.json$/i, '').trim() ||
        '导入的世界书';
      const rawEntries = root.entries;
      if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
        throw new Error('文件中没有有效的世界书条目。');
      }

      const entries = Object.values(rawEntries as Record<string, unknown>).map(
        (rawEntry, index): WorldBookEntry => {
          if (!rawEntry || typeof rawEntry !== 'object') {
            throw new Error(`第 ${index + 1} 个条目格式无效。`);
          }
          const entry = rawEntry as Record<string, unknown>;
          const title =
            (typeof entry.title === 'string' && entry.title) ||
            (typeof entry.comment === 'string' && entry.comment) ||
            (Array.isArray(entry.key) && entry.key.find((key): key is string => typeof key === 'string')) ||
            `条目 ${index + 1}`;
          if (typeof entry.content !== 'string') {
            throw new Error(`条目「${title}」缺少正文内容。`);
          }
          const depth =
            entry.position === 'front' || entry.position === 'middle' || entry.position === 'back'
              ? entry.position
              : typeof entry.depth === 'number' && entry.depth <= 0
                ? 'front'
                : typeof entry.depth === 'number' && entry.depth >= 8
                  ? 'back'
                  : 'middle';
          return { id: newId(), title, content: entry.content, depth };
        }
      );
      if (entries.length === 0) throw new Error('该世界书没有可导入的条目。');

      const existing = books.find(
        (book) => book.name.toLocaleLowerCase() === rawBookName.toLocaleLowerCase()
      );
      const nextBooks = existing
        ? books.map((book) =>
            book.id === existing.id ? { ...book, entries: [...book.entries, ...entries] } : book
          )
        : [...books, { id: newId(), name: rawBookName, entries }];
      if (persistBooks(nextBooks)) {
        const importedBook = nextBooks.find(
          (book) => book.name.toLocaleLowerCase() === rawBookName.toLocaleLowerCase()
        );
        if (importedBook) setSelectedBookId(importedBook.id);
        setMessage(`已导入「${rawBookName}」的 ${entries.length} 个条目。`);
        setError('');
      }
    } catch (importError) {
      console.error('Could not import world book.', importError);
      setError(importError instanceof Error ? importError.message : '无法导入该世界书。');
    }
  };

  const openNewEntry = () => {
    setEditor({ title: '', content: '', depth: 'middle' });
    setEditorBookId(selectedBookId);
    setNewBookName('');
    setError('');
    setMenuOpen(false);
  };

  return (
    <div className="relative flex-1 w-full flex flex-col bg-gradient-to-b from-[#EAF4FF] via-[#F5F1FA] to-[#FDEBF3] overflow-hidden select-none">
      {/* 梦幻粉蓝背景光晕 */}
      <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-pink-300/25 blur-3xl pointer-events-none" />

      <AppHeader
        title="世界书"
        onBack={onBack}
        rightAction={
          <button
            type="button"
            aria-label="世界书菜单"
            onClick={() => setMenuOpen((open) => !open)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sky-700 bg-white/70 hover:bg-white/90 backdrop-blur-md border border-white/90 shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        }
      />

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-12 right-4 z-40 w-44 rounded-2xl bg-white/90 backdrop-blur-2xl shadow-xl border border-white p-1.5 space-y-0.5">
          <button onClick={openNewEntry} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-sky-50/70 rounded-xl font-medium cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-sky-500" />新增条目
          </button>
          <button
            onClick={() => {
              setShowNewBook(true);
              setNewBookName('');
              setMenuOpen(false);
              setError('');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-sky-50/70 rounded-xl font-medium cursor-pointer"
          >
            <BookPlus className="w-3.5 h-3.5 text-sky-500" />新增世界书
          </button>
          <button onClick={() => { setMenuOpen(false); importInputRef.current?.click(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-sky-50/70 rounded-xl font-medium cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-indigo-500" />导入世界书
          </button>
          <button onClick={() => { setMenuOpen(false); setExportPickerOpen(true); setError(''); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-sky-50/70 rounded-xl font-medium cursor-pointer">
            <Download className="w-3.5 h-3.5 text-sky-500" />导出世界书
          </button>
          <button
            onClick={() => {
              setEditingMode((editing) => !editing);
              setSelectedEntryIds([]);
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-sky-50/70 rounded-xl font-medium cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5 text-pink-500" />{editingMode ? '完成编辑' : '编辑条目'}
          </button>
          {selectedBook && (
            <button onClick={() => { setMenuOpen(false); setBookEditor({ id: selectedBook.id, name: selectedBook.name, isGlobal: !!selectedBook.isGlobal }); setError(''); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-sky-50/70 rounded-xl font-medium cursor-pointer">
              <Pencil className="w-3.5 h-3.5 text-sky-500" />编辑当前世界书
            </button>
          )}
          {selectedBook && (
            <button onClick={() => { setMenuOpen(false); handleToggleGlobal(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-sky-50/70 rounded-xl font-medium cursor-pointer">
              <Globe2 className="w-3.5 h-3.5 text-emerald-500" />{selectedBook.isGlobal ? '取消全局世界书' : '设为全局世界书'}
            </button>
          )}
          {selectedBook && (
            <button onClick={() => { setMenuOpen(false); handleDeleteBook(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-rose-500 hover:bg-rose-50 rounded-xl font-medium cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />删除当前世界书
            </button>
          )}
          </div>
        </>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          void handleImport(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3.5">
        <div className="flex items-center gap-2">
          <select
            value={selectedBookId}
            onChange={(event) => {
              setSelectedBookId(event.target.value);
              setSelectedEntryIds([]);
              setMessage('');
            }}
            aria-label="选择世界书"
            className="min-w-0 flex-1 rounded-2xl bg-white/65 backdrop-blur-xl border border-white/85 px-3.5 py-2.5 text-xs font-bold text-[#2C4A5C] outline-none shadow-2xs"
          >
            {books.length === 0 && <option value="">暂无世界书</option>}
            {books.map((book) => (
              <option key={book.id} value={book.id}>{book.isGlobal ? '🌐 ' : ''}{book.name}</option>
            ))}
          </select>
          {selectedBook && (
            <button
              onClick={() => setBookEditor({ id: selectedBook.id, name: selectedBook.name, isGlobal: !!selectedBook.isGlobal })}
              aria-label="编辑世界书"
              className="w-10 h-10 shrink-0 rounded-2xl bg-white/65 backdrop-blur-xl border border-white/85 flex items-center justify-center shadow-2xs active:scale-95 transition-transform cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-pink-400" />
            </button>
          )}
          {selectedBook && (
            <button
              onClick={() => { setShowNewBook(true); setNewBookName(''); setError(''); }}
              aria-label="新增世界书"
              className="w-10 h-10 shrink-0 rounded-2xl bg-white/65 backdrop-blur-xl border border-white/85 flex items-center justify-center text-[#2C4A5C] shadow-2xs active:scale-95 transition-transform cursor-pointer"
            >
              <BookPlus className="w-4 h-4 text-sky-500" />
            </button>
          )}
        </div>

        {selectedBook && (
          <button
            type="button"
            role="switch"
            aria-checked={!!selectedBook.isGlobal}
            onClick={handleToggleGlobal}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/85 px-3.5 py-2.5 text-left shadow-2xs cursor-pointer"
          >
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[#2C4A5C]">全局世界书</span>
              <span className="block text-[10px] text-slate-500 leading-snug">
                {selectedBook.isGlobal
                  ? '已开启：本书条目会默认发送到所有 AI 生成中'
                  : '未开启：仅在角色单独关联时才会加入提示词'}
              </span>
            </span>
            <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${selectedBook.isGlobal ? 'bg-emerald-400' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${selectedBook.isGlobal ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
          </button>
        )}

        {editingMode && selectedBook && (
          <div className="bg-white/60 backdrop-blur-xl border border-white/85 rounded-3xl p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-600">已选 {selectedEntryIds.length} 项</span>
              <div className="flex gap-2">
                <button onClick={handleDeleteSelected} disabled={selectedEntryIds.length === 0} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-1.5 text-[11px] font-bold text-rose-500 disabled:opacity-40 cursor-pointer">
                  <Trash2 className="inline w-3 h-3 mr-1" />删除
                </button>
              </div>
            </div>
            {selectedEntryIds.length > 0 && books.length > 1 && (
              <div className="flex gap-2">
                <select
                  value={moveTargetBookId}
                  onChange={(event) => setMoveTargetBookId(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                  aria-label="归类到世界书"
                >
                  <option value="">选择目标世界书</option>
                  {books.filter((book) => book.id !== selectedBook.id).map((book) => (
                    <option key={book.id} value={book.id}>{book.name}</option>
                  ))}
                </select>
                <button onClick={handleMoveSelected} disabled={!moveTargetBookId} className="rounded-xl bg-gradient-to-r from-sky-100 to-pink-100 border border-white/80 px-3.5 py-1.5 text-[11px] font-bold text-[#587589] disabled:opacity-40 cursor-pointer shadow-2xs">
                  归类
                </button>
              </div>
            )}
          </div>
        )}

        {selectedBook?.entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-white/65 backdrop-blur-xl border border-white/85 rounded-3xl flex items-center gap-3 p-4 shadow-[0_8px_20px_-6px_rgba(148,163,184,0.12)] hover:bg-white/80 transition-all"
          >
            {editingMode && (
              <button
                type="button"
                aria-label={`选择条目 ${entry.title}`}
                onClick={() =>
                  setSelectedEntryIds((ids) =>
                    ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id]
                  )
                }
                className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-all ${
                  selectedEntryIds.includes(entry.id)
                    ? 'bg-gradient-to-r from-sky-100 to-pink-100 border-white/80 text-[#587589] shadow-2xs'
                    : 'border-slate-300 bg-white/70'
                }`}
              >
                {selectedEntryIds.includes(entry.id) && <Check className="w-3 h-3" />}
              </button>
            )}
            <button
              onClick={() => {
                if (editingMode) {
                  setSelectedEntryIds((ids) =>
                    ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id]
                  );
                  return;
                }
                setEditor(entry);
                setEditorBookId(selectedBook.id);
                setNewBookName('');
                setError('');
              }}
              className="min-w-0 flex-1 text-left text-xs font-bold text-[#2C4A5C] truncate cursor-pointer"
            >
              {entry.title}
            </button>
            {!editingMode && (
              <span className="shrink-0 text-[10px] font-semibold text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
                {DEPTH_LABELS[entry.depth]}
              </span>
            )}
          </div>
        ))}

        {(!selectedBook || selectedBook.entries.length === 0) && (
          <div className="bg-white/55 backdrop-blur-xl border border-white/85 rounded-3xl p-8 text-center space-y-2 shadow-2xs">
            <div className="w-11 h-11 rounded-2xl bg-sky-100/70 text-sky-500 flex items-center justify-center mx-auto text-xl">
              📖
            </div>
            <p className="text-xs font-bold text-slate-600">
              {selectedBook ? '这本世界书还没有条目哦~' : '还没有创建世界书'}
            </p>
            <button
              onClick={() => {
                if (selectedBook) openNewEntry();
                else {
                  setShowNewBook(true);
                  setNewBookName('');
                  setError('');
                }
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-100 to-pink-100 border border-white/80 px-3.5 py-1.5 text-xs font-bold text-[#587589] shadow-2xs cursor-pointer active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              {selectedBook ? '新增条目' : '新增世界书'}
            </button>
          </div>
        )}

        {message && <p className="px-1 text-center text-[11px] font-bold text-emerald-600">{message}</p>}
        {error && <p role="alert" className="px-1 text-center text-[11px] font-bold text-rose-500">{error}</p>}
      </div>

      {(editor || showNewBook) && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditor(null);
              setShowNewBook(false);
              setError('');
            }
          }}
        >
          <div className="w-full max-w-sm max-h-[90%] overflow-y-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-white p-5 shadow-2xl space-y-3.5 text-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#2C4A5C]">
                {showNewBook ? '新增世界书' : editor?.id ? '编辑条目' : '新增条目'}
              </h2>
              <button
                aria-label="关闭"
                onClick={() => { setEditor(null); setShowNewBook(false); setError(''); }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showNewBook ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-600">
                  世界书名称
                  <input
                    autoFocus
                    value={newBookName}
                    onChange={(event) => setNewBookName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') handleCreateBook(); }}
                    maxLength={80}
                    placeholder="输入名称..."
                    className="mt-1 w-full rounded-2xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-sky-400"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={newBookGlobal}
                    onChange={(event) => setNewBookGlobal(event.target.checked)}
                  />
                  设为全局世界书（所有 AI 生成默认发送）
                </label>
                <button
                  onClick={handleCreateBook}
                  className="w-full rounded-2xl bg-gradient-to-r from-sky-100 to-pink-100 border border-white/80 py-2.5 text-xs font-bold text-[#587589] shadow-2xs cursor-pointer"
                >
                  创建世界书
                </button>
              </div>
            ) : editor && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-600">
                  标题
                  <input
                    autoFocus
                    value={editor.title}
                    onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                    maxLength={120}
                    className="mt-1 w-full rounded-2xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-sky-400"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  所属世界书
                  <select
                    value={books.some((book) => book.id === editorBookId) ? editorBookId : '__new__'}
                    onChange={(event) => {
                      setEditorBookId(event.target.value === '__new__' ? '' : event.target.value);
                      if (event.target.value !== '__new__') setNewBookName('');
                    }}
                    className="mt-1 w-full rounded-2xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  >
                    {books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
                    <option value="__new__">输入新世界书名称…</option>
                  </select>
                </label>
                {!books.some((book) => book.id === editorBookId) && (
                  <input
                    value={newBookName}
                    onChange={(event) => setNewBookName(event.target.value)}
                    maxLength={80}
                    placeholder="新世界书名称"
                    className="w-full rounded-2xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-sky-400"
                  />
                )}
                <label className="block text-xs font-bold text-slate-600">
                  深度
                  <select
                    value={editor.depth}
                    onChange={(event) => {
                      if (event.target.value === 'front' || event.target.value === 'middle' || event.target.value === 'back') {
                        setEditor({ ...editor, depth: event.target.value });
                      }
                    }}
                    className="mt-1 w-full rounded-2xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="front">前置</option>
                    <option value="middle">中置</option>
                    <option value="back">后置</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  内容
                  <textarea
                    value={editor.content}
                    onChange={(event) => setEditor({ ...editor, content: event.target.value })}
                    rows={6}
                    className="mt-1 w-full resize-y rounded-2xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs leading-relaxed outline-none focus:border-sky-400"
                  />
                </label>
                <button
                  onClick={handleSaveEntry}
                  style={{ background: '                  linear-gradient(90deg, #DCEEFD 0%, #FBE1EC 100%)' }}
                                    className="w-full rounded-2xl border border-white/80 py-2.5 text-xs font-bold text-[#587589] shadow-2xs cursor-pointer"
                >
                  保存条目
                </button>
              </div>
            )}
            {error && <p role="alert" className="text-[11px] font-bold text-rose-500">{error}</p>}
          </div>
        </div>
      )}

      {bookEditor && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) { setBookEditor(null); setError(''); } }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white/95 backdrop-blur-2xl border border-white p-5 shadow-2xl space-y-3.5 text-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#2C4A5C]">编辑世界书</h2>
              <button aria-label="关闭" onClick={() => { setBookEditor(null); setError(''); }} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-xs font-bold text-slate-600">
              世界书名称
              <input
                autoFocus
                value={bookEditor.name}
                onChange={(event) => setBookEditor({ ...bookEditor, name: event.target.value })}
                onKeyDown={(event) => { if (event.key === 'Enter') handleSaveBookEditor(); }}
                maxLength={80}
                className="mt-1 w-full rounded-2xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-sky-400"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={bookEditor.isGlobal}
                onChange={(event) => setBookEditor({ ...bookEditor, isGlobal: event.target.checked })}
              />
              设为全局世界书（所有 AI 生成默认发送）
            </label>
            {error && <p role="alert" className="text-[11px] font-bold text-rose-500">{error}</p>}
            <button
              onClick={handleSaveBookEditor}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-100 to-pink-100 border border-white/80 py-2.5 text-xs font-bold text-[#587589] shadow-2xs cursor-pointer"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {exportPickerOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setExportPickerOpen(false); }}
        >
          <div className="w-full max-w-sm max-h-[80%] overflow-y-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-white p-5 shadow-2xl space-y-3 text-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#2C4A5C]">选择要导出的世界书</h2>
              <button aria-label="关闭" onClick={() => setExportPickerOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {books.length === 0 && <p className="text-xs text-slate-400">暂无世界书可导出。</p>}
            {books.map((book) => (
              <button
                key={book.id}
                onClick={() => { handleExport(book); setExportPickerOpen(false); }}
                className="w-full flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-sky-50 to-pink-50 border border-white/80 px-3.5 py-2.5 text-left text-xs font-bold text-[#2C4A5C] cursor-pointer active:scale-[0.99]"
              >
                <span className="truncate">{book.isGlobal ? '🌐 ' : ''}{book.name}</span>
                <span className="shrink-0 text-[10px] font-medium text-slate-400">{book.entries.length} 条 · 导出</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};