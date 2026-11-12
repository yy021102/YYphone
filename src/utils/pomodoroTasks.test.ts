import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshDailyTasks } from './pomodoroTasks';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStoredValue } from './localStorage';
import { DEFAULT_POMODORO_TIMER, processPomodoroDeadline, POMODORO_TASKS_KEY, POMODORO_RECORDS_KEY, POMODORO_RUNTIME_KEY, POMODORO_GREENHOUSE_KEY } from './pomodoroRuntime';

const values = new Map<string, string>(), events = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: events.dispatchEvent.bind(events), localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; },
} } });
beforeEach(async () => { await clearDbStorage(); });
const task = { id: 'words', title: '每日背单词', category: 'daily' as const, focusMinutes: 30, restMinutes: 5, completedCount: 10, isDoneToday: true };

test('old daily flags recover completion dates from history and reset daily without losing totals', () => {
  const old: typeof task & { bgImageUrl: string; lastCompletedDate?: string } = { ...task, bgImageUrl: 'keep.png' };
  const first = refreshDailyTasks([old], [{ taskId: 'words', dateStr: '2026-11-11' }], '2026-11-12')[0];
  assert.equal(first.isDoneToday, false); assert.equal(first.completedCount, 10); assert.equal(first.bgImageUrl, 'keep.png'); assert.equal(first.lastCompletedDate, '2026-11-11');
  assert.equal(old.isDoneToday, true);
  const today = refreshDailyTasks([old], [{ taskId: 'words', dateStr: '2026-11-12' }], '2026-11-12')[0];
  assert.equal(today.isDoneToday, true);
  assert.equal(refreshDailyTasks([old], [], '2026-11-12')[0].isDoneToday, false, 'undated stale flags cannot remain permanently completed');
});

test('ending a daily task keeps its history and does not automatically reactivate on the next day', () => {
  const ended = { ...task, endedAt: '2026-11-12T08:00:00Z', lastCompletedDate: '2026-11-12' };
  const next = refreshDailyTasks([ended], [], '2026-11-13')[0];
  assert.equal(next.endedAt, ended.endedAt); assert.equal(next.completedCount, 10); assert.equal(next.isDoneToday, false);
  const resumed = refreshDailyTasks([{ ...next, endedAt: undefined }], [], '2026-11-13')[0];
  assert.equal(resumed.isDoneToday, false);
  const retained = refreshDailyTasks([{ ...task, lastCompletedDate: '2026-11-12' }], [], '2026-11-12')[0]; assert.equal(retained.isDoneToday, true, 'deleting old sessions does not erase a saved completion date');
  const temporary = [{ ...task, category: 'temp' as const }]; assert.equal(refreshDailyTasks(temporary, [], '2026-11-13'), temporary, 'one-off tasks do not reset daily');
});

test('a focus session completed before midnight is not counted as today after a late resume', async () => {
  const deadline = new Date(2026, 10, 12, 23, 59, 58).getTime();
  await setStorageItemsAtomically({
    [POMODORO_TASKS_KEY]: [task],
    [POMODORO_RUNTIME_KEY]: { ...DEFAULT_POMODORO_TIMER, activeTaskId: 'words', phase: 'focus', isRunning: true, targetEndTime: deadline, focusMinutes: 30, sessionId: 'midnight' },
  });
  processPomodoroDeadline(deadline + 5000);
  const tasks = readStoredValue(POMODORO_TASKS_KEY, [] as Array<typeof task & { lastCompletedDate: string }>, Array.isArray);
  assert.equal(tasks[0].completedCount, 11); assert.equal(tasks[0].isDoneToday, false); assert.equal(tasks[0].lastCompletedDate, '2026-11-12');
  const records = readStoredValue(POMODORO_RECORDS_KEY, [] as Array<{ dateStr: string }>, Array.isArray); assert.equal(records[0].dateStr, '2026-11-12');
  processPomodoroDeadline(deadline + 6000);
  assert.equal(readStoredValue(POMODORO_RECORDS_KEY, [], Array.isArray).length, 1, 'rechecking the deadline does not duplicate completion');
  const greenhouse = readStoredValue(POMODORO_GREENHOUSE_KEY, { dewDrops: 0, dewProgress: 0 }, (value): value is { dewDrops: number; dewProgress: number } => !!value);
  assert.equal(greenhouse.dewDrops, 1); assert.equal(greenhouse.dewProgress, 5);
});
