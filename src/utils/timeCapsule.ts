export type TimeCapsule = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  unlockDate: string;
  createdAt: string;
  openedAt?: string;
  mood: string;
};

export const TIME_CAPSULE_STORAGE_KEY = 'yyppphh_time_capsules_v1';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isTimeCapsuleList(value: unknown): value is TimeCapsule[] {
  return Array.isArray(value) && value.every(item => item && typeof item === 'object'
    && typeof item.id === 'string' && typeof item.authorId === 'string'
    && typeof item.authorName === 'string' && typeof item.title === 'string'
    && typeof item.body === 'string' && typeof item.unlockDate === 'string'
    && datePattern.test(item.unlockDate) && typeof item.createdAt === 'string'
    && (item.openedAt === undefined || typeof item.openedAt === 'string')
    && typeof item.mood === 'string');
}

export function shanghaiToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function daysUntil(unlockDate: string, today: string): number {
  const toDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  return Math.max(0, toDay(unlockDate) - toDay(today));
}

export function tomorrowInShanghai(now = new Date()): string {
  const today = shanghaiToday(now);
  const [year, month, day] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
