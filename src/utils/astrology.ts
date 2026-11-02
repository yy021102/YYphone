import { Body, Ecliptic, GeoVector, MakeTime, SiderealTime, e_tilt } from 'astronomy-engine';
import { readStoredValue } from './localStorage';
import { setStorageItemsAtomically } from './dbStorage';
import { isDivinationInterpretation, isObject, nonemptyText, type DivinationInterpretation, type DivinationReader } from './divination';
import type { BirthPlace } from './astrologyCities';

export const ZODIAC = [
  ['白羊', 'Aries', '♈', '主动、勇气与开端'], ['金牛', 'Taurus', '♉', '安定、感官与积累'],
  ['双子', 'Gemini', '♊', '好奇、交流与变化'], ['巨蟹', 'Cancer', '♋', '照顾、归属与感受'],
  ['狮子', 'Leo', '♌', '创造、表达与被看见'], ['处女', 'Virgo', '♍', '整理、细节与改善'],
  ['天秤', 'Libra', '♎', '关系、协调与平衡'], ['天蝎', 'Scorpio', '♏', '深度、信任与转化'],
  ['射手', 'Sagittarius', '♐', '探索、信念与远方'], ['摩羯', 'Capricorn', '♑', '责任、结构与耐心'],
  ['水瓶', 'Aquarius', '♒', '独立、社群与新意'], ['双鱼', 'Pisces', '♓', '想象、共情与边界'],
] as const;
export const PLANETS = [
  { id: Body.Sun, name: '太阳', glyph: '☉', theme: '自我认同与表达方向' },
  { id: Body.Moon, name: '月亮', glyph: '☽', theme: '情绪需求与安全感' },
  { id: Body.Mercury, name: '水星', glyph: '☿', theme: '思考、学习与沟通' },
  { id: Body.Venus, name: '金星', glyph: '♀', theme: '喜爱、审美与关系偏好' },
  { id: Body.Mars, name: '火星', glyph: '♂', theme: '行动、动力与界限' },
  { id: Body.Jupiter, name: '木星', glyph: '♃', theme: '探索、成长与信念' },
  { id: Body.Saturn, name: '土星', glyph: '♄', theme: '责任、限制与长期建设' },
  { id: Body.Uranus, name: '天王星', glyph: '♅', theme: '独立、革新与改变' },
  { id: Body.Neptune, name: '海王星', glyph: '♆', theme: '理想、想象与模糊边界' },
  { id: Body.Pluto, name: '冥王星', glyph: '♇', theme: '深层变化与力量议题' },
] as const;
export type PlanetId = typeof PLANETS[number]['id'];
export const HOUSE_THEMES = ['自我与呈现', '资源与价值', '学习与交流', '家庭与归属', '创造与乐趣', '日常与照顾', '伙伴与协商', '共享与信任', '远行与信念', '事业与公共表达', '朋友与社群', '独处与内在整理'];
export const ASPECTS = [
  { id: 'conjunction', name: '合相', angle: 0, orb: 8, description: '两个主题靠得很近，可以一起观察。' },
  { id: 'sextile', name: '六合', angle: 60, orb: 4, description: '两个主题之间可能有可培养的合作空间。' },
  { id: 'square', name: '刑相', angle: 90, orb: 6, description: '不同需求可能需要协调，不等于坏事。' },
  { id: 'trine', name: '拱相', angle: 120, orb: 6, description: '两个主题的连接可能比较自然，也值得主动运用。' },
  { id: 'opposition', name: '冲相', angle: 180, orb: 8, description: '两端需求都值得被听见，可以练习找到平衡。' },
] as const;
export interface BirthProfile {
  id: string; name: string; date: string; time: string; timeKnown: boolean;
  place: BirthPlace; fold: 'reject' | 'earlier' | 'later';
  actorId?: string;
  creative?: { reason: string; assumedFields: ('date' | 'time' | 'place')[]; generatedAt: string; targetAscendant?: number };
}
export interface PlanetPosition { id: PlanetId; longitude: number; retrograde: boolean }
export interface NatalPlanet extends PlanetPosition {
  house: number;
  possibleSigns: number[];
}
export interface NatalAspect {
  a: PlanetId; b: PlanetId; kind: typeof ASPECTS[number]['id']; separation: number; orb: number;
  dayRange?: [number, number];
}
export interface NatalChart {
  version: 1; utc: string; offsetMinutes: number; ascendant: number; midheaven: number;
  cusps: number[]; planets: NatalPlanet[]; aspects: NatalAspect[]; noonReference: boolean;
}
export interface NatalRecord {
  id: string; createdAt: string; profile: BirthProfile; question: string;
  chart: NatalChart; interpretations: DivinationInterpretation[];
  readingMode?: 'question';
}
interface StudyBase {
  id: string; createdAt: string; question: string; first: NatalRecord; aspects: NatalAspect[];
  interpretations: DivinationInterpretation[]; readingMode?: 'question';
}
export type AstrologyStudy = StudyBase & (
  { kind: 'synastry'; second: NatalRecord } |
  { kind: 'daily'; day: string; timeZone: string; utc: string; transits: PlanetPosition[] }
);
export type AstrologyRecord = NatalRecord | AstrologyStudy;
export interface AstrologyStore { profiles: BirthProfile[]; records: NatalRecord[]; studies: AstrologyStudy[] }
export interface NatalInterpretInput { record: AstrologyRecord; reader: DivinationReader; signal: AbortSignal }
export interface CharacterBirthInput { kind: 'birth-draft'; actorId: string; requirements: string; signal: AbortSignal }
export const ASTROLOGY_KEY = 'yyphone:astrology';
export const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
export const angleDistance = (a: number, b: number) => {
  const difference = normalizeAngle(a - b);
  return Math.min(difference, 360 - difference);
};
export const signIndex = (longitude: number) => Math.floor(normalizeAngle(longitude) / 30);
export function zodiacPosition(longitude: number): string {
  const minutes = Math.floor(normalizeAngle(longitude) % 30 * 60);
  return `${ZODIAC[signIndex(longitude)][0]} ${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}′`;
}
export const planetName = (id: PlanetId) => PLANETS.find(planet => planet.id === id)!.name;
const radians = Math.PI / 180;
const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2100-12-31' &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const clock = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validateBirthProfile(profile: BirthProfile): void {
  if (!nonemptyText(profile.id, 200) || !nonemptyText(profile.name, 60)) throw new Error('请填写 1～60 字的档案名称。');
  if (!isoDate(profile.date) || !clock(profile.time)) throw new Error('请输入 1900～2100 年内有效的公历日期与时间。');
  const place = profile.place;
  if (!nonemptyText(place.name, 100) || !Number.isFinite(place.latitude) || Math.abs(place.latitude) > 89 ||
      !Number.isFinite(place.longitude) || Math.abs(place.longitude) > 180) throw new Error('请填写出生地，纬度需在 −89～89、经度在 −180～180 之间。');
  if (!nonemptyText(place.timeZone, 100)) throw new Error('请填写 IANA 时区，例如 Asia/Shanghai。');
  try { new Intl.DateTimeFormat('en', { timeZone: place.timeZone }).format(0); }
  catch { throw new Error('无法识别这个时区。请使用 IANA 名称，例如 Asia/Shanghai 或 America/New_York。'); }
  if (typeof profile.timeKnown !== 'boolean' || !['reject', 'earlier', 'later'].includes(profile.fold)) throw new Error('出生时间选项无效。');
}
function localClock(date: Date, formatter: Intl.DateTimeFormat): number {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}
function timeResolver(date: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const midnight = Date.parse(`${date}T00:00:00Z`), offsets = new Set<number>();
  for (let hour = -36; hour <= 60; hour += 6) {
    const instant = midnight + hour * 3600000;
    offsets.add(localClock(new Date(instant), formatter) - instant);
  }
  return (time: string): Date[] => {
    const target = Date.parse(`${date}T${time}:00Z`);
    return [...offsets].map(offset => new Date(target - offset))
      .filter(instant => localClock(instant, formatter) === target).sort((a, b) => a.getTime() - b.getTime());
  };
}
export function findAscendantTime(profile: BirthProfile, target: number): BirthProfile {
  validateBirthProfile(profile);
  if (!Number.isInteger(target) || target < 0 || target > 11) throw new Error('目标上升星座无效。');
  const resolve = timeResolver(profile.date, profile.place.timeZone);
  const matches: { instant: number; time: string; fold: BirthProfile['fold'] }[] = [];
  for (let minute = 0; minute < 1440; minute++) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    resolve(time).forEach((date, index) => {
      if (signIndex(chartAxes(date, profile.place.latitude, profile.place.longitude).ascendant) === target)
        matches.push({ instant: date.getTime(), time, fold: index ? 'later' : 'earlier' });
    });
  }
  matches.sort((a, b) => a.instant - b.instant);
  if (!matches.length) throw new Error('这一天、这个地点没有找到该上升星座的分钟级时间。请修改创作目标或出生地点，不会伪造结果。');
  let start = 0, bestStart = 0, bestLength = 1;
  for (let index = 1; index < matches.length; index++) {
    if (matches[index].instant - matches[index - 1].instant > 60000) start = index;
    if (index - start + 1 > bestLength) { bestStart = start; bestLength = index - start + 1; }
  }
  const selected = matches[bestStart + Math.floor(bestLength / 2)];
  return { ...profile, time: selected.time, fold: selected.fold, timeKnown: true };
}
export function birthInstant(profile: BirthProfile): { date: Date; offsetMinutes: number } {
  validateBirthProfile(profile);
  const time = profile.timeKnown ? profile.time : '12:00';
  const candidates = timeResolver(profile.date, profile.place.timeZone)(time);
  if (!candidates.length) throw new Error('这个当地时间不存在，可能遇到夏令时跳时或日期变更。请核对日期、时间与时区。');
  if (candidates.length > 1 && profile.fold === 'reject') throw new Error('这个当地时间因时钟回拨出现两次，请在「重复时间」中选择第一次或第二次。');
  const date = candidates[profile.fold === 'later' ? candidates.length - 1 : 0];
  return { date, offsetMinutes: (Date.parse(`${profile.date}T${time}:00Z`) - date.getTime()) / 60000 };
}
export function chartAxes(date: Date, latitude: number, longitude: number): { ascendant: number; midheaven: number } {
  const theta = normalizeAngle(SiderealTime(date) * 15 + longitude) * radians;
  const epsilon = e_tilt(MakeTime(date)).tobl * radians, phi = latitude * radians;
  const a = Math.cos(phi) * Math.cos(theta);
  const b = Math.cos(phi) * Math.sin(theta) * Math.cos(epsilon) + Math.sin(phi) * Math.sin(epsilon);
  if (Math.hypot(a, b) < 1e-8) throw new Error('此刻黄道与地平线几乎重合，上升点无法稳定确定。请核对出生地点和时间。');
  let rising = Math.atan2(-a, b);
  // Of the two horizon intersections, choose the one in the eastern half of the sky.
  if (-Math.sin(theta) * Math.cos(rising) + Math.cos(theta) * Math.sin(rising) * Math.cos(epsilon) < 0) rising += Math.PI;
  return { ascendant: normalizeAngle(rising / radians),
    midheaven: normalizeAngle(Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(epsilon)) / radians) };
}
export const planetaryLongitude = (id: PlanetId, date: Date) => Ecliptic(GeoVector(id, date, true)).elon;
export function planetaryPositions(date: Date): PlanetPosition[] {
  return PLANETS.map(planet => {
    const before = planetaryLongitude(planet.id, new Date(date.getTime() - 1800000));
    const after = planetaryLongitude(planet.id, new Date(date.getTime() + 1800000));
    return { id: planet.id, longitude: planetaryLongitude(planet.id, date), retrograde: ((after - before + 540) % 360) - 180 < 0 };
  });
}
export function crossAspects(first: readonly PlanetPosition[], second: readonly PlanetPosition[]): NatalAspect[] {
  return first.flatMap(a => second.flatMap(b => {
    const separation = angleDistance(a.longitude, b.longitude);
    const aspect = ASPECTS.find(candidate => Math.abs(candidate.angle - separation) <= candidate.orb);
    return aspect ? [{ a: a.id, b: b.id, kind: aspect.id, separation, orb: Math.abs(aspect.angle - separation) }] : [];
  }));
}
export function calculateNatal(profile: BirthProfile): NatalChart {
  const { date, offsetMinutes } = birthInstant(profile);
  const { ascendant, midheaven } = chartAxes(date, profile.place.latitude, profile.place.longitude);
  const cusps = Array.from({ length: 12 }, (_, i) => normalizeAngle((signIndex(ascendant) + i) * 30));
  const resolve = timeResolver(profile.date, profile.place.timeZone);
  const samples = profile.timeKnown ? [] : Array.from({ length: 48 }, (_, index) =>
    resolve(`${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)).flat().concat(resolve('23:59'))
    .map(instant => PLANETS.map(planet => planetaryLongitude(planet.id, instant)));
  const planets = planetaryPositions(date).map((planet, index): NatalPlanet => {
    const { longitude } = planet;
    const possibleSigns = new Set([signIndex(longitude)]);
    for (const sample of samples) {
      // Include a small boundary buffer rather than claiming sampled stability is exact.
      for (const margin of [-.03, 0, .03]) possibleSigns.add(signIndex(sample[index] + margin));
    }
    return { id: planet.id, longitude, house: Math.floor(normalizeAngle(longitude - cusps[0]) / 30) + 1,
      retrograde: planet.retrograde, possibleSigns: [...possibleSigns].sort((a, b) => a - b) };
  });
  const aspects: NatalAspect[] = [];
  for (let i = 0; i < planets.length; i++) for (let j = i + 1; j < planets.length; j++) {
    const separation = angleDistance(planets[i].longitude, planets[j].longitude);
    const aspect = ASPECTS.find(candidate => Math.abs(candidate.angle - separation) <= candidate.orb);
    if (aspect) {
      const distances = samples.map(sample => angleDistance(sample[i], sample[j]));
      aspects.push({ a: planets[i].id, b: planets[j].id, kind: aspect.id, separation, orb: Math.abs(aspect.angle - separation),
        ...(distances.length ? { dayRange: [Math.min(...distances), Math.max(...distances)] as [number, number] } : {}) });
    }
  }
  return { version: 1, utc: date.toISOString(), offsetMinutes, ascendant, midheaven, cusps, planets, aspects, noonReference: !profile.timeKnown };
}
export function createNatalRecord(profile: BirthProfile, question: string): NatalRecord {
  if (question.length > 300) throw new Error('想聊的问题请控制在 300 字以内。');
  const normalized = { ...profile, time: profile.timeKnown ? profile.time : '12:00', place: { ...profile.place },
    ...(profile.creative ? { creative: { ...profile.creative, assumedFields: [...profile.creative.assumedFields] } } : {}) };
  return { id: `natal-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), profile: normalized,
    question: question.trim() || '我可以怎样理解自己的需求、表达方式与成长方向？', chart: calculateNatal(normalized), interpretations: [] };
}
function isProfile(value: unknown): value is BirthProfile {
  if (!isObject(value) || !isObject(value.place) || !nonemptyText(value.id, 200) || !nonemptyText(value.name, 60) ||
      typeof value.date !== 'string' || !isoDate(value.date) || !clock(value.time) || typeof value.timeKnown !== 'boolean' ||
      !['reject', 'earlier', 'later'].includes(String(value.fold))) return false;
  if (value.actorId !== undefined && !nonemptyText(value.actorId, 200)) return false;
  if (value.creative !== undefined) {
    const creative = value.creative;
    if (!isObject(creative) || !nonemptyText(creative.reason, 1500) || typeof creative.generatedAt !== 'string' ||
        !Number.isFinite(Date.parse(creative.generatedAt)) || !Array.isArray(creative.assumedFields) ||
        !creative.assumedFields.every(field => ['date', 'time', 'place'].includes(field)) ||
        creative.targetAscendant !== undefined && (typeof creative.targetAscendant !== 'number' ||
          !Number.isInteger(creative.targetAscendant) || creative.targetAscendant < 0 || creative.targetAscendant > 11)) return false;
  }
  const place = value.place;
  return nonemptyText(place.name, 100) && typeof place.latitude === 'number' && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 89 &&
    typeof place.longitude === 'number' && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180 && nonemptyText(place.timeZone, 100);
}
const angle = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360;
const planetId = (value: unknown): value is PlanetId => PLANETS.some(planet => planet.id === value);
export function isNatalRecord(value: unknown): value is NatalRecord {
  if (!isObject(value) || !nonemptyText(value.id, 200) || !nonemptyText(value.createdAt, 100) || !Number.isFinite(Date.parse(value.createdAt)) ||
      !isProfile(value.profile) || !nonemptyText(value.question, 300) || !isObject(value.chart) || !Array.isArray(value.interpretations)) return false;
  if (value.readingMode !== undefined && value.readingMode !== 'question') return false;
  const chart = value.chart;
  const ascendant = chart.ascendant, cusps = chart.cusps;
  if (chart.version !== 1 || typeof chart.utc !== 'string' || !Number.isFinite(Date.parse(chart.utc)) || typeof chart.offsetMinutes !== 'number' ||
      !Number.isFinite(chart.offsetMinutes) || !angle(ascendant) || !angle(chart.midheaven) || chart.noonReference !== !value.profile.timeKnown ||
      !value.profile.timeKnown && value.profile.time !== '12:00' ||
      !Array.isArray(cusps) || cusps.length !== 12 || !cusps.every((cusp, index) => cusp === normalizeAngle((signIndex(ascendant) + index) * 30)) ||
      !Array.isArray(chart.planets) || chart.planets.length !== 10 || !Array.isArray(chart.aspects)) return false;
  if (!chart.planets.every((planet, index) => isObject(planet) && planet.id === PLANETS[index].id && angle(planet.longitude) &&
      planet.house === Math.floor(normalizeAngle(planet.longitude - cusps[0]) / 30) + 1 &&
      typeof planet.retrograde === 'boolean' && Array.isArray(planet.possibleSigns) && planet.possibleSigns.includes(signIndex(planet.longitude)) &&
      planet.possibleSigns.every(sign => Number.isInteger(sign) && sign >= 0 && sign <= 11))) return false;
  if (!chart.aspects.every(aspect => isObject(aspect) && planetId(aspect.a) && planetId(aspect.b) && aspect.a !== aspect.b &&
      ASPECTS.some(candidate => candidate.id === aspect.kind) && typeof aspect.orb === 'number' && aspect.orb >= 0 && aspect.orb <= 8 &&
      typeof aspect.separation === 'number' && aspect.separation >= 0 && aspect.separation <= 180 &&
      (!chart.noonReference || Array.isArray(aspect.dayRange)) &&
      (aspect.dayRange === undefined || Array.isArray(aspect.dayRange) && aspect.dayRange.length === 2 &&
        aspect.dayRange.every(n => typeof n === 'number' && n >= 0 && n <= 180) && aspect.dayRange[0] <= aspect.dayRange[1]))) return false;
  return value.interpretations.every(isDivinationInterpretation) &&
    new Set(value.interpretations.map(item => item.id)).size === value.interpretations.length;
}
const isStore = (value: unknown): value is Omit<AstrologyStore, 'studies'> & { studies?: AstrologyStudy[] } => isObject(value) && Array.isArray(value.profiles) && value.profiles.every(isProfile) &&
  Array.isArray(value.records) && value.records.every(isNatalRecord) &&
  (value.studies === undefined || Array.isArray(value.studies) && value.studies.every(isAstrologyStudy) && new Set(value.studies.map(item => item.id)).size === value.studies.length) &&
  new Set(value.profiles.map(item => item.id)).size === value.profiles.length && new Set(value.records.map(item => item.id)).size === value.records.length;
