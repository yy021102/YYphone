import { readStoredValue, writeStoredValue } from './localStorage';

export const CALENDAR_STORAGE_KEY = 'yyphone:calendar-data';
export const CALENDAR_EXPORT_FORMAT = 'yyphone-calendar';

export type CalendarEntryKind = 'schedule' | 'todo' | 'birthday' | 'period';

export interface CalendarEntry {
  id: string;
  kind: CalendarEntryKind;
  // YYYY-MM-DD；生日按每年的月日循环，经期为起始日。
  date: string;
  endDate?: string;
  title: string;
  time?: string;
  done?: boolean;
}

export interface CharacterSchedule {
  id: string;
  charId: string;
  date: string;
  text: string;
}

export interface CalendarData {
  entries: CalendarEntry[];
  visibleCharacterIds: string[];
  scheduleCharacterIds: string[];
  schedules: CharacterSchedule[];
}

export const KIND_LABELS: Record<CalendarEntryKind, string> = {
  schedule: '日程',
  todo: '待办',
  birthday: '生日',
  period: '经期',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UPCOMING_DAYS = 7;

export const emptyCalendarData = (): CalendarData => ({
  entries: [],
  visibleCharacterIds: [],
  scheduleCharacterIds: [],
  schedules: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && DATE_PATTERN.test(value);

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isEntry = (value: unknown): value is CalendarEntry =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  (value.kind === 'schedule' || value.kind === 'todo' || value.kind === 'birthday' || value.kind === 'period') &&
  isDateKey(value.date) &&
  (value.endDate === undefined || isDateKey(value.endDate)) &&
  typeof value.title === 'string' &&
  (value.time === undefined || typeof value.time === 'string') &&
  (value.done === undefined || typeof value.done === 'boolean');

const isSchedule = (value: unknown): value is CharacterSchedule =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.charId === 'string' &&
  isDateKey(value.date) &&
  typeof value.text === 'string';

export const isCalendarData = (value: unknown): value is CalendarData =>
  isRecord(value) &&
  Array.isArray(value.entries) && value.entries.every(isEntry) &&
  isStringList(value.visibleCharacterIds) &&
  isStringList(value.scheduleCharacterIds) &&
  Array.isArray(value.schedules) && value.schedules.every(isSchedule);

export const readCalendarData = (): CalendarData =>
  readStoredValue(CALENDAR_STORAGE_KEY, emptyCalendarData(), isCalendarData);

export const writeCalendarData = (data: CalendarData) => writeStoredValue(CALENDAR_STORAGE_KEY, data);

const pad = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const weekdayLabel = (key: string) => WEEKDAYS[parseDateKey(key).getDay()];

export const entriesOnDate = (entries: CalendarEntry[], dateKey: string): CalendarEntry[] =>
  entries.filter((entry) => {
    if (entry.kind === 'birthday') return entry.date.slice(5) === dateKey.slice(5);
    if (entry.kind === 'period') {
      const end = entry.endDate && entry.endDate >= entry.date ? entry.endDate : entry.date;
      return dateKey >= entry.date && dateKey <= end;
    }
    return entry.date === dateKey;
  });

export const sortEntries = (entries: CalendarEntry[]) =>
  [...entries].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));

const describeEntry = (entry: CalendarEntry) =>
  `${entry.time ? `${entry.time} ` : ''}${entry.title}`;

const formatSpan = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}小时${m > 0 ? `${m}分钟` : ''}` : `${m}分钟`;
};

/** 从日程的 time 字段，或标题里的“下午3点半 / 15:30 / 晚上8点”这类说法里推断开始时间（分钟数）。 */
const inferStartMinutes = (entry: CalendarEntry): number | null => {
  const direct = entry.time ? /^(\d{1,2}):(\d{2})/.exec(entry.time) : null;
  if (direct) return Number(direct[1]) * 60 + Number(direct[2]);
  const text = entry.title;
  const clock = /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?\s*(\d{1,2})\s*(?:[:：]|点|时)\s*(半|\d{1,2})?/.exec(text);
  if (clock) {
    let hour = Number(clock[2]);
    const period = clock[1];
    if ((period === '下午' || period === '傍晚' || period === '晚上' || period === '夜里') && hour < 12) hour += 12;
    if (period === '中午' && hour < 11) hour += 12;
    if (hour > 24) return null;
    const minute = clock[3] === '半' ? 30 : clock[3] ? Number(clock[3]) : 0;
    return hour * 60 + minute;
  }
  // 只说了大概时段
  if (/凌晨/.test(text)) return 1 * 60;
  if (/早上|早晨|上午/.test(text)) return 8 * 60;
  if (/中午/.test(text)) return 12 * 60;
  if (/下午/.test(text)) return 14 * 60;
  if (/傍晚/.test(text)) return 17 * 60 + 30;
  if (/晚上|夜里/.test(text)) return 19 * 60 + 30;
  return null;
};

/** 今天的日程，标注它相对“现在”是还没开始、刚开始还是已经过去，避免角色把还没发生的事当成已经发生。 */
const describeTodayEntry = (entry: CalendarEntry, now: Date) => {
  const base = describeEntry(entry);
  const start = inferStartMinutes(entry);
  if (start === null) return base;
  const diff = start - (now.getHours() * 60 + now.getMinutes());
  if (diff > 0) return `${base}（还没开始，还有${formatSpan(diff)}）`;
  if (diff >= -90) return `${base}（已经开始约${formatSpan(-diff) === '0分钟' ? '一会儿' : formatSpan(-diff)}，可能还在进行）`;
  return `${base}（已经过去${formatSpan(-diff)}）`;
};

const buildPlayerSection = (data: CalendarData, today: Date): string | null => {
  const todayKey = toDateKey(today);
  const lines: string[] = [];

  const todayEntries = sortEntries(entriesOnDate(data.entries, todayKey));
  const todayLines = [
    ...todayEntries.filter((entry) => entry.kind === 'schedule').map((entry) => `日程：${describeTodayEntry(entry, today)}`),
    ...todayEntries.filter((entry) => entry.kind === 'todo' && !entry.done).map((entry) => `待办：${entry.title}`),
  ];
  if (todayLines.length > 0) {
    lines.push(
      `今天（${todayKey} ${weekdayLabel(todayKey)}，现在是 ${pad(today.getHours())}:${pad(today.getMinutes())}）：`,
      '（每条日程后面标注了它相对现在的状态。标注“还没开始”的事情还没有发生，不要说成已经发生，也不要问感受或结果，可以期待、提醒或随口聊聊；只有“已经过去”的才能问进行得怎么样。）',
      ...todayLines.map((line) => `- ${line}`)
    );
  }

  const upcomingLines: string[] = [];
  for (let offset = 1; offset <= UPCOMING_DAYS; offset += 1) {
    const day = addDays(today, offset);
    const key = toDateKey(day);
    sortEntries(entriesOnDate(data.entries, key))
      .filter((entry) => entry.kind === 'schedule' || (entry.kind === 'todo' && !entry.done))
      .forEach((entry) => {
        upcomingLines.push(
          `- ${key.slice(5)} ${weekdayLabel(key)}（${offset} 天后）${KIND_LABELS[entry.kind]}：${describeEntry(entry)}`
        );
      });
  }
  if (upcomingLines.length > 0) lines.push('未来 7 天：', ...upcomingLines);

  const specialLines: string[] = [];
  data.entries
    .filter((entry) => entry.kind === 'birthday')
    .forEach((entry) => {
      for (let offset = 0; offset <= UPCOMING_DAYS; offset += 1) {
        const key = toDateKey(addDays(today, offset));
        if (entry.date.slice(5) === key.slice(5)) {
          specialLines.push(
            `- 生日：${entry.title}（${key.slice(5)}，${offset === 0 ? '就是今天' : `${offset} 天后`}）`
          );
          break;
        }
      }
    });
  const yesterdayKey = toDateKey(addDays(today, -1));
  // 仅在经期当下注入；刚结束的次日告知一次“已结束”，其余时间（含未来经期）都不发送。
  data.entries
    .filter((entry) => entry.kind === 'period')
    .forEach((entry) => {
      const end = entry.endDate && entry.endDate >= entry.date ? entry.endDate : entry.date;
      if (entry.date <= todayKey && todayKey <= end) {
        specialLines.push(
          `- 玩家目前正处于经期（${entry.date}${end !== entry.date ? ` ~ ${end}` : ''}），可结合人设适度、自然地关心（如身体不适、保暖、饮食、休息），不要频繁提及或过度追问。`
        );
      } else if (end === yesterdayKey) {
        specialLines.push('- 玩家的经期已经结束，不要再把玩家当作处于经期并关心；如情境自然，可简短提一句她恢复了就好。');
      }
    });
  if (specialLines.length > 0) lines.push('特殊日期：', ...specialLines);

  return lines.length > 0 ? lines.join('\n') : null;
};

/**
 * 生成注入聊天提示词的日历信息。
 * 只发送今天及未来 7 天的内容，已经过去的日期不再发送；
 * 玩家日程仅对被勾选“可见”且在当前聊天中的角色可见。
 */
export const buildCalendarContext = (
  participantIds: string[],
  getName: (id: string) => string | undefined,
  includePlayerSchedule: boolean,
  now = new Date()
): string | null => {
  const data = readCalendarData();
  const todayKey = toDateKey(now);
  const sections: string[] = [];

  if (includePlayerSchedule) {
    const viewers = data.visibleCharacterIds
      .filter((id) => participantIds.includes(id))
      .flatMap((id) => {
        const name = getName(id);
        return name ? [name] : [];
      });
    const playerSection = viewers.length > 0 ? buildPlayerSection(data, now) : null;
    if (playerSection) {
      sections.push(
        `玩家的日程与日期（仅${viewers.join('、')}知道这些信息，聊天中的其他角色并不知道；请在合适的时候自然地提及或关心，不要生硬复述）：\n${playerSection}`
      );
    }
  }

  const scheduleLines = data.schedules
    .filter((schedule) => schedule.date === todayKey && schedule.text.trim() && participantIds.includes(schedule.charId))
    .flatMap((schedule) => {
      const name = getName(schedule.charId);
      return name
        ? [`${name}今天（${todayKey}）的行程（现在是 ${pad(now.getHours())}:${pad(now.getMinutes())}，请据此知道自己此刻大概在做什么、接下来要做什么，聊天时自然体现，如正忙、刚忙完、马上要出门，不必逐条复述；比现在时间更晚的安排还没有发生，不要当成已经做过）：\n${schedule.text.trim()}`]
        : [];
    });
  if (scheduleLines.length > 0) sections.push(scheduleLines.join('\n\n'));

  return sections.length > 0 ? `当前环境（日历）：\n${sections.join('\n\n')}` : null;
};
