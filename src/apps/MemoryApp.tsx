import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pencil, Pin, PinOff, Plus, Search, Settings, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { showYyError } from '../components/ErrorDialog';
import { readOfflineContacts, OfflineContact } from '../utils/offlineData';
import {
  addMemoryCandidates,
  embedMissingMemories,
  embeddingConfigured,
  embedTexts,
  exportMemories,
  importMemories,
  MEMORY_CATEGORIES,
  MemoryCandidate,
  MemoryCategory,
  MemoryItem,
  MemorySettings,
  newMemoryId,
  rankMemories,
  readEmbeddings,
  readMemories,
  readMemorySettings,
  removeEmbeddings,
  ScoredMemory,
  SHARED_MEMORY_ID,
  writeMemories,
  writeMemorySettings,
} from '../utils/memoryData';
import { advanceMemoryCursor, countNewMessages, extractMemoryCandidates } from '../utils/memoryAi';
import { GrowthPanel, JournalPanel } from '../components/MemoryJournalGrowth';

interface MemoryAppProps {
  onBack: () => void;
}

const cardClass = 'rounded-[22px] border border-white/90 bg-white/75 backdrop-blur-xl shadow-[0_6px_20px_-10px_rgba(148,163,184,0.3)]';
const pillBtn = 'rounded-full border border-white bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#6F7F8E] active:scale-95 disabled:opacity-50';
const gradBtn = 'rounded-full bg-gradient-to-r from-[#F5C6D6] to-[#BFD9F0] px-4 py-2 text-xs font-bold text-[#5F6F7E] active:scale-95 disabled:opacity-50';
const inputClass = 'w-full rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700 outline-none focus:border-pink-200';

const categoryOf = (id: MemoryCategory) => MEMORY_CATEGORIES.find((c) => c.id === id) ?? MEMORY_CATEGORIES[1];

