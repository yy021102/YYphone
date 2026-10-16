import { readStoredValue, writeStoredValue } from './localStorage';
import { POMODORO_GREENHOUSE_KEY } from './pomodoroRuntime';

export interface PlantSpecies {
  id: string;
  name: string;
  bloomIcon: string;
  desc: string;
  imageUrl?: string;
  isCustom?: boolean;
}

export const PLANT_SPECIES_LIST: PlantSpecies[] = [
  { id: 'sakura', name: '小樱花', bloomIcon: '🌸', desc: '粉白色的樱花' },
  { id: 'sunflower', name: '向日葵', bloomIcon: '🌻', desc: '朝着阳光生长的金色花朵' },
  { id: 'tulip', name: '郁金香', bloomIcon: '🌷', desc: '安静温柔的花' },
  { id: 'rose', name: '玫瑰', bloomIcon: '🌹', desc: '需要耐心浇灌的花' },
  { id: 'clover', name: '四叶草', bloomIcon: '🍀', desc: '小小的幸运草' },
  { id: 'hibiscus', name: '扶桑花', bloomIcon: '🌺', desc: '热烈鲜活的花' },
];

export const PLANT_STAGE_NAMES = ['沉睡花种', '破土嫩芽', '青翠枝叶', '含苞待放', '已经盛开'];

// 成长用“露水滴数”计：种子→嫩芽 10 滴，嫩芽→枝叶 15 滴，枝叶→含苞 20 滴，含苞→盛开 25 滴。
export const STAGE_DROP_COSTS = [10, 15, 20, 25] as const;
export const STAGE_START_DROPS = [0, 10, 25, 45] as const;
export const TOTAL_GROWTH_DROPS = 70;

export const getPlantStageIndex = (drops: number) => {
  if (drops >= TOTAL_GROWTH_DROPS) return 4;
  if (drops >= STAGE_START_DROPS[3]) return 3;
  if (drops >= STAGE_START_DROPS[2]) return 2;
  if (drops >= STAGE_START_DROPS[1]) return 1;
  return 0;
};

/** 距离下一个成长阶段还差几滴；已盛开返回 0。 */
export const dropsToNextStage = (drops: number) => {
  const stage = getPlantStageIndex(drops);
  if (stage >= 4) return 0;
  const index = stage as 0 | 1 | 2 | 3;
  return STAGE_START_DROPS[index] + STAGE_DROP_COSTS[index] - drops;
};

/** 读取花盆已浇的露水滴数；兼容旧版本按“分钟”存的数据（每 30 分钟相当于 1 滴）。 */
export const readPotDrops = (pot: Record<string, unknown>): number => {
  if (typeof pot.growthDrops === 'number') return pot.growthDrops;
  if (typeof pot.growthMinutes === 'number') return Math.round(pot.growthMinutes / 30);
  return 0;
};

const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const SEEN_KEY = 'yyphone:pomodoro-plant-seen';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readSeen = () => readStoredValue<Record<string, string>>(SEEN_KEY, {}, isRecord as (v: unknown) => v is Record<string, string>);

export interface PlantInjection {
  text: string;
  marks: { charId: string; fingerprint: string }[];
}

export const EMPTY_PLANT_INJECTION: PlantInjection = { text: '', marks: [] };

