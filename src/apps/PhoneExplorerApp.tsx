import React, { useEffect, useRef, useState } from 'react';
import {
  Wallet,
  MapPin,
  HeartPulse,
  MessageCircle,
  Image as ImageIcon,
  Compass,
  FileText,
  Feather,
  Bot,
  ChevronLeft,
  Lock,
  Unlock,
  Pin,
  Search,
  Wifi,
  Battery,
  Menu,
  Upload,
  Download,
  Trash2,
  X,
} from 'lucide-react';
import { readAlipayContacts, AlipayContact } from '../utils/alipayData';
import { showYyError } from '../components/ErrorDialog';
import { generatePhoneScope, PhoneGenContext, PhoneGenScope } from '../utils/phoneAi';
import {
  CHECK_PHONE_STORAGE_KEY,
  formatMoney,
  PhoneHealth,
  PhoneShareMode,
  PhoneWallet,
  postPhoneShareCard,
  syncPhoneMemoryToContext,
} from '../utils/phoneData';
import { readStorageString, writeStorageString } from '../utils/localStorage';

interface CheckPhoneAppProps {
  onBack: () => void;
}

const getCharAvatar = (charObj: unknown): string => {
  if (!charObj || typeof charObj !== 'object') return '';
  const record = charObj as Record<string, unknown>;
  if (typeof record.avatarUrl === 'string') return record.avatarUrl;
  if (typeof record.avatar === 'string') return record.avatar;
  return '';
};

type SubAppKey = 'home' | 'wechat' | 'album' | 'browser' | 'notes' | 'icity' | 'agent' | 'wallet' | 'maps' | 'health';

const GEN_SCOPES: PhoneGenScope[] = ['wechat', 'album', 'browser', 'notes', 'icity', 'agent', 'wallet', 'health'];
const scopeForApp = (app: SubAppKey): 'all' | PhoneGenScope =>
  app === 'home' ? 'all' : app === 'maps' ? 'album' : app;

export interface PhoneWeChatMsg {
  id: string;
  sender: 'char' | 'other';
  senderName: string;
  text: string;
  time: string;
}

export interface PhoneWeChatThread {
  id: string;
  targetId: string;
  name: string;
  remark: string;
  isPinnedUser?: boolean;
  avatarText: string;
  avatarBg: string;
  messages: PhoneWeChatMsg[];
}

export interface PhonePhotoItem {
  id: string;
  isPrivate: boolean;
  dateStr: string;
  location: string;
  sceneDesc: string;
  charThought: string;
}

export interface PhoneBrowserItem {
  id: string;
  query: string;
  urlDomain: string;
  timeStr: string;
  tag: '日常' | '情感' | '私密18+';
  summary: string;
}

export interface PhoneNoteItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface PhoneIcityDiary {
  id: string;
  dateStr: string;
  timeStr: string;
  weather: string;
  mood: string;
  content: string;
}

export interface PhoneAgentTurn {
  id: string;
  role: 'char' | 'ai';
  content: string;
}

export interface PhoneAgentSession {
  doubaoTopic: string;
  doubaoTurns: PhoneAgentTurn[];
  claudeTopic: string;
  claudeTurns: PhoneAgentTurn[];
}

export interface CharacterPhoneData {
  charId: string;
  wallpaperUrl: string;
  userRemark: string;
  npcThreads: PhoneWeChatThread[];
  photos: PhonePhotoItem[];
  browserHistory: PhoneBrowserItem[];
  notes: PhoneNoteItem[];
  icityDiaries: PhoneIcityDiary[];
  agentSession: PhoneAgentSession;
  wallet?: PhoneWallet;
  health?: PhoneHealth;
}

const readRealUserMessagesForChar = (
  charId: string,
  charName: string,
  userName: string
): PhoneWeChatMsg[] => {
  try {
    const raw = localStorage.getItem('yyphone:wechat-chats');
    const chats: unknown = raw ? JSON.parse(raw) : [];
    const chat = Array.isArray(chats)
      ? chats.find(
          (item) =>
            item?.type === 'direct' &&
            Array.isArray(item.participantIds) &&
            item.participantIds.length === 1 &&
            item.participantIds[0] === charId
        )
      : undefined;
    const list: Record<string, unknown>[] = Array.isArray(chat?.messages)
      ? chat.messages.filter(
          (m: Record<string, unknown>) =>
            m.senderId !== 'narrator' && (typeof m.text === 'string' || typeof m.title === 'string')
        )
      : [];
    return list.slice(-10).map((m, idx) => {
      const isFromUser = m.senderId === 'user';
      const created = typeof m.createdAt === 'string' ? new Date(m.createdAt) : null;
      return {
        id: String(m.id || `real-${idx}`),
        sender: isFromUser ? ('other' as const) : ('char' as const),
        senderName: isFromUser ? userName : charName,
        text: String(m.text || m.title || '[互动卡片消息]'),
        time: created && !Number.isNaN(created.getTime())
          ? created.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '',
      };
    });
  } catch {
    return [];
  }
};