const downloadJson = (fileName: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

interface Candidate extends MemoryCandidate {
  key: string;
  selected: boolean;
}

export const MemoryApp: React.FC<MemoryAppProps> = ({ onBack }) => {
  const [contacts] = useState<OfflineContact[]>(() => readOfflineContacts());
  const [memories, setMemories] = useState<MemoryItem[]>(() => readMemories());
  const [settings, setSettings] = useState<MemorySettings>(() => readMemorySettings());
  const [embeddedIds, setEmbeddedIds] = useState<Set<string>>(() => new Set());
  const [ownerId, setOwnerId] = useState<string>(() => readOfflineContacts()[0]?.id ?? SHARED_MEMORY_ID);
  const [category, setCategory] = useState<'all' | MemoryCategory>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MemoryItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState<{ charId: string; cursor: string; candidates: Candidate[] } | null>(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<ScoredMemory[] | null>(null);
  const [tab, setTab] = useState<'memories' | 'journal' | 'growth'>('memories');
  const activeTab = ownerId === SHARED_MEMORY_ID ? 'memories' : tab;
  const importRef = useRef<HTMLInputElement>(null);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const refreshEmbedded = () => {
    const store = readEmbeddings();
    const model = readMemorySettings().embedding.model;
    setEmbeddedIds(new Set(Object.entries(store).filter(([, value]) => value.m === model).map(([id]) => id)));
  };

  useEffect(() => {
    refreshEmbedded();
  }, []);

  const persistSettings = (next: MemorySettings) => {
    setSettings(next);
    writeMemorySettings(next);
  };

  const persistMemories = (next: MemoryItem[]) => {
    setMemories(next);
    writeMemories(next);
  };

  const ownerName = (id: string) => (id === SHARED_MEMORY_ID ? '玩家通用' : contacts.find((c) => c.id === id)?.name ?? '未知角色');
  const owners = [...contacts.map((c) => ({ id: c.id, name: c.name })), { id: SHARED_MEMORY_ID, name: '玩家通用' }];

  const mine = memories.filter((item) => item.charId === ownerId);
  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return mine
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => !keyword || item.content.toLowerCase().includes(keyword))
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || b.importance - a.importance || b.updatedAt.localeCompare(a.updatedAt)
      );
  }, [mine, category, search]);

  const pendingCount = useMemo(
    () => (ownerId === SHARED_MEMORY_ID ? 0 : countNewMessages(ownerId, settings)),
    [ownerId, settings, memories]
  );
  const embeddedCount = mine.filter((item) => embeddedIds.has(item.id)).length;
  const configured = embeddingConfigured(settings.embedding);

  // ---------- 向量化（后台，失败只提示，不影响保存） ----------
  const embedInBackground = async (items: MemoryItem[]) => {
    const config = readMemorySettings().embedding;
    if (!embeddingConfigured(config) || items.length === 0) return;
    try {
      await embedMissingMemories(items, config);
    } catch (error) {
      console.warn('Memory embedding failed.', error);
      flash('向量化失败，这些记忆暂时只能用关键词检索');
    } finally {
      refreshEmbedded();
    }
  };

  // ---------- 增删改 ----------
  const saveEditing = () => {
    if (!editing || !editing.content.trim()) return;
    const now = new Date().toISOString();
    const item: MemoryItem = { ...editing, content: editing.content.trim().slice(0, 300), updatedAt: now };
    const exists = memories.some((m) => m.id === item.id);
    const previous = memories.find((m) => m.id === item.id);
    persistMemories(exists ? memories.map((m) => (m.id === item.id ? item : m)) : [...memories, item]);
    if (previous && previous.content !== item.content) removeEmbeddings([item.id]);
    setEditing(null);
    if (!exists || previous?.content !== item.content) void embedInBackground([item]);
    else refreshEmbedded();
  };

  const deleteItem = (item: MemoryItem) => {
    if (!window.confirm('删除这条记忆？')) return;
    persistMemories(memories.filter((m) => m.id !== item.id));
    removeEmbeddings([item.id]);
    refreshEmbedded();
  };

  const togglePin = (item: MemoryItem) =>
    persistMemories(memories.map((m) => (m.id === item.id ? { ...m, pinned: !m.pinned, updatedAt: new Date().toISOString() } : m)));

  const startAdd = () => {
    const now = new Date().toISOString();
    setEditing({
      id: newMemoryId(),
      charId: ownerId,
      content: '',
      category: 'fact',
      importance: 3,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      recallCount: 0,
      source: 'manual',
    });
  };

  // ---------- 整理记忆 ----------
  const runExtract = async () => {
    if (busy || ownerId === SHARED_MEMORY_ID) return;
    setBusy('extract');
    try {
      const result = await extractMemoryCandidates(ownerId);
      if (result.messageCount === 0) {
        flash('没有新的聊天需要整理');
        return;
      }
      if (result.candidates.length === 0) {
        advanceMemoryCursor(ownerId, result.newCursor);
        setSettings(readMemorySettings());
        flash(`已看过 ${result.messageCount} 条新消息，没有需要长期记住的内容`);
        return;
      }
      if (settings.confirmManual) {
        setReview({
          charId: ownerId,
          cursor: result.newCursor,
          candidates: result.candidates.map((c, i) => ({ ...c, key: `${i}-${c.content.slice(0, 6)}`, selected: true })),
        });
      } else {
        await commitCandidates(ownerId, result.candidates, result.newCursor);
      }
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '整理记忆失败');
    } finally {
      setBusy('');
    }
  };

  const commitCandidates = async (charId: string, candidates: MemoryCandidate[], cursor: string) => {
    const { added, merged } = await addMemoryCandidates(charId, candidates, 'chat', readMemorySettings());
    advanceMemoryCursor(charId, cursor);
    setMemories(readMemories());
    setSettings(readMemorySettings());
    refreshEmbedded();
    flash(`新增 ${added} 条${merged > 0 ? `，合并 ${merged} 条相近记忆` : ''}`);
    const missing = readMemories().filter((m) => m.charId === charId);
    void embedInBackground(missing);
  };

  // ---------- 导入导出 ----------
  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      const { items, skipped } = importMemories(data, ownerId, contacts.map((c) => c.id));
      setMemories(readMemories());
      flash(`导入 ${items.length} 条${skipped ? `，跳过 ${skipped} 条（重复或格式不对）` : ''}`);
      void embedInBackground(items);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '导入记忆失败');
    }
  };

  // ---------- 设置 ----------
  const testEmbedding = async () => {
    setBusy('test');
    try {
      const [vector] = await embedTexts(['你好，这是一条测试'], settings.embedding);
      flash(`连接成功，向量维度 ${vector?.length ?? 0}`);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '向量化接口测试失败');
    } finally {
      setBusy('');
    }
  };

  const embedAll = async () => {
    setBusy('embed');
    try {
      const count = await embedMissingMemories(readMemories(), settings.embedding, (done, total) => setBusy(`embed ${done}/${total}`));
      flash(count === 0 ? '所有记忆都已向量化' : `已向量化 ${count} 条`);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '向量化失败');
    } finally {
      setBusy('');
      refreshEmbedded();
    }
  };

  const runRetrievalTest = async () => {
    if (!testQuery.trim()) return;
    setBusy('retrieve');
    try {
      setTestResults(await rankMemories([ownerId], testQuery, settings, { ignoreThreshold: true, limit: 8 }));
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '检索测试失败');
    } finally {
      setBusy('');
    }
  };

  const embedProgress = busy.startsWith('embed') ? busy.replace('embed', '').trim() : '';

  return (
    <div className="relative flex flex-1 w-full flex-col overflow-hidden bg-gradient-to-b from-[#FBF3F7] via-[#F3F6FB] to-[#EAF2F8] text-slate-700">
      <AppHeader
        title="记忆"
        subtitle="长期记忆 · 陪伴"
        onBack={onBack}
        rightAction={
          <button type="button" aria-label="记忆设置" onClick={() => setSettingsOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5">
            <Settings className="h-[18px] w-[18px]" />
          </button>
        }
      />

      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-[60] -translate-x-1/2 rounded-full bg-slate-700/85 px-4 py-2 text-[11px] text-white">{notice}</div>
      )}

      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {owners.map((owner) => (
            <button
              key={owner.id}
              type="button"
              onClick={() => setOwnerId(owner.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs ${ownerId === owner.id ? 'border-pink-200 bg-gradient-to-r from-pink-50 to-sky-50 font-bold text-[#6F7F8E]' : 'border-slate-200 bg-white/70 text-slate-400'}`}
            >
              {owner.id === SHARED_MEMORY_ID ? '🌐 ' : ''}{owner.name}
            </button>
          ))}
        </div>

        {ownerId !== SHARED_MEMORY_ID && (
          <div className="grid grid-cols-3 rounded-2xl bg-white/70 p-1 text-xs">
            {([['memories', '记忆库'], ['journal', '流水账'], ['growth', '成长笔记']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-xl py-1.5 font-semibold ${activeTab === key ? 'bg-white text-[#6F7F8E] shadow-sm' : 'text-slate-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'journal' && <JournalPanel charId={ownerId} charName={ownerName(ownerId)} flash={flash} />}
        {activeTab === 'growth' && <GrowthPanel charId={ownerId} charName={ownerName(ownerId)} flash={flash} />}

        {activeTab === 'memories' && (<>
        <div className={`${cardClass} space-y-2.5 p-3.5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#4A5A6A]">{ownerName(ownerId)}的记忆</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                共 {mine.length} 条 · {configured ? `已向量化 ${embeddedCount}/${mine.length}` : '未配置向量化（使用关键词检索）'}
                {ownerId !== SHARED_MEMORY_ID && ` · 待整理新消息 ${pendingCount} 条`}
              </p>
            </div>
          </div>
          {ownerId === SHARED_MEMORY_ID && (
            <p className="text-[10px] leading-relaxed text-slate-400">玩家通用记忆对所有角色生效，适合放你的称呼、生日、基本情况等。</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={gradBtn} disabled={!!busy || ownerId === SHARED_MEMORY_ID} onClick={() => void runExtract()}>
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />{busy === 'extract' ? '整理中…' : '整理记忆'}
            </button>
            <button type="button" className={pillBtn} onClick={startAdd}><Plus className="mr-1 inline h-3 w-3" />添加</button>
            <button type="button" className={pillBtn} onClick={() => importRef.current?.click()}><Upload className="mr-1 inline h-3 w-3" />导入</button>
            <button
              type="button"
              className={pillBtn}
              onClick={() => downloadJson(`${ownerName(ownerId)}-memories.json`, exportMemories(ownerId))}
            >
              <Download className="mr-1 inline h-3 w-3" />导出
            </button>
            <button type="button" className={pillBtn} onClick={() => downloadJson('all-memories.json', exportMemories('all'))}>导出全部</button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void handleImport(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
          <input className={`${inputClass} pl-9`} placeholder="搜索记忆内容…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: 'all' as const, label: '全部', emoji: '' }, ...MEMORY_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${category === c.id ? 'border-sky-200 bg-sky-50 font-bold text-[#5B7485]' : 'border-slate-200 bg-white/70 text-slate-400'}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div className={`${cardClass} p-6 text-center`}>
            <p className="text-xs font-bold text-[#6F7F8E]">{mine.length === 0 ? '这里还是空的' : '没有符合条件的记忆'}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {mine.length === 0 ? '点「整理记忆」让 AI 从微信聊天里提炼，或者手动添加。' : '换个分类或关键词试试。'}
            </p>
          </div>
        )}

        {visible.map((item) => {
          const cat = categoryOf(item.category);
          return (
            <div key={item.id} className={`${cardClass} p-3.5 ${item.pinned ? 'border-pink-200' : ''}`}>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-lg">{cat.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">{item.content}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                    <span>{cat.label}</span>
                    <span className="text-amber-400">{'★'.repeat(item.importance)}<span className="text-slate-200">{'★'.repeat(5 - item.importance)}</span></span>
                    <span>{item.createdAt.slice(0, 10)}</span>
                    {item.recallCount > 0 && <span>想起 {item.recallCount} 次</span>}
                    <span title={embeddedIds.has(item.id) ? '已向量化' : '仅关键词'}>{embeddedIds.has(item.id) ? '🟢向量' : '⚪关键词'}</span>
                    {item.source === 'chat' && <span>聊天整理</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button type="button" aria-label={item.pinned ? '取消置顶' : '置顶'} onClick={() => togglePin(item)} className={`rounded-full p-1.5 hover:bg-white ${item.pinned ? 'text-pink-400' : 'text-slate-300'}`}>
                    {item.pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" aria-label="编辑" onClick={() => setEditing(item)} className="rounded-full p-1.5 text-slate-400 hover:bg-white"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="删除" onClick={() => deleteItem(item)} className="rounded-full p-1.5 text-rose-300 hover:bg-white"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
        </>)}
      </div>

      {/* ---------- 编辑 / 添加 ---------- */}
      {editing && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/25 backdrop-blur-xs">
          <div className="flex max-h-[90%] w-full max-w-md flex-col rounded-t-[28px] border border-white bg-gradient-to-b from-white to-[#F6F8FC] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A5A6A]">{memories.some((m) => m.id === editing.id) ? '编辑记忆' : '添加记忆'}</h3>
              <button type="button" aria-label="关闭" onClick={() => setEditing(null)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-600">内容（用“玩家”指玩家，“我”指角色）</span>
                <textarea
                  className={`${inputClass} h-24 resize-none leading-relaxed`}
                  value={editing.content}
                  maxLength={300}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  placeholder="例如：玩家怕黑，睡觉要留一盏小夜灯"
                />
              </label>
              <div className="space-y-1">
                <span className="font-semibold text-slate-600">分类</span>
                <div className="flex flex-wrap gap-1.5">
                  {MEMORY_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditing({ ...editing, category: c.id })}
                      className={`rounded-full border px-3 py-1 text-[11px] ${editing.category === c.id ? 'border-pink-200 bg-pink-50 font-bold text-[#6F7F8E]' : 'border-slate-200 bg-white/70 text-slate-400'}`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">{categoryOf(editing.category).hint}。「核心」和置顶的记忆每轮都会注入。</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-slate-600">重要度</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-label={`${n}星`} onClick={() => setEditing({ ...editing, importance: n })} className={`text-xl ${n <= editing.importance ? 'text-amber-400' : 'text-slate-200'}`}>★</button>
                  ))}
                </div>
              </div>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-600">属于</span>
                <select className={inputClass} value={editing.charId} onChange={(e) => setEditing({ ...editing, charId: e.target.value })}>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={editing.pinned} onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })} />
                <span>置顶（每轮聊天都带上）</span>
              </label>
            </div>
            <button type="button" className={`${gradBtn} mt-3 w-full`} disabled={!editing.content.trim()} onClick={saveEditing}>保存</button>
          </div>
        </div>
      )}

      {/* ---------- 整理结果确认 ---------- */}
      {review && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/25 backdrop-blur-xs">
          <div className="flex max-h-[90%] w-full max-w-md flex-col rounded-t-[28px] border border-white bg-gradient-to-b from-white to-[#F6F8FC] p-4 shadow-2xl">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A5A6A]">AI 整理出 {review.candidates.length} 条记忆</h3>
              <button type="button" aria-label="关闭" onClick={() => setReview(null)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-2 text-[11px] text-slate-400">取消勾选不想要的，也可以直接改文字。确认后才会写入，并标记这些聊天已整理。</p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {review.candidates.map((candidate) => (
                <div key={candidate.key} className={`${cardClass} flex items-start gap-2 p-2.5 ${candidate.selected ? '' : 'opacity-50'}`}>
                  <input
                    type="checkbox"
                    className="mt-1.5"
                    checked={candidate.selected}
                    onChange={(e) =>
                      setReview({ ...review, candidates: review.candidates.map((c) => (c.key === candidate.key ? { ...c, selected: e.target.checked } : c)) })
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <textarea
                      className={`${inputClass} h-14 resize-none leading-relaxed`}
                      value={candidate.content}
                      onChange={(e) =>
                        setReview({ ...review, candidates: review.candidates.map((c) => (c.key === candidate.key ? { ...c, content: e.target.value } : c)) })
                      }
                    />
                    <p className="text-[10px] text-slate-400">
                      {categoryOf(candidate.category).emoji} {categoryOf(candidate.category).label} · {'★'.repeat(candidate.importance)}
                      {candidate.pinned ? ' · 📌置顶' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={`${gradBtn} flex-1`}
                disabled={!!busy}
                onClick={async () => {
                  const chosen = review.candidates.filter((c) => c.selected && c.content.trim());
                  setBusy('commit');
                  try {
                    await commitCandidates(review.charId, chosen, review.cursor);
                    setReview(null);
                  } finally {
                    setBusy('');
                  }
                }}
              >
                写入记忆
              </button>
              <button
                type="button"
                className={pillBtn}
                onClick={() => {
                  advanceMemoryCursor(review.charId, review.cursor);
                  setSettings(readMemorySettings());
                  setReview(null);
                }}
              >
                都不要
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 设置 ---------- */}
      {settingsOpen && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/25 backdrop-blur-xs">
          <div className="flex max-h-[92%] w-full max-w-md flex-col rounded-t-[28px] border border-white bg-gradient-to-b from-white to-[#F6F8FC] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A5A6A]">记忆设置</h3>
              <button type="button" aria-label="关闭" onClick={() => setSettingsOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5 text-xs">
              <section className="space-y-2">
                <h4 className="font-bold text-[#6F7F8E]">向量化接口（Embedding）</h4>
                <p className="text-[10px] leading-relaxed text-slate-400">用语义找出和当前话题相关的记忆。需要支持 OpenAI 兼容 /embeddings 的接口，例如硅基流动的 BAAI/bge-m3。不填则自动用关键词检索。</p>
                <input className={inputClass} placeholder="接口地址" value={settings.embedding.endpoint} onChange={(e) => persistSettings({ ...settings, embedding: { ...settings.embedding, endpoint: e.target.value } })} />
                <input className={inputClass} type="password" placeholder="API Key" value={settings.embedding.apiKey} onChange={(e) => persistSettings({ ...settings, embedding: { ...settings.embedding, apiKey: e.target.value } })} />
                <input className={inputClass} placeholder="模型名称" value={settings.embedding.model} onChange={(e) => persistSettings({ ...settings, embedding: { ...settings.embedding, model: e.target.value } })} />
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={pillBtn} disabled={!configured || !!busy} onClick={() => void testEmbedding()}>{busy === 'test' ? '测试中…' : '测试连接'}</button>
                  <button type="button" className={pillBtn} disabled={!configured || !!busy} onClick={() => void embedAll()}>
                    {embedProgress ? `向量化中 ${embedProgress}` : '补全全部向量'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">换了模型后，旧向量不再可用，点「补全全部向量」重新生成。</p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-[#6F7F8E]">检索</h4>
                <label className="block space-y-1">
                  <span className="text-slate-600">每轮最多想起 {settings.topK} 条相关往事</span>
                  <input type="range" min={1} max={15} className="w-full" value={settings.topK} onChange={(e) => persistSettings({ ...settings, topK: Number(e.target.value) })} />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600">相关度阈值 {settings.threshold.toFixed(2)}（越高越严格）</span>
                  <input type="range" min={0.2} max={0.8} step={0.05} className="w-full" value={settings.threshold} onChange={(e) => persistSettings({ ...settings, threshold: Number(e.target.value) })} />
                </label>
                <div className="flex gap-1.5">
                  <input className={inputClass} placeholder="试试输入一句话，看会想起什么…" value={testQuery} onChange={(e) => setTestQuery(e.target.value)} />
                  <button type="button" className={pillBtn} disabled={!!busy || !testQuery.trim()} onClick={() => void runRetrievalTest()}>测试</button>
                </div>
                {testResults && (
                  <div className="space-y-1">
                    {testResults.length === 0 && <p className="text-[11px] text-slate-400">没有记忆可检索（当前角色 / 玩家通用）。</p>}
                    {testResults.map((entry) => (
                      <p key={entry.item.id} className="rounded-xl bg-white/70 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600">
                        <span className={entry.similarity >= settings.threshold ? 'font-bold text-emerald-500' : 'text-slate-400'}>
                          {Math.round(entry.similarity * 100)}%
                        </span>{' '}
                        <span className="text-[9px] text-slate-300">{entry.mode === 'vector' ? '向量' : '关键词'}</span> {entry.item.content}
                      </p>
                    ))}
                    <p className="text-[10px] text-slate-400">绿色表示达到阈值，会被注入；灰色不会。</p>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-[#6F7F8E]">记忆整理</h4>
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" checked={settings.confirmManual} onChange={(e) => persistSettings({ ...settings, confirmManual: e.target.checked })} />
                  <span>手动整理后，先让我确认再写入</span>
                </label>
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" checked={settings.autoExtract} onChange={(e) => persistSettings({ ...settings, autoExtract: e.target.checked })} />
                  <span>自动整理：微信聊天累计一定条数后，后台整理并直接写入（会额外消耗请求）</span>
                </label>
                {settings.autoExtract && (
                  <label className="block space-y-1">
                    <span className="text-slate-600">每累计 {settings.autoEvery} 条新消息整理一次</span>
                    <input type="range" min={10} max={300} step={10} className="w-full" value={settings.autoEvery} onChange={(e) => persistSettings({ ...settings, autoEvery: Number(e.target.value) })} />
                  </label>
                )}
                {settings.lastAutoError && <p className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-400">上次自动整理失败：{settings.lastAutoError}</p>}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
