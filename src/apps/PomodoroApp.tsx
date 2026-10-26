import { PottedPlant, FlowerShelves } from '../components/GreenhousePlants';
import { FloralGardenBackdrop } from '../components/FloralGardenBackdrop';
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
import { showYyError } from '../components/ErrorDialog';
import { readAlipayContacts, AlipayContact } from '../utils/alipayData';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { compressImage } from '../utils/imageFile';
import {
  DEW_MINUTES,
  processPomodoroDeadline,
  readPomodoroTimer,
  savePomodoroTimer,
} from '../utils/pomodoroRuntime';
import {
  dropsToNextStage,
  getPlantStageIndex,
  PLANT_SPECIES_LIST,
  PlantSpecies,
  readPotDrops,
  TOTAL_GROWTH_DROPS,
} from '../utils/plantData';
import { requestConfiguredAiText } from '../utils/aiApi';
import { readCharacterBrief } from '../utils/coupleSpaceData';
import { upsertContextNote } from '../utils/chatNotes';
import { generateFocusRank } from '../utils/pomodoroAi';

interface PomodoroAppProps {
  onBack: () => void;
}

type PomoTab = 'timer' | 'tasks' | 'rank' | 'stats';
type TimerPhase = 'focus' | 'rest';
type NoiseTrack = { id: string; name: string; url: string; builtin?: boolean };
const BUILTIN_RAIN_TRACK: NoiseTrack = {
  id: 'builtin-rain',
  name: '🌧️ 雨声',
  url: 'http://music.163.com/song/media/outer/url?id=5023467.mp3',
  builtin: true,
};
const isNoiseTrackList = (value: unknown): value is NoiseTrack[] =>
  Array.isArray(value) &&
  value.every((item) => !!item && typeof item === 'object' &&
    typeof (item as NoiseTrack).id === 'string' &&
    typeof (item as NoiseTrack).name === 'string' &&
    typeof (item as NoiseTrack).url === 'string');

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
  dateStr?: string;
}

// 每个角色专属的花盆进度
export interface CharacterPot {
  charId: string;
  speciesId: string; // 内置品种 id，或 customPlants 里的自定义植物 id
  growthDrops: number; // 这盆花已浇灌的露水滴数（满 TOTAL_GROWTH_DROPS 滴即可开花采摘）
  wateredDate?: string; // 最近一次浇水的日期（YYYY-MM-DD）
  wateredToday?: number; // 那一天浇了几次水，用来让角色知道你今天照顾过它
  lastWaterQuote: string; // 最近一次角色（AI 生成）说的话，为空则不显示
  nickname?: string; // 玩家给这盆植物起的名字
}

// 玩家自己上传的植物
export interface CustomPlant {
  id: string;
  name: string;
  imageUrl: string;
  desc: string;
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
  imageUrl?: string;
  nickname?: string;
}