const readLinkedNpcsForChar = (charId: string): { id: string; name: string; persona: string }[] => {
  try {
    const raw = localStorage.getItem('yyphone:character-npcs');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list.filter(
          (n) =>
            n.charId === charId ||
            (Array.isArray(n.linkedCharIds) && n.linkedCharIds.includes(charId))
        );
      }
    }
  } catch {
    // ignore
  }
  return [];
};

const getUserWeChatName = () => {
  try {
    const raw = localStorage.getItem('yyphone:wechat-profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.name) return String(parsed.name);
    }
  } catch {
    // ignore
  }
  return '你';
};

// 默认是空白手机：内容全部由玩家点 ✦ 后让 AI 生成，不再内置任何假数据。
const createDefaultPhoneData = (charId: string, _charName: string): CharacterPhoneData => ({
  charId,
  wallpaperUrl: '',
  userRemark: '',
  npcThreads: [],
  photos: [],
  browserHistory: [],
  notes: [],
  icityDiaries: [],
  agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] },
});

export const CheckPhoneApp: React.FC<CheckPhoneAppProps> = ({ onBack }) => {
  const [contacts] = useState<AlipayContact[]>(() => readAlipayContacts());
  const [selectedCharId, setSelectedCharId] = useState<string>(contacts[0]?.id || 'default_char');
  const currentChar = contacts.find((c) => c.id === selectedCharId) || {
    id: 'default_char',
    name: 'TA',
  };
  const currentCharAvatar = getCharAvatar(currentChar);

  const userName = getUserWeChatName();

  const [phonesMap, setPhonesMap] = useState<Record<string, CharacterPhoneData>>(() => {
    let saved: Record<string, Partial<CharacterPhoneData>> = {};
    try {
      const parsed: unknown = JSON.parse(readStorageString(CHECK_PHONE_STORAGE_KEY) ?? '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        saved = parsed as Record<string, Partial<CharacterPhoneData>>;
      }
    } catch {
      saved = {};
    }
    const map: Record<string, CharacterPhoneData> = {};
    const ids = contacts.length > 0 ? contacts.map((c) => ({ id: c.id, name: c.name })) : [{ id: 'default_char', name: 'TA' }];
    ids.forEach(({ id, name }) => {
      const merged = { ...createDefaultPhoneData(id, name), ...(saved[id] ?? {}), charId: id };
      // 清掉旧版本存下来的内置假数据（固定 id）
      const isFake = (item: { id: string }) => /^(npc-thread-\d|p-\d|b-\d|note-\d|ic-\d)$/.test(item.id);
      merged.npcThreads = (merged.npcThreads ?? []).filter((item) => !isFake(item));
      merged.photos = (merged.photos ?? []).filter((item) => !isFake(item));
      merged.browserHistory = (merged.browserHistory ?? []).filter((item) => !isFake(item));
      merged.notes = (merged.notes ?? []).filter((item) => !isFake(item));
      merged.icityDiaries = (merged.icityDiaries ?? []).filter((item) => !isFake(item));
      if (merged.agentSession?.doubaoTurns?.some((turn) => /^(db|cl)-\d$/.test(turn.id)) ||
          merged.agentSession?.claudeTurns?.some((turn) => /^(db|cl)-\d$/.test(turn.id))) {
        merged.agentSession = { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] };
      }
      if (/置顶唯一/.test(merged.userRemark ?? '')) merged.userRemark = '';
      map[id] = merged;
    });
    return map;
  });
  const phonesMapRef = useRef(phonesMap);
  phonesMapRef.current = phonesMap;

  useEffect(() => {
    try {
      writeStorageString(CHECK_PHONE_STORAGE_KEY, JSON.stringify(phonesMap));
    } catch {
      // 壁纸等大图可能超出存储空间：去掉本地图片壁纸再存一次，保证钱包等关键数据不丢
      try {
        const slim = Object.fromEntries(
          Object.entries(phonesMap).map(([id, phone]) => [
            id,
            phone.wallpaperUrl.startsWith('data:') ? { ...phone, wallpaperUrl: '' } : phone,
          ])
        );
        writeStorageString(CHECK_PHONE_STORAGE_KEY, JSON.stringify(slim));
      } catch (error) {
        console.error('Could not save check-phone data.', error);
      }
    }
  }, [phonesMap]);

  const currentPhone =
    phonesMap[selectedCharId] || createDefaultPhoneData(selectedCharId, currentChar.name);

  const updateCurrentPhone = (updater: (prev: CharacterPhoneData) => CharacterPhoneData) => {
    setPhonesMap((prev) => ({
      ...prev,
      [selectedCharId]: updater(
        prev[selectedCharId] || createDefaultPhoneData(selectedCharId, currentChar.name)
      ),
    }));
  };

  const [activeSubApp, setActiveSubApp] = useState<SubAppKey>('home');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showTopMenu, setShowTopMenu] = useState<boolean>(false);

  const [selectedWeChatThreadId, setSelectedWeChatThreadId] = useState<string | null>(null);
  const [albumTab, setAlbumTab] = useState<'normal' | 'private'>('normal');
  const [unlockedPhotoIds, setUnlockedPhotoIds] = useState<string[]>([]);
  const [agentTab, setAgentTab] = useState<'doubao' | 'claude'>('doubao');

  const realUserMessages = readRealUserMessagesForChar(selectedCharId, currentChar.name, userName);
  const pinnedUserThread: PhoneWeChatThread = {
    id: 'thread-pinned-user',
    targetId: 'user',
    name: userName,
    remark: currentPhone.userRemark || `♡ ${userName}`,
    isPinnedUser: true,
    avatarText: userName.slice(0, 1),
    avatarBg: '#EFE3E6',
    messages: realUserMessages,
  };

  const allWeChatThreads = [pinnedUserThread, ...currentPhone.npcThreads];
  const activeWeChatThread = allWeChatThreads.find((t) => t.id === selectedWeChatThreadId);

  // 同一角色同一天的屏幕使用时间固定，不会每次渲染乱跳
  const screenTimeText = (() => {
    if (currentPhone.health) {
      const m = currentPhone.health.screenTimeMinutes;
      return `${Math.floor(m / 60)}小时${m % 60}分钟`;
    }
    const seed = `${selectedCharId}-${new Date().toDateString()}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const minutes = Math.min(nowMinutes, 90 + (hash % 300));
    return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
  })();
  const [revealedBrowserIds, setRevealedBrowserIds] = useState<string[]>([]);
  const [shareDraft, setShareDraft] = useState<{ appLabel: string; summary: string; detail: string } | null>(null);
  const [shareNotice, setShareNotice] = useState('');

  const handleTriggerGenerate = async (scope: 'all' | PhoneGenScope) => {
    if (isGenerating) return;
    setIsGenerating(true);
    const ctx: PhoneGenContext = {
      charId: selectedCharId,
      charName: currentChar.name,
      userName,
      npcs: readLinkedNpcsForChar(selectedCharId),
    };
    const scopes: PhoneGenScope[] = scope === 'all' ? [...GEN_SCOPES] : [scope];
    const charId = selectedCharId;
    const results = await Promise.allSettled(
      scopes.map(async (item) => {
        const patch = await generatePhoneScope(item, ctx, phonesMapRef.current[charId] ?? currentPhone);
        setPhonesMap((prev) => ({
          ...prev,
          [charId]: { ...(prev[charId] ?? createDefaultPhoneData(charId, currentChar.name)), ...patch },
        }));
      })
    );
    const failed = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [`${scopes[index]}：${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
        : []
    );
    if (failed.length > 0) showYyError(failed.join('\n'), '生成手机内容时出错了');
    setIsGenerating(false);
  };

  const forwardToChar = (appLabel: string, summary: string, detail: string, mode: PhoneShareMode) => {
    if (mode === 'memory') {
      syncPhoneMemoryToContext(selectedCharId, appLabel, detail);
    } else {
      postPhoneShareCard(selectedCharId, currentChar.name, { appLabel, summary, detail });
    }
    setShareDraft(null);
    setShareNotice(mode === 'memory' ? `${appLabel}记忆已同步` : '已转发给TA，回微信里就能看到卡片');
    window.setTimeout(() => setShareNotice(''), 2600);
  };

  const buildShareContent = (): { appLabel: string; summary: string; detail: string } | null => {
    switch (activeSubApp) {
      case 'wechat': {
        const threads = activeWeChatThread && !activeWeChatThread.isPinnedUser
          ? [activeWeChatThread]
          : currentPhone.npcThreads;
        if (threads.length === 0) return null;
        return {
          appLabel: '微信聊天记录',
          summary: threads.map((t) => t.remark).join('、') + ' 的聊天',
          detail: threads
            .map((t) => `与「${t.remark}」的聊天：\n${t.messages.map((m) => `${m.senderName}（${m.time}）：${m.text}`).join('\n')}`)
            .join('\n\n'),
        };
      }
      case 'album': {
        const shown = currentPhone.photos.filter((p) =>
          albumTab === 'private' ? p.isPrivate && unlockedPhotoIds.includes(p.id) : !p.isPrivate
        );
        if (shown.length === 0) return null;
        return {
          appLabel: albumTab === 'private' ? '私密相册' : '相册',
          summary: `${shown.length} 张照片：${shown[0].sceneDesc.slice(0, 30)}…`,
          detail: shown.map((p) => `${p.dateStr}｜${p.location}｜${p.sceneDesc}（备注：${p.charThought}）`).join('\n'),
        };
      }
      case 'browser': {
        const shown = currentPhone.browserHistory.filter((i) => i.tag !== '私密18+' || revealedBrowserIds.includes(i.id));
        if (shown.length === 0) return null;
        return {
          appLabel: '浏览器搜索记录',
          summary: shown.slice(0, 3).map((i) => i.query).join('、'),
          detail: shown.map((i) => `${i.timeStr}｜${i.urlDomain}｜搜索「${i.query}」：${i.summary}`).join('\n'),
        };
      }
      case 'notes':
        if (currentPhone.notes.length === 0) return null;
        return {
          appLabel: '备忘录',
          summary: currentPhone.notes.map((n) => n.title).join('、'),
          detail: currentPhone.notes.map((n) => `《${n.title}》（${n.updatedAt}）\n${n.content}`).join('\n\n'),
        };
      case 'icity':
        if (currentPhone.icityDiaries.length === 0) return null;
        return {
          appLabel: 'icity 日记',
          summary: `${currentPhone.icityDiaries.length} 篇私密日记：${currentPhone.icityDiaries[0].content.slice(0, 30)}…`,
          detail: currentPhone.icityDiaries
            .map((d) => `${d.dateStr} ${d.timeStr}｜${d.weather}｜${d.mood}\n${d.content}`)
            .join('\n\n'),
        };
      case 'agent': {
        const isDoubao = agentTab === 'doubao';
        const session = currentPhone.agentSession;
        const turns = isDoubao ? session.doubaoTurns : session.claudeTurns;
        if (turns.length === 0) return null;
        const aiName = isDoubao ? '豆包' : 'Claude';
        return {
          appLabel: `${aiName}对话记录`,
          summary: `主题：${isDoubao ? session.doubaoTopic : session.claudeTopic}`,
          detail: turns.map((t) => `${t.role === 'char' ? currentChar.name : aiName}：${t.content}`).join('\n'),
        };
      }
      case 'wallet': {
        const wallet = currentPhone.wallet;
        if (!wallet) return null;
        return {
          appLabel: '钱包',
          summary: `总资产 ¥${formatMoney(wallet.balance)}，最近 ${Math.min(wallet.records.length, 12)} 笔收支`,
          detail: [
            `当前总资产：¥${formatMoney(wallet.balance)}`,
            ...wallet.records.slice(0, 12).map(
              (r) => `${r.timeStr}｜${r.title}｜${r.amount >= 0 ? '+' : '-'}¥${formatMoney(Math.abs(r.amount))}${r.note ? `（${r.note}）` : ''}`
            ),
          ].join('\n'),
        };
      }
      case 'health': {
        const health = currentPhone.health;
        if (!health) return null;
        return {
          appLabel: '健康数据',
          summary: `睡眠 ${health.sleepHours} 小时，今日 ${health.steps} 步`,
          detail: `昨晚睡眠 ${health.sleepHours} 小时${health.sleepNote ? `（${health.sleepNote}）` : ''}；今日步数 ${health.steps}；今日屏幕使用 ${Math.floor(health.screenTimeMinutes / 60)} 小时 ${health.screenTimeMinutes % 60} 分钟`,
        };
      }
      default:
        return null;
    }
  };

  const SHAREABLE_APPS: SubAppKey[] = ['wechat', 'album', 'browser', 'notes', 'icity', 'agent', 'wallet', 'health'];
  const shareButton = SHAREABLE_APPS.includes(activeSubApp) ? (
    <button
      type="button"
      onClick={() => {
        const content = buildShareContent();
        if (!content) {
          setShareNotice('这里还没有可转发的内容（加锁或模糊的内容需要先点开）');
          window.setTimeout(() => setShareNotice(''), 2600);
          return;
        }
        setShareDraft(content);
      }}
      className="absolute bottom-5 right-4 z-30 rounded-full border border-white bg-gradient-to-r from-pink-100 to-sky-100 px-3.5 py-2 text-[11px] font-bold text-[#6F7F8E] shadow-[0_6px_16px_rgba(148,163,184,0.25)] active:scale-95"
    >
      📤 转发给TA
    </button>
  ) : null;

  const toggleUnlockPhoto = (photoId: string) => {
    setUnlockedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const handleLocalWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        updateCurrentPhone((p) => ({ ...p, wallpaperUrl: String(ev.target?.result) }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportPhone = () => {
    const dataStr = JSON.stringify({ phonesMap, selectedCharId }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `check_phone_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="relative flex-1 w-full flex flex-col overflow-hidden select-none text-[#4E4B56]"
      style={{
        background: currentPhone.wallpaperUrl
          ? `linear-gradient(rgba(246,245,248,0.45), rgba(240,244,248,0.55)), url(${currentPhone.wallpaperUrl}) center / cover no-repeat`
          : 'linear-gradient(180deg, #F5F2F6 0%, #EFF2F7 52%, #EAEFF5 100%)',
      }}
    >
      <div className="z-20 px-4 pt-[max(env(safe-area-inset-top,0px),10px)] pb-2 flex items-center justify-between bg-white/55 backdrop-blur-xl border-b border-white/80 shrink-0">
        <button
          onClick={() => {
            if (selectedWeChatThreadId) {
              setSelectedWeChatThreadId(null);
            } else if (activeSubApp !== 'home') {
              setActiveSubApp('home');
            } else {
              onBack();
            }
          }}
          className="flex items-center gap-1 text-xs font-bold text-[#635E6E] hover:text-slate-900 cursor-pointer active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>
            {selectedWeChatThreadId
              ? '微信列表'
              : activeSubApp !== 'home'
              ? `${currentChar.name}的桌面`
              : '退出查手机'}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedCharId}
            onChange={(e) => {
              setSelectedCharId(e.target.value);
              setActiveSubApp('home');
              setSelectedWeChatThreadId(null);
            }}
            className="px-3 py-1 rounded-full bg-white/80 border border-slate-200/80 text-[11px] font-bold text-[#5E5968] outline-none shadow-2xs cursor-pointer"
          >
            {contacts.length === 0 ? (
              <option value="default_char">📱 TA的手机</option>
            ) : (
              contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  📱 {c.name}的手机
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void handleTriggerGenerate(scopeForApp(activeSubApp))}
            disabled={isGenerating}
            className="w-7 h-7 rounded-full bg-white/80 hover:bg-white border border-white text-[#7C7489] flex items-center justify-center text-sm font-bold shadow-2xs cursor-pointer active:scale-95 transition-all"
            title={activeSubApp === 'home' ? '✦ 一键生成全机内容' : '✦ 重新生成当前 App 内容'}
          >
            <span className={isGenerating ? 'animate-spin inline-block' : ''}>✦</span>
          </button>

          <button
            onClick={() => setShowTopMenu(true)}
            className="w-7 h-7 rounded-full bg-white/80 hover:bg-white border border-white text-slate-500 flex items-center justify-center shadow-2xs cursor-pointer active:scale-95"
            title="壁纸与数据管理"
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeSubApp === 'home' && (
        <div className="flex-1 flex flex-col justify-between px-5 pt-4 pb-6 overflow-y-auto no-scrollbar">
          <div className="space-y-6">
            <div className="rounded-[26px] bg-white/65 backdrop-blur-xl border border-white/90 p-4 flex items-center justify-between shadow-[0_8px_24px_-8px_rgba(148,163,184,0.12)]">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span>{currentChar.name}'s iPhone</span>
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    <Battery className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-2xl font-light tracking-tight text-[#4A4652] font-mono">
                  {new Date().toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </p>
                <p className="text-[11px] text-slate-500">
                  今日屏幕使用时间：<span className="font-medium text-[#8C727D]">{screenTimeText}</span>
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-[#EAE6ED] border-2 border-white shadow-2xs flex items-center justify-center overflow-hidden text-sm font-bold text-[#6E6778]">
                {currentCharAvatar ? (
                  <img
                    src={currentCharAvatar}
                    alt={currentChar.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  currentChar.name.slice(0, 1)
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-2">
              {[
                {
                  key: 'wechat',
                  label: '微信',
                  icon: MessageCircle,
                  bg: '#DCE8E0',
                  color: '#52735F',
                },
                {
                  key: 'album',
                  label: '相册',
                  icon: ImageIcon,
                  bg: '#F2E4E8',
                  color: '#8C6773',
                },
                {
                  key: 'browser',
                  label: 'Safari',
                  icon: Compass,
                  bg: '#DFEAEF',
                  color: '#547387',
                },
                {
                  key: 'notes',
                  label: '备忘录',
                  icon: FileText,
                  bg: '#F5EFE0',
                  color: '#8C7A56',
                },
                {
                  key: 'icity',
                  label: 'icity',
                  icon: Feather,
                  bg: '#E8E4F0',
                  color: '#6B6082',
                },
                {
                  key: 'agent',
                  label: '智能体',
                  icon: Bot,
                  bg: '#E4E8EC',
                  color: '#5C6873',
                },
              ].map((app) => {
                const IconComp = app.icon;
                return (
                  <button
                    key={app.key}
                    onClick={() => setActiveSubApp(app.key as SubAppKey)}
                    className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
                  >
                    <div
                      style={{ backgroundColor: app.bg, color: app.color }}
                      className="relative w-15 h-15 rounded-[18px] border border-white/95 shadow-[0_6px_16px_-4px_rgba(148,163,184,0.18)] flex items-center justify-center"
                    >
                      <IconComp className="w-7 h-7 stroke-[1.75]" />
                    </div>
                    <span className="text-[11px] font-medium text-[#5A5564]">{app.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/90 px-4 py-3 flex items-center justify-around shadow-[0_10px_28px_-8px_rgba(148,163,184,0.2)]">
            {[
              { key: 'wallet', icon: Wallet, bg: '#DCE8E0', color: '#52735F' },
              { key: 'maps', icon: MapPin, bg: '#F2E4E8', color: '#8C6773' },
              { key: 'health', icon: HeartPulse, bg: '#E8E4F0', color: '#6B6082' },
            ].map((dock) => {
              const DockIcon = dock.icon;
              return (
                <button
                  key={dock.key}
                  onClick={() => setActiveSubApp(dock.key as SubAppKey)}
                  style={{ backgroundColor: dock.bg, color: dock.color }}
                  className="w-12 h-12 rounded-[15px] border border-white flex items-center justify-center shadow-2xs active:scale-95 transition-transform cursor-pointer"
                >
                  <DockIcon className="w-5.5 h-5.5 stroke-[1.8]" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeSubApp === 'wechat' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-2.5">
          {!activeWeChatThread ? (
            <>
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-bold text-slate-600">消息</span>
                <span className="text-[10px] text-slate-400">点击右上角 ✦ 可刷新对话</span>
              </div>

              {currentPhone.npcThreads.length === 0 && (
                <p className="px-1 text-[10px] text-slate-400">TA 的好友对话还是空的，点右上角 ✦ 生成</p>
              )}

              {allWeChatThreads.map((thread) => {
                const lastMsg = thread.messages[thread.messages.length - 1];
                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedWeChatThreadId(thread.id)}
                    className={`w-full p-3.5 rounded-[22px] border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      thread.isPinnedUser
                        ? 'bg-[#F7F1F3]/90 border-white shadow-2xs'
                        : 'bg-white/75 border-white/90 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        style={{ backgroundColor: thread.avatarBg }}
                        className="w-11 h-11 rounded-2xl border border-white flex items-center justify-center text-xs font-bold text-slate-600 shrink-0"
                      >
                        {thread.avatarText}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-700 truncate">
                            {thread.remark}
                          </span>
                          {thread.isPinnedUser && (
                            <Pin className="w-3 h-3 text-[#99737E] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {lastMsg ? `${lastMsg.senderName}：${lastMsg.text}` : '暂无消息'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {lastMsg?.time || ''}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="space-y-3 pb-4">
              <div className="text-center py-1">
                <span className="text-[10px] bg-white/70 px-3 py-1 rounded-full text-slate-500 border border-white">
                  备注名：{activeWeChatThread.remark}（共 {activeWeChatThread.messages.length} 条记录）
                </span>
              </div>

              {activeWeChatThread.messages.slice(-10).map((m) => {
                const isCharSelf = m.sender === 'char';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isCharSelf ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[9px] text-slate-400 mb-1 px-1">
                      {m.senderName} · {m.time}
                    </span>
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed border ${
                        isCharSelf
                          ? 'bg-[#DCE8E0]/90 text-[#3B5244] border-white rounded-tr-xs'
                          : 'bg-white/90 text-slate-700 border-white rounded-tl-xs'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubApp === 'album' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          <div className="grid grid-cols-2 p-1 bg-white/65 backdrop-blur-md rounded-2xl border border-white">
            <button
              onClick={() => setAlbumTab('normal')}
              className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                albumTab === 'normal'
                  ? 'bg-white text-slate-700 shadow-2xs'
                  : 'text-slate-400'
              }`}
            >
              日常相册 ({currentPhone.photos.filter((p) => !p.isPrivate).length})
            </button>
            <button
              onClick={() => setAlbumTab('private')}
              className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                albumTab === 'private'
                  ? 'bg-white text-[#8C6773] shadow-2xs'
                  : 'text-slate-400'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>私密相册 ({currentPhone.photos.filter((p) => p.isPrivate).length})</span>
            </button>
          </div>

          <div className="space-y-3">
            {currentPhone.photos.length === 0 && (
              <p className="py-10 text-center text-[11px] text-slate-400">相册还是空的，点右上角 ✦ 生成</p>
            )}
            {currentPhone.photos
              .filter((p) => (albumTab === 'private' ? p.isPrivate : !p.isPrivate))
              .map((photo) => {
                const isLocked = photo.isPrivate && !unlockedPhotoIds.includes(photo.id);
                return (
                  <div
                    key={photo.id}
                    onClick={() => {
                      if (photo.isPrivate) toggleUnlockPhoto(photo.id);
                    }}
                    className="relative rounded-[24px] bg-white/80 backdrop-blur-xl border border-white p-4 space-y-2.5 shadow-2xs overflow-hidden cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>📍 {photo.location}</span>
                      <span className="flex items-center gap-1">
                        {photo.isPrivate && (
                          <Unlock className="w-3 h-3 text-[#99737E]" />
                        )}
                        {photo.dateStr}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#F7F4F6] to-[#EDF2F7] border border-white">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {photo.sceneDesc}
                      </p>
                    </div>

                    <p className="text-[11px] text-[#7E6B74] bg-[#F9F4F6] px-3 py-1.5 rounded-xl">
                      💭 备注：{photo.charThought}
                    </p>

                    {isLocked && (
                      <div className="absolute inset-0 bg-[#F2EEF3]/85 backdrop-blur-md flex flex-col items-center justify-center gap-1.5 text-[#7A6B78]">
                        <div className="w-10 h-10 rounded-full bg-white/90 border border-white flex items-center justify-center shadow-2xs">
                          <Lock className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold">轻点一下悄悄解锁查看</span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {activeSubApp === 'browser' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          <div className="px-3.5 py-2 rounded-2xl bg-white/80 border border-white flex items-center gap-2 text-xs text-slate-400">
            <Search className="w-3.5 h-3.5" />
            <span>搜索或输入网站名称 · 最近 5 条历史记录</span>
          </div>

          <div className="space-y-2.5">
            {currentPhone.browserHistory.length === 0 && (
              <p className="py-10 text-center text-[11px] text-slate-400">还没有搜索记录，点右上角 ✦ 生成</p>
            )}
            {currentPhone.browserHistory.map((item) => {
              const isSensitive = item.tag === '私密18+';
              const isHidden = isSensitive && !revealedBrowserIds.includes(item.id);
              return (
              <div
                key={item.id}
                onClick={() => {
                  if (isHidden) setRevealedBrowserIds((prev) => [...prev, item.id]);
                }}
                className={`relative p-3.5 rounded-[22px] bg-white/80 backdrop-blur-xl border border-white space-y-1.5 shadow-2xs ${isHidden ? 'cursor-pointer' : ''}`}
              >
                <div className={`space-y-1.5 transition-all ${isHidden ? 'blur-md select-none pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isSensitive
                        ? 'bg-[#F3E5E8] text-[#966571]'
                        : item.tag === '情感'
                        ? 'bg-[#EAE6F2] text-[#6E6385]'
                        : 'bg-[#E5EDF2] text-[#5B7485]'
                    }`}
                  >
                    {item.tag}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {item.urlDomain} · {item.timeStr}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-snug">
                  🔍 {item.query}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {item.summary}
                </p>
                </div>
                {isHidden && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#8C6773]">
                    点击查看
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubApp === 'notes' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          {currentPhone.notes.length === 0 && (
            <p className="py-10 text-center text-[11px] text-slate-400">备忘录还是空的，点右上角 ✦ 生成</p>
          )}
          {currentPhone.notes.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-[24px] bg-[#FDFBF7]/90 border border-white space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#5C5346]">{n.title}</h4>
                <span className="text-[10px] font-mono text-slate-400">{n.updatedAt}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {n.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeSubApp === 'icity' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="text-xs font-bold text-[#6B6082]">
              icity · 仅 {currentChar.name} 自己可见的私密日记
            </span>
          </div>

          {currentPhone.icityDiaries.length === 0 && (
            <p className="py-10 text-center text-[11px] text-slate-400">还没有日记，点右上角 ✦ 生成</p>
          )}
          {currentPhone.icityDiaries.map((d) => (
            <div
              key={d.id}
              className="p-4 rounded-[24px] bg-white/80 backdrop-blur-xl border border-white space-y-2.5 shadow-2xs"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono border-b border-slate-100 pb-2">
                <span>
                  {d.dateStr} · {d.timeStr}
                </span>
                <span className="text-[#7E7294] font-sans font-medium">
                  {d.weather} · {d.mood}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {d.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeSubApp === 'agent' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          <div className="grid grid-cols-2 p-1 bg-white/65 backdrop-blur-md rounded-2xl border border-white">
            <button
              onClick={() => setAgentTab('doubao')}
              className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                agentTab === 'doubao'
                  ? 'bg-white text-slate-700 shadow-2xs'
                  : 'text-slate-400'
              }`}
            >
              豆包
            </button>
            <button
              onClick={() => setAgentTab('claude')}
              className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                agentTab === 'claude'
                  ? 'bg-white text-slate-700 shadow-2xs'
                  : 'text-slate-400'
              }`}
            >
              Claude
            </button>
          </div>

          <div className="p-3.5 rounded-[24px] bg-white/80 border border-white space-y-3 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 border-b border-slate-100 pb-2">
              对话主题：
              {agentTab === 'doubao'
                ? currentPhone.agentSession.doubaoTopic
                : currentPhone.agentSession.claudeTopic}
            </div>

            <div className="space-y-2.5">
              {(agentTab === 'doubao' ? currentPhone.agentSession.doubaoTurns : currentPhone.agentSession.claudeTurns).length === 0 && (
                <p className="py-6 text-center text-[11px] text-slate-400">还没有对话，点右上角 ✦ 生成</p>
              )}
              {(agentTab === 'doubao'
                ? currentPhone.agentSession.doubaoTurns
                : currentPhone.agentSession.claudeTurns
              ).map((turn) => (
                <div
                  key={turn.id}
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    turn.role === 'char'
                      ? 'bg-[#EAEFF5] text-slate-700 ml-4'
                      : 'bg-[#F7F5F8] text-slate-600 mr-4 border border-white'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    {turn.role === 'char'
                      ? `${currentChar.name} 提问：`
                      : agentTab === 'doubao'
                      ? '豆包：'
                      : 'Claude：'}
                  </span>
                  {turn.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubApp === 'wallet' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          <div className="rounded-[26px] border border-white bg-gradient-to-br from-[#EAF3EE] via-white to-[#F6EAF0] p-5 shadow-2xs">
            <p className="text-[11px] text-slate-400">总资产（元）</p>
            <p className="mt-1 text-3xl font-light tracking-tight text-[#4A4652]">
              {currentPhone.wallet ? `¥${formatMoney(currentPhone.wallet.balance)}` : '—'}
            </p>
            {!currentPhone.wallet && (
              <p className="mt-2 text-[10px] text-slate-400">点右上角 ✦ 生成钱包。生成后，TA 会一直记得自己的钱包状况。</p>
            )}
          </div>
          <p className="px-1 text-xs font-bold text-slate-600">收支明细</p>
          {(currentPhone.wallet?.records ?? []).map((record) => (
            <div key={record.id} className="flex items-center justify-between rounded-[20px] border border-white bg-white/80 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-700">{record.title}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {record.timeStr}{record.note ? ` · ${record.note}` : ''}
                </p>
              </div>
              <span className={`shrink-0 text-sm font-medium ${record.amount >= 0 ? 'text-[#6FA386]' : 'text-[#B88996]'}`}>
                {record.amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(record.amount))}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeSubApp === 'maps' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-2.5">
          <p className="px-1 text-xs font-bold text-slate-600">最近去过</p>
          {currentPhone.photos.filter((p) => !p.isPrivate).map((photo) => (
            <div key={photo.id} className="flex items-center gap-3 rounded-[20px] border border-white bg-white/80 p-3.5">
              <MapPin className="h-4 w-4 shrink-0 text-[#99737E]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-700">{photo.location}</p>
                <p className="text-[10px] text-slate-400">{photo.dateStr}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubApp === 'health' && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-white bg-white/80 p-4">
              <p className="text-[10px] text-slate-400">昨晚睡眠</p>
              <p className="mt-1 text-2xl font-light text-[#6B6082]">
                {currentPhone.health ? `${currentPhone.health.sleepHours}` : '—'}
                <span className="ml-0.5 text-xs">小时</span>
              </p>
              {currentPhone.health?.sleepNote && <p className="mt-1 text-[10px] text-slate-400">{currentPhone.health.sleepNote}</p>}
            </div>
            <div className="rounded-[24px] border border-white bg-white/80 p-4">
              <p className="text-[10px] text-slate-400">今日步数</p>
              <p className="mt-1 text-2xl font-light text-[#52735F]">
                {currentPhone.health ? currentPhone.health.steps.toLocaleString('zh-CN') : '—'}
                <span className="ml-0.5 text-xs">步</span>
              </p>
            </div>
          </div>
          <div className="rounded-[24px] border border-white bg-white/80 p-4 text-center">
            <p className="text-[10px] text-slate-400">今日屏幕使用时间</p>
            <p className="mt-1 text-2xl font-light text-[#4A4652]">{screenTimeText}</p>
          </div>
          {!currentPhone.health && (
            <p className="text-center text-[10px] text-slate-400">点右上角 ✦ 让 TA 生成今天的健康数据</p>
          )}
        </div>
      )}

      {shareButton}
      {shareNotice && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-700/80 px-4 py-2 text-[11px] text-white">
          {shareNotice}
        </div>
      )}
      {shareDraft && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/25 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-3 rounded-[26px] border border-white bg-white/95 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">转发「{shareDraft.appLabel}」给{currentChar.name}</h3>
              <button onClick={() => setShareDraft(null)} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="line-clamp-2 text-[11px] text-slate-400">{shareDraft.summary}</p>
            <button
              onClick={() => forwardToChar(shareDraft.appLabel, shareDraft.summary, shareDraft.detail, 'found')}
              className="w-full rounded-2xl border border-white bg-gradient-to-r from-sky-50 to-sky-100 p-3 text-left active:scale-[0.99]"
            >
              <p className="text-xs font-bold text-[#5B7485]">📱 我查到的内容</p>
              <p className="mt-0.5 text-[10px] text-slate-400">TA 会知道你偷看了 TA 的手机，并作出反应。</p>
            </button>
            <button
              onClick={() => forwardToChar(shareDraft.appLabel, shareDraft.summary, shareDraft.detail, 'memory')}
              className="w-full rounded-2xl border border-white bg-gradient-to-r from-pink-50 to-pink-100 p-3 text-left active:scale-[0.99]"
            >
              <p className="text-xs font-bold text-[#99737E]">🫧 同步为TA自己的记忆</p>
              <p className="mt-0.5 text-[10px] text-slate-400">不发送卡片；聊天里只出现一条「记忆已同步」，内容成为TA的上下文记忆，之后会被流水账总结，不会就此和你对话。</p>
            </button>
          </div>
        </div>
      )}

      {showTopMenu && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-[26px] p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">
                {currentChar.name}的手机 · 壁纸与数据
              </h3>
              <button
                onClick={() => setShowTopMenu(false)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-600 block">自定义该角色的手机壁纸：</span>
              <input
                type="text"
                placeholder="粘贴壁纸图片 URL..."
                value={currentPhone.wallpaperUrl}
                onChange={(e) =>
                  updateCurrentPhone((p) => ({ ...p, wallpaperUrl: e.target.value }))
                }
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>从本地相册上传壁纸</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLocalWallpaperUpload}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={handleExportPhone}
                className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center gap-1.5 text-xs text-slate-600 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出数据</span>
              </button>
              <button
                onClick={() => {
                  updateCurrentPhone(() =>
                    createDefaultPhoneData(selectedCharId, currentChar.name)
                  );
                  setShowTopMenu(false);
                }}
                className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-200/60 flex items-center justify-center gap-1.5 text-xs text-rose-500 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>重置此手机</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};