const listeners = new Set<() => void>();
export const subscribeAstrology = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const loadAstrology = (): AstrologyStore => {
  const stored = readStoredValue(ASTROLOGY_KEY, { profiles: [], records: [], studies: [] }, isStore);
  return { ...stored, studies: stored.studies ?? [] };
};
let writes = Promise.resolve();
export function updateAstrology(update: (store: AstrologyStore) => AstrologyStore): Promise<void> {
  const result = writes.then(async () => {
    const next = update(loadAstrology());
    if (!isStore(next)) throw new Error('无法保存无效的星盘档案。');
    await setStorageItemsAtomically({ [ASTROLOGY_KEY]: next });
    listeners.forEach(listener => listener());
  });
  writes = result.then(() => undefined, () => undefined);
  return result;
}
export function updateNatalRecord(id: string, update: (record: NatalRecord) => NatalRecord): Promise<void> {
  return updateAstrology(store => {
    if (!store.records.some(record => record.id === id)) throw new Error('这份星盘手记已不存在。');
    return { ...store, records: store.records.map(record => record.id === id ? update(record) : record) };
  });
}
export function recoverNatalRecords<T extends { interpretations: DivinationInterpretation[] }>(records: T[]): T[] {
  return records.map(record => ({ ...record, interpretations: record.interpretations.map(attempt => attempt.status === 'pending'
    ? { ...attempt, status: 'error', error: '上次解读已中断，不会自动重新请求。' } : attempt) }));
}
export function natalContext(record: NatalRecord): string {
  if (!isNatalRecord(record)) throw new Error('星盘手记无效，不能生成解读。');
  const { profile, chart } = record;
  return [
    `星盘主人：${profile.name}\n公历出生：${profile.date} ${profile.time}（${profile.timeKnown ? profile.creative ? '角色创作设定的当地时间' : '用户提供的当地时间' : '时间未知，按当地中午12:00参考'}）`,
    ...(profile.creative ? [`【角色创作设定，不是真实出生时间鉴定】${profile.creative.reason}\n补全字段：${profile.creative.assumedFields.join('、') || '用户已确认具体设定'}。${profile.creative.targetAscendant === undefined ? '' : `最初创作目标：上升${ZODIAC[profile.creative.targetAscendant][0]}，用户后续编辑可能改变结果。`}性格联想不能反推真实出生时间；所有下游比较与行运解读也属于这套虚构设定。`] : []),
    `地点：${profile.place.name}；纬度${profile.place.latitude}，经度${profile.place.longitude}；IANA时区${profile.place.timeZone}；UTC${chart.utc}`,
    '计算：Astronomy Engine 2.1.19；地心、日期真黄道；热带黄道、整宫制；相位仅统计十星体间主要相位，不含交点与小行星。',
    `主要相位固定容许度：${ASPECTS.map(aspect => `${aspect.name}${aspect.angle}° ±${aspect.orb}°`).join('；')}。逆行由前后各30分钟黄经变化判断，驻留附近仅参考。`,
    ...(chart.noonReference ? ['【重要不确定性】这是中午参考盘。上升、天顶、全部宫位不可信；行星精确度数、逆行状态和相位也可能随当天时间变化。不得把午间位置当成真实出生时刻。',
      '候选星座与相位角距范围来自当地当天每30分钟及23:59采样、星座边界另加0.03°缓冲，并非全天不变的保证；可能漏掉午间未成立而其他时刻成立的相位。'] : []),
    `上升${zodiacPosition(chart.ascendant)}；天顶${zodiacPosition(chart.midheaven)}${chart.noonReference ? '（均为时间敏感的午间参考）' : ''}`,
    ...chart.planets.map(planet => `${planetName(planet.id)}：${zodiacPosition(planet.longitude)}；第${planet.house}宫；${planet.retrograde ? '逆行' : '顺行'}${chart.noonReference ? `；当天采样候选：${planet.possibleSigns.map(index => ZODIAC[index][0]).join('、')}（仅参考）` : ''}`),
    ...chart.aspects.map(aspect => `${planetName(aspect.a)}·${planetName(aspect.b)} ${ASPECTS.find(candidate => candidate.id === aspect.kind)!.name}；容许度${aspect.orb.toFixed(2)}°${aspect.dayRange ? `；当天采样角距${aspect.dayRange.map(n => n.toFixed(2)).join('～')}°，时间敏感` : ''}`),
    `想聊：${record.question}`,
  ].join('\n\n');
}
export const natalShareText = (record: NatalRecord) => [
  'STELLAR NOTES · 星空来信', natalContext(record),
  ...record.interpretations.filter(attempt => attempt.status === 'done').map(attempt =>
    `${attempt.reader.mode === 'oracle' ? 'AI 占星师' : attempt.reader.actorName}的解读：\n${attempt.text}`),
  '占星仅供娱乐与自我探索，不是科学性格测验，不预测命运，不替代现实沟通或专业建议。',
].join('\n\n');

