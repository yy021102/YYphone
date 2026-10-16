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

export const MAX_PLANT_GROWTH = 180;

export const PLANT_STAGE_NAMES = ['沉睡花种', '破土嫩芽', '青翠枝叶', '含苞待放', '已经盛开'];

export const getPlantStageIndex = (minutes: number) => {
  if (minutes < 30) return 0;
  if (minutes < 60) return 1;
  if (minutes < 120) return 2;
  if (minutes < MAX_PLANT_GROWTH) return 3;
  return 4;
};

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
  const growth = typeof pot.growthMinutes === 'number' ? pot.growthMinutes : 0;
  const specimens = Array.isArray(greenhouse.specimens)
    ? greenhouse.specimens.filter(isRecord).filter((item) => item.charId === charId)
    : [];

  // 没有任何用户参与痕迹（未命名、未浇水、非自选植物、无标本）时不打扰角色。
  if (!nickname && growth <= 0 && !custom && specimens.length === 0) return EMPTY_PLANT_INJECTION;

  const stage = getPlantStageIndex(growth);
  const fingerprint = [speciesName, nickname, stage, specimens.length].join('|');
  const seen = readSeen();
  if (seen[charId] === fingerprint) return EMPTY_PLANT_INJECTION;

  const displayName = nickname || speciesName || '盆栽';
  const name = nameOf(charId) || '你';
  const lines = [
    `【你们一起培育的盆栽】${name}和玩家在番茄钟的温室里一起养着一盆植物：` +
      `名字叫「${displayName}」${nickname && speciesName ? `（品种：${speciesName}）` : ''}` +
      `${speciesDesc ? `，${speciesDesc}` : ''}。` +
      `目前成长阶段：${stage + 1}/5 ${PLANT_STAGE_NAMES[stage]}（已累计 ${growth}/${MAX_PLANT_GROWTH} 分钟的成长，玩家每完成专注、浇水它就会长大）。` +
      (specimens.length > 0 ? `你们已经一起养成并收藏了 ${specimens.length} 株标本。` : '') +
      (seen[charId] ? '这些是自你上次留意以来的新变化。' : ''),
    '这是你们共同的一件小事：你知道它的名字和长势，聊到相关话题、玩家提起、或你自然想起时可以按人设自然带一句，不必每轮提起，也不要为了提而提。',
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
