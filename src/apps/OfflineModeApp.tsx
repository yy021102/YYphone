import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Flag,
  Lightbulb,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { ColorWheel, hexToRgba } from '../components/ColorWheel';
import { compressImageFile } from '../utils/imageFile';
import { showYyError } from '../components/ErrorDialog';
import {
  currentVersionText,
  DEFAULT_OFFLINE_STYLE,
  deleteOfflineMemory,
  newOfflineId,
  normalizePreset,
  normalizeStory,
  OfflineContact,
  OfflineMessage,
  OfflinePreset,
  OfflinePresetEntry,
  OfflineStory,
  OfflineStyle,
  OfflineWorldBookInfo,
  readOfflineContacts,
  readOfflinePersonas,
  readOfflinePresets,
  readOfflineStories,
  readOfflineStyle,
  readOfflineWorldBooks,
  saveOfflineMemory,
  writeOfflinePresets,
  writeOfflineStories,
  writeOfflineStyle,
} from '../utils/offlineData';
import { generateOfflineChoices, generateOfflineText, summarizeOfflineStory } from '../utils/offlineAi';

interface OfflineModeAppProps {
  onBack: () => void;
}

type View = 'list' | 'play' | 'presets';
type StoryDraft = Pick<
  OfflineStory,
  'title' | 'characterIds' | 'personaId' | 'worldBookIds' | 'presetId' | 'wechatContextCount' | 'contextMessages' | 'autoChoices'
>;

