const TIMESTAMP_GAP_MS = 10 * 60 * 1000;

export const shouldShowTimestamp = (previous: string | undefined, current: string) => {
  const currentTime = Date.parse(current);
  if (Number.isNaN(currentTime)) return false;
  if (!previous) return true;
  const previousTime = Date.parse(previous);
  return Number.isNaN(previousTime) || currentTime - previousTime >= TIMESTAMP_GAP_MS;
};

export const effectiveChatTimeZone = (timeZone?: string) => timeZone === 'local' ? undefined : timeZone || 'Asia/Shanghai';

export const formatChatTimestamp = (value: string, timeZone?: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const makeDateParts = (d: Date) => Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d).map((part) => [part.type, part.value])
  );
  let dateFields: Record<string, string>;
  let nowFields: Record<string, string>;
  try {
    dateFields = makeDateParts(date);
    nowFields = makeDateParts(now);
  } catch (error) {
    console.error('Could not format chat timestamp for the selected time zone.', error);
    return timeZone ? formatChatTimestamp(value) : value;
  }
  const clock = `${pad(Number(dateFields.hour))}:${pad(Number(dateFields.minute))}`;
  const dayStart = (fields: Record<string, string>) =>
    Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day));
  const dayDiff = Math.round((dayStart(nowFields) - dayStart(dateFields)) / 86400000);
  if (dayDiff === 0) return clock;
  if (dayDiff === 1) return `昨天 ${clock}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = { Sun: '周日', Mon: '周一', Tue: '周二', Wed: '周三', Thu: '周四', Fri: '周五', Sat: '周六' }[dateFields.weekday];
    return `${weekday ?? dateFields.weekday} ${clock}`;
  }
  if (dateFields.year === nowFields.year) return `${dateFields.month}月${dateFields.day}日 ${clock}`;
  return `${dateFields.year}年${dateFields.month}月${dateFields.day}日 ${clock}`;
};
