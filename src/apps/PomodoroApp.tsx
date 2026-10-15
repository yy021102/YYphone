import React, { useState, useEffect, useRef } from 'react';
import {
  Timer,
  ListTodo,
  Trophy,
  BarChart3,
  Menu,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Send,
  Share2,
  Droplets,
  Sprout,
  Calendar,
  Upload,
  Download,
  Palette,
  Save,
  X,
  BookOpen,
  User,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { readAlipayContacts, AlipayContact } from '../utils/alipayData';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { compressImage } from '../utils/imageFile';
import {
  processPomodoroDeadline,
  readPomodoroTimer,
  savePomodoroTimer,
} from '../utils/pomodoroRuntime';

interface PomodoroAppProps {
  onBack: () => void;
}

type PomoTab = 'timer' | 'tasks' | 'rank' | 'stats';
type TimerPhase = 'focus' | 'rest';
type NoiseType = 'off' | 'wind' | 'rain' | 'deep' | 'custom';

// 任务结构
export interface PomoTask {
  id: string;
  title: string;
  category: 'daily' | 'temp';
  focusMinutes: number;
  restMinutes: number;
  completedCount: number;
  isDoneToday: boolean;
  bgImageUrl?: string;
}

// 专注历史记录结构
export interface PomoSessionRecord {
  id: string;
  taskId?: string;
  taskTitle: string;
  durationMinutes: number;
  dateStr: string;
  timeStr: string;
  companionCharId?: string;
  companionCharName?: string;
}

// 角色虚拟专注排行项
export interface CharRankItem {
  id: string;
  charId?: string;
  name: string;
  isPlayer?: boolean;
  todayMinutes: number;
  statusText: string;
}

// 植物品种定义
export interface PlantSpecies {
  id: string;
  name: string;
  bloomIcon: string;
  desc: string;
}

const PLANT_SPECIES_LIST: PlantSpecies[] = [
  { id: 'sakura', name: '绯色小樱花', bloomIcon: '🌸', desc: '春风吹过自习桌时盛开的粉白樱花' },
  { id: 'sunflower', name: '暖阳向日葵', bloomIcon: '🌻', desc: '永远朝着阳光与目标生长的金色花朵' },
  { id: 'tulip', name: '粉雾郁金香', bloomIcon: '🌷', desc: '安静温柔地见证你们每一次专注的时光' },
  { id: 'rose', name: '星河红玫瑰', bloomIcon: '🌹', desc: '用耐心与偏爱一滴滴浇灌出的浪漫' },
  { id: 'clover', name: '幸运四叶草', bloomIcon: '🍀', desc: '据说努力的人一定能收获这株小幸运' },
  { id: 'hibiscus', name: '夏夜扶桑花', bloomIcon: '🌺', desc: '热烈而鲜活，记录每一次不放弃的坚持' },
];

// 每个角色专属的花盆进度
export interface CharacterPot {
  charId: string;
  speciesId: string;
  growthMinutes: number; // 当前这盆花已浇灌的成长分钟数（满 180 即可开花采摘）
  lastWaterQuote: string; // 最近一次浇水时角色的互动语
}

// 采摘后的植物标本图鉴项
export interface HarvestedSpecimen {
  id: string;
  charId: string;
  charName: string;
  speciesId: string;
  speciesName: string;
  bloomIcon: string;
  harvestDate: string;
  commemorativeQuote: string;
}

// 温室总数据结构
export interface GreenhouseState {
  dewDrops: number; // 玩家当前拥有的待浇灌露水数量
  pots: Record<string, CharacterPot>; // key 为 charId，每个角色独立一盆花
  specimens: HarvestedSpecimen[]; // 已采摘收集的标本图鉴列表
}

// 番茄钟专属美化预设
export interface PomoThemePreset {
  id: string;
  name: string;
  bgGradient: string;
  wallpaperUrl: string;
  timerCardBgUrl: string;
  primaryGradient: string;
  cardBg: string;
  textColor: string;
  cardRadius: string;
  customCss: string;
}

const DEFAULT_POMO_PRESET: PomoThemePreset = {
  id: 'default',
  name: '默认预设',
  bgGradient: 'linear-gradient(180deg, #F0F7FF 0%, #F7F4FC 50%, #FFF2F7 100%)',
  wallpaperUrl: '',
  timerCardBgUrl: '',
  primaryGradient: 'linear-gradient(90deg, #8EC5FC 0%, #F5B8D1 100%)',
  cardBg: 'rgba(255, 255, 255, 0.74)',
  textColor: '#3A5064',
  cardRadius: '24px',
  customCss: '/* 可在此自定义番茄钟附加样式 */',
};

const MAX_PLANT_GROWTH = 180; // 每盆花满 180 成长值（浇 6 滴露水）即可盛开采摘
const todayDateStr = () => new Date().toISOString().slice(0, 10);

const POMODORO_STORAGE_KEYS = {
  tasks: 'yyphone:pomodoro-tasks',
  records: 'yyphone:pomodoro-records',
  greenhouse: 'yyphone:pomodoro-greenhouse',
  rankList: 'yyphone:pomodoro-rank-list',
  themePresets: 'yyphone:pomodoro-theme-presets',
  activePresetId: 'yyphone:pomodoro-active-preset-id',
  currentTheme: 'yyphone:pomodoro-current-theme',
  shares: 'yyphone:pomodoro-shares',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isTaskList = (value: unknown): value is PomoTask[] =>
  Array.isArray(value) &&
  value.every((item) =>
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    (item.category === 'daily' || item.category === 'temp') &&
    typeof item.focusMinutes === 'number' &&
    typeof item.restMinutes === 'number' &&
    typeof item.completedCount === 'number' &&
    typeof item.isDoneToday === 'boolean'
  );

const isRecordList = (value: unknown): value is PomoSessionRecord[] =>
  Array.isArray(value) &&
  value.every((item) =>
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.taskTitle === 'string' &&
    typeof item.durationMinutes === 'number' &&
    typeof item.dateStr === 'string' &&
    typeof item.timeStr === 'string'
  );

const isGreenhouseState = (value: unknown): value is GreenhouseState =>
  isRecord(value) &&
  typeof value.dewDrops === 'number' &&
  isRecord(value.pots) &&
  Object.values(value.pots).every((pot) =>
    isRecord(pot) &&
    typeof pot.charId === 'string' &&
    typeof pot.speciesId === 'string' &&
    typeof pot.growthMinutes === 'number' &&
    typeof pot.lastWaterQuote === 'string'
  ) &&
  Array.isArray(value.specimens) &&
  value.specimens.every((specimen) =>
    isRecord(specimen) &&
    typeof specimen.id === 'string' &&
    typeof specimen.charId === 'string' &&
    typeof specimen.charName === 'string' &&
    typeof specimen.speciesId === 'string' &&
    typeof specimen.speciesName === 'string' &&
    typeof specimen.bloomIcon === 'string' &&
    typeof specimen.harvestDate === 'string' &&
    typeof specimen.commemorativeQuote === 'string'
  );

const isRankList = (value: unknown): value is CharRankItem[] =>
  Array.isArray(value) &&
  value.every((item) =>
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.todayMinutes === 'number' &&
    typeof item.statusText === 'string'
  );

const isThemePreset = (value: unknown): value is PomoThemePreset =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.bgGradient === 'string' &&
  typeof value.wallpaperUrl === 'string' &&
  typeof value.timerCardBgUrl === 'string' &&
  typeof value.primaryGradient === 'string' &&
  typeof value.cardBg === 'string' &&
  typeof value.textColor === 'string' &&
  typeof value.cardRadius === 'string' &&
  typeof value.customCss === 'string';

const isThemePresetList = (value: unknown): value is PomoThemePreset[] =>
  Array.isArray(value) && value.every(isThemePreset);

export const PomodoroApp: React.FC<PomodoroAppProps> = ({ onBack }) => {
  // ==================== 1. 基础导航与角色列表 ====================
  const [initialTimer] = useState(() => readPomodoroTimer());
  const [activeTab, setActiveTab] = useState<PomoTab>('timer');
  const [contacts] = useState<AlipayContact[]>(() => readAlipayContacts());
  const [companionCharId, setCompanionCharId] = useState<string>(
    initialTimer.companionCharId || contacts[0]?.id || 'default_char'
  );

  const companionChar = contacts.find((c) => c.id === companionCharId) || contacts[0];

  // ==================== 2. 专属美化预设状态 ====================
  const [themePresets, setThemePresets] = useState<PomoThemePreset[]>(() =>
    readStoredValue(POMODORO_STORAGE_KEYS.themePresets, [DEFAULT_POMO_PRESET], isThemePresetList)
  );
  const [activePresetId, setActivePresetId] = useState<string>(() =>
    readStoredValue(POMODORO_STORAGE_KEYS.activePresetId, 'default', (value): value is string =>
      typeof value === 'string'
    )
  );
  const [currentTheme, setCurrentTheme] = useState<PomoThemePreset>(() =>
    readStoredValue(POMODORO_STORAGE_KEYS.currentTheme, DEFAULT_POMO_PRESET, isThemePreset)
  );
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [menuTab, setMenuTab] = useState<'theme' | 'data'>('theme');

  // ==================== 3. 计时器核心状态（真实时间戳差值法） ====================
  const [phase, setPhase] = useState<TimerPhase>(initialTimer.phase);
  const [customFocusMin, setCustomFocusMin] = useState<number>(initialTimer.focusMinutes);
  const [customRestMin, setCustomRestMin] = useState<number>(initialTimer.restMinutes);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialTimer.remainingSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(initialTimer.isRunning);
  const [activeTaskId, setActiveTaskId] = useState<string>(initialTimer.activeTaskId);
  const lastTimerPhaseRef = useRef<TimerPhase>(initialTimer.phase);

  const [companionBubble, setCompanionBubble] = useState<string>(
    '准备好开始专注了吗？我就在旁边陪着你，专注完还能一起去温室浇花哦~'
  );
  const [chatToCharInput, setChatToCharInput] = useState<string>('');
  const [isCharReplying, setIsCharReplying] = useState<boolean>(false);

  // ==================== 4. 内置免链接白噪音合成器 ====================
  const [noiseType, setNoiseType] = useState<NoiseType>('off');
  const [customAudioUrl, setCustomAudioUrl] = useState<string>('');
  const [showNoiseModal, setShowNoiseModal] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  // ==================== 5. 任务列表状态 ====================
  const [taskFilter, setTaskFilter] = useState<'daily' | 'temp'>('daily');
  const [tasks, setTasks] = useState<PomoTask[]>(() => readStoredValue(POMODORO_STORAGE_KEYS.tasks, [
    {
      id: 'task-1',
      title: '沉浸阅读 / 背单词 25 分钟',
      category: 'daily',
      focusMinutes: 25,
      restMinutes: 5,
      completedCount: 1,
      isDoneToday: false,
    },
    {
      id: 'task-2',
      title: '整理今日笔记与待办清单',
      category: 'temp',
      focusMinutes: 15,
      restMinutes: 5,
      completedCount: 0,
      isDoneToday: false,
    },
  ], isTaskList));

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskCategoryInput, setTaskCategoryInput] = useState<'daily' | 'temp'>('daily');
  const [taskFocusInput, setTaskFocusInput] = useState('25');
  const [taskRestInput, setTaskRestInput] = useState('5');
  const [taskBgUrlInput, setTaskBgUrlInput] = useState('');

  const [showDurationModal, setShowDurationModal] = useState(false);
  const [tempFocusInput, setTempFocusInput] = useState('25');
  const [tempRestInput, setTempRestInput] = useState('5');

  // ==================== 6. 专注记录、升级版温室（角色专属花盆+手动浇水+标本图鉴）与排行榜 ====================
  const [records, setRecords] = useState<PomoSessionRecord[]>(() =>
    readStoredValue(POMODORO_STORAGE_KEYS.records, [] as PomoSessionRecord[], isRecordList)
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => todayDateStr());

  const [greenhouse, setGreenhouse] = useState<GreenhouseState>(() => readStoredValue(
    POMODORO_STORAGE_KEYS.greenhouse,
    (() => {
    const initialPots: Record<string, CharacterPot> = {};
    contacts.forEach((c, idx) => {
      const sp = PLANT_SPECIES_LIST[idx % PLANT_SPECIES_LIST.length];
      initialPots[c.id] = {
        charId: c.id,
        speciesId: sp.id,
        growthMinutes: idx === 0 ? 60 : 0,
        lastWaterQuote: `这是我和你一起种下的「${sp.name}」，每次专注完记得来给它浇水呀。`,
      };
    });
    return {
      dewDrops: 3, // 初始送 3 滴露水方便玩家体验手动浇水
      pots: initialPots,
      specimens: [],
    };
    })(),
    isGreenhouseState
  ));

  const [showSpecimenModal, setShowSpecimenModal] = useState(false);
  const [isWateringAnim, setIsWateringAnim] = useState(false);

  // 角色虚拟专注排行榜
  const [rankList, setRankList] = useState<CharRankItem[]>(() => {
    const initialRankList: CharRankItem[] = contacts.map((c, i) => ({
      id: `rank-${c.id}`,
      charId: c.id,
      name: c.name,
      todayMinutes: i === 0 ? 140 : 45,
      statusText: i === 0 ? '正在专注处理公务，效率拉满' : '刚泡了一杯咖啡准备开始',
    }));
    return readStoredValue(POMODORO_STORAGE_KEYS.rankList, initialRankList, isRankList);
  });
  const [isRefreshingRank, setIsRefreshingRank] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCharIds, setShareCharIds] = useState<string[]>([]);
  const [noticeBanner, setNoticeBanner] = useState<string>('');

  useEffect(() => {
    writeStoredValue(POMODORO_STORAGE_KEYS.tasks, tasks);
  }, [tasks]);

  useEffect(() => {
    writeStoredValue(POMODORO_STORAGE_KEYS.records, records);
  }, [records]);

  useEffect(() => {
    writeStoredValue(POMODORO_STORAGE_KEYS.greenhouse, greenhouse);
  }, [greenhouse]);

  useEffect(() => {
    writeStoredValue(POMODORO_STORAGE_KEYS.rankList, rankList);
  }, [rankList]);

  useEffect(() => {
    writeStoredValue(POMODORO_STORAGE_KEYS.themePresets, themePresets);
  }, [themePresets]);

  useEffect(() => {
    writeStoredValue(POMODORO_STORAGE_KEYS.activePresetId, activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    writeStoredValue(POMODORO_STORAGE_KEYS.currentTheme, currentTheme);
  }, [currentTheme]);

  // 获取当前陪伴角色对应的专属花盆（若无则动态初始化一盆）
  const activePotKey = companionChar?.id || 'default_char';
  const currentPot: CharacterPot = greenhouse.pots[activePotKey] || {
    charId: activePotKey,
    speciesId: PLANT_SPECIES_LIST[0].id,
    growthMinutes: 0,
    lastWaterQuote: '刚埋下了一颗新种子，快去完成专注攒露水浇灌它吧~',
  };
  const currentSpecies =
    PLANT_SPECIES_LIST.find((s) => s.id === currentPot.speciesId) || PLANT_SPECIES_LIST[0];

  // 计算当前花盆的 5 个成长阶段
  const getPotStageInfo = (mins: number, species: PlantSpecies) => {
    if (mins < 30) {
      return { icon: '🌰', stageName: '1/5 · 沉睡花种', isBloomed: false };
    }
    if (mins < 60) {
      return { icon: '🌱', stageName: '2/5 · 破土嫩芽', isBloomed: false };
    }
    if (mins < 120) {
      return { icon: '🌿', stageName: '3/5 · 青翠枝叶', isBloomed: false };
    }
    if (mins < MAX_PLANT_GROWTH) {
      return { icon: '💐', stageName: '4/5 · 含苞待放', isBloomed: false };
    }
    return {
      icon: species.bloomIcon,
      stageName: `5/5 · ${species.name}已盛开`,
      isBloomed: true,
    };
  };

  const currentStageInfo = getPotStageInfo(currentPot.growthMinutes, currentSpecies);

  // ==================== 7. 手动浇水 & 开花采摘收录图鉴逻辑 ====================
  const handleWaterPlant = () => {
    if (greenhouse.dewDrops <= 0) {
      setNoticeBanner('露水不够啦！每完成一次专注即可获得 1 滴专注露水哦~');
      return;
    }
    if (currentStageInfo.isBloomed) {
      setNoticeBanner(`这盆「${currentSpecies.name}」已经完全盛开啦，快点击采摘收入标本图鉴吧！`);
      return;
    }

    setIsWateringAnim(true);
    setTimeout(() => setIsWateringAnim(false), 600);

    const nextMins = Math.min(MAX_PLANT_GROWTH, currentPot.growthMinutes + 30);
    const charName = companionChar?.name || 'TA';

    const waterQuotes = [
      `${charName}递给你小水壶：“今天又坚持专注了，你看它的叶子是不是更绿了一点？”`,
      `${charName}弯腰看了看花盆：“照这个速度，我们很快就能看到「${currentSpecies.name}」开花了。”`,
      `${charName}笑着揉了揉你的头发：“奖励你一朵小红花，剩下的露水都喂给它吧~”`,
      `露水落在叶片上亮晶晶的，${charName}在旁边认真记录下了你们今天的培育进度。`,
    ];
    const nextQuote =
      nextMins >= MAX_PLANT_GROWTH
        ? `哇！在${charName}和你的共同培育下，「${currentSpecies.name}」彻底盛开了！快把它采摘进标本图鉴吧 ✨`
        : waterQuotes[Math.floor(Math.random() * waterQuotes.length)];

    setGreenhouse((prev) => ({
      ...prev,
      dewDrops: prev.dewDrops - 1,
      pots: {
        ...prev.pots,
        [activePotKey]: {
          ...currentPot,
          growthMinutes: nextMins,
          lastWaterQuote: nextQuote,
        },
      },
    }));
  };

  // 采摘已盛开的花朵收入标本图鉴，并开启下一颗新种子
  const handleHarvestAndNewSeed = () => {
    if (!currentStageInfo.isBloomed) return;
    const charName = companionChar?.name || '神秘同桌';

    const newSpecimen: HarvestedSpecimen = {
      id: `spec-${Date.now()}`,
      charId: activePotKey,
      charName,
      speciesId: currentSpecies.id,
      speciesName: currentSpecies.name,
      bloomIcon: currentSpecies.bloomIcon,
      harvestDate: todayDateStr(),
      commemorativeQuote: `由你与「${charName}」共同倾注 180 分钟专注时光培育盛开。`,
    };

    // 随机抽取下一颗不同品种的种子
    const otherSpecies = PLANT_SPECIES_LIST.filter((s) => s.id !== currentSpecies.id);
    const nextSpecies =
      otherSpecies[Math.floor(Math.random() * otherSpecies.length)] || PLANT_SPECIES_LIST[0];

    setGreenhouse((prev) => ({
      ...prev,
      specimens: [newSpecimen, ...prev.specimens],
      pots: {
        ...prev.pots,
        [activePotKey]: {
          charId: activePotKey,
          speciesId: nextSpecies.id,
          growthMinutes: 0,
          lastWaterQuote: `已经把上一盆花做成永恒标本啦！现在我们换上了新的「${nextSpecies.name}」花种，继续加油吧~`,
        },
      },
    }));

    setNoticeBanner(
      `🎉 已将盛开的「${currentSpecies.name}」收入标本图鉴，并为你和${charName}换上了新花种「${nextSpecies.name}」！`
    );
  };

  // ==================== 8. 真实时间戳倒计时逻辑 ====================
  useEffect(() => {
    const applyTimerSnapshot = (snapshot: ReturnType<typeof readPomodoroTimer>) => {
      setPhase(snapshot.phase);
      setIsRunning(snapshot.isRunning);
      setRemainingSeconds(snapshot.remainingSeconds);
      setCustomFocusMin(snapshot.focusMinutes);
      setCustomRestMin(snapshot.restMinutes);
      setActiveTaskId(snapshot.activeTaskId);
      if (snapshot.companionCharId) setCompanionCharId(snapshot.companionCharId);
    };
    const refresh = () => {
      try {
        applyTimerSnapshot(processPomodoroDeadline());
      } catch (error) {
        console.error('Could not refresh the Pomodoro timer.', error);
      }
    };
    const handleRuntimeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{
        snapshot: ReturnType<typeof readPomodoroTimer>;
        completedFocus: boolean;
      }>).detail;
      if (!detail) return;
      const previousPhase = lastTimerPhaseRef.current;
      lastTimerPhaseRef.current = detail.snapshot.phase;
      applyTimerSnapshot(detail.snapshot);
      if (detail.completedFocus) {
        setCompanionBubble('太棒了！专注完成，已获得 1 滴专注露水。休息一下再继续吧！');
        setRecords(readStoredValue(POMODORO_STORAGE_KEYS.records, [] as PomoSessionRecord[], isRecordList));
        setTasks(readStoredValue(POMODORO_STORAGE_KEYS.tasks, [] as PomoTask[], isTaskList));
        setGreenhouse(readStoredValue(
          POMODORO_STORAGE_KEYS.greenhouse,
          greenhouse,
          isGreenhouseState
        ));
      } else if (previousPhase === 'rest' && detail.snapshot.phase === 'focus') {
        setCompanionBubble('休息时间结束啦！精神恢复了吗？随时可以开启下一轮专注~');
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 500);
    window.addEventListener('yyphone:pomodoro-runtime', handleRuntimeEvent);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('yyphone:pomodoro-runtime', handleRuntimeEvent);
    };
  }, []);

  const triggerAiCompanionMessage = (
    eventType: 'pause' | 'stop' | 'complete_focus' | 'start_rest' | 'user_poke',
    userText?: string
  ) => {
    const charName = companionChar?.name || 'TA';
    setIsCharReplying(true);
    setTimeout(() => {
      if (eventType === 'pause') {
        setCompanionBubble(`怎么暂停啦？是不是累了，喝口水喘口气再继续吧，${charName}在这等你。`);
      } else if (eventType === 'stop') {
        setCompanionBubble(`提前结束了吗？没关系，休息好了我们随时重新开始~`);
      } else if (eventType === 'complete_focus') {
        setCompanionBubble(
          `太棒了！完整的专注时间达成 ✨ 获得了 1 滴专注露水，快去「排行/温室」给我们的花浇水吧！`
        );
      } else if (eventType === 'start_rest') {
        setCompanionBubble(`现在是休息时间~ 伸个懒腰，现在可以光明正大找我聊天啦！`);
      } else if (eventType === 'user_poke') {
        setCompanionBubble(
          isRunning && phase === 'focus'
            ? `抓包！针对你刚刚说的「${userText}」——专心点，等倒计时结束我再好好回你！`
            : `收到你的消息啦：「${userText}」，休息时间陪你聊个痛快~`
        );
      }
      setIsCharReplying(false);
    }, 350);
  };

  const handleStartTimer = () => {
    const current = readPomodoroTimer();
    savePomodoroTimer({
      phase,
      isRunning: true,
      remainingSeconds,
      targetEndTime: Date.now() + remainingSeconds * 1000,
      focusMinutes: customFocusMin,
      restMinutes: customRestMin,
      activeTaskId,
      companionCharId: companionChar?.id ?? '',
      companionCharName: companionChar?.name ?? '',
      sessionId: phase === 'focus'
        ? current.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : '',
    });
    setIsRunning(true);
    if (phase === 'focus') {
      setCompanionBubble(`已开启专注模式！把手机放一旁安心忙吧，我帮你看着时间~`);
    } else {
      triggerAiCompanionMessage('start_rest');
    }
  };

  const handlePauseTimer = () => {
    const current = processPomodoroDeadline();
    if (!current.isRunning) {
      setIsRunning(false);
      setPhase(current.phase);
      setRemainingSeconds(current.remainingSeconds);
      return;
    }
    const remaining = current.targetEndTime === null
      ? remainingSeconds
      : Math.max(0, Math.ceil((current.targetEndTime - Date.now()) / 1000));
    savePomodoroTimer({
      ...current,
      isRunning: false,
      remainingSeconds: remaining,
      targetEndTime: null,
    });
    setIsRunning(false);
    setRemainingSeconds(remaining);
    triggerAiCompanionMessage('pause');
  };

  const handleStopTimer = () => {
    const current = readPomodoroTimer();
    const wasRunning = current.isRunning;
    const resetSec = (phase === 'focus' ? customFocusMin : customRestMin) * 60;
    savePomodoroTimer({
      ...current,
      phase,
      isRunning: false,
      remainingSeconds: resetSec,
      targetEndTime: null,
      focusMinutes: customFocusMin,
      restMinutes: customRestMin,
      activeTaskId,
      companionCharId: companionChar?.id ?? '',
      companionCharName: companionChar?.name ?? '',
      sessionId: '',
    });
    setIsRunning(false);
    setRemainingSeconds(resetSec);
    if (wasRunning) {
      triggerAiCompanionMessage('stop');
    }
  };


  const handleSendChatToCompanion = () => {
    const txt = chatToCharInput.trim();
    if (!txt) return;
    setChatToCharInput('');
    triggerAiCompanionMessage('user_poke', txt);
  };

  // ==================== 9. 免链接纯代码白噪音发生器 ====================
  const stopAllNoise = () => {
    if (noiseNodeRef.current) {
      try {
        noiseNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      noiseNodeRef.current = null;
    }
    if (customAudioRef.current) {
      customAudioRef.current.pause();
    }
  };

  const handleSelectNoise = (type: NoiseType) => {
    stopAllNoise();
    setNoiseType(type);
    if (type === 'off') return;

    if (type === 'custom') {
      if (customAudioUrl.trim()) {
        if (!customAudioRef.current) {
          customAudioRef.current = new Audio();
          customAudioRef.current.loop = true;
        }
        customAudioRef.current.src = customAudioUrl.trim();
        customAudioRef.current.play().catch(() => {});
      }
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 0.18;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'deep' ? 220 : type === 'wind' ? 520 : 950;

      whiteNoise.connect(filter);
      filter.connect(ctx.destination);
      whiteNoise.start(0);
      noiseNodeRef.current = filter;
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    return () => stopAllNoise();
  }, []);

  // ==================== 10. 任务增删改与一键带入计时 ====================
  const openCreateTask = () => {
    setEditingTaskId(null);
    setTaskTitleInput('');
    setTaskCategoryInput(taskFilter);
    setTaskFocusInput('25');
    setTaskRestInput('5');
    setTaskBgUrlInput('');
    setShowTaskModal(true);
  };

  const openEditTask = (t: PomoTask) => {
    setEditingTaskId(t.id);
    setTaskTitleInput(t.title);
    setTaskCategoryInput(t.category);
    setTaskFocusInput(String(t.focusMinutes));
    setTaskRestInput(String(t.restMinutes));
    setTaskBgUrlInput(t.bgImageUrl || '');
    setShowTaskModal(true);
  };

  const handleSaveTask = () => {
    const title = taskTitleInput.trim();
    if (!title) return;
    const fMin = Math.max(1, parseInt(taskFocusInput, 10) || 25);
    const rMin = Math.max(1, parseInt(taskRestInput, 10) || 5);

    if (editingTaskId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskId
            ? {
                ...t,
                title,
                category: taskCategoryInput,
                focusMinutes: fMin,
                restMinutes: rMin,
                bgImageUrl: taskBgUrlInput.trim() || undefined,
              }
            : t
        )
      );
    } else {
      const newTask: PomoTask = {
        id: `task-${Date.now()}`,
        title,
        category: taskCategoryInput,
        focusMinutes: fMin,
        restMinutes: rMin,
        completedCount: 0,
        isDoneToday: false,
        bgImageUrl: taskBgUrlInput.trim() || undefined,
      };
      setTasks((prev) => [newTask, ...prev]);
    }
    setShowTaskModal(false);
  };

  const handleSelectTaskToFocus = (task: PomoTask) => {
    const current = readPomodoroTimer();
    savePomodoroTimer({
      ...current,
      phase: 'focus',
      isRunning: false,
      remainingSeconds: task.focusMinutes * 60,
      targetEndTime: null,
      focusMinutes: task.focusMinutes,
      restMinutes: task.restMinutes,
      activeTaskId: task.id,
      companionCharId: companionChar?.id ?? '',
      companionCharName: companionChar?.name ?? '',
      sessionId: '',
    });
    setActiveTaskId(task.id);
    setCustomFocusMin(task.focusMinutes);
    setCustomRestMin(task.restMinutes);
    setPhase('focus');
    setIsRunning(false);
    setRemainingSeconds(task.focusMinutes * 60);
    setActiveTab('timer');
    setCompanionBubble(`已切换到任务「${task.title}」，专注 ${task.focusMinutes} 分钟，开始吧！`);
  };

  // ==================== 11. 角色专注排行榜生成与互动 ====================
  const todayPlayerMinutes = records
    .filter((r) => r.dateStr === todayDateStr())
    .reduce((sum, r) => sum + r.durationMinutes, 0);

  const combinedRankings: CharRankItem[] = [
    ...rankList,
    {
      id: 'rank-player',
      name: '我 (玩家)',
      isPlayer: true,
      todayMinutes: todayPlayerMinutes,
      statusText: `今日已完成 ${records.filter((r) => r.dateStr === todayDateStr()).length} 轮番茄专注`,
    },
  ].sort((a, b) => b.todayMinutes - a.todayMinutes);

  const handleRefreshAiRank = () => {
    setIsRefreshingRank(true);
    setTimeout(() => {
      const statuses = [
        '正在书房认真看资料，手机调了静音',
        '刚忙完手头的工作，准备冲杯手冲咖啡',
        '窝在沙发上看书，不小心困得直点头',
        '全神贯注推进计划中，今日状态极佳',
      ];
      setRankList(
        contacts.map((c, idx) => ({
          id: `rank-${c.id}`,
          charId: c.id,
          name: c.name,
          todayMinutes: Math.floor(20 + Math.random() * 180),
          statusText: statuses[(idx + Math.floor(Math.random() * statuses.length)) % statuses.length],
        }))
      );
      setIsRefreshingRank(false);
    }, 450);
  };

  const handleInteractRankChar = (item: CharRankItem, myMinutes: number) => {
    const isHigherThanMe = item.todayMinutes > myMinutes;
    const actionLabel = isHigherThanMe ? '膜拜了一下卷王' : '向对方炫耀了你的自习排名';
    setNoticeBanner(
      `已${actionLabel}「${item.name}」（今日排行榜战况已同步至 TA 的记忆，可去微信聊起此事）！`
    );
  };

  // ==================== 12. 统计计算与多选角色分享 ====================
  const totalFocusMinutes = records.reduce((s, r) => s + r.durationMinutes, 0);
  const uniqueCheckInDays = Array.from(new Set(records.map((r) => r.dateStr))).length;
  const selectedDayRecords = records.filter((r) => r.dateStr === selectedDateStr);

  const handleConfirmShareStats = () => {
    if (shareCharIds.length === 0) return;
    const selectedContacts = contacts.filter((contact) => shareCharIds.includes(contact.id));
    const names = selectedContacts.map((contact) => contact.name).join('、');
    const todayRecords = records.filter((record) => record.dateStr === todayDateStr());
    const taskNames = [...new Set(todayRecords.map((record) => record.taskTitle))];
    const companionNames = [...new Set(todayRecords
      .map((record) => record.companionCharName)
      .filter((name): name is string => !!name))];
    const detailLines = [
      `今日累计专注：${todayPlayerMinutes} 分钟`,
      `完成专注次数：${todayRecords.length} 次`,
      `完成事项：${taskNames.length > 0 ? taskNames.join('、') : '暂无任务记录'}`,
      `陪读角色：${companionNames.length > 0 ? companionNames.join('、') : '自由专注'}`,
    ];
    const aiContext = [
      '[玩家主动分享今日番茄钟专注战绩，请结合具体数字和事项回应。]',
      ...detailLines,
      '专注记录明细：',
      ...(todayRecords.length > 0
        ? todayRecords.map((record) =>
            `${record.timeStr} · ${record.durationMinutes} 分钟 · ${record.taskTitle}${record.companionCharName ? ` · 陪读：${record.companionCharName}` : ''}`
          )
        : ['今日暂无已完成的专注记录。']),
    ].join('\n');
    const queue = readStoredValue<unknown[]>(POMODORO_STORAGE_KEYS.shares, [], Array.isArray);
    const now = new Date().toISOString();
    const shareEntries = selectedContacts.map((contact) => ({
      targetCharId: contact.id,
      message: {
        id: `pomodoro-share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${contact.id}`,
        senderId: 'user',
        kind: 'pomodoro-share',
        title: '🍅 今日专注打卡战报',
        content: `${todayPlayerMinutes} 分钟 · ${todayRecords.length} 次专注\n${taskNames.slice(0, 2).join('、') || '今天也有认真专注'}`,
        source: '来自 番茄钟 · 自习室',
        text: aiContext,
        aiContext,
        pomodoroDetails: {
          totalMinutes: todayPlayerMinutes,
          sessionCount: todayRecords.length,
          tasks: taskNames,
          companionNames,
          sessions: todayRecords.map((record) => ({
            time: record.timeStr,
            durationMinutes: record.durationMinutes,
            taskTitle: record.taskTitle,
            companionCharName: record.companionCharName || '',
          })),
        },
        createdAt: now,
      },
    }));
    writeStoredValue(POMODORO_STORAGE_KEYS.shares, [...queue, ...shareEntries]);
    setNoticeBanner(
      `已将今日专注战绩（共 ${todayPlayerMinutes} 分钟）发送给「${names}」，进入微信后点生成即可回应！`
    );
    setShowShareModal(false);
    setShareCharIds([]);
  };

  // ==================== 13. 工具函数：本地上传图片 & 美化预设 & 备份 ====================
  const handleLocalImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onSuccess(await compressImage(file));
    } catch (error) {
      console.error('Could not compress Pomodoro image.', error);
      window.alert(error instanceof Error ? error.message : '图片压缩失败，请重新选择。');
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setActivePresetId(presetId);
    const found = themePresets.find((p) => p.id === presetId);
    if (found) setCurrentTheme({ ...found });
  };

  const handleSaveAsNewPreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const newId = `preset-${Date.now()}`;
    const newPreset: PomoThemePreset = { ...currentTheme, id: newId, name };
    setThemePresets((prev) => [...prev, newPreset]);
    setActivePresetId(newId);
    setNewPresetName('');
  };

  const handleUpdateCurrentPreset = () => {
    setThemePresets((prev) =>
      prev.map((p) => (p.id === activePresetId ? { ...currentTheme, id: p.id, name: p.name } : p))
    );
  };

  const handleDeletePreset = (id: string) => {
    if (id === 'default') return;
    const nextList = themePresets.filter((p) => p.id !== id);
    setThemePresets(nextList);
    setActivePresetId('default');
    setCurrentTheme(nextList.find((p) => p.id === 'default') || DEFAULT_POMO_PRESET);
  };

  const handleExportPomo = () => {
    const dataStr = JSON.stringify(
      { tasks, records, greenhouse, rankList, themePresets, activePresetId },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomodoro_backup_${todayDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatMMSS = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const activeTaskObj = tasks.find((t) => t.id === activeTaskId);

  return (
    <div
      className="pomo-custom-scope relative flex-1 w-full flex flex-col overflow-hidden select-none"
      style={{
        background: currentTheme.wallpaperUrl
          ? `url(${currentTheme.wallpaperUrl}) center / cover no-repeat`
          : currentTheme.bgGradient,
        color: currentTheme.textColor,
      }}
    >
      {currentTheme.customCss && <style>{currentTheme.customCss}</style>}

      {!currentTheme.wallpaperUrl && (
        <>
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-sky-200/25 blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-pink-200/20 blur-3xl pointer-events-none" />
        </>
      )}

      {/* 顶栏 */}
      <AppHeader
        title="番茄钟"
        onBack={onBack}
        rightAction={
          <button
            onClick={() => setShowTopMenu(true)}
            className="w-8 h-8 flex items-center justify-center text-sky-600 bg-white/70 hover:bg-white/90 backdrop-blur-md border border-white/90 rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="美化与数据中心"
          >
            <Menu className="w-4 h-4 stroke-[2]" />
          </button>
        }
      />

      {/* 四大板块导航栏 */}
      <div className="px-4 py-2 z-10 shrink-0">
        <div className="grid grid-cols-4 p-1 bg-white/55 backdrop-blur-xl border border-white/85 rounded-2xl shadow-[0_4px_14px_rgba(148,163,184,0.06)]">
          {[
            { key: 'timer', label: '专注', icon: Timer },
            { key: 'tasks', label: '任务', icon: ListTodo },
            { key: 'rank', label: '排行/温室', icon: Trophy },
            { key: 'stats', label: '统计', icon: BarChart3 },
          ].map(({ key, label, icon: TabIcon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as PomoTab)}
                style={isActive ? { background: currentTheme.primaryGradient } : undefined}
                className={`py-2 flex items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all duration-300 cursor-pointer ${
                  isActive ? 'text-white shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 主内容滚动区 */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-1 space-y-3 pb-[env(safe-area-inset-bottom,0px)]">
        {noticeBanner && (
          <div className="flex items-center justify-between rounded-2xl bg-white/85 backdrop-blur-md border border-emerald-200 px-3.5 py-2.5 text-[11px] font-bold text-emerald-600 shadow-2xs">
            <span>{noticeBanner}</span>
            <button onClick={() => setNoticeBanner('')} className="text-slate-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ==================== 板块 1：专注计时器 + 角色陪伴小窗 + 白噪音 ==================== */}
        {activeTab === 'timer' && (
          <div className="space-y-3">
            {/* 角色陪伴自习桌小窗 */}
            <div
              style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
              className="backdrop-blur-xl border border-white/85 p-3.5 space-y-2.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-white text-xs font-extrabold flex items-center justify-center border border-white">
                    {companionChar ? companionChar.name.slice(0, 1) : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold">
                        陪伴角色：{companionChar?.name || '暂未绑定'}
                      </span>
                      <span className="text-[9px] bg-pink-50 text-pink-500 px-1.5 py-0.2 rounded-full font-bold">
                        同桌陪读中
                      </span>
                    </div>
                  </div>
                </div>

                <select
                  value={companionCharId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const found = contacts.find((c) => c.id === selectedId);
                    setCompanionCharId(selectedId);
                    const current = readPomodoroTimer();
                    savePomodoroTimer({
                      ...current,
                      companionCharId: selectedId,
                      companionCharName: found?.name ?? '',
                    });
                    if (found) {
                      setCompanionBubble(`换我来陪你专注啦，我们的专属花盆也在温室里等着浇水哦！`);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white/80 border border-sky-100 text-[11px] font-bold text-sky-600 outline-none cursor-pointer"
                >
                  {contacts.length === 0 ? (
                    <option value="default_char">暂无角色</option>
                  ) : (
                    contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        切换：{c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="bg-white/80 border border-white rounded-2xl p-3 text-xs leading-relaxed text-slate-700 shadow-2xs">
                {isCharReplying ? '对方正在看你并输入中...' : companionBubble}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatToCharInput}
                  onChange={(e) => setChatToCharInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatToCompanion()}
                  placeholder={
                    isRunning && phase === 'focus'
                      ? '偷偷和 TA 说话（会被抓包开小差哦）...'
                      : '和陪读的 TA 说句话...'
                  }
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white/90 border border-slate-200/80 text-xs outline-none focus:border-sky-300"
                />
                <button
                  onClick={handleSendChatToCompanion}
                  style={{ background: currentTheme.primaryGradient }}
                  className="p-1.5 rounded-xl text-white cursor-pointer active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 计时器主表盘卡片 */}
            <div
              style={{
                background: currentTheme.timerCardBgUrl
                  ? `linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.72)), url(${currentTheme.timerCardBgUrl}) center / cover no-repeat`
                  : currentTheme.cardBg,
                borderRadius: currentTheme.cardRadius,
              }}
              className="backdrop-blur-xl border border-white/90 p-6 flex flex-col items-center space-y-5 shadow-[0_10px_28px_-8px_rgba(148,163,184,0.16)]"
            >
              <div className="w-full flex items-center justify-between">
                <div className="flex gap-1.5 bg-white/70 p-1 rounded-xl border border-white">
                  <button
                    onClick={() => {
                      const current = readPomodoroTimer();
                      savePomodoroTimer({
                        ...current,
                        phase: 'focus',
                        isRunning: false,
                        remainingSeconds: customFocusMin * 60,
                        targetEndTime: null,
                        focusMinutes: customFocusMin,
                        restMinutes: customRestMin,
                        activeTaskId,
                        companionCharId: companionChar?.id ?? '',
                        companionCharName: companionChar?.name ?? '',
                        sessionId: '',
                      });
                      setIsRunning(false);
                      setPhase('focus');
                      setRemainingSeconds(customFocusMin * 60);
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                      phase === 'focus'
                        ? 'bg-sky-400 text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    🍅 专注 ({customFocusMin}m)
                  </button>
                  <button
                    onClick={() => {
                      const current = readPomodoroTimer();
                      savePomodoroTimer({
                        ...current,
                        phase: 'rest',
                        isRunning: false,
                        remainingSeconds: customRestMin * 60,
                        targetEndTime: null,
                        focusMinutes: customFocusMin,
                        restMinutes: customRestMin,
                        activeTaskId,
                        companionCharId: companionChar?.id ?? '',
                        companionCharName: companionChar?.name ?? '',
                        sessionId: '',
                      });
                      setIsRunning(false);
                      setPhase('rest');
                      setRemainingSeconds(customRestMin * 60);
                      triggerAiCompanionMessage('start_rest');
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                      phase === 'rest'
                        ? 'bg-pink-400 text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    ☕ 休息 ({customRestMin}m)
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowNoiseModal(true)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                      noiseType !== 'off'
                        ? 'bg-sky-100 text-sky-600 border-sky-200'
                        : 'bg-white/80 text-slate-500 border-white'
                    }`}
                  >
                    {noiseType !== 'off' ? (
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {noiseType === 'off'
                        ? '白噪音'
                        : noiseType === 'wind'
                        ? '微风中'
                        : noiseType === 'rain'
                        ? '细雨中'
                        : noiseType === 'deep'
                        ? '深海中'
                        : '音乐中'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setTempFocusInput(String(customFocusMin));
                      setTempRestInput(String(customRestMin));
                      setShowDurationModal(true);
                    }}
                    className="p-1.5 rounded-xl bg-white/80 border border-white text-slate-500 hover:text-sky-500 cursor-pointer"
                    title="自定义专注与休息时长"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('tasks')}
                className="px-3.5 py-1 rounded-full bg-white/80 border border-sky-100 text-xs font-bold text-sky-600 cursor-pointer hover:bg-white"
              >
                📌 当前任务：{activeTaskObj ? activeTaskObj.title : '自由专注（点击可去绑定任务）'}
              </div>

              <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-white/90 via-sky-50/60 to-pink-50/60 border-4 border-white shadow-inner flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold text-slate-400 mb-1">
                  {phase === 'focus' ? 'FOCUS TIME' : 'BREAK TIME'}
                </span>
                <span className="text-4xl font-extrabold font-mono tracking-wider text-[#2C4A5C]">
                  {formatMMSS(remainingSeconds)}
                </span>
                <span className="text-[10px] text-pink-400 font-bold mt-2">
                  {isRunning ? '正在计时中...' : '已就绪 / 已暂停'}
                </span>
              </div>

              <div className="flex items-center gap-3 w-full max-w-xs">
                {!isRunning ? (
                  <button
                    onClick={handleStartTimer}
                    style={{ background: currentTheme.primaryGradient }}
                    className="flex-1 py-3 rounded-2xl text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>开始{phase === 'focus' ? '专注' : '休息'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePauseTimer}
                    className="flex-1 py-3 rounded-2xl bg-amber-400 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                  >
                    <Pause className="w-4 h-4 fill-white" />
                    <span>暂停 (触发TA询问)</span>
                  </button>
                )}

                <button
                  onClick={handleStopTimer}
                  className="px-4 py-3 rounded-2xl bg-white/90 border border-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center gap-1 hover:text-rose-500 cursor-pointer"
                  title="结束并重置当前计时"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>结束</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 板块 2：任务管理 ==================== */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 p-1 bg-white/60 backdrop-blur-xl border border-white rounded-2xl">
                <button
                  onClick={() => setTaskFilter('daily')}
                  className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    taskFilter === 'daily'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-400'
                  }`}
                >
                  📅 每日计划
                </button>
                <button
                  onClick={() => setTaskFilter('temp')}
                  className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    taskFilter === 'temp'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-400'
                  }`}
                >
                  📌 临时任务
                </button>
              </div>

              <button
                onClick={openCreateTask}
                style={{ background: currentTheme.primaryGradient }}
                className="px-3.5 py-2 rounded-2xl text-white text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建任务</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {tasks
                .filter((t) => t.category === taskFilter)
                .map((task) => (
                  <div
                    key={task.id}
                    style={{
                      background: task.bgImageUrl
                        ? `linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)), url(${task.bgImageUrl}) center / cover no-repeat`
                        : currentTheme.cardBg,
                      borderRadius: currentTheme.cardRadius,
                    }}
                    className="backdrop-blur-xl border border-white/90 p-4 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold truncate">{task.title}</span>
                        {task.isDoneToday && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                            ✓ 今日已打卡
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] opacity-65">
                        <span>🍅 专注 {task.focusMinutes} 分钟</span>
                        <span>·</span>
                        <span>☕ 休息 {task.restMinutes} 分钟</span>
                        <span>·</span>
                        <span>累计完成 {task.completedCount} 次</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openEditTask(task)}
                        className="p-1.5 rounded-xl bg-white/80 text-slate-400 hover:text-sky-500 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTasks((prev) => prev.filter((i) => i.id !== task.id))}
                        className="p-1.5 rounded-xl bg-white/80 text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSelectTaskToFocus(task)}
                        style={{ background: currentTheme.primaryGradient }}
                        className="px-3 py-1.5 rounded-xl text-white text-[11px] font-bold cursor-pointer shadow-2xs"
                      >
                        去专注
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ==================== 板块 3：升级版陪伴温室（角色专属花盆+手动浇水+标本图鉴） + 角色专注排行榜 ==================== */}
        {activeTab === 'rank' && (
          <div className="space-y-3">
            {/* 升级版陪伴温室卡片 */}
            <div
              style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
              className="backdrop-blur-xl border border-white/90 p-4 space-y-3 shadow-2xs"
            >
              {/* 顶部：标题 + 切换角色专属花盆 + 标本图鉴按钮 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sprout className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-extrabold">陪伴温室 · 专属花盆</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowSpecimenModal(true)}
                    className="px-2.5 py-1 rounded-full bg-pink-50 text-pink-500 border border-pink-100 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>标本图鉴 ({greenhouse.specimens.length})</span>
                  </button>
                </div>
              </div>

              {/* 角色专属花盆切换栏 + 当前露水余量 */}
              <div className="flex items-center justify-between bg-white/70 px-3 py-2 rounded-2xl border border-white text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-600">共同培育人：</span>
                  <select
                    value={companionCharId}
                    onChange={(e) => setCompanionCharId(e.target.value)}
                    className="font-extrabold text-sky-600 bg-transparent outline-none cursor-pointer"
                  >
                    {contacts.length === 0 ? (
                      <option value="default_char">默认同桌</option>
                    ) : (
                      contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}的花盆
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sky-500 flex items-center gap-0.5">
                    <Droplets className="w-3.5 h-3.5" />
                    <span>露水：{greenhouse.dewDrops} 滴</span>
                  </span>
                </div>
              </div>

              {/* 花盆中央展示区 */}
              <div className="bg-gradient-to-r from-sky-50/70 via-white/85 to-pink-50/70 p-3.5 rounded-2xl border border-white space-y-2.5">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-white shadow-2xs flex items-center justify-center text-4xl shrink-0 transition-transform duration-300 ${
                      isWateringAnim ? 'scale-115' : ''
                    }`}
                  >
                    {currentStageInfo.icon}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#2C4A5C]">
                        品种：{currentSpecies.name}
                      </span>
                      <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">
                        {currentStageInfo.stageName}
                      </span>
                    </div>

                    {/* 成长进度条 */}
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(100, (currentPot.growthMinutes / MAX_PLANT_GROWTH) * 100)}%`,
                          background: currentTheme.primaryGradient,
                        }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{currentSpecies.desc}</span>
                      <span className="font-mono font-bold text-sky-600 shrink-0 ml-1">
                        {currentPot.growthMinutes}/{MAX_PLANT_GROWTH}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* 角色浇水互动气泡语 */}
                <div className="bg-white/90 rounded-xl px-3 py-2 text-[11px] text-slate-600 border border-sky-100/80 leading-relaxed">
                  💬 {currentPot.lastWaterQuote}
                </div>

                {/* 手动浇水按钮 / 盛开后采摘收入图鉴按钮 */}
                {!currentStageInfo.isBloomed ? (
                  <button
                    onClick={handleWaterPlant}
                    style={{ background: currentTheme.primaryGradient }}
                    className="w-full py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 transition-transform cursor-pointer"
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    <span>消耗 1 滴露水手动浇灌 (+30m 成长值)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleHarvestAndNewSeed}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-pink-400 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 transition-transform cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✨ 花已盛开！采摘收录进标本图鉴 & 领新花种</span>
                  </button>
                )}
              </div>
            </div>

            {/* 角色今日专注排行榜 */}
            <div
              style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
              className="backdrop-blur-xl border border-white/90 p-4 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>今日自习室专注排行</span>
                  </h4>
                  <p className="text-[10px] opacity-60 mt-0.5">
                    点击互动可将当前名次同步至角色记忆
                  </p>
                </div>

                <button
                  onClick={handleRefreshAiRank}
                  disabled={isRefreshingRank}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className={`w-3 h-3 ${isRefreshingRank ? 'animate-spin' : ''}`} />
                  <span>刷新角色状态</span>
                </button>
              </div>

              <div className="space-y-2">
                {combinedRankings.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 ${
                      item.isPlayer
                        ? 'bg-gradient-to-r from-sky-50/90 to-pink-50/90 border-sky-200'
                        : 'bg-white/80 border-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          index === 0
                            ? 'bg-amber-400 text-white'
                            : index === 1
                            ? 'bg-slate-300 text-slate-700'
                            : index === 2
                            ? 'bg-amber-600/70 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold truncate">{item.name}</span>
                          <span className="text-[11px] font-mono font-bold text-pink-500">
                            {item.todayMinutes} 分钟
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {item.statusText}
                        </p>
                      </div>
                    </div>

                    {!item.isPlayer && (
                      <button
                        onClick={() => handleInteractRankChar(item, todayPlayerMinutes)}
                        className="px-2.5 py-1 rounded-full bg-white border border-sky-200 text-sky-600 text-[10px] font-bold shrink-0 cursor-pointer hover:bg-sky-50"
                      >
                        {item.todayMinutes > todayPlayerMinutes ? '🙇 膜拜TA' : '😼 炫耀督促'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 板块 4：数据统计与历史回看 ==================== */}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div
                style={{ backgroundColor: currentTheme.cardBg }}
                className="backdrop-blur-xl border border-white rounded-2xl p-3 text-center space-y-0.5 shadow-2xs"
              >
                <span className="text-[10px] opacity-60 block">今日专注</span>
                <span className="text-base font-extrabold text-sky-500 font-mono">
                  {todayPlayerMinutes}m
                </span>
              </div>
              <div
                style={{ backgroundColor: currentTheme.cardBg }}
                className="backdrop-blur-xl border border-white rounded-2xl p-3 text-center space-y-0.5 shadow-2xs"
              >
                <span className="text-[10px] opacity-60 block">累计总时长</span>
                <span className="text-base font-extrabold text-pink-500 font-mono">
                  {totalFocusMinutes}m
                </span>
              </div>
              <div
                style={{ backgroundColor: currentTheme.cardBg }}
                className="backdrop-blur-xl border border-white rounded-2xl p-3 text-center space-y-0.5 shadow-2xs"
              >
                <span className="text-[10px] opacity-60 block">累计打卡</span>
                <span className="text-base font-extrabold text-emerald-500 font-mono">
                  {uniqueCheckInDays}天
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowShareModal(true)}
              style={{ background: currentTheme.primaryGradient }}
              className="w-full py-2.5 rounded-2xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>将今日专注情况分享给角色（支持多选）</span>
            </button>

            <div
              style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
              className="backdrop-blur-xl border border-white/90 p-4 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  <span>历史专注记录回看</span>
                </span>
                <input
                  type="date"
                  value={selectedDateStr}
                  onChange={(e) => setSelectedDateStr(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono outline-none"
                />
              </div>

              {selectedDayRecords.length === 0 ? (
                <div className="p-6 text-center space-y-1 text-slate-400">
                  <p className="text-xs font-bold">{selectedDateStr} 暂无专注记录</p>
                  <p className="text-[10px]">完成一次专注倒计时后会自动记录在这里哦~</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-2xl bg-white/80 border border-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-[#2C4A5C]">{rec.taskTitle}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {rec.timeStr} · 陪伴角色：{rec.companionCharName || '独立专注'}
                        </p>
                      </div>
                      <span className="font-mono font-extrabold text-pink-500">
                        +{rec.durationMinutes} 分钟
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== 弹窗 0：植物标本图鉴收集册弹窗 ==================== */}
      {showSpecimenModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 max-h-[88%] overflow-y-auto text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-pink-400" />
                <span>植物标本图鉴 ({greenhouse.specimens.length})</span>
              </h3>
              <button
                onClick={() => setShowSpecimenModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {greenhouse.specimens.length === 0 ? (
              <div className="p-8 text-center space-y-1.5 text-slate-400">
                <p className="text-2xl">🌸</p>
                <p className="text-xs font-bold">还没有收集到植物标本哦~</p>
                <p className="text-[10px]">
                  在温室里把花盆浇灌满 {MAX_PLANT_GROWTH}m 成长值即可采摘收入图鉴！
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {greenhouse.specimens.map((sp) => (
                  <div
                    key={sp.id}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/60 to-pink-50/60 border border-white flex items-center gap-3 shadow-2xs"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                      {sp.bloomIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#2C4A5C]">
                          {sp.speciesName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {sp.harvestDate}
                        </span>
                      </div>
                      <span className="text-[10px] text-pink-500 font-bold block mt-0.5">
                        共同培育人：{sp.charName}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        {sp.commemorativeQuote}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 弹窗 1：自定义专注与休息时长 ==================== */}
      {showDurationModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 text-slate-700">
            <h3 className="text-sm font-extrabold">自定义计时器时长</h3>
            <div className="space-y-2">
              <label className="block text-xs font-bold">
                专注时长 (分钟)
                <input
                  type="number"
                  value={tempFocusInput}
                  onChange={(e) => setTempFocusInput(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold"
                />
              </label>
              <label className="block text-xs font-bold">
                短休息时长 (分钟)
                <input
                  type="number"
                  value={tempRestInput}
                  onChange={(e) => setTempRestInput(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDurationModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const fm = Math.max(1, parseInt(tempFocusInput, 10) || 25);
                  const rm = Math.max(1, parseInt(tempRestInput, 10) || 5);
                  setCustomFocusMin(fm);
                  setCustomRestMin(rm);
                  setIsRunning(false);
                  const duration = (phase === 'focus' ? fm : rm) * 60;
                  setRemainingSeconds(duration);
                  const current = readPomodoroTimer();
                  savePomodoroTimer({
                    ...current,
                    phase,
                    isRunning: false,
                    remainingSeconds: duration,
                    targetEndTime: null,
                    focusMinutes: fm,
                    restMinutes: rm,
                    activeTaskId,
                    companionCharId: companionChar?.id ?? '',
                    companionCharName: companionChar?.name ?? '',
                    sessionId: '',
                  });
                  setShowDurationModal(false);
                }}
                style={{ background: currentTheme.primaryGradient }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                应用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 2：免链接白噪音选择窗 ==================== */}
      {showNoiseModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">专注环境白噪音（内置免链接）</h3>
              <button
                onClick={() => setShowNoiseModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'off', label: '🔇 关闭白噪音' },
                { key: 'wind', label: '🍃 林间微风 (内置)' },
                { key: 'rain', label: '🌧️ 窗外细雨 (内置)' },
                { key: 'deep', label: '🌊 深海低频 (内置)' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleSelectNoise(item.key as NoiseType)}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold border cursor-pointer ${
                    noiseType === item.key
                      ? 'bg-sky-400 text-white border-transparent shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 bg-sky-50/60 p-3 rounded-2xl border border-sky-100">
              <span className="text-[11px] font-bold block">自定义音频直链（选填）</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="粘贴 MP3 音频 URL..."
                  value={customAudioUrl}
                  onChange={(e) => setCustomAudioUrl(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
                />
                <button
                  onClick={() => handleSelectNoise('custom')}
                  className="px-3 py-1.5 rounded-xl bg-sky-400 text-white text-[11px] font-bold cursor-pointer"
                >
                  播放
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 3：新建 / 编辑任务弹窗 ==================== */}
      {showTaskModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3 text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">
                {editingTaskId ? '编辑任务' : '新建专注任务'}
              </h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="任务名称（如：背单词、画画、写代码）"
              value={taskTitleInput}
              onChange={(e) => setTaskTitleInput(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTaskCategoryInput('daily')}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  taskCategoryInput === 'daily'
                    ? 'bg-sky-400 text-white border-transparent'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                📅 每日固定计划
              </button>
              <button
                type="button"
                onClick={() => setTaskCategoryInput('temp')}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  taskCategoryInput === 'temp'
                    ? 'bg-pink-400 text-white border-transparent'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                📌 临时任务
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-bold">
                专注分钟
                <input
                  type="number"
                  value={taskFocusInput}
                  onChange={(e) => setTaskFocusInput(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono"
                />
              </label>
              <label className="text-[11px] font-bold">
                休息分钟
                <input
                  type="number"
                  value={taskRestInput}
                  onChange={(e) => setTaskRestInput(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono"
                />
              </label>
            </div>

            <div className="space-y-1.5 bg-sky-50/50 p-3 rounded-2xl border border-sky-100">
              <span className="text-[11px] font-bold block">任务卡片专属背景图片（选填）</span>
              <input
                type="text"
                placeholder="粘贴背景图 URL..."
                value={taskBgUrlInput}
                onChange={(e) => setTaskBgUrlInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-sky-100 text-sky-500 text-[11px] font-bold cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>本地上传任务背景图</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLocalImageUpload(e, (b64) => setTaskBgUrlInput(b64))}
                />
              </label>
            </div>

            <button
              onClick={handleSaveTask}
              style={{ background: currentTheme.primaryGradient }}
              className="w-full py-2.5 rounded-2xl text-white text-xs font-bold cursor-pointer"
            >
              保存任务
            </button>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 4：多选角色分享今日专注战绩 ==================== */}
      {showShareModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 text-slate-700">
            <h3 className="text-sm font-extrabold">分享今日专注成果给角色</h3>
            <p className="text-xs text-slate-500">
              今日已累计专注 <strong>{todayPlayerMinutes} 分钟</strong>，勾选想要分享的角色（支持多选）：
            </p>
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => {
                const checked = shareCharIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setShareCharIds((prev) =>
                        checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      checked
                        ? 'bg-pink-400 text-white border-transparent'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {checked ? '✓ ' : ''}{c.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmShareStats}
                style={{ background: currentTheme.primaryGradient }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                确认分享
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 5：右上角美化预设 + 表盘/页面壁纸 + 数据导入导出 ==================== */}
      {showTopMenu && (
        <div className="absolute inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 max-h-[92%] overflow-y-auto text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">番茄钟 · 美化与数据中心</h3>
              <button
                onClick={() => setShowTopMenu(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setMenuTab('theme')}
                className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  menuTab === 'theme' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>页面与卡片美化</span>
              </button>
              <button
                onClick={() => setMenuTab('data')}
                className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  menuTab === 'data' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>数据导入/导出</span>
              </button>
            </div>

            {menuTab === 'theme' && (
              <div className="space-y-3 text-xs">
                <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">美化预设切换</span>
                    {activePresetId !== 'default' && (
                      <button
                        onClick={() => handleDeletePreset(activePresetId)}
                        className="text-[10px] text-rose-500 font-bold cursor-pointer"
                      >
                        删除此预设
                      </button>
                    )}
                  </div>
                  <select
                    value={activePresetId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-sky-200 text-xs font-bold outline-none"
                  >
                    {themePresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="新预设名称（如：森系、黑银）"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
                    />
                    <button
                      onClick={handleSaveAsNewPreset}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-400 text-white text-[11px] font-bold cursor-pointer"
                    >
                      存为预设
                    </button>
                  </div>
                </div>

                <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-3 space-y-2">
                  <span className="font-bold block">页面壁纸 & 计时器卡片背景图</span>
                  <input
                    type="text"
                    placeholder="页面全局壁纸 URL..."
                    value={currentTheme.wallpaperUrl}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, wallpaperUrl: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-pink-200 text-pink-500 text-[11px] font-bold cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>本地上传全局壁纸</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleLocalImageUpload(e, (b64) =>
                          setCurrentTheme({ ...currentTheme, wallpaperUrl: b64 })
                        )
                      }
                    />
                  </label>

                  <input
                    type="text"
                    placeholder="计时器表盘卡片背景图 URL..."
                    value={currentTheme.timerCardBgUrl}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, timerCardBgUrl: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] mt-1"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-sky-200 text-sky-500 text-[11px] font-bold cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>本地上传表盘卡片背景</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleLocalImageUpload(e, (b64) =>
                          setCurrentTheme({ ...currentTheme, timerCardBgUrl: b64 })
                        )
                      }
                    />
                  </label>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-2">
                  <span className="font-bold block">配色参数（可参照原值修改）</span>
                  <input
                    type="text"
                    value={currentTheme.bgGradient}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, bgGradient: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-mono"
                  />
                  <input
                    type="text"
                    value={currentTheme.primaryGradient}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, primaryGradient: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-mono"
                  />
                  <button
                    onClick={handleUpdateCurrentPreset}
                    style={{ background: currentTheme.primaryGradient }}
                    className="w-full py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>保存修改到当前预设</span>
                  </button>
                </div>
              </div>
            )}

            {menuTab === 'data' && (
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={handleExportPomo}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>导出数据</span>
                </button>
                <label className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 text-xs font-bold text-slate-600 cursor-pointer">
                  <Upload className="w-4 h-4 text-indigo-400" />
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
                          if (Array.isArray(data.tasks)) setTasks(data.tasks);
                          if (Array.isArray(data.records)) setRecords(data.records);
                          if (data.greenhouse) setGreenhouse(data.greenhouse);
                          if (Array.isArray(data.rankList)) setRankList(data.rankList);
                          if (Array.isArray(data.themePresets)) setThemePresets(data.themePresets);
                          setShowTopMenu(false);
                        } catch {
                          alert('导入文件格式有误');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
                <button
                  onClick={() => {
                    if (window.confirm('确定清空所有番茄钟任务与专注统计记录吗？')) {
                      setTasks([]);
                      setRecords([]);
                      setShowTopMenu(false);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-rose-50 text-xs font-bold text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>清除数据</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};