const downloadJson = (fileName: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const readJsonFile = async (file: File): Promise<unknown> => JSON.parse(await file.text());

const cardClass = 'rounded-[22px] border border-white/90 bg-white/75 backdrop-blur-xl shadow-[0_6px_20px_-10px_rgba(148,163,184,0.3)]';
const pillBtn = 'rounded-full border border-white bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#6F7F8E] active:scale-95';
const gradBtn = 'rounded-full bg-gradient-to-r from-[#F5C6D6] to-[#BFD9F0] px-4 py-2 text-xs font-bold text-[#5F6F7E] active:scale-95 disabled:opacity-50';
const inputClass = 'w-full rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700 outline-none focus:border-pink-200';

// ==================== 故事设置表单（新建 / 编辑共用） ====================
interface StoryFormProps {
  draft: StoryDraft;
  onChange: (draft: StoryDraft) => void;
  contacts: OfflineContact[];
  personas: Array<{ id: string; name: string }>;
  books: OfflineWorldBookInfo[];
  presets: OfflinePreset[];
}

const StoryForm: React.FC<StoryFormProps> = ({ draft, onChange, contacts, personas, books, presets }) => {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  const localBooks = books.filter((book) => !book.isGlobal);
  const globalBooks = books.filter((book) => book.isGlobal);
  return (
    <div className="space-y-3 text-xs">
      <label className="block space-y-1">
        <span className="font-semibold text-slate-600">故事标题</span>
        <input className={inputClass} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} placeholder="例如：雨夜重逢" />
      </label>

      <div className="space-y-1">
        <span className="font-semibold text-slate-600">登场角色（可多选，群像剧情）</span>
        <div className="flex flex-wrap gap-1.5">
          {contacts.length === 0 && <span className="text-[11px] text-slate-400">通讯录里还没有角色，也可以不选，让 AI 自行安排人物</span>}
          {contacts.map((c) => {
            const on = draft.characterIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ ...draft, characterIds: toggle(draft.characterIds, c.id) })}
                className={`rounded-full border px-3 py-1 text-[11px] ${on ? 'border-pink-200 bg-gradient-to-r from-pink-50 to-sky-50 font-bold text-[#6F7F8E]' : 'border-slate-200 bg-white/70 text-slate-400'}`}
              >
                {on ? '✓ ' : ''}{c.name}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="font-semibold text-slate-600">玩家身份</span>
        <select className={inputClass} value={draft.personaId} onChange={(e) => onChange({ ...draft, personaId: e.target.value })}>
          <option value="">使用当前启用的身份</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <div className="space-y-1">
        <span className="font-semibold text-slate-600">绑定世界书</span>
        {globalBooks.length > 0 && (
          <p className="text-[10px] text-slate-400">全局世界书（{globalBooks.map((b) => b.name).join('、')}）会自动带入，无需勾选。</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {localBooks.length === 0 && <span className="text-[11px] text-slate-400">还没有可绑定的世界书</span>}
          {localBooks.map((b) => {
            const on = draft.worldBookIds.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onChange({ ...draft, worldBookIds: toggle(draft.worldBookIds, b.id) })}
                className={`rounded-full border px-3 py-1 text-[11px] ${on ? 'border-sky-200 bg-sky-50 font-bold text-[#5B7485]' : 'border-slate-200 bg-white/70 text-slate-400'}`}
              >
                {on ? '✓ ' : ''}{b.name}（{b.entryCount}）
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="font-semibold text-slate-600">预设</span>
        <select className={inputClass} value={draft.presetId} onChange={(e) => onChange({ ...draft, presetId: e.target.value })}>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="font-semibold text-slate-600">带入微信聊天（条）</span>
          <input
            type="number"
            min={0}
            max={200}
            className={inputClass}
            value={draft.wechatContextCount}
            onChange={(e) => onChange({ ...draft, wechatContextCount: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })}
          />
          <span className="text-[10px] text-slate-400">0 = 不带入</span>
        </label>
        <label className="block space-y-1">
          <span className="font-semibold text-slate-600">带入剧情（段）</span>
          <input
            type="number"
            min={4}
            max={100}
            className={inputClass}
            value={draft.contextMessages}
            onChange={(e) => onChange({ ...draft, contextMessages: Math.max(4, Math.min(100, Number(e.target.value) || 30)) })}
          />
          <span className="text-[10px] text-slate-400">每次生成回看最近几段</span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-slate-600">
        <input type="checkbox" checked={draft.autoChoices} onChange={(e) => onChange({ ...draft, autoChoices: e.target.checked })} />
        <span>每次生成剧情时顺带给出 3 个行动建议（和剧情同一次请求，不额外消耗额度）</span>
      </label>
    </div>
  );
};

// ==================== 主组件 ====================
export const OfflineModeApp: React.FC<OfflineModeAppProps> = ({ onBack }) => {
  const [view, setView] = useState<View>('list');
  const [stories, setStories] = useState<OfflineStory[]>(() => readOfflineStories());
  const [presets, setPresets] = useState<OfflinePreset[]>(() => readOfflinePresets());
  const [activeStoryId, setActiveStoryId] = useState('');
  const [contacts] = useState<OfflineContact[]>(() => readOfflineContacts());
  const [personaInfo] = useState(() => readOfflinePersonas());
  const [books] = useState<OfflineWorldBookInfo[]>(() => readOfflineWorldBooks());

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'' | 'send' | 'choices' | 'summary'>('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [openingHint, setOpeningHint] = useState('');
  const [manualOpening, setManualOpening] = useState('');
  const [summaryModal, setSummaryModal] = useState<{ storyId: string; text: string } | null>(null);
  const [activePresetId, setActivePresetId] = useState('');
  const [notice, setNotice] = useState('');
  const [style, setStyle] = useState<OfflineStyle>(() => readOfflineStyle());
  const [styleOpen, setStyleOpen] = useState(false);
  const [styleTab, setStyleTab] = useState<'wallpaper' | 'ai' | 'user'>('wallpaper');
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const storyImportRef = useRef<HTMLInputElement>(null);
  const presetImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    writeOfflineStyle(style);
  }, [style]);

  useEffect(() => {
    writeOfflineStories(stories);
  }, [stories]);
  useEffect(() => {
    writeOfflinePresets(presets);
  }, [presets]);

  const story = stories.find((item) => item.id === activeStoryId);
  const storyPreset = story ? presets.find((p) => p.id === story.presetId) ?? presets[0] : undefined;
  const messageCount = story?.messages.length ?? 0;
  useEffect(() => {
    if (view === 'play') bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [view, messageCount, busy]);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const patchStory = (id: string, fn: (s: OfflineStory) => OfflineStory) =>
    setStories((prev) => prev.map((s) => (s.id === id ? { ...fn(s), updatedAt: new Date().toISOString() } : s)));

  const defaultDraft = (): StoryDraft => ({
    title: '',
    characterIds: [],
    personaId: '',
    worldBookIds: [],
    presetId: presets[0]?.id ?? '',
    wechatContextCount: 20,
    contextMessages: 30,
    autoChoices: false,
  });

  const submitForm = () => {
    if (!draft) return;
    const title = draft.title.trim() || '未命名故事';
    if (formMode === 'create') {
      const now = new Date().toISOString();
      const created: OfflineStory = { ...draft, title, id: newOfflineId('story'), ended: false, messages: [], createdAt: now, updatedAt: now };
      setStories((prev) => [created, ...prev]);
      setActiveStoryId(created.id);
      setView('play');
    } else if (formMode === 'edit' && story) {
      patchStory(story.id, (s) => ({ ...s, ...draft, title }));
    }
    setFormMode(null);
    setDraft(null);
  };

  // ---------- 生成 ----------
  const appendAiMessage = async (target: OfflineStory, history: OfflineMessage[], mode: 'continue' | 'opening', hint = '') => {
    setBusy('send');
    try {
      const { text, choices } = await generateOfflineText(target, storyPreset, history, mode, hint, target.autoChoices);
      const aiMessage: OfflineMessage = {
        id: newOfflineId('om'),
        role: 'ai',
        versions: [text],
        versionIndex: 0,
        createdAt: new Date().toISOString(),
        ...(choices.length > 0 ? { choices } : {}),
      };
      patchStory(target.id, (s) => ({ ...s, ended: false, messages: [...s.messages, aiMessage] }));
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '线下剧情生成失败');
    } finally {
      setBusy('');
    }
  };

  const handleSend = async () => {
    if (!story || busy) return;
    const text = input.trim();
    let history = story.messages;
    if (text) {
      const userMessage: OfflineMessage = {
        id: newOfflineId('om'),
        role: 'user',
        versions: [text],
        versionIndex: 0,
        createdAt: new Date().toISOString(),
      };
      history = [...history, userMessage];
      patchStory(story.id, (s) => ({ ...s, ended: false, messages: [...s.messages, userMessage] }));
      setInput('');
    } else if (history.length === 0) {
      return;
    }
    await appendAiMessage(story, history, 'continue');
  };

  const handleRegenerate = async (message: OfflineMessage) => {
    if (!story || busy) return;
    const index = story.messages.findIndex((m) => m.id === message.id);
    if (index < 0) return;
    setBusy('send');
    try {
      const { text, choices } = await generateOfflineText(
        story, storyPreset, story.messages.slice(0, index), index === 0 ? 'opening' : 'continue', '', story.autoChoices
      );
      patchStory(story.id, (s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === message.id
            ? { ...m, versions: [...m.versions, text], versionIndex: m.versions.length, choices: choices.length > 0 ? choices : undefined }
            : m
        ),
      }));
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '线下剧情生成失败');
    } finally {
      setBusy('');
    }
  };

  const handleChoices = async () => {
    if (!story || busy || story.messages.length === 0) return;
    const last = story.messages[story.messages.length - 1];
    setBusy('choices');
    try {
      const choices = await generateOfflineChoices(story, storyPreset, story.messages);
      patchStory(story.id, (s) => ({ ...s, messages: s.messages.map((m) => (m.id === last.id ? { ...m, choices } : m)) }));
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '生成行动建议失败');
    } finally {
      setBusy('');
    }
  };

  const handleEndStory = async () => {
    if (!story || busy) return;
    if (story.messages.length < 2) {
      flash('剧情还太短，先多写几段再结束吧');
      return;
    }
    if (!window.confirm('结束这段线下剧情？会生成摘要并写入角色记忆，之后角色在微信里就知道这些事了。（结束后仍可以继续写）')) return;
    setBusy('summary');
    try {
      const summary = await summarizeOfflineStory(story, storyPreset);
      saveOfflineMemory(story, summary);
      patchStory(story.id, (s) => ({ ...s, ended: true }));
      setSummaryModal({ storyId: story.id, text: summary });
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '生成剧情摘要失败');
    } finally {
      setBusy('');
    }
  };

  const swipe = (message: OfflineMessage, delta: number) => {
    if (!story) return;
    const next = message.versionIndex + delta;
    if (next < 0 || next >= message.versions.length) return;
    patchStory(story.id, (s) => ({ ...s, messages: s.messages.map((m) => (m.id === message.id ? { ...m, versionIndex: next } : m)) }));
  };

  const saveEdit = () => {
    if (!story || !editing) return;
    const text = editing.text.trim();
    if (!text) return;
    patchStory(story.id, (s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === editing.id ? { ...m, versions: m.versions.map((v, i) => (i === m.versionIndex ? text : v)) } : m
      ),
    }));
    setEditing(null);
  };

  const deleteMessage = (message: OfflineMessage) => {
    if (!story || !window.confirm('删除这一段？')) return;
    patchStory(story.id, (s) => ({ ...s, messages: s.messages.filter((m) => m.id !== message.id) }));
  };

  const addManualOpening = () => {
    const text = manualOpening.trim();
    if (!story || !text) return;
    patchStory(story.id, (s) => ({
      ...s,
      messages: [{ id: newOfflineId('om'), role: 'ai', versions: [text], versionIndex: 0, createdAt: new Date().toISOString() }],
    }));
    setManualOpening('');
  };

  // ---------- 导入 / 导出 ----------
  const importStory = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await readJsonFile(file);
      const raw = data && typeof data === 'object' && 'story' in data ? (data as { story: unknown }).story : data;
      const imported = normalizeStory(raw);
      if (!imported) throw new Error('文件不是有效的故事存档。');
      setStories((prev) => [{ ...imported, presetId: presets.some((p) => p.id === imported.presetId) ? imported.presetId : presets[0]?.id ?? '' }, ...prev]);
      flash(`已导入「${imported.title}」`);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '导入故事失败');
    }
  };

  const importPresets = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await readJsonFile(file);
      const unwrap = (item: unknown) =>
        item && typeof item === 'object' && 'preset' in item ? (item as { preset: unknown }).preset : item;
      const rawList: unknown[] = Array.isArray(data) ? data.map(unwrap) : [unwrap(data)];
      const imported = rawList.flatMap((item) => {
        const preset = normalizePreset(item);
        return preset ? [preset] : [];
      });
      if (imported.length === 0) throw new Error('文件里没有有效的预设。');
      setPresets((prev) => [...prev, ...imported]);
      setActivePresetId(imported[0].id);
      flash(`已导入 ${imported.length} 个预设`);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '导入预设失败');
    }
  };

  const characterNames = (s: OfflineStory) =>
    s.characterIds.map((id) => contacts.find((c) => c.id === id)?.name).filter(Boolean).join('、') || '未选择角色';

  const goBack = () => {
    if (view === 'play' || view === 'presets') {
      setView('list');
      setEditing(null);
    } else {
      onBack();
    }
  };

  // ==================== 渲染 ====================
  const lastMessage = story?.messages[story.messages.length - 1];
  const aiBubbleStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(style.aiBubbleColor, style.aiBubbleOpacity),
    color: style.aiTextColor,
    backdropFilter: 'blur(12px)',
  };
  const userBubbleStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(style.userBubbleColor, style.userBubbleOpacity),
    color: style.userTextColor,
    backdropFilter: 'blur(12px)',
  };

  const uploadWallpaper = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await compressImageFile(file);
      setStyle((prev) => ({ ...prev, wallpaperUrl: url }));
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '壁纸上传失败');
    }
  };

  return (
    <div
      className="relative flex flex-1 w-full flex-col overflow-hidden bg-gradient-to-b from-[#FBF3F7] via-[#F3F6FB] to-[#EAF2F8] text-slate-700"
      style={
        style.wallpaperUrl
          ? { background: `linear-gradient(rgba(255,255,255,0.18), rgba(255,255,255,0.18)), url(${style.wallpaperUrl}) center / cover no-repeat` }
          : undefined
      }
    >
      <AppHeader
        title={view === 'play' && story ? story.title : view === 'presets' ? '预设' : '线下模式'}
        subtitle={view === 'play' && story ? `${characterNames(story)} · ${storyPreset?.name ?? '无预设'}` : view === 'list' ? '长篇剧情 · 沉浸叙事' : '写作风格与生成参数'}
        onBack={goBack}
        rightAction={
          view === 'play' && story ? (
            <button
              type="button"
              aria-label="故事设置"
              onClick={() => {
                const { id: _id, ended: _ended, messages: _messages, createdAt: _c, updatedAt: _u, ...rest } = story;
                setDraft(rest);
                setFormMode('edit');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          ) : null
        }
      />

      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-slate-700/85 px-4 py-2 text-[11px] text-white">{notice}</div>
      )}

      {/* ---------- 故事列表 ---------- */}
      {view === 'list' && (
        <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={gradBtn}
              onClick={() => {
                setDraft(defaultDraft());
                setFormMode('create');
              }}
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" />新故事
            </button>
            <button type="button" className={pillBtn} onClick={() => { setActivePresetId(presets[0]?.id ?? ''); setView('presets'); }}>
              <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />预设
            </button>
            <button type="button" className={pillBtn} onClick={() => setStyleOpen(true)}>🎨 外观</button>
            <button type="button" className={pillBtn} onClick={() => storyImportRef.current?.click()}>
              <Upload className="mr-1 inline h-3.5 w-3.5" />导入故事
            </button>
            <input
              ref={storyImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void importStory(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {stories.length === 0 && (
            <div className={`${cardClass} p-6 text-center`}>
              <BookOpen className="mx-auto h-8 w-8 text-pink-300" />
              <p className="mt-2 text-xs font-bold text-[#6F7F8E]">还没有故事</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">选好角色、玩家身份和世界书，写一段只属于你们的线下长篇。结束后，摘要会写进角色的记忆，微信里 TA 就会记得。</p>
            </div>
          )}

          {[...stories].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => (
            <div key={item.id} className={`${cardClass} p-3.5`}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  setActiveStoryId(item.id);
                  setView('play');
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-[#4A5A6A]">{item.title}</span>
                  {item.ended && <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[9px] text-[#5B7485]">已写入记忆</span>}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">{characterNames(item)}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                  {item.messages.length > 0 ? currentVersionText(item.messages[item.messages.length - 1]) : '（还没有开场）'}
                </p>
                <p className="mt-1 text-[10px] text-slate-300">{item.messages.length} 段 · {item.updatedAt.slice(0, 16).replace('T', ' ')}</p>
              </button>
              <div className="mt-2 flex gap-1.5 border-t border-white/80 pt-2">
                <button type="button" className={pillBtn} onClick={() => downloadJson(`${item.title}.story.json`, { type: 'yyphone-offline-story', version: 1, story: item })}>
                  <Download className="mr-1 inline h-3 w-3" />导出
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white bg-rose-50 px-3 py-1.5 text-[11px] text-rose-400 active:scale-95"
                  onClick={() => {
                    if (!window.confirm(`删除「${item.title}」？它写入角色的记忆摘要也会一并删除。`)) return;
                    deleteOfflineMemory(item.id);
                    setStories((prev) => prev.filter((s) => s.id !== item.id));
                  }}
                >
                  <Trash2 className="mr-1 inline h-3 w-3" />删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- 阅读 / 游玩 ---------- */}
      {view === 'play' && story && (
        <>
          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-3">
            {story.messages.length === 0 && (
              <div className={`${cardClass} space-y-3 p-4`}>
                <p className="text-xs font-bold text-[#6F7F8E]">先来一段开场白吧</p>
                <div className="space-y-1.5">
                  <textarea
                    className={`${inputClass} h-16 resize-none`}
                    value={openingHint}
                    onChange={(e) => setOpeningHint(e.target.value)}
                    placeholder="可选：说说你想要的开场（时间、地点、氛围……）"
                  />
                  <button
                    type="button"
                    disabled={!!busy}
                    className={gradBtn}
                    onClick={() => void appendAiMessage(story, [], 'opening', openingHint)}
                  >
                    {busy ? '生成中…' : '✨ 让 AI 生成开场白'}
                  </button>
                </div>
                <div className="space-y-1.5 border-t border-white/80 pt-3">
                  <textarea
                    className={`${inputClass} h-24 resize-none`}
                    value={manualOpening}
                    onChange={(e) => setManualOpening(e.target.value)}
                    placeholder="或者自己写开场白……"
                  />
                  <button type="button" disabled={!manualOpening.trim()} className={pillBtn} onClick={addManualOpening}>用我写的开场白</button>
                </div>
              </div>
            )}

            {story.messages.map((message, index) => {
              const isLast = index === story.messages.length - 1;
              const text = currentVersionText(message);
              const isEditing = editing?.id === message.id;
              const isUser = message.role === 'user';
              return (
                <div key={message.id} className={isUser ? 'flex justify-end' : ''}>
                  <div className={isUser ? 'max-w-[86%]' : 'w-full'}>
                    {isEditing ? (
                      <div className={`${cardClass} space-y-2 p-3`}>
                        <textarea
                          className={`${inputClass} min-h-40 resize-y leading-relaxed`}
                          value={editing.text}
                          onChange={(e) => setEditing({ id: message.id, text: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <button type="button" className={gradBtn} onClick={saveEdit}><Check className="mr-1 inline h-3.5 w-3.5" />保存</button>
                          <button type="button" className={pillBtn} onClick={() => setEditing(null)}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={isUser ? userBubbleStyle : aiBubbleStyle}
                        className={
                          isUser
                            ? 'rounded-2xl rounded-tr-md border border-white/80 px-3.5 py-2.5 text-xs leading-relaxed'
                            : 'rounded-[22px] border border-white/90 px-4 py-3.5 text-[13px] leading-[1.85] shadow-[0_6px_20px_-10px_rgba(148,163,184,0.3)]'
                        }
                      >
                        <p className="whitespace-pre-wrap break-words">{text}</p>
                      </div>
                    )}

                    {!isEditing && (
                      <div className={`mt-1 flex items-center gap-1 text-[10px] text-slate-400 ${isUser ? 'justify-end' : ''}`}>
                        {!isUser && message.versions.length > 1 && (
                          <>
                            <button type="button" aria-label="上一个版本" disabled={message.versionIndex === 0} onClick={() => swipe(message, -1)} className="rounded-full p-1 hover:bg-white/80 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                            <span>{message.versionIndex + 1}/{message.versions.length}</span>
                            <button type="button" aria-label="下一个版本" disabled={message.versionIndex === message.versions.length - 1} onClick={() => swipe(message, 1)} className="rounded-full p-1 hover:bg-white/80 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                        <button type="button" aria-label="编辑" onClick={() => setEditing({ id: message.id, text })} className="rounded-full p-1.5 hover:bg-white/80"><Pencil className="h-3 w-3" /></button>
                        <button type="button" aria-label="复制" onClick={() => void navigator.clipboard?.writeText(text).then(() => flash('已复制'))} className="rounded-full p-1.5 hover:bg-white/80"><Copy className="h-3 w-3" /></button>
                        {!isUser && isLast && (
                          <button type="button" aria-label="重新生成" disabled={!!busy} onClick={() => void handleRegenerate(message)} className="rounded-full p-1.5 hover:bg-white/80 disabled:opacity-40"><RefreshCw className="h-3 w-3" /></button>
                        )}
                        <button type="button" aria-label="删除" onClick={() => deleteMessage(message)} className="rounded-full p-1.5 text-rose-300 hover:bg-white/80"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}

                    {!isUser && isLast && message.choices && message.choices.length > 0 && !isEditing && (
                      <div className="mt-2 space-y-1.5">
                        {message.choices.map((choice, i) => (
                          <button
                            key={`${choice}-${i}`}
                            type="button"
                            onClick={() => setInput(choice)}
                            className="block w-full rounded-2xl border border-white bg-gradient-to-r from-pink-50/80 to-sky-50/80 px-3 py-2 text-left text-[11px] leading-snug text-[#6F7F8E] active:scale-[0.99]"
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {busy && (
              <p className="text-center text-[11px] text-slate-400">
                {busy === 'send' ? '正在书写剧情…' : busy === 'choices' ? '正在想行动建议…' : '正在整理剧情摘要…'}
              </p>
            )}
            {story.ended && !busy && (
              <p className="text-center text-[10px] text-sky-400">这段剧情已写入角色记忆，继续书写会在下次「结束」时更新</p>
            )}
            <div ref={bottomRef} />
          </div>

          {story.messages.length > 0 && (
            <div className="shrink-0 border-t border-white/80 bg-white/70 px-3 pb-3 pt-2 backdrop-blur-xl">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <button type="button" disabled={!!busy} onClick={() => void handleChoices()} className={`${pillBtn} disabled:opacity-40`}>
                  <Lightbulb className="mr-1 inline h-3 w-3" />行动建议（单独请求）
                </button>
                <button type="button" className={pillBtn} onClick={() => setStyleOpen(true)}>🎨 外观</button>
                <button type="button" disabled={!!busy} onClick={() => void handleEndStory()} className={`${pillBtn} disabled:opacity-40`}>
                  <Flag className="mr-1 inline h-3 w-3" />结束并写入记忆
                </button>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={2}
                  placeholder={lastMessage?.role === 'user' ? '点右边按钮生成回复…' : '写下你的行动或对白；留空直接点生成，让剧情继续'}
                  className="min-h-[52px] max-h-32 flex-1 resize-none rounded-2xl border border-white bg-white/85 px-3 py-2 text-xs leading-relaxed outline-none focus:border-pink-200"
                />
                <button type="button" disabled={!!busy} onClick={() => void handleSend()} className={`${gradBtn} h-[52px] shrink-0 rounded-2xl px-4`}>
                  {busy ? '…' : input.trim() ? '发送' : '生成'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------- 预设 ---------- */}
      {view === 'presets' && (() => {
        const preset = presets.find((p) => p.id === activePresetId) ?? presets[0];
        const patchPreset = (fn: (p: OfflinePreset) => OfflinePreset) =>
          setPresets((prev) => prev.map((p) => (p.id === preset?.id ? fn(p) : p)));
        const patchEntry = (id: string, patch: Partial<OfflinePresetEntry>) =>
          patchPreset((p) => ({ ...p, entries: p.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
        const moveEntry = (index: number, delta: number) =>
          patchPreset((p) => {
            const target = index + delta;
            if (target < 0 || target >= p.entries.length) return p;
            const entries = [...p.entries];
            [entries[index], entries[target]] = [entries[target], entries[index]];
            return { ...p, entries };
          });
        return (
          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePresetId(p.id)}
                  className={`rounded-full border px-3 py-1 text-[11px] ${preset?.id === p.id ? 'border-pink-200 bg-gradient-to-r from-pink-50 to-sky-50 font-bold text-[#6F7F8E]' : 'border-slate-200 bg-white/70 text-slate-400'}`}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                className={pillBtn}
                onClick={() => {
                  const created: OfflinePreset = { id: newOfflineId('preset'), name: '新预设', targetWords: 800, temperature: 0.9, entries: [] };
                  setPresets((prev) => [...prev, created]);
                  setActivePresetId(created.id);
                }}
              >
                <Plus className="mr-0.5 inline h-3 w-3" />新建
              </button>
              <button type="button" className={pillBtn} onClick={() => presetImportRef.current?.click()}>
                <Upload className="mr-0.5 inline h-3 w-3" />导入
              </button>
              <input
                ref={presetImportRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  void importPresets(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            {preset && (
              <div className={`${cardClass} space-y-3 p-3.5`}>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-slate-600">预设名称</span>
                  <input className={inputClass} value={preset.name} onChange={(e) => patchPreset((p) => ({ ...p, name: e.target.value }))} />
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="block space-y-1">
                    <span className="font-semibold text-slate-600">目标字数</span>
                    <input
                      type="number"
                      min={100}
                      max={6000}
                      step={100}
                      className={inputClass}
                      value={preset.targetWords}
                      onChange={(e) => patchPreset((p) => ({ ...p, targetWords: Math.max(100, Math.min(6000, Number(e.target.value) || 800)) }))}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-semibold text-slate-600">温度 {preset.temperature.toFixed(2)}</span>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      className="w-full"
                      value={preset.temperature}
                      onChange={(e) => patchPreset((p) => ({ ...p, temperature: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className={pillBtn} onClick={() => downloadJson(`${preset.name}.preset.json`, { type: 'yyphone-offline-preset', version: 1, preset })}>
                    <Download className="mr-1 inline h-3 w-3" />导出
                  </button>
                  <button
                    type="button"
                    className={pillBtn}
                    onClick={() => {
                      const copy: OfflinePreset = {
                        ...preset,
                        id: newOfflineId('preset'),
                        name: `${preset.name}（副本）`,
                        entries: preset.entries.map((e) => ({ ...e, id: newOfflineId('pe') })),
                      };
                      setPresets((prev) => [...prev, copy]);
                      setActivePresetId(copy.id);
                    }}
                  >
                    <Copy className="mr-1 inline h-3 w-3" />复制
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white bg-rose-50 px-3 py-1.5 text-[11px] text-rose-400 active:scale-95"
                    onClick={() => {
                      if (presets.length <= 1) {
                        flash('至少保留一个预设');
                        return;
                      }
                      if (!window.confirm(`删除预设「${preset.name}」？用到它的故事会改用第一个预设。`)) return;
                      const rest = presets.filter((p) => p.id !== preset.id);
                      setPresets(rest);
                      setStories((prev) => prev.map((s) => (s.presetId === preset.id ? { ...s, presetId: rest[0].id } : s)));
                      setActivePresetId(rest[0].id);
                    }}
                  >
                    <Trash2 className="mr-1 inline h-3 w-3" />删除
                  </button>
                </div>
              </div>
            )}

            {preset && (
              <div className="space-y-2">
                <p className="px-1 text-[11px] text-slate-400">提示词条目会按顺序发给 AI；关掉开关的条目不会发送。可以写文风、视角、禁词，或任何自定义要求。</p>
                {preset.entries.map((entry, index) => (
                  <div key={entry.id} className={`${cardClass} space-y-2 p-3 ${entry.enabled ? '' : 'opacity-60'}`}>
                    <div className="flex items-center gap-1.5">
                      <input type="checkbox" aria-label="启用" checked={entry.enabled} onChange={(e) => patchEntry(entry.id, { enabled: e.target.checked })} />
                      <input className={`${inputClass} flex-1 font-semibold`} value={entry.title} onChange={(e) => patchEntry(entry.id, { title: e.target.value })} placeholder="条目名称" />
                      <button type="button" aria-label="上移" onClick={() => moveEntry(index, -1)} className="rounded-full p-1.5 text-slate-400 hover:bg-white"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="下移" onClick={() => moveEntry(index, 1)} className="rounded-full p-1.5 text-slate-400 hover:bg-white"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button
                        type="button"
                        aria-label="删除条目"
                        onClick={() => patchPreset((p) => ({ ...p, entries: p.entries.filter((e) => e.id !== entry.id) }))}
                        className="rounded-full p-1.5 text-rose-300 hover:bg-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      className={`${inputClass} min-h-20 resize-y leading-relaxed`}
                      value={entry.content}
                      onChange={(e) => patchEntry(entry.id, { content: e.target.value })}
                      placeholder="这一条要求的具体内容"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className={pillBtn}
                  onClick={() => patchPreset((p) => ({ ...p, entries: [...p.entries, { id: newOfflineId('pe'), title: '新条目', content: '', enabled: true }] }))}
                >
                  <Plus className="mr-1 inline h-3 w-3" />添加条目
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ---------- 新建 / 编辑故事 ---------- */}
      {formMode && draft && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-slate-900/25 backdrop-blur-xs">
          <div className="flex max-h-[88%] w-full max-w-md flex-col rounded-t-[28px] border border-white bg-gradient-to-b from-white to-[#F6F8FC] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A5A6A]">{formMode === 'create' ? '新故事' : '故事设置'}</h3>
              <button type="button" aria-label="关闭" onClick={() => { setFormMode(null); setDraft(null); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <StoryForm draft={draft} onChange={setDraft} contacts={contacts} personas={personaInfo.profiles} books={books} presets={presets} />
            </div>
            <button type="button" className={`${gradBtn} mt-3 w-full`} onClick={submitForm}>
              {formMode === 'create' ? '开始创作' : '保存设置'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- 外观 ---------- */}
      {styleOpen && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/25 backdrop-blur-xs">
          <div className="flex max-h-[88%] w-full max-w-md flex-col rounded-t-[28px] border border-white bg-gradient-to-b from-white to-[#F6F8FC] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A5A6A]">线下外观</h3>
              <button type="button" aria-label="关闭" onClick={() => setStyleOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            <div className="mb-3 grid grid-cols-3 rounded-2xl bg-white/70 p-1 text-xs">
              {([['wallpaper', '壁纸'], ['ai', '剧情气泡'], ['user', '我的气泡']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStyleTab(key)}
                  className={`rounded-xl py-1.5 font-semibold ${styleTab === key ? 'bg-white text-[#6F7F8E] shadow-sm' : 'text-slate-400'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
              {styleTab === 'wallpaper' && (
                <div className="space-y-2 text-xs">
                  <div
                    className="h-28 rounded-2xl border border-white bg-gradient-to-b from-[#FBF3F7] to-[#EAF2F8] bg-cover bg-center"
                    style={style.wallpaperUrl ? { backgroundImage: `url(${style.wallpaperUrl})` } : undefined}
                  />
                  <input
                    className={inputClass}
                    placeholder="粘贴壁纸图片链接…"
                    value={style.wallpaperUrl.startsWith('data:') ? '' : style.wallpaperUrl}
                    onChange={(e) => setStyle((prev) => ({ ...prev, wallpaperUrl: e.target.value.trim() }))}
                  />
                  <div className="flex gap-2">
                    <button type="button" className={pillBtn} onClick={() => wallpaperInputRef.current?.click()}>
                      <Upload className="mr-1 inline h-3 w-3" />上传本地图片
                    </button>
                    <button type="button" className={pillBtn} onClick={() => setStyle((prev) => ({ ...prev, wallpaperUrl: '' }))}>恢复默认背景</button>
                  </div>
                  <input
                    ref={wallpaperInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void uploadWallpaper(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}

              {styleTab !== 'wallpaper' && (
                <div className="space-y-3 text-xs">
                  <div
                    className="rounded-2xl border border-white/80 px-4 py-3 text-[13px] leading-[1.8]"
                    style={styleTab === 'ai' ? aiBubbleStyle : userBubbleStyle}
                  >
                    {styleTab === 'ai' ? '细雨打在窗沿，她抬起头，笑意藏在没说出口的话里。' : '我伸手替她把伞往那边偏了偏。'}
                  </div>
                  <ColorWheel
                    label="气泡颜色"
                    value={styleTab === 'ai' ? style.aiBubbleColor : style.userBubbleColor}
                    onChange={(hex) => setStyle((prev) => (styleTab === 'ai' ? { ...prev, aiBubbleColor: hex } : { ...prev, userBubbleColor: hex }))}
                  />
                  <label className="block space-y-1">
                    <span className="font-semibold text-slate-600">
                      气泡透明度 {Math.round((styleTab === 'ai' ? style.aiBubbleOpacity : style.userBubbleOpacity) * 100)}%
                    </span>
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.05}
                      className="w-full"
                      value={styleTab === 'ai' ? style.aiBubbleOpacity : style.userBubbleOpacity}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setStyle((prev) => (styleTab === 'ai' ? { ...prev, aiBubbleOpacity: value } : { ...prev, userBubbleOpacity: value }));
                      }}
                    />
                  </label>
                  <ColorWheel
                    label="字体颜色"
                    value={styleTab === 'ai' ? style.aiTextColor : style.userTextColor}
                    onChange={(hex) => setStyle((prev) => (styleTab === 'ai' ? { ...prev, aiTextColor: hex } : { ...prev, userTextColor: hex }))}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              className={`${pillBtn} mt-3 w-full`}
              onClick={() => setStyle(DEFAULT_OFFLINE_STYLE)}
            >
              全部恢复默认
            </button>
          </div>
        </div>
      )}

      {/* ---------- 剧情摘要 ---------- */}
      {summaryModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-5 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-3 rounded-[26px] border border-white bg-white/95 p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-[#4A5A6A]">已写入角色记忆</h3>
            <p className="text-[11px] text-slate-400">下面这段摘要会成为角色在微信里对这段线下剧情的记忆，可以修改。</p>
            <textarea
              className={`${inputClass} h-48 resize-none leading-relaxed`}
              value={summaryModal.text}
              onChange={(e) => setSummaryModal({ ...summaryModal, text: e.target.value })}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={`${gradBtn} flex-1`}
                onClick={() => {
                  const target = stories.find((s) => s.id === summaryModal.storyId);
                  if (target && summaryModal.text.trim()) saveOfflineMemory(target, summaryModal.text.trim());
                  setSummaryModal(null);
                }}
              >
                保存
              </button>
              <button type="button" className={pillBtn} onClick={() => setSummaryModal(null)}>不改了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
