import { requestConfiguredAiText } from './aiApi';
import { parseAiJson } from './aiResponse';
import { buildCalendarContext } from './calendarData';
import { localDateString, readCharacterBrief } from './coupleSpaceData';

export const generateFocusRank = async (contacts: Array<{ id: string; name: string }>, now = new Date()) => {
  const elapsed = now.getHours() * 60 + now.getMinutes();
  const data = parseAiJson(await requestConfiguredAiText(
    '为虚构角色生成今天各自的学习/工作/创作专注时长与当前状态。这不是陪玩家的陪读时长，也不是玩家计时记录。根据各自人设、日程与当前时间合理编造，有差异，可以为0；不能把未来安排当成已完成。只返回JSON。',
    `现在：${now.toLocaleString('zh-CN')}。时长为0至${elapsed}的整数分钟。
角色：${JSON.stringify(contacts.map((contact) => ({ id: contact.id, ...readCharacterBrief(contact.id) })))}。
今日日程：${buildCalendarContext(contacts.map((contact) => contact.id), (id) => contacts.find((contact) => contact.id === id)?.name, false, now) || '无'}。
逐一返回所有角色，不多不少：{"characters":[{"id":"角色ID","todayMinutes":120,"statusText":"30字内说明自己的专注事项/当前状态"}]}`,
    { json: true }
  ));
  if (!data || typeof data !== 'object' || !('characters' in data) || !Array.isArray(data.characters) || data.characters.length !== contacts.length) {
    throw new Error('AI 未返回全部角色的专注排行，请重试。');
  }
  const seen = new Set<string>();
  return data.characters.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('角色排行格式无效。');
    const row = value as Record<string, unknown>;
    const contact = contacts.find((contact) => contact.id === row.id);
    if (!contact || seen.has(contact.id) || typeof row.todayMinutes !== 'number' ||
      !Number.isInteger(row.todayMinutes) || row.todayMinutes < 0 || row.todayMinutes > elapsed ||
      typeof row.statusText !== 'string' || !row.statusText.trim() || row.statusText.length > 100) {
      throw new Error('AI 返回的角色专注时间、身份或状态无效，未保存排行。');
    }
    seen.add(contact.id);
    return { id: `rank-${contact.id}`, charId: contact.id, name: contact.name,
      todayMinutes: row.todayMinutes, statusText: row.statusText.trim(), dateStr: localDateString(now) };
  });
};