// 温室总数据结构
export interface GreenhouseState {
  dewDrops: number; // 玩家当前拥有的待浇灌露水数量
  dewProgress?: number; // 还没凑够 1 滴露水的专注分钟数
  pots: Record<string, CharacterPot>; // key 为 charId，每个角色独立一盆花
  specimens: HarvestedSpecimen[]; // 已采摘收集的标本图鉴列表
  customPlants?: CustomPlant[];
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
  textColor: '#7A8B9A',
  cardRadius: '24px',
  customCss: '/* 可在此自定义番茄钟附加样式 */',
};

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
  noiseTracks: 'yyphone:pomodoro-noise-tracks',
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
    (typeof pot.growthDrops === 'number' || typeof pot.growthMinutes === 'number') &&
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
  const [currentTheme, setCurrentTheme] = useState<PomoThemePreset>(() => {
    const stored = readStoredValue(POMODORO_STORAGE_KEYS.currentTheme, DEFAULT_POMO_PRESET, isThemePreset);
    // 旧版默认的深色文字改成柔和色，用户自定义过的颜色保持不变
    return stored.textColor === '#3A5064' ? { ...stored, textColor: DEFAULT_POMO_PRESET.textColor } : stored;
  });
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

  // companionBubble 只放系统提示；角色的话（charLine）只来自 AI 生成
  const [companionBubble, setCompanionBubble] = useState<string>('');
  const [charLine, setCharLine] = useState<string>('');
  const [chatToCharInput, setChatToCharInput] = useState<string>('');
  const [isCharReplying, setIsCharReplying] = useState<boolean>(false);

  // ==================== 4. 内置免链接白噪音合成器 ====================
  const [noiseTracks, setNoiseTracks] = useState<NoiseTrack[]>(() => [
    BUILTIN_RAIN_TRACK,
    ...readStoredValue<NoiseTrack[]>(POMODORO_STORAGE_KEYS.noiseTracks, [], isNoiseTrackList),
  ]);
  const [noiseIndex, setNoiseIndex] = useState(-1);
  const noiseTracksRef = useRef<NoiseTrack[]>(noiseTracks);
  const noiseIndexRef = useRef(-1);
  const [customAudioUrl, setCustomAudioUrl] = useState<string>('');
  const [customAudioName, setCustomAudioName] = useState<string>('');
  const [showNoiseModal, setShowNoiseModal] = useState(false);
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
      completedCount: 0,
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

  const [greenhouse, setGreenhouse] = useState<GreenhouseState>(() => {
    const stored = readStoredValue(
      POMODORO_STORAGE_KEYS.greenhouse,
      { dewDrops: 0, pots: {}, specimens: [], customPlants: [] } as GreenhouseState,
      isGreenhouseState
    );
    // 旧版本按“分钟”记成长（每 30 分钟 = 1 滴），统一换算成露水滴数；旧版预制台词和标本文案一并清理
    return {
      ...stored,
      pots: Object.fromEntries(
        Object.entries(stored.pots).map(([key, pot]) => {
          const { growthMinutes: _legacy, ...rest } = pot as CharacterPot & { growthMinutes?: number };
          return [key, { ...rest, growthDrops: readPotDrops(pot as unknown as Record<string, unknown>), lastWaterQuote: '' }];
        })
      ),
      specimens: stored.specimens.map((sp) => ({
        ...sp,
        commemorativeQuote: /分钟养成/.test(sp.commemorativeQuote)
          ? `和「${sp.charName}」一起浇灌了 ${TOTAL_GROWTH_DROPS} 滴露水养成。`
          : sp.commemorativeQuote,
      })),
    };
  });
  const greenhouseRef = useRef(greenhouse);
  greenhouseRef.current = greenhouse;

  const [showSpecimenModal, setShowSpecimenModal] = useState(false);
  const [isWateringAnim, setIsWateringAnim] = useState(false);

  // Character activity is fictional; only the player's timer records are measured.
  const [rankList, setRankList] = useState<CharRankItem[]>(() => {
    const initialRankList: CharRankItem[] = contacts.map((c) => ({
      id: `rank-${c.id}`,
      charId: c.id,
      name: c.name,
      todayMinutes: 0,
      statusText: '',
    }));
    const stored = readStoredValue(POMODORO_STORAGE_KEYS.rankList, initialRankList, isRankList);
    if (readStoredValue('yyphone:pomodoro-canned-cleared', false, (v): v is boolean => typeof v === 'boolean')) return stored;
    writeStoredValue('yyphone:pomodoro-canned-cleared', true);
    return stored.map((item) => ({ ...item, todayMinutes: 0, statusText: '' }));
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

  // 获取当前陪伴角色对应的专属花盆（未种植时只是内存里的空盆，玩家操作后才会落盘）
  const activePotKey = companionChar?.id || 'default_char';
  const customPlants = greenhouse.customPlants ?? [];
  const allSpecies: PlantSpecies[] = [
    ...PLANT_SPECIES_LIST,
    ...customPlants.map((plant) => ({
      id: plant.id,
      name: plant.name,
      bloomIcon: '🌼',
      desc: plant.desc,
      imageUrl: plant.imageUrl,
      isCustom: true,
    })),
  ];
  const currentPot: CharacterPot = greenhouse.pots[activePotKey] || {
    charId: activePotKey,
    speciesId: PLANT_SPECIES_LIST[0].id,
    growthDrops: 0,
    lastWaterQuote: '',
  };
  const currentSpecies =
    allSpecies.find((s) => s.id === currentPot.speciesId) || PLANT_SPECIES_LIST[0];
  const currentPlantName = currentPot.nickname?.trim() || currentSpecies.name;

  const [showPlantModal, setShowPlantModal] = useState(false);
  const [plantNameDraft, setPlantNameDraft] = useState('');
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantImage, setNewPlantImage] = useState('');
  const [isPlantAiBusy, setIsPlantAiBusy] = useState(false);
  useEffect(() => {
    setPlantNameDraft('');
  }, [activePotKey]);

  // 让角色按人设说一句话；失败时返回空串，不编造台词
  const requestCharLine = async (charId: string, situation: string): Promise<string> => {
    if (!charId || charId === 'default_char') return '';
    try {
      const brief = readCharacterBrief(charId);
      const system = [
        `你正在扮演「${brief.name}」，此刻在和玩家一起用番茄钟自习、一起养一盆植物。`,
        `角色设定：${brief.persona || '保持自然、符合上下文。'}`,
        brief.recentChat ? `你们最近的聊天（仅供把握语气）：\n${brief.recentChat}` : '',
        '用第一人称、符合人设的口吻说一两句话，像真人聊天，口语化、少用标点、不用套话、不要旁白和动作描写、不要用引号。只输出这句话本身。',
      ].filter(Boolean).join('\n');
      const text = await requestConfiguredAiText(system, situation);
      return text.trim().replace(/^["“「]|["”」]$/g, '').slice(0, 120);
    } catch (error) {
      console.error('Could not generate Pomodoro character line.', error);
      setNoticeBanner('角色暂时没有回应，请检查 AI 接口设置后再试。');
      return '';
    }
  };

  // 把角色在陪伴时说的话记进和 TA 的微信聊天上下文，让 TA 记得自己在这里说过什么
  const recordCompanionNote = (charId: string, content: string, detail: string) => {
    if (!charId || charId === 'default_char') return;
    try {
      upsertContextNote(charId, {
        id: `pomodoro-note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: 'pomodoro',
        title: '番茄钟陪伴',
        content,
        detail,
      });
    } catch (error) {
      console.warn('Could not record Pomodoro companion line in chat context.', error);
    }
  };

  // 计算当前花盆的 5 个成长阶段（按浇灌的露水滴数）
  const getPotStageInfo = (drops: number, species: PlantSpecies) => {
    const stage = getPlantStageIndex(drops);
    if (stage === 0) return { icon: '🌰', stageName: '1/5 · 沉睡花种', isBloomed: false, stage };
    if (stage === 1) return { icon: '🌱', stageName: '2/5 · 破土嫩芽', isBloomed: false, stage };
    if (stage === 2) return { icon: '🌿', stageName: '3/5 · 青翠枝叶', isBloomed: false, stage };
    if (stage === 3) return { icon: '💐', stageName: '4/5 · 含苞待放', isBloomed: false, stage };
    return { icon: species.bloomIcon, stageName: '5/5 · 已盛开', isBloomed: true, stage };
  };

  const currentStageInfo = getPotStageInfo(currentPot.growthDrops, currentSpecies);

  const updateActivePot = (patch: Partial<CharacterPot>) => {
    setGreenhouse((prev) => ({
      ...prev,
      pots: {
        ...prev.pots,
        [activePotKey]: { ...(prev.pots[activePotKey] || currentPot), ...patch },
      },
    }));
  };

  const handleSelectSpecies = (speciesId: string) => {
    const growing = currentPot.growthDrops > 0 && !currentStageInfo.isBloomed;
    if (growing && !window.confirm('换品种会让当前这盆植物的成长从头开始，确定吗？')) return;
    updateActivePot({ speciesId, growthDrops: growing ? 0 : currentPot.growthDrops, lastWaterQuote: '' });
    setShowPlantModal(false);
  };

  const handleAddCustomPlant = () => {
    const name = newPlantName.trim();
    if (!name || !newPlantImage) {
      setNoticeBanner('请先填写植物名字并上传一张图片。');
      return;
    }
    const plant: CustomPlant = {
      id: `custom-${Date.now()}`,
      name,
      imageUrl: newPlantImage,
      desc: '玩家自己带来的植物',
    };
    setGreenhouse((prev) => ({ ...prev, customPlants: [...(prev.customPlants ?? []), plant] }));
    setNewPlantName('');
    setNewPlantImage('');
    setNoticeBanner(`已添加「${name}」，可以在下方选为这盆植物。`);
  };

  const handleDeleteCustomPlant = (plantId: string) => {
    if (Object.values(greenhouse.pots).some((pot) => pot.speciesId === plantId)) {
      setNoticeBanner('这个植物正在被某个花盆使用，先换成别的品种再删除。');
      return;
    }
    setGreenhouse((prev) => ({
      ...prev,
      customPlants: (prev.customPlants ?? []).filter((plant) => plant.id !== plantId),
    }));
  };

  const handleSavePlantName = () => {
    updateActivePot({ nickname: plantNameDraft.trim() });
    setNoticeBanner(plantNameDraft.trim() ? `这盆植物现在叫「${plantNameDraft.trim()}」。` : '已清除植物昵称。');
  };

  // ==================== 7. 手动浇水 & 开花采摘收录图鉴逻辑 ====================
  const handleWaterPlant = async () => {
    if (greenhouse.dewDrops <= 0) {
      setNoticeBanner(`露水不够啦，每累计专注 ${DEW_MINUTES} 分钟可获得 1 滴露水。`);
      return;
    }
    if (currentStageInfo.isBloomed) {
      setNoticeBanner(`「${currentPlantName}」已经盛开，可以采摘收入标本图鉴了。`);
      return;
    }

    setIsWateringAnim(true);
    setTimeout(() => setIsWateringAnim(false), 600);

    const nextDrops = currentPot.growthDrops + 1;
    const potKey = activePotKey;
    const basePot = currentPot;
    const nextStage = getPotStageInfo(nextDrops, currentSpecies);
    const stageUp = nextStage.stage > currentStageInfo.stage;
    const today = todayDateStr();
    const wateredToday = basePot.wateredDate === today ? (basePot.wateredToday ?? 0) + 1 : 1;

    setGreenhouse((prev) => ({
      ...prev,
      dewDrops: prev.dewDrops - 1,
      pots: {
        ...prev.pots,
        [potKey]: { ...basePot, growthDrops: nextDrops, wateredDate: today, wateredToday },
      },
    }));

    // 平时浇水不调用 AI（省额度）；只有长到新的成长阶段时，角色才会说一句话。
    if (!stageUp) {
      setNoticeBanner(`浇水成功：${nextDrops}/${TOTAL_GROWTH_DROPS} 滴，离下一阶段还差 ${dropsToNextStage(nextDrops)} 滴。`);
      return;
    }

    const stageText = nextStage.stageName.replace(/^\d\/\d · /, '');
    const situation = `你们刚给一盆叫「${currentPlantName}」的植物浇了水，它长大了一步，现在是「${stageText}」（累计 ${nextDrops}/${TOTAL_GROWTH_DROPS} 滴）。你对玩家说一句话。`;
    setIsPlantAiBusy(true);
    const line = await requestCharLine(potKey, situation);
    setIsPlantAiBusy(false);
    if (line) {
      setGreenhouse((prev) => prev.pots[potKey]
        ? { ...prev, pots: { ...prev.pots, [potKey]: { ...prev.pots[potKey], lastWaterQuote: line } } }
        : prev);
      recordCompanionNote(
        potKey,
        `「${line}」`,
        `你们一起给盆栽「${currentPlantName}」浇水，它长到了「${stageText}」（${nextDrops}/${TOTAL_GROWTH_DROPS} 滴）。你当时对玩家说：「${line}」`
      );
    }
  };

  // 采摘已盛开的花朵收入标本图鉴；花盆清空，由玩家自己重新选择下一株
  const handleHarvestAndNewSeed = () => {
    if (!currentStageInfo.isBloomed) return;
    const charName = companionChar?.name || '同桌';

    const newSpecimen: HarvestedSpecimen = {
      id: `spec-${Date.now()}`,
      charId: activePotKey,
      charName,
      speciesId: currentSpecies.id,
      speciesName: currentSpecies.name,
      bloomIcon: currentSpecies.bloomIcon,
      harvestDate: todayDateStr(),
      commemorativeQuote: `和「${charName}」一起浇灌了 ${TOTAL_GROWTH_DROPS} 滴露水养成。`,
      imageUrl: currentSpecies.imageUrl,
      nickname: currentPot.nickname,
    };

    setGreenhouse((prev) => ({
      ...prev,
      specimens: [newSpecimen, ...prev.specimens],
      pots: {
        ...prev.pots,
        [activePotKey]: {
          charId: activePotKey,
          speciesId: currentSpecies.id,
          growthDrops: 0,
          lastWaterQuote: '',
          nickname: currentPot.nickname,
        },
      },
    }));

    setNoticeBanner(`已将「${currentPlantName}」收入标本图鉴，花盆已重新种下一颗种子，也可以在「选择植物」里换品种。`);
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
        const latestGreenhouse = readStoredValue(
          POMODORO_STORAGE_KEYS.greenhouse,
          greenhouseRef.current,
          isGreenhouseState
        );
        const gained = latestGreenhouse.dewDrops - greenhouseRef.current.dewDrops;
        setCompanionBubble(
          gained > 0
            ? `专注完成，获得 ${gained} 滴露水。`
            : `专注完成，再累计专注 ${DEW_MINUTES - (latestGreenhouse.dewProgress ?? 0)} 分钟可得 1 滴露水。`
        );
        setRecords(readStoredValue(POMODORO_STORAGE_KEYS.records, [] as PomoSessionRecord[], isRecordList));
        setTasks(readStoredValue(POMODORO_STORAGE_KEYS.tasks, [] as PomoTask[], isTaskList));
        setGreenhouse(latestGreenhouse);
      } else if (previousPhase === 'rest' && detail.snapshot.phase === 'focus') {
        setCompanionBubble('休息结束，可以开始下一轮专注。');
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
    if (eventType === 'user_poke') {
      const charId = companionChar?.id ?? '';
      if (!charId) {
        setCompanionBubble('还没有绑定陪伴角色。');
        return;
      }
      setIsCharReplying(true);
      const focusing = isRunning && phase === 'focus';
      const situation = `${focusing ? '玩家正在专注计时中，' : phase === 'rest' && isRunning ? '玩家正在休息时间，' : '玩家目前没在计时，'}偷偷对你说：「${userText}」。请回应他。`;
      void requestCharLine(charId, situation).then((line) => {
        if (line) {
          setCharLine(line);
          setCompanionBubble('');
          recordCompanionNote(
            charId,
            `「${line}」`,
            `${focusing ? '玩家正在专注计时，' : phase === 'rest' && isRunning ? '玩家正在休息，' : ''}悄悄对你说：「${userText}」，你回应：「${line}」`
          );
        }
        setIsCharReplying(false);
      });
      return;
    }
    const notes = {
      pause: '计时已暂停。',
      stop: '计时已结束并重置。',
      complete_focus: '专注完成。',
      start_rest: '休息时间开始。',
    } as const;
    setCompanionBubble(notes[eventType]);
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
      setCompanionBubble('专注已开始。');
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

  // ==================== 9. 白噪音：内置雨声 + 自定义音频列表，支持轮播 ====================
  const stopAllNoise = () => {
    if (customAudioRef.current) {
      customAudioRef.current.pause();
    }
  };

  const playTrackAt = (index: number) => {
    const list = noiseTracksRef.current;
    if (list.length === 0) return;
    const safeIndex = ((index % list.length) + list.length) % list.length;
    if (!customAudioRef.current) {
      const audio = new Audio();
      // 只有一首时循环本曲；多首时播完自动切到下一首
      audio.onended = () => {
        const tracks = noiseTracksRef.current;
        if (tracks.length <= 1) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          playTrackAt(noiseIndexRef.current + 1);
        }
      };
      audio.onerror = () => {
        const tracks = noiseTracksRef.current;
        if (tracks.length > 1 && noiseIndexRef.current >= 0) {
          setNoticeBanner('这首白噪音加载失败，已跳到下一首。');
          playTrackAt(noiseIndexRef.current + 1);
        } else {
          setNoticeBanner('白噪音加载失败，请检查链接。');
          setNoiseIndex(-1);
        }
      };
      customAudioRef.current = audio;
    }
    noiseIndexRef.current = safeIndex;
    setNoiseIndex(safeIndex);
    customAudioRef.current.src = list[safeIndex].url;
    customAudioRef.current.play().catch(() => {});
  };

  const handleStopNoise = () => {
    stopAllNoise();
    noiseIndexRef.current = -1;
    setNoiseIndex(-1);
  };

  const handleAddNoiseTrack = () => {
    const url = customAudioUrl.trim();
    if (!url) return;
    const track: NoiseTrack = {
      id: `noise-${Date.now()}`,
      name: customAudioName.trim() || `自定义音频 ${noiseTracks.length}`,
      url,
    };
    setNoiseTracks((prev) => [...prev, track]);
    setCustomAudioUrl('');
    setCustomAudioName('');
  };

  const handleDeleteNoiseTrack = (trackId: string) => {
    const removeIndex = noiseTracks.findIndex((track) => track.id === trackId);
    if (removeIndex <= 0) return;
    if (removeIndex === noiseIndex) {
      handleStopNoise();
    } else if (removeIndex < noiseIndex) {
      noiseIndexRef.current = noiseIndex - 1;
      setNoiseIndex(noiseIndex - 1);
    }
    setNoiseTracks((prev) => prev.filter((track) => track.id !== trackId));
  };

  useEffect(() => {
    noiseTracksRef.current = noiseTracks;
    writeStoredValue(POMODORO_STORAGE_KEYS.noiseTracks, noiseTracks.filter((track) => !track.builtin));
  }, [noiseTracks]);

  useEffect(() => {
    return () => {
      if (customAudioRef.current) {
        customAudioRef.current.onended = null;
        customAudioRef.current.onerror = null;
        customAudioRef.current.pause();
      }
    };
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
    setCompanionBubble(`已切换到任务「${task.title}」。`);
  };

  // ==================== 11. 角色专注排行榜生成与互动 ====================
  const todayPlayerMinutes = records
    .filter((r) => r.dateStr === todayDateStr())
    .reduce((sum, r) => sum + r.durationMinutes, 0);

  const combinedRankings: CharRankItem[] = [
    ...contacts.map((contact) => {
      const item = rankList.find((item) => item.charId === contact.id && item.dateStr === todayDateStr());
      return item ?? { id: `rank-${contact.id}`, charId: contact.id, name: contact.name,
        todayMinutes: 0, statusText: '尚未生成今日专注状态' };
    }),
    {
      id: 'rank-player',
      name: '我 (玩家)',
      isPlayer: true,
      todayMinutes: todayPlayerMinutes,
      statusText: `今日已完成 ${records.filter((r) => r.dateStr === todayDateStr()).length} 轮番茄专注`,
    },
  ].sort((a, b) => b.todayMinutes - a.todayMinutes);

  const handleRefreshAiRank = async () => {
    if (isRefreshingRank || contacts.length === 0) return;
    setIsRefreshingRank(true);
    try {
      const generated = await generateFocusRank(contacts);
      if (generated[0]?.dateStr !== todayDateStr()) throw new Error('已过零点，请重新生成今日排行。');
      setRankList(generated);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '生成角色专注排行失败');
    } finally {
      setIsRefreshingRank(false);
    }
  };

  const handleInteractRankChar = (item: CharRankItem, myMinutes: number) => {
    const text = item.todayMinutes > myMinutes
      ? `「${item.name}」今天自己专注了 ${item.todayMinutes} 分钟，比你的 ${myMinutes} 分钟更多。`
      : `你今天专注 ${myMinutes} 分钟，「${item.name}」自己专注 ${item.todayMinutes} 分钟。`;
    setNoticeBanner(text);
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
      showYyError(error instanceof Error ? error.message : '图片压缩失败，请重新选择。', '图片处理失败');
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
      <style>{`
        .pomo-custom-scope .font-extrabold { font-weight: 600; }
        .pomo-custom-scope .font-bold { font-weight: 500; }
        .pomo-custom-scope .text-slate-700, .pomo-custom-scope .text-slate-800 { color: #7d8b99; }
        .pomo-custom-scope .text-slate-600 { color: #8b98a5; }
        .pomo-custom-scope .text-slate-500 { color: #9aa6b2; }
        .pomo-custom-scope .text-slate-400 { color: #b3bcc6; }
        .pomo-custom-scope .text-sky-600, .pomo-custom-scope .text-sky-500 { color: #8fb3d0; }
        .pomo-custom-scope .text-sky-400 { color: #a9c6dc; }
        .pomo-custom-scope .text-pink-500, .pomo-custom-scope .text-pink-400, .pomo-custom-scope .text-rose-500, .pomo-custom-scope .text-rose-400 { color: #d9a5b8; }
        .pomo-custom-scope .text-emerald-600, .pomo-custom-scope .text-emerald-500 { color: #9cc4b0; }
        .pomo-custom-scope .text-amber-400, .pomo-custom-scope .text-indigo-400 { color: #d9c49a; }
        .pomo-custom-scope .bg-sky-400 { background-color: #b5d3ea; }
        .pomo-custom-scope .bg-pink-400 { background-color: #efbfce; }
        .pomo-custom-scope .bg-amber-400, .pomo-custom-scope .bg-amber-600\\/70 { background-color: #ecd9b0; }
      `}</style>

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
            { key: 'rank', label: '温室', icon: Sprout },
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
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-1 space-y-3">
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
                      <span className="text-[9px] bg-pink-50/70 text-pink-400 px-1.5 py-0.2 rounded-full font-bold">
                        陪读中
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
                      setCharLine('');
                      setCompanionBubble('');
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

              <div className="bg-white/70 border border-white rounded-2xl p-3 text-xs leading-relaxed text-slate-600 shadow-2xs">
                {isCharReplying ? (
                  <span className="text-slate-400">正在输入...</span>
                ) : companionBubble ? (
                  <span className="text-slate-400">{companionBubble}</span>
                ) : charLine ? (
                  <span>
                    <span className="text-slate-400">{companionChar?.name || 'TA'}：</span>
                    {charLine}
                  </span>
                ) : (
                  <span className="text-slate-400">和 TA 说句话，TA 会按自己的性格回你。</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatToCharInput}
                  onChange={(e) => setChatToCharInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatToCompanion()}
                  placeholder={
                    isRunning && phase === 'focus'
                      ? '偷偷和 TA 说话...'
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
                      noiseIndex >= 0
                        ? 'bg-sky-100 text-sky-600 border-sky-200'
                        : 'bg-white/80 text-slate-500 border-white'
                    }`}
                  >
                    {noiseIndex >= 0 ? (
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {noiseIndex >= 0 ? (noiseTracks[noiseIndex]?.name ?? '白噪音') : '白噪音'}
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
          <div className="pomo-dream-garden">
            <FloralGardenBackdrop />
            {/* 升级版陪伴温室卡片 */}
            <div
              style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
              className="pomo-greenhouse-card"
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
                    <span>
                      露水：{greenhouse.dewDrops} 滴
                      <span className="ml-1 font-normal text-sky-300">（再专注 {DEW_MINUTES - (greenhouse.dewProgress ?? 0)} 分钟 +1）</span>
                    </span>
                  </span>
                </div>
              </div>

              <div className="pomo-garden-stage">
                <div className="pomo-garden-orbit" aria-hidden="true" />
                <div className="pomo-garden-hero"><PottedPlant icon={currentStageInfo.icon} image={currentSpecies.imageUrl} name={currentPlantName} stage={currentStageInfo.stage} watering={isWateringAnim} /></div>
                <div className="pomo-garden-plant-info"><span className="pomo-growth-stage">{currentStageInfo.stageName}</span><h3>{currentPlantName}</h3><p>{currentSpecies.desc}</p><div className="pomo-garden-progress"><span style={{ width: Math.min(100, currentPot.growthDrops / TOTAL_GROWTH_DROPS * 100) + '%', background: currentTheme.primaryGradient }} /></div><small>{currentPot.growthDrops}/{TOTAL_GROWTH_DROPS} 滴{!currentStageInfo.isBloomed && (' · 距下一阶段 ' + dropsToNextStage(currentPot.growthDrops) + ' 滴')}</small></div>
                <div className="pomo-garden-care">
                <div className="flex items-center gap-2">
                  <input
                    value={plantNameDraft}
                    onChange={(e) => setPlantNameDraft(e.target.value)}
                    placeholder={currentPot.nickname?.trim() ? `现在叫「${currentPot.nickname.trim()}」` : '给它起个名字'}
                    maxLength={12}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200/70 text-[11px] outline-none focus:border-sky-200"
                  />
                  <button
                    onClick={handleSavePlantName}
                    className="px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200/70 text-[11px] text-slate-500 cursor-pointer"
                  >
                    命名
                  </button>
                  <button
                    onClick={() => setShowPlantModal(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200/70 text-[11px] text-slate-500 cursor-pointer"
                  >
                    选择植物
                  </button>
                </div>

                {(currentPot.lastWaterQuote || isPlantAiBusy) && (
                  <div className="bg-white/70 rounded-xl px-3 py-2 text-[11px] text-slate-500 border border-white leading-relaxed">
                    {isPlantAiBusy ? (
                      <span className="text-slate-400">正在输入...</span>
                    ) : (
                      <span>
                        <span className="text-slate-400">{companionChar?.name || 'TA'}：</span>
                        {currentPot.lastWaterQuote}
                      </span>
                    )}
                  </div>
                )}

                {/* 手动浇水按钮 / 盛开后采摘收入图鉴按钮 */}
                {!currentStageInfo.isBloomed ? (
                  <button
                    onClick={handleWaterPlant}
                    style={{ background: currentTheme.primaryGradient }}
                    className="w-full py-2.5 rounded-xl text-white/95 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 transition-transform cursor-pointer"
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    <span>消耗 1 滴露水浇灌 (+1 滴成长)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleHarvestAndNewSeed}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-200 to-pink-200 text-amber-800/70 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 transition-transform cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>已盛开，采摘收入标本图鉴</span>
                  </button>
                )}
                </div>
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
                    角色时长与状态由 AI 按人设、日程编造；玩家时长为真实专注记录
                  </p>
                </div>

                <button
                  onClick={handleRefreshAiRank}
                  disabled={isRefreshingRank}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className={`w-3 h-3 ${isRefreshingRank ? 'animate-spin' : ''}`} />
                  <span>生成角色专注排行</span>
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

      {/* ==================== 弹窗：选择植物 / 添加自定义植物 ==================== */}
      {showPlantModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 max-h-[88%] overflow-y-auto text-slate-600">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">选择植物</h3>
              <button
                onClick={() => setShowPlantModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {allSpecies.map((species) => (
                <div key={species.id} className="relative">
                  <button
                    onClick={() => handleSelectSpecies(species.id)}
                    className={`w-full p-2 rounded-2xl border flex flex-col items-center gap-1 cursor-pointer ${
                      species.id === currentSpecies.id ? 'border-sky-200 bg-sky-50/60' : 'border-slate-100 bg-white/70'
                    }`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-2xl overflow-hidden">
                      {species.imageUrl ? (
                        <img src={species.imageUrl} alt={species.name} className="w-full h-full object-cover" />
                      ) : (
                        species.bloomIcon
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate w-full text-center">{species.name}</span>
                  </button>
                  {species.isCustom && (
                    <button
                      onClick={() => handleDeleteCustomPlant(species.id)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">添加自己的植物（上传图片并取名）</p>
              <div className="flex items-center gap-2">
                <label className="w-12 h-12 rounded-xl bg-white/80 border border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer shrink-0">
                  {newPlantImage ? (
                    <img src={newPlantImage} alt="新植物" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-4 h-4 text-slate-300" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLocalImageUpload(e, setNewPlantImage)}
                  />
                </label>
                <input
                  value={newPlantName}
                  onChange={(e) => setNewPlantName(e.target.value)}
                  placeholder="植物的名字"
                  maxLength={12}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/80 border border-slate-200/70 text-xs outline-none focus:border-sky-200"
                />
                <button
                  onClick={handleAddCustomPlant}
                  style={{ background: currentTheme.primaryGradient }}
                  className="px-3 py-2 rounded-xl text-white/95 text-xs cursor-pointer"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 0：植物标本图鉴收集册弹窗 ==================== */}
      {showSpecimenModal && <FlowerShelves specimens={greenhouse.specimens} onClose={() => setShowSpecimenModal(false)} />}

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
              <h3 className="text-sm font-extrabold">专注环境白噪音</h3>
              <button
                onClick={() => setShowNoiseModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {noiseTracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-2 py-2 px-3 rounded-2xl border ${
                    noiseIndex === index ? 'bg-sky-50/70 border-sky-200' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <button
                    onClick={() => (noiseIndex === index ? handleStopNoise() : playTrackAt(index))}
                    className="flex-1 min-w-0 text-left text-xs font-bold text-slate-600 truncate cursor-pointer"
                  >
                    {noiseIndex === index ? '▶ ' : ''}
                    {track.name}
                  </button>
                  {!track.builtin && (
                    <button
                      onClick={() => handleDeleteNoiseTrack(track.id)}
                      className="text-slate-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => playTrackAt(noiseIndex < 0 ? noiseTracks.length - 1 : noiseIndex - 1)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 cursor-pointer"
              >
                上一首
              </button>
              <button
                onClick={() => (noiseIndex >= 0 ? handleStopNoise() : playTrackAt(0))}
                className="flex-1 py-1.5 rounded-xl bg-sky-100 text-sky-600 text-[11px] font-bold cursor-pointer"
              >
                {noiseIndex >= 0 ? '停止' : '播放'}
              </button>
              <button
                onClick={() => playTrackAt(noiseIndex + 1)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 cursor-pointer"
              >
                下一首
              </button>
            </div>
            <p className="text-[10px] text-slate-400">多首时播完自动轮播下一首，只有一首时循环播放。</p>

            <div className="space-y-1.5 bg-sky-50/60 p-3 rounded-2xl border border-sky-100">
              <span className="text-[11px] font-bold block">添加自定义音频直链</span>
              <input
                type="text"
                placeholder="名称（选填）"
                value={customAudioName}
                onChange={(e) => setCustomAudioName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="粘贴 MP3 音频 URL..."
                  value={customAudioUrl}
                  onChange={(e) => setCustomAudioUrl(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
                />
                <button
                  onClick={handleAddNoiseTrack}
                  className="px-3 py-1.5 rounded-xl bg-sky-400 text-white text-[11px] font-bold cursor-pointer"
                >
                  添加
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
                          showYyError('导入文件格式有误', '导入失败');
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
