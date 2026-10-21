import React, { useEffect, useRef, useState } from 'react';
import {
  Heart,
  Calendar as CalendarIcon,
  BookHeart,
  HelpCircle,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Upload,
  Download,
  Menu,
  X,
  Send,
  Unlink,
  Eraser,
  Pencil,
  Trash2,
  ImagePlus,
  RotateCcw,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { CoupleRecordEditor } from '../components/CoupleRecordEditor';
import { coupleRecordDate, editCoupleRecord, type CoupleRecordEdit } from '../utils/coupleRecords';
import { showYyError } from '../components/ErrorDialog';
import { readAlipayContacts, AlipayContact } from '../utils/alipayData';
import { appendCharacterContextEvent } from '../utils/characterContext';
import { compressImageFile } from '../utils/imageFile';
import {
  createEmptyCoupleSpace,
  localDateString,
  postCoupleInviteCard,
  postUserChatNote,
  readCoupleSpaces,
  readWeChatUserProfile,
  setCoupleInviteCardStatus,
  writeCoupleSpaces,
} from '../utils/coupleSpaceData';
import {
  generateCharDiary,
  generateCharMood,
  generateCoupleBatch,
  generateDiaryReply,
  generateQaAnswer,
  generateQaQuestion,
  generateStickyNote,
} from '../utils/coupleSpaceAi';

interface CoupleSpaceAppProps {
  onBack: () => void;
}

// ==================== 1. 心情颜文字与柔和浅色配置 ====================
export type MoodCategory = 'happy' | 'calm' | 'sad' | 'angry' | 'tired';

export interface MoodOption {
  id: string;
  category: MoodCategory;
  label: string;
  kaomoji: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  // 开心（浅黄）
  {
    id: 'happy_1',
    category: 'happy',
    label: '开心',
    kaomoji: '>ᴗoಣ',
    bgColor: '#FEF6C9',
    textColor: '#7A5C12',
    borderColor: '#F7E594',
  },
  {
    id: 'happy_2',
    category: 'happy',
    label: '开心',
    kaomoji: '^ω^',
    bgColor: '#FEF6C9',
    textColor: '#7A5C12',
    borderColor: '#F7E594',
  },
  // 平静（浅绿）
  {
    id: 'calm_1',
    category: 'calm',
    label: '平静',
    kaomoji: '՞˶･֊･˶՞',
    bgColor: '#DCF5E3',
    textColor: '#2B6847',
    borderColor: '#BCE8C9',
  },
  {
    id: 'calm_2',
    category: 'calm',
    label: '平静',
    kaomoji: '૮・・ა',
    bgColor: '#DCF5E3',
    textColor: '#2B6847',
    borderColor: '#BCE8C9',
  },
  // 伤心（浅蓝）
  {
    id: 'sad_1',
    category: 'sad',
    label: '伤心',
    kaomoji: 'ꃋᴖꃋ',
    bgColor: '#DCEEFF',
    textColor: '#305F8C',
    borderColor: '#B8DCFF',
  },
  {
    id: 'sad_2',
    category: 'sad',
    label: '伤心',
    kaomoji: '꒦ິ^꒦ິ',
    bgColor: '#DCEEFF',
    textColor: '#305F8C',
    borderColor: '#B8DCFF',
  },
  // 生气（浅粉）
  {
    id: 'angry_1',
    category: 'angry',
    label: '生气',
    kaomoji: 'ᓀ‸ᓂ',
    bgColor: '#FFE0E9',
    textColor: '#943553',
    borderColor: '#FFC2D4',
  },
  {
    id: 'angry_2',
    category: 'angry',
    label: '生气',
    kaomoji: 'ᗜ - ᗜ',
    bgColor: '#FFE0E9',
    textColor: '#943553',
    borderColor: '#FFC2D4',
  },
  // 疲惫（浅紫）
  {
    id: 'tired_1',
    category: 'tired',
    label: '疲惫',
    kaomoji: 'ʢᴗ.ᴗʡᶻ',
    bgColor: '#EDE2FF',
    textColor: '#593D85',
    borderColor: '#D6C2FA',
  },
  {
    id: 'tired_2',
    category: 'tired',
    label: '疲惫',
    kaomoji: 'ㅍ_ㅍ',
    bgColor: '#EDE2FF',
    textColor: '#593D85',
    borderColor: '#D6C2FA',
  },
];

// ==================== 2. 数据结构 ====================
export type SpaceBindStatus = 'unbound' | 'pending_char' | 'pending_user' | 'bound';

export interface DailyMoodRecord {
  dateStr: string;
  userMoodId?: string;
  userNote?: string;
  charMoodId?: string;
  charNote?: string;
  seenByChar?: boolean;
}

export interface AnniversaryItem {
  id: string;
  title: string;
  targetDate: string;
  type: 'countdown' | 'elapsed';
}

export interface DiaryEntry {
  id: string;
  author: 'user' | 'char';
  authorName: string;
  dateStr: string;
  title: string;
  content: string;
  replyComment?: string;
  seenByChar?: boolean;
}

export interface QAEntry {
  id: string;
  dateStr: string;
  question: string;
  askedBy: 'user' | 'char' | 'system';
  userAnswer?: string;
  charAnswer?: string;
  seenByChar?: boolean;
}

export interface StickyNoteItem {
  id: string;
  author: 'user' | 'char';
  authorName: string;
  content: string;
  colorBg: string;
  createdAt: string;
  seenByChar?: boolean;
}

export interface CharacterCoupleSpace {
  charId: string;
  bindStatus: SpaceBindStatus;
  inviteMessage?: string;
  startDate: string;
  headerBgUrl: string;
  pageBgUrl?: string;
  calendarBgUrl?: string;
  moods: Record<string, DailyMoodRecord>;
  anniversaries: AnniversaryItem[];
  diaries: DiaryEntry[];
  qaList: QAEntry[];
  stickyNotes: StickyNoteItem[];
}

const todayStr = () => localDateString();

const BUILTIN_QUESTIONS = [
  '对方做过哪件小事让你心动了很久？',
  '如果吵架冷战了，希望对方怎么哄你？',
  '第一次见面时，你心里在想什么？',
  '周末一整天不出门的话，最想和对方一起干嘛？',
  '用一种小动物形容对方，你会选什么？',
];

export const CoupleSpaceApp: React.FC<CoupleSpaceAppProps> = ({ onBack }) => {
  const [contacts] = useState<AlipayContact[]>(() => readAlipayContacts());
  const [selectedCharId, setSelectedCharId] = useState<string>(contacts[0]?.id || 'default_char');
  const foundChar = contacts.find((c) => c.id === selectedCharId);
  const currentChar = {
    id: selectedCharId,
    name: foundChar?.name ?? '恋人',
    avatar: foundChar?.avatarUrl ?? '',
  };

  // 实时读取微信「我」里当前使用的个人资料。
  const [userProfile] = useState(() => readWeChatUserProfile());

  const [spacesMap, setSpacesMap] = useState<Record<string, CharacterCoupleSpace>>(() => readCoupleSpaces());
  const spacesRef = useRef(spacesMap);
  spacesRef.current = spacesMap;
  const persistReadyRef = useRef(false);
  useEffect(() => {
    if (!persistReadyRef.current) {
      persistReadyRef.current = true;
      return;
    }
    writeCoupleSpaces(spacesMap);
  }, [spacesMap]);

  const currentSpace: CharacterCoupleSpace =
    spacesMap[selectedCharId] || createEmptyCoupleSpace(selectedCharId);

  const updateSpaceFor = (
    charId: string,
    updater: (prev: CharacterCoupleSpace) => CharacterCoupleSpace
  ) => {
    setSpacesMap((prev) => ({
      ...prev,
      [charId]: updater(prev[charId] || createEmptyCoupleSpace(charId)),
    }));
  };

  const updateCurrentSpace = (updater: (prev: CharacterCoupleSpace) => CharacterCoupleSpace) =>
    updateSpaceFor(selectedCharId, updater);

  const [activeSubModal, setActiveSubModal] = useState<
    'none' | 'anniversary' | 'diary' | 'qa' | 'sticky'
  >('none');
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(currentSpace.startDate);
  const [tempHeaderBg, setTempHeaderBg] = useState(currentSpace.headerBgUrl);

  const [currentYearMonth, setCurrentYearMonth] = useState<string>(() => todayStr().slice(0, 7));
  const [editingMoodDate, setEditingMoodDate] = useState<string | null>(null);
  const [selectedUserMoodId, setSelectedUserMoodId] = useState<string>('happy_1');
  const [userMoodNoteInput, setUserMoodNoteInput] = useState<string>('');

  const [bannerTip, setBannerTip] = useState<string>('');
  const [aiBusy, setAiBusy] = useState('');
  const aiWorking = useRef(false);
  const [bgEditor, setBgEditor] = useState<'page' | 'calendar' | null>(null);
  const [bgDraft, setBgDraft] = useState('');
  const [recordEdit, setRecordEdit] = useState<CoupleRecordEdit | null>(null);

  // 运行 AI 生成：用调用时的角色 ID 写回，避免生成期间切换角色导致写错空间。
  const runAi = async (key: string, task: () => Promise<void | string>) => {
    if (aiWorking.current) return;
    aiWorking.current = true;
    setAiBusy(key);
    try {
      const result = await task();
      setBannerTip(typeof result === 'string' ? result : '');
    } catch (error) {
      setBannerTip(error instanceof Error ? error.message : 'AI 生成失败，请检查 API 配置后重试。');
    } finally {
      aiWorking.current = false;
      setAiBusy('');
    }
  };

  const [newAnniTitle, setNewAnniTitle] = useState('');
  const [newAnniDate, setNewAnniDate] = useState('');
  const [newDiaryTitle, setNewDiaryTitle] = useState('');
  const [newDiaryContent, setNewDiaryContent] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [answeringQaId, setAnsweringQaId] = useState<string | null>(null);
  const [userAnswerInput, setUserAnswerInput] = useState('');
  const [newStickyText, setNewStickyText] = useState('');
  const [newStickyColor, setNewStickyColor] = useState('#FEF6C9');

  const calcLoveDays = (startDateStr: string) => {
    const start = new Date(startDateStr).getTime();
    const now = new Date(todayStr()).getTime();
    if (isNaN(start)) return 1;
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  const calcDaysUntil = (targetDateStr: string) => {
    const target = new Date(targetDateStr).getTime();
    const now = new Date(todayStr()).getTime();
    if (isNaN(target)) return 0;
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  };

  const nextAnniversary = currentSpace.anniversaries[0];
  const nextAnniDays = nextAnniversary ? calcDaysUntil(nextAnniversary.targetDate) : null;

  // ==================== 3. 7列心情日历（周一到周日） ====================
  const [yearNum, monthNum] = currentYearMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

  const getMondayIndexedDay = (date: Date) => {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const firstDayMondayIndex = getMondayIndexedDay(new Date(yearNum, monthNum - 1, 1));

  interface CalendarDayItem {
    dayNum: number;
    fullDateStr: string;
  }

  const calendarWeeks: (CalendarDayItem | null)[][] = [];
  let currentWeek: (CalendarDayItem | null)[] = [];

  for (let i = 0; i < firstDayMondayIndex; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const fullDateStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
    currentWeek.push({ dayNum: day, fullDateStr });
    if (currentWeek.length === 7) {
      calendarWeeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    calendarWeeks.push(currentWeek);
  }

  const handleChangeMonth = (offset: number) => {
    const d = new Date(yearNum, monthNum - 1 + offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    setCurrentYearMonth(`${y}-${m}`);
  };

  const openDayMoodEditor = (dateStr: string) => {
    const rec = currentSpace.moods[dateStr];
    setEditingMoodDate(dateStr);
    setSelectedUserMoodId(rec?.userMoodId || 'happy_1');
    setUserMoodNoteInput(rec?.userNote || '');
  };

  const handleSaveUserMood = () => {
    if (!editingMoodDate) return;
    updateCurrentSpace((prev) => {
      const old = prev.moods[editingMoodDate] || { dateStr: editingMoodDate };
      return {
        ...prev,
        moods: {
          ...prev.moods,
          [editingMoodDate]: {
            ...old,
            userMoodId: selectedUserMoodId,
            userNote: userMoodNoteInput.trim(),
            seenByChar: false,
          },
        },
      };
    });
    setEditingMoodDate(null);
  };

  const handleGenerateCharMoodForDay = (dateStr: string) => {
    const charId = selectedCharId;
    const rec = currentSpace.moods[dateStr];
    const userMood = getMoodById(rec?.userMoodId);
    void runAi('mood', async () => {
      const result = await generateCharMood(charId, userProfile.name, dateStr, MOOD_OPTIONS, {
        label: userMood?.label,
        note: rec?.userNote,
      });
      updateSpaceFor(charId, (prev) => ({
        ...prev,
        moods: {
          ...prev.moods,
          [dateStr]: {
            ...(prev.moods[dateStr] || { dateStr }),
            charMoodId: result.moodId,
            charNote: result.note,
          },
        },
      }));
    });
  };

  // Validate the complete response before writing any section.
  const handleGenerateAll = () => {
    const charId = selectedCharId;
    const space = currentSpace;
    void runAi('all', async () => {
      const result = await generateCoupleBatch(charId, userProfile.name, space, MOOD_OPTIONS);
      if (JSON.stringify(readCoupleSpaces()[charId]) !== JSON.stringify(space) ||
        JSON.stringify(spacesRef.current[charId]) !== JSON.stringify(space) ||
        todayStr() !== result.stickyNotes[0]?.createdAt) {
        throw new Error('生成期间情侣空间内容已变化，未覆盖现有内容，请重试。');
      }
      updateSpaceFor(charId, () => result);
      return '已用一次请求补齐心情、日记、问答和便签，保留已有内容。';
    });
  };

  // 双向邀请与清除
  const requireRealChar = () => {
    if (foundChar) return true;
    setBannerTip('请先在微信通讯录里添加角色，再开通情侣空间。');
    return false;
  };

  const handleSendInviteToChar = () => {
    if (!requireRealChar()) return;
    postCoupleInviteCard(selectedCharId, 'user', currentChar.name);
    updateCurrentSpace((prev) => ({
      ...prev,
      bindStatus: 'pending_char',
      inviteMessage: `我向「${currentChar.name}」发送了情侣空间开通邀请，等待对方在微信里回应...`,
    }));
    setBannerTip(`已向「${currentChar.name}」的微信单聊发送情侣空间邀请卡片，去聊天里等 TA 回应吧。`);
  };

  const handleTriggerCharInviteUser = () => {
    if (!requireRealChar()) return;
    postCoupleInviteCard(selectedCharId, 'char', currentChar.name);
    updateCurrentSpace((prev) => ({
      ...prev,
      bindStatus: 'pending_user',
      inviteMessage: `「${currentChar.name}」向你发来了情侣空间绑定邀请：“想和你拥有一个只属于我们两人的小天地，可以吗？”`,
    }));
  };

  const handleWithdrawInvite = () => {
    setCoupleInviteCardStatus(selectedCharId, 'withdrawn');
    updateCurrentSpace((p) => ({ ...p, bindStatus: 'unbound' }));
  };

  const handleRespondCharInvite = (accept: boolean) => {
    setCoupleInviteCardStatus(selectedCharId, accept ? 'accepted' : 'declined');
    postUserChatNote(
      selectedCharId,
      accept ? '我同意啦，我们一起开通情侣空间吧 💞' : '这次先不开通情侣空间啦。'
    );
    updateCurrentSpace((prev) => ({
      ...prev,
      bindStatus: accept ? 'bound' : 'unbound',
      ...(accept ? { startDate: todayStr() } : {}),
    }));
    setBannerTip(accept ? `已正式开通与「${currentChar.name}」的情侣空间。` : '已婉拒邀请。');
  };

  // 清除空间数据：静默执行，不写入 characterContext，不通知角色。
  const handleClearSpaceSilently = () => {
    if (
      !window.confirm(
        `确定清除与「${currentChar.name}」情侣空间内的所有数据吗？（此操作静默执行，不通知角色）`
      )
    )
      return;
    updateCurrentSpace((prev) => ({
      ...prev,
      moods: {},
      anniversaries: [],
      diaries: [],
      qaList: [],
      stickyNotes: [],
    }));
    setShowTopMenu(false);
    setBannerTip(`已静默清空当前情侣空间数据。`);
  };

  // 解除关系：重置为未开通，并向角色记忆写入高优先级事件。
  const handleUnbindAndNotifyChar = () => {
    if (
      !window.confirm(
        `确定要与「${currentChar.name}」解除情侣空间绑定关系吗？（解绑后将通知角色）`
      )
    )
      return;
    updateCurrentSpace((prev) => ({
      ...prev,
      bindStatus: 'unbound',
      inviteMessage: undefined,
    }));
    try {
      appendCharacterContextEvent(
        selectedCharId,
        `玩家解除了与你的情侣空间绑定关系，你们之间的情侣空间已关闭（${todayStr()}）。请根据你的人设和与玩家的关系，在下次聊天时自然地对此作出反应。`,
        'couple',
        { priority: 'high' }
      );
    } catch (error) {
      console.error('Could not notify the character about the unbind.', error);
    }
    setShowTopMenu(false);
    setBannerTip(`已解除与「${currentChar.name}」的情侣空间关系，TA 会在下次聊天时知道。`);
  };

  const handleSaveBackground = (value: string) => {
    updateCurrentSpace((prev) => ({
      ...prev,
      ...(bgEditor === 'page' ? { pageBgUrl: value } : { calendarBgUrl: value }),
    }));
    setBgEditor(null);
  };

  const handleBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBgDraft(await compressImageFile(file, { maxDimension: 900, maxBytes: 300 * 1024 }));
    } catch (error) {
      setBannerTip(error instanceof Error ? error.message : '图片读取失败。');
    }
  };

  const handleLocalImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (b64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) onSuccess(String(ev.target.result));
    };
    reader.readAsDataURL(file);
  };

  const handleExportCoupleData = () => {
    const dataStr = JSON.stringify({ spacesMap, selectedCharId }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `couple_space_backup_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMoodById = (id?: string) => MOOD_OPTIONS.find((m) => m.id === id);

  return (
    <div
      className="relative flex-1 w-full flex flex-col overflow-hidden select-none text-[#56515C]"
      style={{
        background: currentSpace.pageBgUrl
          ? `linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0.35)), url("${currentSpace.pageBgUrl}") center / cover no-repeat`
          : 'linear-gradient(180deg, #FBF8FA 0%, #F5F7FA 52%, #EFF4F8 100%)',
      }}
    >
      {/* 极浅柔和光晕装饰 */}
      <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-rose-100/25 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-sky-100/30 blur-3xl pointer-events-none" />

      {/* 顶栏 */}
      <AppHeader
        title="情侣空间"
        onBack={onBack}
        rightAction={
          <div className="flex items-center gap-1.5">
            {/* 角色切换下拉：去掉高亮玫粉，采用柔和灰紫/豆沙淡粉 */}
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-md border border-slate-200/80 text-[11px] font-bold text-[#7E7484] outline-none shadow-2xs cursor-pointer"
            >
              {contacts.length === 0 ? (
                <option value="default_char">恋人</option>
              ) : (
                contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={() => {
                setBgDraft(currentSpace.pageBgUrl || '');
                setBgEditor('page');
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-500 bg-white/75 hover:bg-white rounded-full border border-white shadow-2xs cursor-pointer active:scale-95"
              title="更换空间背景"
            >
              <ImagePlus className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTempStartDate(currentSpace.startDate);
                setTempHeaderBg(currentSpace.headerBgUrl);
                setShowTopMenu(true);
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-500 bg-white/75 hover:bg-white rounded-full border border-white shadow-2xs cursor-pointer active:scale-95"
              title="空间设置、导入导出与解绑"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* 主体滚动容器 */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-1 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),24px)]">
        {bannerTip && (
          <div className="flex items-center justify-between rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 px-3.5 py-2 text-[11px] font-medium text-slate-600 shadow-2xs">
            <span>{bannerTip}</span>
            <button onClick={() => setBannerTip('')} className="text-slate-400 ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 状态 A：尚未开通情侣空间 */}
        {currentSpace.bindStatus !== 'bound' ? (
          <div className="mt-6 rounded-[28px] bg-white/75 backdrop-blur-xl border border-white/90 p-6 text-center space-y-5 shadow-[0_12px_28px_-8px_rgba(148,163,184,0.12)]">
            <div className="flex items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-200 to-rose-100 border-4 border-white shadow-sm flex items-center justify-center overflow-hidden text-sm font-bold text-slate-600">
                {userProfile.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="me" className="w-full h-full object-cover" />
                ) : (
                  userProfile.name.slice(0, 1)
                )}
              </div>

              <div className="flex flex-col items-center">
                <Heart className="w-5 h-5 text-rose-300 fill-rose-200" />
                <span className="text-[10px] text-slate-400 font-medium mt-1">等待开通</span>
              </div>

              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-100 to-slate-200 border-4 border-white shadow-sm flex items-center justify-center overflow-hidden text-sm font-bold text-slate-600">
                {currentChar.avatar ? (
                  <img
                    src={currentChar.avatar}
                    alt={currentChar.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  currentChar.name.slice(0, 1)
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-700">
                与「{currentChar.name}」的情侣空间尚未开通
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                开通后即可解锁专属双人心情日历、交换日记与纪念日记录
              </p>
            </div>

            {currentSpace.bindStatus === 'unbound' && (
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleSendInviteToChar}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#D7A8B7] to-[#A8C6DF] text-white text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>向 {currentChar.name} 发送空间邀请</span>
                </button>
                <button
                  onClick={handleTriggerCharInviteUser}
                  className="w-full py-2 rounded-2xl bg-white/90 border border-slate-200 text-slate-600 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>触发 {currentChar.name} 主动向我发送邀请</span>
                </button>
              </div>
            )}

            {currentSpace.bindStatus === 'pending_char' && (
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-3">
                <p className="text-xs font-medium text-rose-800">{currentSpace.inviteMessage}</p>
                <p className="text-[10px] leading-relaxed text-rose-400">
                  邀请卡片已发到 TA 的微信单聊，去聊天里发条消息，TA 同意后会自动开通。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleWithdrawInvite}
                    className="flex-1 py-2 rounded-xl bg-white text-slate-400 text-xs cursor-pointer"
                  >
                    撤回邀请
                  </button>
                </div>
              </div>
            )}

            {currentSpace.bindStatus === 'pending_user' && (
              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-100 space-y-3">
                <p className="text-xs font-medium text-sky-800 leading-relaxed">
                  {currentSpace.inviteMessage}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespondCharInvite(true)}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#D7A8B7] to-[#A8C6DF] text-white text-xs font-bold cursor-pointer"
                  >
                    同意开通空间
                  </button>
                  <button
                    onClick={() => handleRespondCharInvite(false)}
                    className="px-3 py-2 rounded-xl bg-white text-slate-400 text-xs cursor-pointer"
                  >
                    婉拒
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 状态 B：已开通情侣空间 */
          <>
            {/* 1. 顶部头图区：双人头像 + 在一起的 N 天 + 右上角纯白色圆底小铅笔 */}
            <div
              style={{
                background: currentSpace.headerBgUrl
                  ? `linear-gradient(rgba(255,255,255,0.65), rgba(255,255,255,0.65)), url(${currentSpace.headerBgUrl}) center / cover no-repeat`
                  : 'linear-gradient(135deg, #F8EFEF 0%, #F5F3F7 50%, #EBF2F7 100%)',
              }}
              className="relative rounded-[28px] border border-white/95 p-5 shadow-[0_8px_24px_-8px_rgba(148,163,184,0.12)] flex flex-col items-center justify-center space-y-3 overflow-hidden"
            >
              {/* 右上角纯铅笔小图标（无文字） */}
              <button
                type="button"
                onClick={() => {
                  setTempStartDate(currentSpace.startDate);
                  setTempHeaderBg(currentSpace.headerBgUrl);
                  setShowStartDateModal(true);
                }}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-slate-500 flex items-center justify-center border border-white shadow-2xs cursor-pointer active:scale-95 transition-transform"
                title="修改相恋起始日与头图背景"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              {/* 情侣双人头像 */}
              <div className="flex items-center justify-center gap-5 pt-1">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-full bg-gradient-to-br from-rose-200 to-slate-200 border-2 border-white shadow-xs flex items-center justify-center overflow-hidden text-white font-bold text-xs">
                    {userProfile.avatarUrl ? (
                      <img
                        src={userProfile.avatarUrl}
                        alt="user"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      userProfile.name.slice(0, 1)
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 bg-white/75 px-2 py-0.2 rounded-full">
                    {userProfile.name}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center shadow-2xs">
                    <Heart className="w-3 h-3 text-rose-300 fill-rose-300" />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-13 h-13 rounded-full bg-gradient-to-br from-sky-200 to-slate-200 border-2 border-white shadow-xs flex items-center justify-center overflow-hidden text-white font-bold text-xs">
                    {currentChar.avatar ? (
                      <img
                        src={currentChar.avatar}
                        alt={currentChar.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      currentChar.name.slice(0, 1)
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 bg-white/75 px-2 py-0.2 rounded-full">
                    {currentChar.name}
                  </span>
                </div>
              </div>

              {/* 恋爱天数：去除高饱和玫粉，使用温润雅致的豆沙灰粉 #B47A8C */}
              <div className="text-center space-y-0.5">
                <div className="inline-flex items-baseline gap-1.5 bg-white/85 backdrop-blur-md px-3.5 py-1 rounded-full border border-white shadow-2xs">
                  <span className="text-xs font-medium text-slate-500">在一起</span>
                  <span className="text-lg font-bold font-mono text-[#B47A8C]">
                    {calcLoveDays(currentSpace.startDate)}
                  </span>
                  <span className="text-xs font-medium text-slate-500">天</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono pt-0.5">
                  {currentSpace.startDate}
                </p>
                <button
                  type="button"
                  disabled={!!aiBusy}
                  onClick={handleGenerateAll}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-white bg-white/85 px-3 py-1 text-[11px] font-semibold text-[#B47A8C] shadow-2xs active:scale-95 disabled:opacity-60"
                >
                  <Sparkles className={`h-3 w-3 text-amber-400 ${aiBusy === 'all' ? 'animate-spin' : ''}`} />
                  {aiBusy === 'all' ? '生成中…' : '一键生成TA的内容'}
                </button>
              </div>
            </div>

            {/* 2. 心情日历区 */}
            <div
              style={
                currentSpace.calendarBgUrl
                  ? {
                      background: `linear-gradient(rgba(255,255,255,0.6), rgba(255,255,255,0.6)), url("${currentSpace.calendarBgUrl}") center / cover no-repeat`,
                    }
                  : undefined
              }
              className="relative rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/95 p-4 space-y-3.5 shadow-[0_8px_24px_-8px_rgba(148,163,184,0.1)]"
            >
              <button
                onClick={() => {
                  setBgDraft(currentSpace.calendarBgUrl || '');
                  setBgEditor('calendar');
                }}
                className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 rounded-full bg-white/90 text-slate-500 flex items-center justify-center border border-white shadow-2xs cursor-pointer active:scale-95"
                title="更换日历背景"
              >
                <ImagePlus className="w-3 h-3" />
              </button>
              {/* 日历顶部：年份月份 + 右上角纯简图例 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleChangeMonth(-1)}
                    className="w-6 h-6 rounded-full bg-slate-100/80 text-slate-500 flex items-center justify-center hover:bg-slate-200/60 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-center px-1">
                    <span className="text-xs font-bold text-slate-700 block leading-tight">
                      {monthNum}月
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 block leading-none">
                      {yearNum}年
                    </span>
                  </div>
                  <button
                    onClick={() => handleChangeMonth(1)}
                    className="w-6 h-6 rounded-full bg-slate-100/80 text-slate-500 flex items-center justify-center hover:bg-slate-200/60 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 右侧极简图标图例：● 玩家名字  ■ 角色名字（去除多余文案） */}
                <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FEF6C9] border border-[#E8DC9B] inline-block" />
                    <span>{userProfile.name}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[#DCEEFF] border border-[#BBD7F0] inline-block" />
                    <span>{currentChar.name}</span>
                  </span>
                </div>
              </div>

              {/* 星期表头（一 二 三 四 五 六 日） */}
              <div className="grid grid-cols-7 text-center text-[10px] font-medium text-slate-400 border-b border-slate-100 pb-1.5">
                {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              {/* 日历主体：每个日期格内，日期在上，左圆（玩家）右方（角色）并排在下 */}
              <div className="space-y-1.5 pt-0.5">
                {calendarWeeks.map((week, wIdx) => (
                  <div key={`week-${wIdx}`} className="grid grid-cols-7">
                    {week.map((item, colIdx) => {
                      if (!item) return <div key={`empty-${wIdx}-${colIdx}`} />;
                      const dayRec = currentSpace.moods[item.fullDateStr];
                      const uMood = getMoodById(dayRec?.userMoodId);
                      const cMood = getMoodById(dayRec?.charMoodId);
                      const isToday = item.fullDateStr === todayStr();
                      return (
                        <div
                          key={item.fullDateStr}
                          onClick={() => openDayMoodEditor(item.fullDateStr)}
                          className="flex flex-col items-center gap-0.5 py-0.5 cursor-pointer"
                        >
                          <span
                            className={`text-[10px] font-mono font-medium leading-none ${
                              isToday
                                ? 'text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-full font-bold'
                                : 'text-slate-500'
                            }`}
                          >
                            {item.dayNum}
                          </span>
                          <div className="flex items-center justify-center gap-[2px]">
                            <span
                              style={{
                                backgroundColor: uMood ? uMood.bgColor : 'rgba(255,255,255,0.7)',
                                color: uMood ? uMood.textColor : '#CBD5E1',
                                borderColor: uMood ? uMood.borderColor : '#F1F5F9',
                              }}
                              className="w-[21px] h-[21px] rounded-full border flex items-center justify-center text-[6.5px] font-bold whitespace-nowrap overflow-hidden"
                              title={
                                uMood
                                  ? `${item.fullDateStr} ${userProfile.name}：${uMood.label} ${uMood.kaomoji}`
                                  : `${item.fullDateStr} 记录心情`
                              }
                            >
                              {uMood ? uMood.kaomoji : '·'}
                            </span>
                            <span
                              style={{
                                backgroundColor: cMood ? cMood.bgColor : 'rgba(255,255,255,0.7)',
                                color: cMood ? cMood.textColor : '#CBD5E1',
                                borderColor: cMood ? cMood.borderColor : '#F1F5F9',
                              }}
                              className="w-[21px] h-[21px] rounded-[6px] border flex items-center justify-center text-[6.5px] font-bold whitespace-nowrap overflow-hidden"
                              title={
                                cMood
                                  ? `${item.fullDateStr} ${currentChar.name}：${cMood.label} ${cMood.kaomoji}`
                                  : `${item.fullDateStr} 查看TA的心情`
                              }
                            >
                              {cMood ? cMood.kaomoji : '·'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 四大功能入口（去除计数赘述，图标全部采用浅淡马卡龙色系） */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* 入口 1：纪念日（浅灰粉） */}
              <button
                onClick={() => setActiveSubModal('anniversary')}
                className="rounded-[22px] bg-white/75 backdrop-blur-xl border border-white p-3.5 text-left space-y-2 shadow-2xs hover:bg-white transition-all cursor-pointer active:scale-98"
              >
                <div className="w-8 h-8 rounded-xl bg-[#F8EDF0] text-[#B88998] flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">纪念日</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {nextAnniversary
                      ? `距「${nextAnniversary.title}」${Math.max(0, nextAnniDays ?? 0)} 天`
                      : '记录重要日子'}
                  </p>
                </div>
              </button>

              {/* 入口 2：交换日记（薄雾蓝） */}
              <button
                onClick={() => setActiveSubModal('diary')}
                className="rounded-[22px] bg-white/75 backdrop-blur-xl border border-white p-3.5 text-left space-y-2 shadow-2xs hover:bg-white transition-all cursor-pointer active:scale-98"
              >
                <div className="w-8 h-8 rounded-xl bg-[#ECF3F9] text-[#7899B8] flex items-center justify-center">
                  <BookHeart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">交换日记</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {currentSpace.diaries[0]
                      ? currentSpace.diaries[0].title
                      : '写下想分享的话'}
                  </p>
                </div>
              </button>

              {/* 入口 3：每日 Q&A（淡紫灰） */}
              <button
                onClick={() => setActiveSubModal('qa')}
                className="rounded-[22px] bg-white/75 backdrop-blur-xl border border-white p-3.5 text-left space-y-2 shadow-2xs hover:bg-white transition-all cursor-pointer active:scale-98"
              >
                <div className="w-8 h-8 rounded-xl bg-[#F2EFF7] text-[#9387A8] flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">每日 Q&A</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {currentSpace.qaList[0]
                      ? currentSpace.qaList[0].question
                      : '互相提问互动'}
                  </p>
                </div>
              </button>

              {/* 入口 4：碎碎念（奶麦黄） */}
              <button
                onClick={() => setActiveSubModal('sticky')}
                className="rounded-[22px] bg-white/75 backdrop-blur-xl border border-white p-3.5 text-left space-y-2 shadow-2xs hover:bg-white transition-all cursor-pointer active:scale-98"
              >
                <div className="w-8 h-8 rounded-xl bg-[#FAF4E6] text-[#B09968] flex items-center justify-center">
                  <StickyNote className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">碎碎念</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {currentSpace.stickyNotes[0]
                      ? currentSpace.stickyNotes[0].content
                      : '日常小便签'}
                  </p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ==================== 弹窗：页面 / 日历背景 ==================== */}
      {bgEditor && (
        <div className="absolute inset-0 z-[60] bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-[26px] p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">
                {bgEditor === 'page' ? '情侣空间背景' : '心情日历背景'}
              </h3>
              <button
                onClick={() => setBgEditor(null)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {bgDraft && (
              <div
                className="h-24 rounded-2xl border border-white shadow-2xs bg-slate-100"
                style={{ background: `url("${bgDraft}") center / cover no-repeat` }}
              />
            )}
            <input
              type="text"
              placeholder="粘贴图片 URL..."
              value={bgDraft.startsWith('data:') ? '' : bgDraft}
              onChange={(e) => setBgDraft(e.target.value.trim())}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
            />
            <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>从相册上传</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleSaveBackground('')}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 text-xs flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复默认
              </button>
              <button
                onClick={() => handleSaveBackground(bgDraft)}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#D7A8B7] to-[#A8C6DF] text-white text-xs font-bold cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 A：点击日期编辑当天心情 ==================== */}
      {editingMoodDate && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-[26px] p-5 shadow-lg space-y-4 max-h-[90%] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 font-mono">
                {editingMoodDate}
              </h3>
              <button
                onClick={() => setEditingMoodDate(null)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 玩家今日心情选择 */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-600 block">
                我的心情（圆形）：
              </span>
              <div className="grid grid-cols-5 gap-2">
                {MOOD_OPTIONS.map((opt) => {
                  const isSel = selectedUserMoodId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedUserMoodId(opt.id)}
                      className={`p-1.5 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isSel
                          ? 'ring-2 ring-slate-300 bg-slate-50 border-slate-300 scale-105'
                          : 'bg-white border-slate-100'
                      }`}
                    >
                      <div
                        style={{
                          backgroundColor: opt.bgColor,
                          color: opt.textColor,
                          borderColor: opt.borderColor,
                        }}
                        className="w-8 h-8 rounded-full border flex items-center justify-center text-[9px] font-bold shadow-2xs"
                      >
                        {opt.kaomoji}
                      </div>
                      <span className="text-[10px] text-slate-500">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                placeholder="写一句今日心情备注（选填）..."
                value={userMoodNoteInput}
                onChange={(e) => setUserMoodNoteInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none"
              />
            </div>

            {/* 角色当天心情 */}
            <div className="flex gap-2">
              {(['user', 'char'] as const).map((author) => (
                <button key={author} type="button" onClick={() => {
                  const record = currentSpace.moods[editingMoodDate];
                  setRecordEdit({
                    kind: 'mood', originalDate: editingMoodDate, date: editingMoodDate, author,
                    moodId: (author === 'user' ? record?.userMoodId : record?.charMoodId) || 'happy_1',
                    note: (author === 'user' ? record?.userNote : record?.charNote) || '',
                  });
                }} className="flex-1 rounded-xl bg-sky-50 p-2 text-[11px] text-sky-700">
                  {author === 'user' ? '编辑我的记录与日期' : '编辑角色记录与日期'}
                </button>
              ))}
            </div>
            <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  {currentChar.name} 的心情（方形）：
                </span>
                <button
                  type="button"
                  onClick={() => handleGenerateCharMoodForDay(editingMoodDate)}
                  disabled={aiBusy === 'mood'}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[10px] flex items-center gap-1 cursor-pointer hover:bg-slate-50"
                >
                  <Sparkles className={`w-3 h-3 text-amber-400 ${aiBusy === 'mood' ? 'animate-spin' : ''}`} />
                  <span>查看心情</span>
                </button>
              </div>

              {(() => {
                const dayRec = currentSpace.moods[editingMoodDate];
                const cMood = getMoodById(dayRec?.charMoodId);
                if (!cMood) {
                  return (
                    <p className="text-[11px] text-slate-400">
                      尚未记录这一天的心情
                    </p>
                  );
                }
                return (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-100">
                    <div
                      style={{
                        backgroundColor: cMood.bgColor,
                        color: cMood.textColor,
                        borderColor: cMood.borderColor,
                      }}
                      className="w-9 h-9 rounded-[10px] border flex items-center justify-center text-[10px] font-bold shrink-0"
                    >
                      {cMood.kaomoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-700">
                        {cMood.label}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {dayRec?.charNote || '静静地度过了这一天'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <button
              onClick={handleSaveUserMood}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#D7A8B7] to-[#A8C6DF] text-white text-xs font-bold shadow-2xs cursor-pointer"
            >
              保存心情
            </button>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 B：四大子板块详情 ==================== */}
      {activeSubModal !== 'none' && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-[26px] p-5 shadow-lg space-y-3.5 max-h-[90%] overflow-y-auto">
            {/* 1. 纪念日 */}
            {activeSubModal === 'anniversary' && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700">纪念日</h3>
                  <button
                    onClick={() => setActiveSubModal('none')}
                    className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/60 space-y-2">
                  <input
                    type="text"
                    placeholder="纪念日名称..."
                    value={newAnniTitle}
                    onChange={(e) => setNewAnniTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newAnniDate}
                      onChange={(e) => setNewAnniDate(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono"
                    />
                    <button
                      onClick={() => {
                        if (!newAnniTitle.trim() || !newAnniDate) return;
                        updateCurrentSpace((prev) => ({
                          ...prev,
                          anniversaries: [
                            {
                              id: `anni-${Date.now()}`,
                              title: newAnniTitle.trim(),
                              targetDate: newAnniDate,
                              type: 'countdown',
                            },
                            ...prev.anniversaries,
                          ],
                        }));
                        setNewAnniTitle('');
                        setNewAnniDate('');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-700 text-white text-xs font-medium cursor-pointer"
                    >
                      添加
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {currentSpace.anniversaries.map((item) => {
                    const dLeft = calcDaysUntil(item.targetDate);
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-white border border-slate-100 flex items-center justify-between shadow-2xs"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-700">{item.title}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.targetDate}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600 font-mono">
                            {dLeft >= 0 ? `还有 ${dLeft} 天` : `已过 ${Math.abs(dLeft)} 天`}
                          </span>
                          <button type="button" aria-label={`编辑纪念日：${item.title}`}
                            onClick={() => setRecordEdit({ kind: 'anniversary', id: item.id, date: item.targetDate, title: item.title, type: item.type })}
                            className="text-slate-400"><Pencil className="h-3.5 w-3.5" /></button>
                          <button
                            onClick={() =>
                              updateCurrentSpace((prev) => ({
                                ...prev,
                                anniversaries: prev.anniversaries.filter((a) => a.id !== item.id),
                              }))
                            }
                            className="text-slate-300 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* 2. 交换日记 */}
            {activeSubModal === 'diary' && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700">交换日记</h3>
                  <button
                    onClick={() => setActiveSubModal('none')}
                    className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/60 space-y-2">
                  <input
                    type="text"
                    placeholder="标题..."
                    value={newDiaryTitle}
                    onChange={(e) => setNewDiaryTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                  <textarea
                    rows={3}
                    placeholder="写下今天的想法..."
                    value={newDiaryContent}
                    onChange={(e) => setNewDiaryContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!newDiaryContent.trim()) return;
                          const entry: DiaryEntry = {
                            id: `diary-${Date.now()}`,
                            author: 'user',
                            authorName: userProfile.name,
                            dateStr: todayStr(),
                            title: newDiaryTitle.trim() || '今日小记',
                            content: newDiaryContent.trim(),
                            seenByChar: false,
                          };
                          updateCurrentSpace((prev) => ({
                            ...prev,
                            diaries: [entry, ...prev.diaries],
                          }));
                        setNewDiaryTitle('');
                        setNewDiaryContent('');
                      }}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#D7A8B7] to-[#A8C6DF] text-white text-xs font-medium cursor-pointer"
                    >
                      写日记
                    </button>

                    <button
                      disabled={!!aiBusy}
                      onClick={() => {
                        const charId = selectedCharId;
                        if (currentSpace.diaries.some((x) => x.author === 'char' && x.dateStr === todayStr())) {
                          setBannerTip(`${currentChar.name}今天已经写过一篇日记啦，明天再来吧。`);
                          return;
                        }
                        void runAi('diary', async () => {
                          const result = await generateCharDiary(
                            charId,
                            userProfile.name,
                            currentSpace
                          );
                          const charEntry: DiaryEntry = {
                            id: `diary-${Date.now()}`,
                            author: 'char',
                            authorName: currentChar.name,
                            dateStr: todayStr(),
                            title: result.title,
                            content: result.content,
                            seenByChar: true,
                          };
                          updateSpaceFor(charId, (prev) => ({
                            ...prev,
                            diaries: [charEntry, ...prev.diaries],
                          }));
                        });
                      }}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      <Sparkles
                        className={`w-3.5 h-3.5 text-amber-400 ${aiBusy === 'diary' ? 'animate-spin' : ''}`}
                      />
                      <span>{aiBusy === 'diary' ? '写作中' : '让TA写'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {currentSpace.diaries.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-100 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          {d.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            {d.authorName} · {d.dateStr}
                          </span>
                          <button
                            onClick={() =>
                              updateCurrentSpace((prev) => ({
                                ...prev,
                                diaries: prev.diaries.filter((x) => x.id !== d.id),
                              }))
                            }
                            className="text-slate-300 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">
                        {d.content}
                      </p>
                      {d.replyComment && (
                        <p className="text-[11px] text-slate-500 leading-relaxed p-2 rounded-xl bg-rose-50/60">
                          {currentChar.name}：{d.replyComment}
                        </p>
                      )}
                      <button type="button" onClick={() => setRecordEdit({
                        kind: 'diary', id: d.id, date: d.dateStr, title: d.title, content: d.content,
                        replyComment: d.replyComment || '', authorName: d.authorName,
                      })} className="flex items-center gap-1 text-[10px] text-sky-600">
                        <Pencil className="h-3 w-3" />编辑日记与日期
                      </button>
                      {d.author === 'user' && (
                        <div className="flex items-center gap-3 pt-0.5">
                          {!d.replyComment && (
                            <button
                              disabled={!!aiBusy}
                              onClick={() => {
                                const charId = selectedCharId;
                                void runAi(`reply-${d.id}`, async () => {
                                  const reply = await generateDiaryReply(
                                    charId,
                                    userProfile.name,
                                    d.title,
                                    d.content
                                  );
                                  updateSpaceFor(charId, (prev) => ({
                                    ...prev,
                                    diaries: prev.diaries.map((x) =>
                                      x.id === d.id ? { ...x, replyComment: reply } : x
                                    ),
                                  }));
                                });
                              }}
                              className="text-[10px] text-slate-400 flex items-center gap-0.5 cursor-pointer disabled:opacity-60"
                            >
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              {aiBusy === `reply-${d.id}` ? '回复中...' : '让TA回复'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 3. 每日 Q&A */}
            {activeSubModal === 'qa' && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700">每日 Q&A</h3>
                  <button
                    onClick={() => setActiveSubModal('none')}
                    className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/60 space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="问一个问题..."
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
                    />
                    <button
                      onClick={() => {
                        const q =
                          newQuestionText.trim() ||
                          BUILTIN_QUESTIONS[Math.floor(Math.random() * BUILTIN_QUESTIONS.length)];
                        const newQa: QAEntry = {
                          id: `qa-${Date.now()}`,
                          dateStr: todayStr(),
                          question: q,
                          askedBy: newQuestionText.trim() ? 'user' : 'system',
                          seenByChar: false,
                        };
                        updateCurrentSpace((prev) => ({
                          ...prev,
                          qaList: [newQa, ...prev.qaList],
                        }));
                        setNewQuestionText('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-700 text-white text-xs font-medium cursor-pointer shrink-0"
                    >
                      {newQuestionText.trim() ? '提问' : '抽题'}
                    </button>
                  </div>
                  <button
                    disabled={!!aiBusy}
                    onClick={() => {
                      const charId = selectedCharId;
                      void runAi('qa-ask', async () => {
                        const question = await generateQaQuestion(
                          charId,
                          userProfile.name,
                          currentSpace
                        );
                        const newQa: QAEntry = {
                          id: `qa-${Date.now()}`,
                          dateStr: todayStr(),
                          question,
                          askedBy: 'char',
                          seenByChar: true,
                        };
                        updateSpaceFor(charId, (prev) => ({
                          ...prev,
                          qaList: [newQa, ...prev.qaList],
                        }));
                      });
                    }}
                    className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    <Sparkles
                      className={`w-3 h-3 text-amber-400 ${aiBusy === 'qa-ask' ? 'animate-spin' : ''}`}
                    />
                    <span>{aiBusy === 'qa-ask' ? '思考中' : '让TA提问'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {currentSpace.qaList.map((qa) => (
                    <div
                      key={qa.id}
                      className="p-3 rounded-2xl bg-white border border-slate-100 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700">Q：{qa.question}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{qa.dateStr}</p>
                        </div>
                        <button type="button" aria-label={`编辑问答：${qa.question}`} onClick={() => setRecordEdit({
                          kind: 'qa', id: qa.id, date: qa.dateStr, question: qa.question,
                          userAnswer: qa.userAnswer || '', charAnswer: qa.charAnswer || '',
                        })} className="shrink-0 text-slate-400"><Pencil className="h-3.5 w-3.5" /></button>
                        <button
                          onClick={() =>
                            updateCurrentSpace((prev) => ({
                              ...prev,
                              qaList: prev.qaList.filter((x) => x.id !== qa.id),
                            }))
                          }
                          className="text-slate-300 hover:text-rose-400 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
                          <span className="font-medium text-slate-800">{userProfile.name}：</span>
                          {qa.userAnswer || (
                            <button
                              onClick={() => {
                                setAnsweringQaId(qa.id);
                                setUserAnswerInput('');
                              }}
                              className="text-slate-500 underline ml-1 cursor-pointer"
                            >
                              填写回答
                            </button>
                          )}
                          {qa.userAnswer && (
                            <button
                              onClick={() => {
                                setAnsweringQaId(qa.id);
                                setUserAnswerInput(qa.userAnswer || '');
                              }}
                              className="text-slate-400 ml-1.5 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 inline" />
                            </button>
                          )}
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
                          <span className="font-medium text-slate-800">{currentChar.name}：</span>
                          {qa.charAnswer || (
                            <button
                              disabled={!!aiBusy}
                              onClick={() => {
                                const charId = selectedCharId;
                                void runAi(`qa-${qa.id}`, async () => {
                                  const answer = await generateQaAnswer(
                                    charId,
                                    userProfile.name,
                                    qa.question,
                                    qa.userAnswer
                                  );
                                  updateSpaceFor(charId, (prev) => ({
                                    ...prev,
                                    qaList: prev.qaList.map((item) =>
                                      item.id === qa.id ? { ...item, charAnswer: answer } : item
                                    ),
                                  }));
                                });
                              }}
                              className="text-slate-500 underline ml-1 cursor-pointer disabled:opacity-60"
                            >
                              {aiBusy === `qa-${qa.id}` ? '回答中...' : '让TA回答'}
                            </button>
                          )}
                        </div>
                      </div>

                      {answeringQaId === qa.id && (
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            placeholder="写下回答..."
                            value={userAnswerInput}
                            onChange={(e) => setUserAnswerInput(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                          />
                          <button
                            onClick={() => {
                              updateCurrentSpace((prev) => ({
                                ...prev,
                                qaList: prev.qaList.map((item) =>
                                  item.id === qa.id
                                    ? { ...item, userAnswer: userAnswerInput.trim(), seenByChar: false }
                                    : item
                                ),
                              }));
                              setAnsweringQaId(null);
                            }}
                            className="px-3 py-1 rounded-xl bg-slate-700 text-white text-xs font-medium cursor-pointer"
                          >
                            保存
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 4. 碎碎念 */}
            {activeSubModal === 'sticky' && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700">碎碎念</h3>
                  <button
                    onClick={() => setActiveSubModal('none')}
                    className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/60 space-y-2">
                  <textarea
                    rows={2}
                    placeholder="随手写一条小碎碎念..."
                    value={newStickyText}
                    onChange={(e) => setNewStickyText(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {['#FEF6C9', '#FFE0E9', '#DCEEFF', '#DCF5E3', '#EDE2FF'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewStickyColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-4.5 h-4.5 rounded-full border cursor-pointer ${
                            newStickyColor === c ? 'ring-2 ring-slate-400 border-white' : 'border-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={!!aiBusy}
                        onClick={() => {
                          const charId = selectedCharId;
                          void runAi('sticky', async () => {
                            const content = await generateStickyNote(
                              charId,
                              userProfile.name,
                              currentSpace
                            );
                            const note: StickyNoteItem = {
                              id: `note-${Date.now()}`,
                              author: 'char',
                              authorName: currentChar.name,
                              content,
                              colorBg: ['#FEF6C9', '#FFE0E9', '#DCEEFF', '#DCF5E3', '#EDE2FF'][
                                Math.floor(Math.random() * 5)
                              ],
                              createdAt: todayStr(),
                              seenByChar: true,
                            };
                            updateSpaceFor(charId, (prev) => ({
                              ...prev,
                              stickyNotes: [note, ...prev.stickyNotes],
                            }));
                          });
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles
                          className={`w-3 h-3 text-amber-400 ${aiBusy === 'sticky' ? 'animate-spin' : ''}`}
                        />
                        <span>{aiBusy === 'sticky' ? '书写中' : '让TA贴'}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (!newStickyText.trim()) return;
                            const note: StickyNoteItem = {
                              id: `note-${Date.now()}`,
                              author: 'user',
                              authorName: userProfile.name,
                              content: newStickyText.trim(),
                              colorBg: newStickyColor,
                              createdAt: todayStr(),
                              seenByChar: false,
                            };
                            updateCurrentSpace((prev) => ({
                              ...prev,
                              stickyNotes: [note, ...prev.stickyNotes],
                            }));
                          setNewStickyText('');
                        }}
                        className="px-3.5 py-1 rounded-xl bg-slate-700 text-white text-xs font-medium cursor-pointer"
                      >
                        贴上
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {currentSpace.stickyNotes.map((n) => (
                    <div
                      key={n.id}
                      style={{ backgroundColor: n.colorBg }}
                      className="p-3 rounded-2xl border border-white/90 shadow-2xs flex flex-col justify-between space-y-2"
                    >
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {n.content}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-black/5">
                        <span>{n.authorName} · {coupleRecordDate(n.createdAt) ?? n.createdAt}</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" aria-label={`编辑便签：${n.content}`} onClick={() => setRecordEdit({
                            kind: 'note', id: n.id, date: coupleRecordDate(n.createdAt) ?? todayStr(),
                            content: n.content, authorName: n.authorName, colorBg: n.colorBg,
                          })} className="text-sky-600"><Pencil className="h-3 w-3" /></button>
                          <button
                            onClick={() =>
                              updateCurrentSpace((prev) => ({
                                ...prev,
                                stickyNotes: prev.stickyNotes.filter((x) => x.id !== n.id),
                              }))
                            }
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {recordEdit && (
        <CoupleRecordEditor
          initial={recordEdit}
          moods={MOOD_OPTIONS}
          onClose={() => setRecordEdit(null)}
          onSave={(edit) => {
            const latest = readCoupleSpaces();
            const space = latest[selectedCharId] || createEmptyCoupleSpace(selectedCharId);
            const next = { ...latest, [selectedCharId]: editCoupleRecord(space, edit) };
            writeCoupleSpaces(next);
            setSpacesMap(next);
            if (edit.kind === 'mood') {
              setEditingMoodDate(null);
              setCurrentYearMonth(edit.date.slice(0, 7));
            }
            setRecordEdit(null);
          }}
        />
      )}

      {/* ==================== 弹窗 C：修改起始日与背景 ==================== */}
      {showStartDateModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-[26px] p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">起始日与头图</h3>
              <button
                onClick={() => setShowStartDateModal(false)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <label className="block text-xs text-slate-600 space-y-1">
              <span>起始日期：</span>
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-600 block">头图背景（留空默认）：</span>
              <input
                type="text"
                placeholder="粘贴图片 URL..."
                value={tempHeaderBg}
                onChange={(e) => setTempHeaderBg(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>从相册上传</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLocalImageUpload(e, (b64) => setTempHeaderBg(b64))}
                />
              </label>
            </div>

            <button
              onClick={() => {
                updateCurrentSpace((prev) => ({
                  ...prev,
                  startDate: tempStartDate || prev.startDate,
                  headerBgUrl: tempHeaderBg.trim(),
                }));
                setShowStartDateModal(false);
              }}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#D7A8B7] to-[#A8C6DF] text-white text-xs font-bold cursor-pointer"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 D：右上角管理菜单 ==================== */}
      {showTopMenu && (
        <div className="absolute inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-[26px] p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">空间管理</h3>
              <button
                onClick={() => setShowTopMenu(false)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportCoupleData}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center gap-1 text-xs text-slate-600 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>导出数据</span>
              </button>

              <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center gap-1 text-xs text-slate-600 cursor-pointer">
                <Upload className="w-4 h-4 text-slate-400" />
                <span>导入数据</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const data = JSON.parse(String(ev.target?.result));
                        if (data.spacesMap) setSpacesMap(data.spacesMap);
                        setShowTopMenu(false);
                        setBannerTip('空间数据已恢复。');
                      } catch {
                        showYyError('导入文件格式有误', '导入失败');
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-100">
              <button
                onClick={handleClearSpaceSilently}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200/60 text-slate-600 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eraser className="w-4 h-4 text-slate-400" />
                <span>清空此空间数据（静默）</span>
              </button>

              <button
                onClick={handleUnbindAndNotifyChar}
                className="w-full py-2.5 px-3 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/70 text-rose-500 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Unlink className="w-4 h-4" />
                <span>解除绑定关系（通知角色）</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};