// 只在“和玩家的单聊”里注入，且只有盆栽状态相对角色上次知道的发生变化时才注入一次。
export const buildPlantInjection = (
  participantIds: string[],
  chatType: 'direct' | 'group' | 'observer',
  nameOf: (charId: string) => string | undefined
): PlantInjection => {
  if (chatType !== 'direct' || participantIds.length !== 1) return EMPTY_PLANT_INJECTION;
  const charId = participantIds[0];
  if (charId.startsWith('npc:')) return EMPTY_PLANT_INJECTION;

  const greenhouse = readStoredValue<unknown>(POMODORO_GREENHOUSE_KEY, null, (value): value is unknown => true);
  if (!isRecord(greenhouse) || !isRecord(greenhouse.pots)) return EMPTY_PLANT_INJECTION;
  const pot = greenhouse.pots[charId];
  if (!isRecord(pot) || typeof pot.speciesId !== 'string') return EMPTY_PLANT_INJECTION;

  const customPlants = Array.isArray(greenhouse.customPlants) ? greenhouse.customPlants.filter(isRecord) : [];
  const custom = customPlants.find((item) => item.id === pot.speciesId);
  const builtin = PLANT_SPECIES_LIST.find((item) => item.id === pot.speciesId);
  const speciesName = typeof custom?.name === 'string' ? custom.name : builtin?.name ?? '';
  const speciesDesc = typeof custom?.desc === 'string' ? custom.desc : builtin?.desc ?? '';
  const nickname = typeof pot.nickname === 'string' ? pot.nickname.trim() : '';
  const drops = readPotDrops(pot);
  const specimens = Array.isArray(greenhouse.specimens)
    ? greenhouse.specimens.filter(isRecord).filter((item) => item.charId === charId)
    : [];
  // 今天玩家给它浇过几次水（只有日期是今天才算）
  const wateredToday = pot.wateredDate === localDateKey() && typeof pot.wateredToday === 'number' ? pot.wateredToday : 0;

  // 没有任何用户参与痕迹（未命名、未浇水、非自选植物、无标本）时不打扰角色。
  if (!nickname && drops <= 0 && !custom && specimens.length === 0) return EMPTY_PLANT_INJECTION;

  const stage = getPlantStageIndex(drops);
  // 指纹只在“阶段/名字/标本变化”或“今天第一次有浇水”时变化，所以角色最多是每个大变化提一次、每天一次浇水情况。
  const fingerprint = [speciesName, nickname, stage, specimens.length, wateredToday > 0 ? localDateKey() : ''].join('|');
  const seen = readSeen();
  if (seen[charId] === fingerprint) return EMPTY_PLANT_INJECTION;
  const previous = seen[charId]?.split('|');
  const majorChange = !previous || previous[0] !== speciesName || previous[1] !== nickname ||
    previous[2] !== String(stage) || previous[3] !== String(specimens.length);

  const displayName = nickname || speciesName || '盆栽';
  const name = nameOf(charId) || '你';
  const toNext = dropsToNextStage(drops);
  const lines = [
    `【你们一起培育的盆栽】${name}和玩家在番茄钟的温室里一起养着一盆植物：` +
      `名字叫「${displayName}」${nickname && speciesName ? `（品种：${speciesName}）` : ''}` +
      `${speciesDesc ? `，${speciesDesc}` : ''}。` +
      `目前成长阶段：${stage + 1}/5 ${PLANT_STAGE_NAMES[stage]}（共浇了 ${drops}/${TOTAL_GROWTH_DROPS} 滴露水${toNext > 0 ? `，离下一个阶段还差 ${toNext} 滴` : '，已经盛开，可以采摘了'}）。` +
      (wateredToday > 0 ? `玩家今天已经给它浇了 ${wateredToday} 次水。` : '') +
      (specimens.length > 0 ? `你们已经一起养成并收藏了 ${specimens.length} 株标本。` : ''),
    majorChange
      ? '它刚刚有了值得一提的变化（成长阶段、名字或收藏）。你可以按人设自然地提一句，之后就当作已经知道的事，不要反复提。'
      : '这只是让你知道玩家今天照顾了它。不必特意提起；只有玩家提到盆栽、或话题自然相关时才带一句，之后不要反复说。',
  ];
  return { text: lines.join('\n'), marks: [{ charId, fingerprint }] };
};

export const applyPlantSeenAfterChat = (injection: PlantInjection) => {
  if (injection.marks.length === 0) return;
  const seen = { ...readSeen() };
  injection.marks.forEach((mark) => {
    seen[mark.charId] = mark.fingerprint;
  });
  writeStoredValue(SEEN_KEY, seen);
};
