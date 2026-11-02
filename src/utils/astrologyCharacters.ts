import { parseAiJson } from './aiResponse';
import { isObject, nonemptyText } from './divination';
import { ASTROLOGY_CITIES } from './astrologyCities';
import { birthInstant, findAscendantTime, validateBirthProfile, type BirthProfile } from './astrology';

export interface CharacterBirthProposal {
  date: string; time: string | null; city: string; targetAscendant: number | null; reason: string;
  evidence: { date: string; time: string; place: string };
  assumedFields: ('date' | 'time' | 'place')[];
}
const dateInQuote = (quote: string) => quote.match(/(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/);
function timeInQuote(quote: string): string | undefined {
  const clock = quote.match(/(\d{1,2})[:：](\d{2})/);
  const chinese = quote.match(/(\d{1,2})[时点](?:(\d{1,2})分?|半|整)?/);
  const found = clock ?? chinese;
  if (!found) return undefined;
  let hour = Number(found[1]);
  const minute = found[2] ? Number(found[2]) : found[0].includes('半') ? 30 : 0;
  if (/下午|晚上|傍晚/.test(quote) && hour < 12) hour += 12;
  if (/凌晨|午夜/.test(quote) && hour === 12) hour = 0;
  return hour <= 23 && minute <= 59 ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : undefined;
}
export function parseCharacterBirthReply(text: string, source?: string): CharacterBirthProposal {
  const value: unknown = parseAiJson(text);
  if (!isObject(value) || typeof value.date !== 'string' || !(value.time === null || typeof value.time === 'string') ||
      typeof value.city !== 'string' || !ASTROLOGY_CITIES.some(city => city.name === value.city) ||
      !nonemptyText(value.reason, 700) || !isObject(value.evidence) || !Array.isArray(value.assumedFields) ||
      !value.assumedFields.every((field): field is 'date' | 'time' | 'place' => field === 'date' || field === 'time' || field === 'place'))
    throw new Error('角色档案草稿格式无效，请手动重试；不会自动补造字段。');
  const evidence = value.evidence;
  for (const field of ['date', 'time', 'place']) {
    if (typeof evidence[field] !== 'string' || evidence[field].length > 200 ||
        source !== undefined && evidence[field] && !source.includes(evidence[field])) throw new Error('草稿引用了角色设定中不存在的出生依据，请重试或手动填写。');
  }
  const target = value.targetAscendant;
  if (!(target === null || typeof target === 'number' && Number.isInteger(target) && target >= 0 && target <= 11))
    throw new Error('草稿的上升星座目标无效。');
  if (!evidence.time && target === null) throw new Error('没有明确出生时间时，草稿必须提供一个创作上升目标。');
  if (evidence.time && value.time === null) throw new Error('草稿引用了明确出生时间，却没有填写时间。');
  const explicitDate = dateInQuote(String(evidence.date));
  if (explicitDate && `${explicitDate[1]}-${explicitDate[2].padStart(2, '0')}-${explicitDate[3].padStart(2, '0')}` !== value.date)
    throw new Error('草稿改写了引用中的明确出生日期，请重新填写。');
  const explicitTime = timeInQuote(String(evidence.time));
  if (evidence.time && !explicitTime) throw new Error('引用不足以核对具体出生时刻，请手动填写或让角色重新留空时间并提供创作上升目标。');
  if (explicitTime && explicitTime !== value.time)
    throw new Error('草稿改写了引用中的明确出生时间，请重新填写。');
  return { date: value.date, time: evidence.time ? value.time : null, city: value.city, targetAscendant: target,
    reason: value.reason, assumedFields: value.assumedFields,
    evidence: { date: String(evidence.date), time: String(evidence.time), place: String(evidence.place) } };
}
export function characterProfileFromProposal(proposal: CharacterBirthProposal, actor: { id: string; name: string }, id: string): BirthProfile {
  const place = ASTROLOGY_CITIES.find(city => city.name === proposal.city);
  if (!place) throw new Error('没有找到草稿所选城市，请重新选择。');
  const assumedFields = new Set(proposal.assumedFields);
  for (const field of ['date', 'time', 'place'] as const) if (!proposal.evidence[field]) assumedFields.add(field);
  if (!dateInQuote(proposal.evidence.date)) assumedFields.add('date');
  if (!proposal.evidence.place.includes(proposal.city)) assumedFields.add('place');
  const profile: BirthProfile = { id, actorId: actor.id, name: actor.name, date: proposal.date, time: proposal.time ?? '12:00', timeKnown: true,
    fold: 'reject', place: { ...place }, creative: { generatedAt: new Date().toISOString(), assumedFields: [...assumedFields],
      reason: `${proposal.reason}\n生日依据：${proposal.evidence.date || '补设（含缺失年份）'}；时间依据：${proposal.evidence.time || '按上升目标匹配的补设时间'}；地点依据：${proposal.evidence.place || '近似城市补设，请核对'}。`,
      ...(proposal.time === null && proposal.targetAscendant !== null ? { targetAscendant: proposal.targetAscendant } : {}) } };
  validateBirthProfile(profile);
  if (proposal.time !== null) { birthInstant(profile); return profile; }
  if (proposal.targetAscendant === null) throw new Error('缺少上升创作目标。');
  return findAscendantTime(profile, proposal.targetAscendant);
}
