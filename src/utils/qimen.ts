import { calculate, type Branch, type CivilDateTime, type Cycle, type Deity, type Door, type Element, type Star, type Stem } from '@spensercai/qimen-wasm';
import { readStoredValue } from './localStorage';
import { setStorageItemsAtomically } from './dbStorage';
import { isDivinationInterpretation, isObject, nonemptyText, type DivinationInterpretation, type DivinationReader } from './divination';

export const QIMEN_KEY = 'yyphone:qimen';
export const QIMEN_METHOD = '时家转盘 · 拆补法；固定 UTC+08:00，不自动处理历史夏令时、不修正真太阳时；23:00 子初换日；中五寄坤二、天禽随天芮；时旬空亡、时支驿马。';
export const QIMEN_LIMIT = '传统术数仅供文化体验、娱乐与自我探索，不是科学预测。不据此判断他人真实想法、保证吉凶或作医疗、投资等重大决定。';
const stems: Record<Stem, string> = { jia: '甲', yi: '乙', bing: '丙', ding: '丁', wu: '戊', ji: '己', geng: '庚', xin: '辛', ren: '壬', gui: '癸' };
const branches: Record<Branch, string> = { zi: '子', chou: '丑', yin: '寅', mao: '卯', chen: '辰', si: '巳', wu: '午', wei: '未', shen: '申', you: '酉', xu: '戌', hai: '亥' };
const stars: Record<Star, string> = { tian_peng: '天蓬', tian_rui: '天芮', tian_chong: '天冲', tian_fu: '天辅', tian_qin: '天禽', tian_xin: '天心', tian_zhu: '天柱', tian_ren: '天任', tian_ying: '天英' };
const doors: Record<Door, string> = { xiu: '休门', si: '死门', shang: '伤门', du: '杜门', kai: '开门', jing: '惊门', sheng: '生门', scene: '景门' };
const deities: Record<Deity, string> = { zhi_fu: '值符', teng_she: '腾蛇', tai_yin: '太阴', liu_he: '六合', bai_hu: '白虎', xuan_wu: '玄武', jiu_di: '九地', jiu_tian: '九天' };
const elements: Record<Element, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
export const QIMEN_PALACES = ['坎一', '坤二', '震三', '巽四', '中五', '乾六', '兑七', '艮八', '离九'];
export const QIMEN_DIRECTIONS = ['正北', '西南', '正东', '东南', '中央', '西北', '正西', '东北', '正南'];
export const QIMEN_LAYOUT = [4, 9, 2, 3, 5, 7, 8, 1, 6];
export const QIMEN_DOOR_NOTES: Record<string, string> = {
  休门: '休息与滋养：先照顾精力，给自己一点缓冲。',
  生门: '生长与资源：把愿望拆成可以慢慢积累的小事。',
  伤门: '行动与边界：表达需要，也留意彼此的承受度。',
  杜门: '收束与专注：整理信息，给隐私与独处留出空间。',
  景门: '呈现与表达：让想说的话更清楚，不以外表代替了解。',
  死门: '收尾与停顿：可以整理旧事、暂停消耗；名称不代表死亡或灾祸。',
  惊门: '信息与觉察：遇到不确定，先核实再回应；名称不代表灾祸。',
  开门: '开放与沟通：尝试一场尊重彼此、可以拒绝的对话。',
};
export interface QimenPalace {
  number: number; element: string; earth: string; hostedEarth: string | null;
  heaven: { stem: string; source: number; hosted: boolean }[];
  stars: string[]; door: string | null; deity: string | null; voids: string[]; horse: boolean;
}
export interface QimenChart {
  pillars: string[]; lunar: string; term: string; termStart: string; nextTerm: string; nextTermStart: string;
  dun: '阳遁' | '阴遁'; yuan: '上元' | '中元' | '下元'; ju: number; yuanHead: string;
  xunHead: string; hidden: string; voids: string[]; horseBranch: string; horsePalace: number;
  leaderStar: string; leaderDoor: string; leaderOrigin: number; starPalace: number; doorPalace: number; doorRawPalace: number;
  palaces: QimenPalace[];
}
export interface QimenRecord {
  kind: 'qimen'; version: 1; engine: 'qimen-rs 0.2.1'; id: string; createdAt: string;
  date: string; time: string; question: string; chart: QimenChart; interpretations: DivinationInterpretation[];
}
export interface QimenInterpretInput { record: QimenRecord; reader: DivinationReader; signal: AbortSignal }
const pad = (n: number) => String(n).padStart(2, '0');
const civil = (d: CivilDateTime) => `${d.year}-${pad(d.month)}-${pad(d.day)} ${pad(d.hour)}:${pad(d.minute)}:${pad(d.second)} +08:00`;
const cycle = (c: Cycle) => stems[c.stem] + branches[c.branch];
export function qimenNow(now = new Date()): { date: string; time: string } {
  const fixed = new Date(now.getTime() + 480 * 60000).toISOString();
  return { date: fixed.slice(0, 10), time: fixed.slice(11, 19) };
}
export function validateQimenInput(date: string, time: string, question: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > '2100-12-31' ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
    throw new Error('请输入 1900～2100 年内有效的公历日期。');
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) throw new Error('请输入有效的北京时间，可精确到秒。');
  if (typeof question !== 'string' || question.length > 300) throw new Error('问题请控制在 300 字以内。');
}
// The engine is initialized by the browser loader (or initSync in Node tests).
export function createQimenRecord(date: string, time: string, question: string): QimenRecord {
  validateQimenInput(date, time, question);
  const [year, month, day] = date.split('-').map(Number), [hour, minute, second = 0] = time.split(':').map(Number);
  const c = calculate({ year, month, day, hour, minute, second, utc_offset_minutes: 480, day_boundary: 'zi_start' });
  if (c.schema_version !== '1.1' || c.method !== 'shi_jia_chai_bu_zhuan_pan') throw new Error('排盘引擎规则版本不匹配，未保存。');
  const chart: QimenChart = {
    pillars: [c.calendar.four_pillars.year, c.calendar.four_pillars.month, c.calendar.four_pillars.day, c.calendar.four_pillars.hour].map(cycle),
    lunar: c.calendar.lunar_date.name, term: c.calendar.solar_term.name, termStart: civil(c.calendar.solar_term.start),
    nextTerm: c.calendar.next_solar_term.name, nextTermStart: civil(c.calendar.next_solar_term.start),
    dun: c.dun === 'yang' ? '阳遁' : '阴遁', yuan: c.yuan === 'upper' ? '上元' : c.yuan === 'middle' ? '中元' : '下元',
    ju: c.ju, yuanHead: cycle(c.yuan_head), xunHead: cycle(c.xun.head), hidden: stems[c.xun.hidden_stem],
    voids: c.xun.void_branches.map(b => branches[b]), horseBranch: branches[c.horse.branch], horsePalace: c.horse.palace,
    leaderStar: stars[c.leaders.star], leaderDoor: doors[c.leaders.door], leaderOrigin: c.leaders.original_palace,
    starPalace: c.leaders.star_palace, doorPalace: c.leaders.door_palace, doorRawPalace: c.leaders.door_raw_palace,
    palaces: c.palaces.map(p => ({
      number: p.number, element: elements[p.element], earth: stems[p.earth_stem],
      hostedEarth: p.hosted_earth_stem ? stems[p.hosted_earth_stem] : null,
      heaven: p.heaven_stems.map(h => ({ stem: stems[h.stem], source: h.source_palace, hosted: h.is_center_hosted })),
      stars: p.stars.map(s => stars[s]), door: p.door ? doors[p.door] : null, deity: p.deity ? deities[p.deity] : null,
      voids: p.void_branches.map(b => branches[b]), horse: p.is_horse,
    })),
  };
  const record: QimenRecord = { kind: 'qimen', version: 1, engine: 'qimen-rs 0.2.1', id: `qimen-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(), date, time: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
    question: question.trim() || '此刻，我可以怎样更从容地面对眼前的事？', chart, interpretations: [] };
  if (!isQimenRecord(record)) throw new Error('排盘结果不完整，未保存。');
  return record;
}
const palaceNumber = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 9;
const member = (v: unknown, values: Record<string, string>): v is string => typeof v === 'string' && Object.values(values).includes(v);
const pair = (v: unknown): v is string => typeof v === 'string' && v.length === 2 && Object.values(stems).includes(v[0]) && Object.values(branches).includes(v[1]);
function isPalace(v: unknown, i: number): v is QimenPalace {
  return isObject(v) && v.number === i + 1 && member(v.element, elements) && member(v.earth, stems) &&
    (v.hostedEarth === null || member(v.hostedEarth, stems)) &&
    Array.isArray(v.heaven) && v.heaven.every(h => isObject(h) && member(h.stem, stems) && palaceNumber(h.source) && typeof h.hosted === 'boolean') &&
    Array.isArray(v.stars) && v.stars.every(s => member(s, stars)) &&
    (v.door === null || member(v.door, doors)) && (v.deity === null || member(v.deity, deities)) &&
    Array.isArray(v.voids) && v.voids.every(b => member(b, branches)) && typeof v.horse === 'boolean';
}
export function isQimenRecord(v: unknown): v is QimenRecord {
  if (!isObject(v) || v.kind !== 'qimen' || v.version !== 1 || v.engine !== 'qimen-rs 0.2.1' ||
      !nonemptyText(v.id, 200) || typeof v.createdAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt)) ||
      typeof v.date !== 'string' || typeof v.time !== 'string' || !nonemptyText(v.question, 300) ||
      !Array.isArray(v.interpretations) || !v.interpretations.every(isDivinationInterpretation) ||
      new Set(v.interpretations.map(a => a.id)).size !== v.interpretations.length || !isObject(v.chart)) return false;
  try { validateQimenInput(v.date, v.time, v.question); } catch { return false; }
  const c = v.chart;
  if (!Array.isArray(c.pillars) || c.pillars.length !== 4 || !c.pillars.every(pair) ||
      !['lunar', 'term', 'termStart', 'nextTerm', 'nextTermStart'].every(k => nonemptyText(c[k], 100)) ||
      !['阳遁', '阴遁'].includes(String(c.dun)) || !['上元', '中元', '下元'].includes(String(c.yuan)) ||
      !palaceNumber(c.ju) || !pair(c.yuanHead) || !pair(c.xunHead) || !member(c.hidden, stems) ||
      !member(c.horseBranch, branches) || !palaceNumber(c.horsePalace) ||
      !Array.isArray(c.voids) || c.voids.length !== 2 || !c.voids.every(b => member(b, branches)) ||
      !member(c.leaderStar, stars) || !member(c.leaderDoor, doors) ||
      !palaceNumber(c.leaderOrigin) || !palaceNumber(c.starPalace) || !palaceNumber(c.doorPalace) || !palaceNumber(c.doorRawPalace) ||
      !Array.isArray(c.palaces) || c.palaces.length !== 9 || !c.palaces.every(isPalace)) return false;
  const ps = c.palaces;
  return ps[4].stars.length === 0 && ps[4].door === null && ps[4].deity === null && ps[4].heaven.length === 0 &&
    new Set(ps.map(p => p.earth)).size === 9 && new Set(ps.flatMap(p => p.stars)).size === 9 &&
    ps.flatMap(p => p.stars).length === 9 && new Set(ps.flatMap(p => p.door ? [p.door] : [])).size === 8 &&
    new Set(ps.flatMap(p => p.deity ? [p.deity] : [])).size === 8 &&
    ps.flatMap(p => p.heaven).length === 9 && new Set(ps.flatMap(p => p.heaven.map(h => h.stem))).size === 9 &&
    ps[c.starPalace - 1].stars.includes(c.leaderStar) && ps[c.doorPalace - 1].door === c.leaderDoor &&
    ps[c.horsePalace - 1].horse;
}
export const isQimenList = (v: unknown): v is QimenRecord[] => Array.isArray(v) && v.every(isQimenRecord) && new Set(v.map(r => r.id)).size === v.length;
export const loadQimen = (): QimenRecord[] => readStoredValue(QIMEN_KEY, [], isQimenList);
const listeners = new Set<() => void>();
export function subscribeQimen(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
let writes = Promise.resolve();
export function updateQimen(update: (records: QimenRecord[]) => QimenRecord[]): Promise<void> {
  const next = writes.then(async () => {
    const records = update(loadQimen());
    if (!isQimenList(records)) throw new Error('奇门手记内容无效，未保存。');
    await setStorageItemsAtomically({ [QIMEN_KEY]: records });
    listeners.forEach(listener => listener());
  });
  writes = next.catch(error => { console.error('Could not persist Qimen records:', error); });
  return next;
}
export function patchQimen(id: string, update: (record: QimenRecord) => QimenRecord): Promise<void> {
  return updateQimen(records => {
    if (!records.some(r => r.id === id)) throw new Error('这份奇门手记已不存在。');
    return records.map(r => r.id === id ? update(r) : r);
  });
}
export const recoverQimen = (records: QimenRecord[]): QimenRecord[] => records.map(r => ({ ...r, interpretations: r.interpretations.map(a =>
  a.status === 'pending' ? { ...a, status: 'error', error: '上次解读已中断，不会自动重试。' } : a) }));
export function qimenContext(record: QimenRecord): string {
  if (!isQimenRecord(record)) throw new Error('奇门盘面无效，不能生成解读。');
  const c = record.chart;
  return [
    `【问题】${record.question}`, `起局：${record.date} ${record.time}，固定 UTC+08:00。规则：${QIMEN_METHOD}`,
    `计算引擎：${record.engine}；本地确定性排盘，AI 不得换盘。${c.lunar}`,
    `年、月、日、时柱：${c.pillars.join(' / ')}。23:00 后日柱按次日，节气仍按实际交节时刻。`,
    `当前节气：${c.term}，交节 ${c.termStart}；下一节气：${c.nextTerm}，交节 ${c.nextTermStart}。交节输出到秒不等于天文精度一秒。`,
    `${c.dun}${c.ju}局 · ${c.yuan}，符头${c.yuanHead}；时旬首${c.xunHead}，遁${c.hidden}。`,
    `值符${c.leaderStar}，旬首原宫${c.leaderOrigin}，落${QIMEN_PALACES[c.starPalace - 1]}宫；值使${c.leaderDoor}，飞数原落${c.doorRawPalace}，实际落${QIMEN_PALACES[c.doorPalace - 1]}宫。`,
    `时旬空亡${c.voids.join('、')}，仅是传统标记，不表示必定落空；时马${c.horseBranch}，落${QIMEN_PALACES[c.horsePalace - 1]}宫，不表示必定出行。`,
    '盘面南上北下、东左西右。中宫保留地盘干，天禽只随天芮显示一次；寄干始终注明来源。',
    ...c.palaces.map(p => `${QIMEN_PALACES[p.number - 1]}宫 / ${QIMEN_DIRECTIONS[p.number - 1]} / ${p.element}：地盘${p.earth}${p.hostedEarth ? `，地盘寄干${p.hostedEarth}（来自中五）` : ''}；天盘${p.heaven.map(h => `${h.stem}（来自${h.source}宫${h.hosted ? '、中五寄干' : ''}）`).join('、') || '无独立天盘'}；九星${p.stars.join('、') || '无独立星，天禽随芮'}；八门${p.door || '无'}；八神${p.deity || '无'}${p.voids.length ? `；时空${p.voids.join('、')}` : ''}${p.horse ? '；时马' : ''}。`),
    '本版不计算或宣称完整格局、暗干、旺衰、刑墓与门迫，不得自行补算这些注记。死门、惊门、白虎等只是传统名称，不预言死亡、灾祸或健康问题。',
    QIMEN_LIMIT,
  ].join('\n\n');
}
export const qimenShareText = (r: QimenRecord): string => [
  '山河秘仪 · 奇门问时', qimenContext(r),
  ...r.interpretations.filter(a => a.status === 'done').map(a => `${a.reader.mode === 'oracle' ? 'AI 解读' : `${a.reader.actorName}的解读`}：\n${a.text}`),
].join('\n\n');
