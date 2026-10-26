import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowUpRight, BookOpen, BrainCircuit, ChevronDown, Download, Film, Heart, Package, Pencil, Pin, PinOff, Plus, Search, Settings, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { MemoryTheater } from '../components/MemoryTheater';
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
import { activeMemoryArchive, guardMemoryArchive, memoryArchiveLabel } from '../utils/memoryArchives';
import { giftDateToday, giftMemoryContent } from '../utils/giftMemory';
import type { GiftMemoryDetails } from '../utils/memoryData';
import { getAutomaticWorldBookIdsForContacts, readWorldBookOptions } from '../utils/worldBookPrompt';

interface MemoryAppProps {
  onBack: () => void;
}

const cardClass = 'memory-card rounded-[22px] border border-white/90 bg-white/75 backdrop-blur-xl shadow-[0_6px_20px_-10px_rgba(148,163,184,0.3)]';
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
  const [worldBookOptions] = useState(() => readWorldBookOptions());
  const [embeddedIds, setEmbeddedIds] = useState<Set<string>>(() => new Set());
  const [ownerId, setOwnerId] = useState<string>(() => readOfflineContacts()[0]?.id ?? SHARED_MEMORY_ID);
  const [category, setCategory] = useState<'all' | MemoryCategory>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MemoryItem | null>(null);
  const [giftEditing, setGiftEditing] = useState<{ id?: string; gift: GiftMemoryDetails } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theaterId, setTheaterId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [secondaryModels, setSecondaryModels] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoadingSecondaryModels, setIsLoadingSecondaryModels] = useState(false);
  const [secondaryModelMessage, setSecondaryModelMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState<{ charId: string; cursor: string; candidates: Candidate[]; assertArchive: () => void } | null>(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<ScoredMemory[] | null>(null);
  const [tab, setTab] = useState<'memories' | 'items' | 'journal' | 'growth'>('memories');
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
    try {
      writeMemorySettings(next);
      setSettings(next);
    } catch (error) {
      console.error('Could not save memory settings.', error);
      showYyError(error instanceof Error ? error.message : '记忆设置保存失败，请重试。');
    }
  };

  const persistMemories = (next: MemoryItem[]) => {
    try {
      writeMemories(next);
      setMemories(readMemories());
      return true;
    } catch (error) {
      console.error('Could not save archive memories.', error);
      showYyError(error instanceof Error ? error.message : '记忆保存失败，请重试。');
      return false;
    }
  };

  const ownerName = (id: string) => (id === SHARED_MEMORY_ID ? '玩家通用' : contacts.find((c) => c.id === id)?.name ?? '未知角色');
  const ownerAvatar = contacts.find((contact) => contact.id === ownerId)?.avatarUrl;
  const owners = [...contacts.map((c) => ({ id: c.id, name: c.name })), { id: SHARED_MEMORY_ID, name: '玩家通用' }];

  const mine = memories.filter((item) => item.charId === ownerId);
  const library = mine.filter((item) => item.category !== 'item');
  const gifts = mine.filter((item) => item.category === 'item')
    .sort((a, b) => (b.gift?.date ?? b.createdAt).localeCompare(a.gift?.date ?? a.createdAt));
  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return library
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => !keyword || item.content.toLowerCase().includes(keyword))
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || b.importance - a.importance || b.updatedAt.localeCompare(a.updatedAt)
      );
  }, [library, category, search]);

  const pendingCount = useMemo(
    () => (ownerId === SHARED_MEMORY_ID ? 0 : countNewMessages(ownerId, settings)),
    [ownerId, settings, memories]
  );
  const embeddedCount = library.filter((item) => embeddedIds.has(item.id)).length;
  const configured = embeddingConfigured(settings.embedding);
  const selectedMemoryWorldBookIds = ownerId === SHARED_MEMORY_ID
    ? []
    : settings.worldBookIdsByCharacter?.[ownerId] ?? getAutomaticWorldBookIdsForContacts([ownerId]);
  const isMemoryWorldBookAuto = ownerId === SHARED_MEMORY_ID ||
    settings.worldBookIdsByCharacter?.[ownerId] === undefined;
  const setMemoryWorldBookMode = (bookIds: string[] | undefined) => {
    if (ownerId === SHARED_MEMORY_ID) return;
    const current = settings.worldBookIdsByCharacter ?? {};
    const nextWorldBooks = { ...current };
    if (bookIds === undefined) delete nextWorldBooks[ownerId];
    else nextWorldBooks[ownerId] = bookIds;
    persistSettings({ ...settings, worldBookIdsByCharacter: nextWorldBooks });
  };

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
    if (!persistMemories(exists ? memories.map((m) => (m.id === item.id ? item : m)) : [...memories, item])) return;
    if (previous && previous.content !== item.content) removeEmbeddings([item.id]);
    setEditing(null);
    if (!exists || previous?.content !== item.content) void embedInBackground([item]);
    else refreshEmbedded();
  };

  const deleteItem = (item: MemoryItem) => {
    if (!window.confirm('删除这条记忆？')) return;
    if (!persistMemories(memories.filter((m) => m.id !== item.id))) return;
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
      archiveKey: activeMemoryArchive(ownerId),
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

  const saveGift = () => {
    if (!giftEditing || !giftEditing.gift.name.trim() || !giftEditing.gift.date) return;
    const gift = {
      ...giftEditing.gift,
      name: giftEditing.gift.name.trim().slice(0, 100),
      scene: giftEditing.gift.scene.trim().slice(0, 160),
    };
    const content = giftMemoryContent(gift);
    const now = new Date().toISOString();
    const old = memories.find((item) => item.id === giftEditing.id);
    const item: MemoryItem = old
      ? { ...old, category: 'item', gift, content, updatedAt: now }
      : { id: newMemoryId(), charId: ownerId, archiveKey: activeMemoryArchive(ownerId),
          category: 'item', gift, content, importance: 3, pinned: false,
          createdAt: now, updatedAt: now, recallCount: 0, source: 'manual' };
    if (!persistMemories(old ? memories.map((entry) => entry.id === item.id ? item : entry) : [...memories, item])) return;
    if (old && old.content !== content) removeEmbeddings([item.id]);
    if (!old || old.content !== content) void embedInBackground([item]);
    setGiftEditing(null);
  };

  // ---------- 整理记忆 ----------
  const runExtract = async () => {
    if (busy || ownerId === SHARED_MEMORY_ID) return;
    const assertArchive = guardMemoryArchive(ownerId);
    setBusy('extract');
    try {
      const result = await extractMemoryCandidates(ownerId);
      assertArchive();
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
          assertArchive,
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
    const assertArchive = guardMemoryArchive(charId);
    const { added, merged } = await addMemoryCandidates(charId, candidates, 'chat', readMemorySettings());
    assertArchive();
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

  const fetchSecondaryModels = async () => {
    const { endpoint, apiKey } = settings.secondaryApi;
    if (!endpoint.trim() || !apiKey.trim()) {
      setSecondaryModelMessage('请先填写副 API 地址和 Key。');
      return;
    }
    let modelsUrl: URL;
    try {
      modelsUrl = new URL(endpoint.trim());
      if (modelsUrl.protocol !== 'http:' && modelsUrl.protocol !== 'https:') {
        throw new Error('接口地址必须使用 HTTP 或 HTTPS。');
      }
    } catch (error) {
      setSecondaryModelMessage(error instanceof Error ? error.message : '副 API 地址无效。');
      return;
    }
    const isGemini = modelsUrl.hostname.includes('generativelanguage.googleapis.com') ||
      /\/v1beta(?:\/|$)/i.test(modelsUrl.pathname);
    const path = modelsUrl.pathname.replace(/\/+$/, '');
    if (isGemini) {
      modelsUrl.pathname = path
        .replace(/\/models(?:\/[^/]+)?$/i, '')
        .replace(/\/[^/]+:generateContent$/i, '');
      if (!/\/v1beta$/i.test(modelsUrl.pathname)) {
        modelsUrl.pathname = `${modelsUrl.pathname.replace(/\/+$/, '')}/v1beta`;
      }
      modelsUrl.pathname = `${modelsUrl.pathname.replace(/\/+$/, '')}/models`;
      modelsUrl.search = `key=${encodeURIComponent(apiKey.trim())}`;
    } else {
      modelsUrl.pathname = path
        .replace(/\/chat\/completions$/i, '')
        .replace(/\/completions$/i, '')
        .replace(/\/models$/i, '');
      modelsUrl.pathname = `${modelsUrl.pathname.replace(/\/+$/, '')}/models`;
      modelsUrl.search = '';
    }
    modelsUrl.hash = '';

    setIsLoadingSecondaryModels(true);
    setSecondaryModels([]);
    setSecondaryModelMessage('');
    try {
      const response = await fetch(modelsUrl.toString(), {
        method: 'GET',
        headers: isGemini
          ? { 'Content-Type': 'application/json' }
          : { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`模型拉取失败（HTTP ${response.status}）：${detail || response.statusText}`);
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') throw new Error('接口返回的数据格式无效。');
      const rawModels = Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : Array.isArray((payload as { models?: unknown }).models)
          ? (payload as { models: unknown[] }).models
          : [];
      const models = rawModels.flatMap((item): Array<{ id: string; label: string }> => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        if (Array.isArray(record.supportedGenerationMethods) &&
          !record.supportedGenerationMethods.includes('generateContent')) return [];
        const id = typeof record.id === 'string'
          ? record.id
          : typeof record.name === 'string'
            ? record.name.replace(/^models\//, '')
            : '';
        if (!id) return [];
        return [{
          id,
          label: typeof record.displayName === 'string' ? `${record.displayName} (${id})` : id,
        }];
      });
      if (models.length === 0) throw new Error('接口已响应，但没有找到可用模型；请确认模型列表接口已开放。');
      setSecondaryModels(models);
      setSecondaryModelMessage(`已拉取 ${models.length} 个模型。`);
    } catch (error) {
      console.error('Could not fetch memory secondary API models.', error);
      setSecondaryModelMessage(
        error instanceof Error
          ? `${error.message}${error instanceof TypeError ? '；也可能是反代未允许浏览器跨域请求（CORS）。' : ''}`
          : '模型拉取失败，请检查副 API 地址、Key 及网络。'
      );
    } finally {
      setIsLoadingSecondaryModels(false);
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
    <div className="memory-app relative flex flex-1 w-full flex-col overflow-hidden bg-gradient-to-b from-[#FBF3F7] via-[#F3F6FB] to-[#EAF2F8] text-slate-700">
      {theaterId && <MemoryTheater key={theaterId} charId={theaterId} charName={ownerName(theaterId)} avatar={contacts.find(c => c.id === theaterId)?.avatarUrl} onClose={() => setTheaterId(null)} />}
      <AppHeader
        title="记忆"
        subtitle="把重要的相处，慢慢记住"
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

      <div className="memory-content flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
        <div className="memory-owner-tabs flex gap-2 overflow-x-auto pb-1">
          {owners.map((owner) => (
            <button
              key={owner.id}
              type="button"
              onClick={() => setOwnerId(owner.id)}
              className={`memory-owner flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs ${ownerId === owner.id ? 'is-active border-pink-200 bg-gradient-to-r from-pink-50 to-sky-50 font-bold text-[#6F7F8E]' : 'border-slate-200 bg-white/70 text-slate-400'}`}
            >
              <span aria-hidden="true" className="memory-owner-initial flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[10px]">{owner.id === SHARED_MEMORY_ID ? '✧' : owner.name.slice(0, 1)}</span>{owner.name}
            </button>
          ))}
        </div>

        <section className="memory-hero">
          {ownerId !== SHARED_MEMORY_ID && <button type="button" aria-label={`进入${ownerName(ownerId)}的记忆放映室`} onClick={() => setTheaterId(ownerId)} className="absolute inset-0 z-10 rounded-[28px] outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-[#9eacc8]" />}
          <div className="memory-hero-orbit">
            {ownerAvatar ? <img key={ownerAvatar} src={ownerAvatar} alt={`${ownerName(ownerId)}的头像`} className="memory-hero-avatar" /> : <span aria-hidden="true" className="text-2xl font-semibold">{ownerId === SHARED_MEMORY_ID ? '✧' : ownerName(ownerId).slice(0, 1)}</span>}
            <Heart aria-hidden="true" size={13} className="memory-hero-heart" fill="currentColor" />
          </div>
          <p className="memory-eyebrow"><Sparkles size={11} /> 相处档案 · MEMORY</p>
          <h2 className="memory-hero-title">{ownerName(ownerId)}的记忆花园</h2>
          <p className="memory-hero-subtitle">那些小事，也值得被认真收藏。</p>
          {ownerId !== SHARED_MEMORY_ID && <div className="memory-theater-entry"><Film size={12} strokeWidth={1.4} /><span>记忆放映室</span><ArrowUpRight size={13} /></div>}
          <div className="memory-stats">
            <div><span>长期记忆</span><strong>{library.length}<small> 条</small></strong></div>
            <div><span>互赠物品</span><strong>{gifts.length}<small> 件</small></strong></div>
            <div><span>待整理消息</span><strong>{pendingCount}<small> 条</small></strong></div>
          </div>
        </section>

        <details className="memory-archive-note rounded-2xl border border-white/90 bg-white/60 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
          <summary className="flex cursor-pointer list-none items-center gap-2"><Archive size={13} className="text-[#98acc3]" /><span className="flex-1">{ownerId === SHARED_MEMORY_ID ? '玩家通用 · 跨角色共享' : `当前存档 · ${memoryArchiveLabel(ownerId)}`}</span><span className="text-[9px] text-[#a6b1c0]">存档说明</span><ChevronDown size={12} /></summary>
          <p className="mt-2 border-t border-white pt-2">
          {ownerId === SHARED_MEMORY_ID
            ? '玩家通用记忆跨角色、跨存档共用。身份或关系相关的信息请存入对应角色的当前档，避免影响新身份。'
            : `当前关联微信私聊「${memoryArchiveLabel(ownerId)}」：记忆、流水账和成长笔记仅属于此档。请到聊天 → 更多 → 聊天存档切换；新档为空，删除存档会一并删除这些内容。`}
          </p>
        </details>
        {ownerId !== SHARED_MEMORY_ID && (
          <div className="memory-tabs grid grid-cols-4 rounded-2xl bg-white/70 p-1 text-[11px]">
            {([['memories', '记忆库', BrainCircuit], ['items', '物品', Package], ['journal', '流水账', BookOpen], ['growth', '成长笔记', Heart]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`memory-tab flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 font-semibold ${activeTab === key ? 'is-active bg-white text-[#6F7F8E] shadow-sm' : 'text-slate-400'}`}
              >
                <Icon size={16} strokeWidth={1.6} />{label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'journal' && <JournalPanel charId={ownerId} charName={ownerName(ownerId)} flash={flash} />}
        {activeTab === 'growth' && <GrowthPanel charId={ownerId} charName={ownerName(ownerId)} flash={flash} />}

        {activeTab === 'items' && (
          <div className="space-y-3">
            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#4A5A6A]">🎁 互赠的物品</p>
                  <p className="mt-1 text-[11px] text-slate-400">记录实际送出的礼物、日期与当时情景；聊天时可检索想起。</p>
                </div>
                <button type="button" className={gradBtn} onClick={() => setGiftEditing({ gift: { name: '', direction: 'player-to-character', date: giftDateToday(), scene: '' } })}>+ 记一件</button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">{gifts.length} 件 · {configured ? `${gifts.filter((item) => embeddedIds.has(item.id)).length} 件已向量化` : '使用关键词检索'}</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <input className={`${inputClass} pl-9`} placeholder="搜索物品或送礼情景…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            {gifts.filter((item) => !search.trim() || item.content.toLowerCase().includes(search.trim().toLowerCase())).map((item) => (
              <div key={item.id} className={`${cardClass} p-3.5`}>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-pink-50 p-2 text-xl">🎁</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-700">{item.gift?.name ?? '送礼记录'}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{item.gift?.direction === 'player-to-character' ? '玩家 → 角色' : item.gift?.direction === 'character-to-player' ? '角色 → 玩家' : '赠送方向未标注'} · {item.gift?.date ?? item.createdAt.slice(0, 10)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{item.gift?.scene || item.content}</p>
                    <p className="mt-2 text-[10px] text-slate-400">{embeddedIds.has(item.id) ? '🟢 已向量化' : '⚪ 关键词可检索'}</p>
                  </div>
                  <div className="flex gap-1">
                    {item.gift && <button type="button" aria-label="编辑物品" onClick={() => setGiftEditing({ id: item.id, gift: { ...item.gift! } })} className="rounded-full p-1.5 text-slate-400"><Pencil className="h-4 w-4" /></button>}
                    <button type="button" aria-label="删除物品" onClick={() => deleteItem(item)} className="rounded-full p-1.5 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
            {gifts.length === 0 && <p className={`${cardClass} p-6 text-center text-xs text-slate-400`}>还没有送礼记录。可以手动添加，或在淘宝、闲鱼、微信聊天里互赠实物。</p>}
          </div>
        )}

        {activeTab === 'memories' && (<>
        <div className={`${cardClass} space-y-2.5 p-3.5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#4A5A6A]">{ownerName(ownerId)}的记忆</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                共 {library.length} 条 · {configured ? `已向量化 ${embeddedCount}/${library.length}` : '未配置向量化（使用关键词检索）'}
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
          {[{ id: 'all' as const, label: '全部', emoji: '' }, ...MEMORY_CATEGORIES.filter(c => c.id !== 'item')].map((c) => (
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
            <p className="text-xs font-bold text-[#6F7F8E]">{library.length === 0 ? '这里还是空的' : '没有符合条件的记忆'}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {library.length === 0 ? '点「整理记忆」让 AI 从微信聊天里提炼，或者手动添加。物品记录请查看上方“物品”。' : '换个分类或关键词试试。'}
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
                  <button type="button" aria-label="编辑" onClick={() => item.category === 'item' && item.gift ? setGiftEditing({ id: item.id, gift: { ...item.gift } }) : setEditing(item)} className="rounded-full p-1.5 text-slate-400 hover:bg-white"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="删除" onClick={() => deleteItem(item)} className="rounded-full p-1.5 text-rose-300 hover:bg-white"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
        </>)}
      </div>

      {/* ---------- 编辑 / 添加 ---------- */}
      {giftEditing && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/25 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-3 rounded-t-[28px] border border-white bg-gradient-to-b from-white to-[#F6F8FC] p-4 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{giftEditing.id ? '编辑物品' : '记录物品'}</h3><button type="button" aria-label="关闭" onClick={() => setGiftEditing(null)}><X className="h-4 w-4" /></button></div>
            <input aria-label="物品名称" className={inputClass} placeholder="物品名称" maxLength={100} value={giftEditing.gift.name} onChange={(event) => setGiftEditing({ ...giftEditing, gift: { ...giftEditing.gift, name: event.target.value } })} />
            <select aria-label="赠送方向" className={inputClass} value={giftEditing.gift.direction} onChange={(event) => setGiftEditing({ ...giftEditing, gift: { ...giftEditing.gift, direction: event.target.value as GiftMemoryDetails['direction'] } })}><option value="player-to-character">玩家送给角色</option><option value="character-to-player">角色送给玩家</option></select>
            <label className="block text-xs text-slate-500">赠送日期<input type="date" className={`${inputClass} mt-1`} value={giftEditing.gift.date} onChange={(event) => setGiftEditing({ ...giftEditing, gift: { ...giftEditing.gift, date: event.target.value } })} /></label>
            <textarea aria-label="送礼情景" className={`${inputClass} h-24 resize-none`} placeholder="当时为什么送？发生了什么？" maxLength={160} value={giftEditing.gift.scene} onChange={(event) => setGiftEditing({ ...giftEditing, gift: { ...giftEditing.gift, scene: event.target.value } })} />
            <button type="button" className={`${gradBtn} w-full`} disabled={!giftEditing.gift.name.trim() || !giftEditing.gift.date} onClick={saveGift}>保存物品</button>
          </div>
        </div>
      )}
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
                  {MEMORY_CATEGORIES.filter((c) => c.id !== 'item').map((c) => (
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
                <select className={inputClass} value={editing.charId} onChange={(e) => setEditing({ ...editing, charId: e.target.value, archiveKey: activeMemoryArchive(e.target.value) })}>
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
                      readOnly={!!candidate.gift}
                      onChange={(e) =>
                        setReview({ ...review, candidates: review.candidates.map((c) => (c.key === candidate.key ? { ...c, content: e.target.value } : c)) })
                      }
                    />
                    {candidate.gift && <p className="text-[10px] text-slate-400">物品详情可在写入后到「物品」栏编辑。</p>}
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
                    review.assertArchive();
                    await commitCandidates(review.charId, chosen, review.cursor);
                    setReview(null);
                  } catch (error) {
                    showYyError(error instanceof Error ? error.message : String(error), '写入记忆失败');
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
                  try {
                    review.assertArchive();
                    advanceMemoryCursor(review.charId, review.cursor);
                    setSettings(readMemorySettings());
                    setReview(null);
                  } catch (error) {
                    showYyError(error instanceof Error ? error.message : String(error), '更新整理进度失败');
                  }
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
                <h4 className="font-bold text-[#6F7F8E]">记忆整理世界书</h4>
                {ownerId === SHARED_MEMORY_ID ? (
                  <p className="text-[10px] leading-relaxed text-slate-400">请选择一个角色查看和设置该角色的记忆整理世界书。</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] leading-relaxed text-slate-400">
                        {isMemoryWorldBookAuto
                          ? '自动使用全局世界书和该角色已绑定的世界书。'
                          : '仅使用下方勾选的世界书进行记忆整理。'}
                      </p>
                      {!isMemoryWorldBookAuto && (
                        <button type="button" className={pillBtn} onClick={() => setMemoryWorldBookMode(undefined)}>
                          恢复自动
                        </button>
                      )}
                    </div>
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-white/70 p-2">
                      {worldBookOptions.length === 0 && (
                        <p className="text-[10px] text-slate-400">尚未创建世界书。</p>
                      )}
                      {worldBookOptions.map((book) => (
                        <label key={book.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedMemoryWorldBookIds.includes(book.id)}
                            onChange={(event) => {
                              const selected = selectedMemoryWorldBookIds.filter((id) => id !== book.id);
                              if (event.target.checked) selected.push(book.id);
                              setMemoryWorldBookMode(selected);
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">{book.name}</span>
                          {book.isGlobal && <span className="text-[9px] text-sky-500">全局</span>}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </section>
              <section className="space-y-2">
                <h4 className="font-bold text-[#6F7F8E]">记忆专用副 API</h4>
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" checked={settings.useSecondaryApi} onChange={(e) => persistSettings({ ...settings, useSecondaryApi: e.target.checked })} />
                  <span>独立使用副 API</span>
                </label>
                <p className="text-[10px] leading-relaxed text-slate-400">用于手动/自动记忆整理、流水账、回顾合并和成长笔记；不影响聊天主 API。关闭则跟随系统 API，向量化仍使用下方独立接口。</p>
                {settings.useSecondaryApi && (
                  <>
                    <input aria-label="记忆副 API 地址" className={inputClass} placeholder="接口地址（OpenAI 兼容或 Gemini）" value={settings.secondaryApi.endpoint} onChange={(e) => persistSettings({ ...settings, secondaryApi: { ...settings.secondaryApi, endpoint: e.target.value } })} />
                    <input aria-label="记忆副 API 密钥" className={inputClass} type="password" placeholder="API Key" value={settings.secondaryApi.apiKey} onChange={(e) => persistSettings({ ...settings, secondaryApi: { ...settings.secondaryApi, apiKey: e.target.value } })} />
                    <input aria-label="记忆副 API 模型" className={inputClass} placeholder="模型名称" value={settings.secondaryApi.model} onChange={(e) => persistSettings({ ...settings, secondaryApi: { ...settings.secondaryApi, model: e.target.value } })} />
                    <button type="button" className={pillBtn} disabled={isLoadingSecondaryModels} onClick={() => void fetchSecondaryModels()}>
                      {isLoadingSecondaryModels ? '正在拉取模型…' : '拉取模型'}
                    </button>
                    {secondaryModels.length > 0 && (
                      <label className="block space-y-1 text-slate-600">
                        <span>选择模型</span>
                        <select
                          aria-label="选择记忆副 API 模型"
                          className={inputClass}
                          value={secondaryModels.some((model) => model.id === settings.secondaryApi.model) ? settings.secondaryApi.model : ''}
                          onChange={(event) => persistSettings({
                            ...settings,
                            secondaryApi: { ...settings.secondaryApi, model: event.target.value },
                          })}
                        >
                          <option value="">请选择已拉取的模型</option>
                          {secondaryModels.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                        </select>
                      </label>
                    )}
                    {secondaryModelMessage && (
                      <p role="status" className={`text-[10px] ${secondaryModelMessage.includes('已拉取') ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {secondaryModelMessage}
                      </p>
                    )}
                  </>
                )}
              </section>
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
