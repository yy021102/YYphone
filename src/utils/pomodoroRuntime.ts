import { readStoredValue, writeStoredValue } from './localStorage';

export const POMODORO_RUNTIME_KEY = 'yyphone:pomodoro-active-timer';
export const POMODORO_TASKS_KEY = 'yyphone:pomodoro-tasks';
export const POMODORO_RECORDS_KEY = 'yyphone:pomodoro-records';
export const POMODORO_GREENHOUSE_KEY = 'yyphone:pomodoro-greenhouse';

export interface PomodoroTimerSnapshot {
  phase: 'focus' | 'rest';
  isRunning: boolean;
  remainingSeconds: number;
  targetEndTime: number | null;
  focusMinutes: number;
  restMinutes: number;
  activeTaskId: string;
  companionCharId: string;
  companionCharName: string;
  sessionId: string;
}

interface StoredTask {
  id: string;
  title: string;
  completedCount: number;
  isDoneToday: boolean;
}

interface StoredSession {
  id: string;
  taskId?: string;
  taskTitle: string;
  durationMinutes: number;
  dateStr: string;
  timeStr: string;
  companionCharId?: string;
  companionCharName?: string;
}

interface StoredGreenhouse {
  dewDrops: number;
  pots: Record<string, unknown>;
  specimens: unknown[];
}

export const DEFAULT_POMODORO_TIMER: PomodoroTimerSnapshot = {
  phase: 'focus',
  isRunning: false,
  remainingSeconds: 25 * 60,
  targetEndTime: null,
  focusMinutes: 25,
  restMinutes: 5,
  activeTaskId: '',
  companionCharId: '',
  companionCharName: '',
  sessionId: '',
};

const isPomodoroTimerSnapshot = (value: unknown): value is PomodoroTimerSnapshot =>
  !!value &&
  typeof value === 'object' &&
  (value as PomodoroTimerSnapshot).phase !== undefined &&
  ((value as PomodoroTimerSnapshot).phase === 'focus' || (value as PomodoroTimerSnapshot).phase === 'rest') &&
  typeof (value as PomodoroTimerSnapshot).isRunning === 'boolean' &&
  typeof (value as PomodoroTimerSnapshot).remainingSeconds === 'number' &&
  ((value as PomodoroTimerSnapshot).targetEndTime === null ||
    typeof (value as PomodoroTimerSnapshot).targetEndTime === 'number') &&
  typeof (value as PomodoroTimerSnapshot).focusMinutes === 'number' &&
  typeof (value as PomodoroTimerSnapshot).restMinutes === 'number' &&
  typeof (value as PomodoroTimerSnapshot).activeTaskId === 'string' &&
  typeof (value as PomodoroTimerSnapshot).companionCharId === 'string' &&
  typeof (value as PomodoroTimerSnapshot).companionCharName === 'string' &&
  typeof (value as PomodoroTimerSnapshot).sessionId === 'string';

export const readPomodoroTimer = () =>
  readStoredValue(POMODORO_RUNTIME_KEY, DEFAULT_POMODORO_TIMER, isPomodoroTimerSnapshot);

export const savePomodoroTimer = (snapshot: PomodoroTimerSnapshot) =>
  writeStoredValue(POMODORO_RUNTIME_KEY, snapshot);

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const announceRuntimeChange = (snapshot: PomodoroTimerSnapshot, completedFocus: boolean) => {
  window.dispatchEvent(new CustomEvent('yyphone:pomodoro-runtime', {
    detail: { snapshot, completedFocus },
  }));
};

export function processPomodoroDeadline(now = Date.now()): PomodoroTimerSnapshot {
  const snapshot = readPomodoroTimer();
  if (!snapshot.isRunning || snapshot.targetEndTime === null) return snapshot;

  const remainingSeconds = Math.max(0, Math.ceil((snapshot.targetEndTime - now) / 1000));
  if (remainingSeconds > 0) {
    if (snapshot.remainingSeconds !== remainingSeconds) {
      const updated = { ...snapshot, remainingSeconds };
      announceRuntimeChange(updated, false);
      return updated;
    }
    return snapshot;
  }

  if (snapshot.phase === 'focus') {
    const completedAt = new Date(snapshot.targetEndTime);
    const records = readStoredValue<StoredSession[]>(
      POMODORO_RECORDS_KEY,
      [],
      (value): value is StoredSession[] => Array.isArray(value)
    );
    if (!records.some((record) => record.id === `rec-${snapshot.sessionId}`)) {
      const tasks = readStoredValue<StoredTask[]>(
        POMODORO_TASKS_KEY,
        [],
        (value): value is StoredTask[] => Array.isArray(value)
      );
      const task = tasks.find((item) => item.id === snapshot.activeTaskId);
      writeStoredValue(POMODORO_RECORDS_KEY, [{
        id: `rec-${snapshot.sessionId}`,
        taskId: task?.id,
        taskTitle: task?.title ?? '自由专注时光',
        durationMinutes: snapshot.focusMinutes,
        dateStr: localDate(completedAt),
        timeStr: completedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        companionCharId: snapshot.companionCharId || undefined,
        companionCharName: snapshot.companionCharName || undefined,
      }, ...records]);

      if (task) {
        writeStoredValue(POMODORO_TASKS_KEY, tasks.map((item) =>
          item.id === task.id
            ? { ...item, completedCount: item.completedCount + 1, isDoneToday: true }
            : item
        ));
      }

      const greenhouse = readStoredValue<StoredGreenhouse>(
        POMODORO_GREENHOUSE_KEY,
        { dewDrops: 0, pots: {}, specimens: [] },
        (value): value is StoredGreenhouse =>
          !!value &&
          typeof value === 'object' &&
          typeof (value as StoredGreenhouse).dewDrops === 'number' &&
          !!(value as StoredGreenhouse).pots &&
          Array.isArray((value as StoredGreenhouse).specimens)
      );
      writeStoredValue(POMODORO_GREENHOUSE_KEY, {
        ...greenhouse,
        dewDrops: greenhouse.dewDrops + 1,
      });
    }

    const updated: PomodoroTimerSnapshot = {
      ...snapshot,
      phase: 'rest',
      isRunning: false,
      remainingSeconds: snapshot.restMinutes * 60,
      targetEndTime: null,
      sessionId: '',
    };
    savePomodoroTimer(updated);
    announceRuntimeChange(updated, true);
    return updated;
  }

  const updated: PomodoroTimerSnapshot = {
    ...snapshot,
    phase: 'focus',
    isRunning: false,
    remainingSeconds: snapshot.focusMinutes * 60,
    targetEndTime: null,
    sessionId: '',
  };
  savePomodoroTimer(updated);
  announceRuntimeChange(updated, false);
  return updated;
}