export function localCalendarDate(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function studyBase(first: BirthProfile, question: string): StudyBase {
  if (question.length > 300) throw new Error('问题请控制在 300 字以内。');
  return { id: `stellar-${crypto.randomUUID()}`, createdAt: new Date().toISOString(),
    question: question.trim() || '可以从哪些角度更好地照顾自己、理解彼此？',
    first: createNatalRecord(first, ''), aspects: [], interpretations: [] };
}
export function createSynastry(first: BirthProfile, second: BirthProfile, question = ''): AstrologyStudy {
  if (first.id === second.id) throw new Error('请选择两份不同的出生档案。');
  const base = studyBase(first, question), other = createNatalRecord(second, '');
  return { ...base, kind: 'synastry', second: other, aspects: crossAspects(base.first.chart.planets, other.chart.planets) };
}
export function createDaily(first: BirthProfile, day: string, timeZone: string, question = ''): AstrologyStudy {
  if (!isoDate(day)) throw new Error('请输入 1900～2100 年内有效的行运日期。');
  const base = studyBase(first, question);
  const { date } = birthInstant({ ...first, date: day, time: '12:00', timeKnown: true, fold: 'reject', place: { ...first.place, timeZone } });
  const transits = planetaryPositions(date);
  return { ...base, kind: 'daily', day, timeZone, utc: date.toISOString(), transits, aspects: crossAspects(base.first.chart.planets, transits) };
}
export function isAstrologyStudy(value: unknown): value is AstrologyStudy {
  if (!isObject(value) || !nonemptyText(value.id, 200) || !nonemptyText(value.question, 300) ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !isNatalRecord(value.first) ||
      !Array.isArray(value.interpretations) || !value.interpretations.every(isDivinationInterpretation) ||
      new Set(value.interpretations.map(item => item.id)).size !== value.interpretations.length ||
      value.readingMode !== undefined && value.readingMode !== 'question') return false;
  let positions: PlanetPosition[];
  if (value.kind === 'synastry') {
    if (!isNatalRecord(value.second) || value.first.profile.id === value.second.profile.id) return false;
    positions = value.second.chart.planets;
  } else if (value.kind === 'daily') {
    if (typeof value.day !== 'string' || !isoDate(value.day) || !nonemptyText(value.timeZone, 100) ||
        typeof value.utc !== 'string' || !Number.isFinite(Date.parse(value.utc)) || !Array.isArray(value.transits) ||
        value.transits.length !== 10 || !value.transits.every((planet, index) => isObject(planet) &&
          planet.id === PLANETS[index].id && angle(planet.longitude) && typeof planet.retrograde === 'boolean')) return false;
    positions = value.transits;
  } else return false;
  const expected = crossAspects(value.first.chart.planets, positions);
  return Array.isArray(value.aspects) && value.aspects.length === expected.length && value.aspects.every((aspect, index) =>
    isObject(aspect) && Object.entries(expected[index]).every(([key, entry]) => aspect[key] === entry));
}
export function updateAstrologyRecord(id: string, update: (record: AstrologyRecord) => AstrologyRecord): Promise<void> {
  return updateAstrology(store => {
    const natal = store.records.find(record => record.id === id);
    const study = store.studies.find(record => record.id === id);
    const original = natal ?? study;
    if (!original) throw new Error('这份星空手记已不存在。');
    const next = update(original);
    if (natal && isNatalRecord(next)) return { ...store, records: store.records.map(record => record.id === id ? next : record) };
    if (study && isAstrologyStudy(next)) return { ...store, studies: store.studies.map(record => record.id === id ? next : record) };
    throw new Error('手记类型或内容无效，未保存更改。');
  });
}
export const astrologyRecordTitle = (record: AstrologyRecord): string =>
  `${record.readingMode === 'question' ? '星空问答 · ' : ''}${'chart' in record ? `${record.profile.name}的星空来信` :
    record.kind === 'synastry' ? `${record.first.profile.name} × ${record.second.profile.name} · 双人比较盘` :
      `${record.first.profile.name} · ${record.day} 每日星空`}`;
export function astrologyWarnings(record: AstrologyRecord): string[] {
  const profiles = 'chart' in record ? [record] : record.kind === 'synastry' ? [record.first, record.second] : [record.first];
  return profiles.flatMap(natal => [
    ...(natal.chart.noonReference ? [`${natal.profile.name}：出生时间未知，按当地中午参考；上升、天顶、宫位不可靠，行星与相位也可能变化。`] : []),
    ...(natal.profile.creative ? [`${natal.profile.name}：角色创作设定。${natal.profile.creative.reason} 性格联想不能反推出真实时间，比较盘与每日解读也沿用这套虚构设定。`] : []),
  ]);
}
export function astrologyContext(record: AstrologyRecord): string {
  if ('chart' in record) return natalContext(record);
  if (!isAstrologyStudy(record)) throw new Error('星空手记无效，不能生成解读。');
  const other = record.kind === 'synastry' ? record.second.profile.name : '行运';
  return [
    astrologyRecordTitle(record), `【A 本命快照】\n${natalContext({ ...record.first, question: record.question })}`,
    ...(record.kind === 'synastry' ? [
      `【B 本命快照】\n${natalContext({ ...record.second, question: record.question })}`,
      '算法：双人比较盘，不是组合中点盘；下面每组都跨 A/B 两盘，包含同名星体。无配对分数，不判断命定、读心或关系必然成败。',
      ...record.first.chart.planets.map(planet => `A ${planetName(planet.id)}落 B 第${Math.floor(normalizeAngle(planet.longitude - record.second.chart.cusps[0]) / 30) + 1}宫`),
      ...record.second.chart.planets.map(planet => `B ${planetName(planet.id)}落 A 第${Math.floor(normalizeAngle(planet.longitude - record.first.chart.cusps[0]) / 30) + 1}宫`),
    ] : [
      `【每日行运快照】${record.day}，${record.timeZone} 当地中午12:00；UTC ${record.utc}。不是全天不变，也不代表任何人的实际出生时间。无日内采样，不预测具体事件。`,
      ...record.transits.map(planet => `行运${planetName(planet.id)}：${zodiacPosition(planet.longitude)} ${planet.retrograde ? '逆行' : '顺行'}`),
    ]),
    ...record.aspects.map(aspect => `A本命${planetName(aspect.a)} · ${other}${planetName(aspect.b)} ${ASPECTS.find(candidate => candidate.id === aspect.kind)!.name}，角距${aspect.separation.toFixed(2)}°，容许度${aspect.orb.toFixed(2)}°`),
    ...astrologyWarnings(record), `【本次问题】${record.question}`,
    '只依据已列位置与相位提供开放的反思、沟通与照顾建议。所有创作与午间参考限制都适用于跨盘相位和落宫；不认定对方真实想法、不许诺吉凶、健康、财运或未来事件。',
  ].join('\n\n');
}
export const astrologyShareText = (record: AstrologyRecord) => [
  'STELLAR NOTES · 星空来信', astrologyContext(record),
  ...record.interpretations.filter(attempt => attempt.status === 'done').map(attempt =>
    `${attempt.reader.mode === 'oracle' ? 'AI 占星师' : attempt.reader.actorName}的解读：\n${attempt.text}`),
  '占星仅供娱乐与自我探索，不是科学性格测验，不预测命运，不替代现实沟通或专业建议。',
].join('\n\n');
