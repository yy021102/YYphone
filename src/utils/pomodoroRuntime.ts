import { readStoredValue, writeStoredValue } from './localStorage';
import { upsertContextNote } from './chatNotes';

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
  /** 还没凑够 1 滴露水的专注分钟数 */
  dewProgress?: number;
  pots: Record<string, unknown>;
  specimens: unknown[];
}

/** 每专注多少分钟换 1 滴露水 */
export const DEW_MINUTES = 25;

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
      // 露水按专注时长折算：每累计 DEW_MINUTES 分钟得 1 滴，不满的部分留到下一次。
      const totalMinutes = (greenhouse.dewProgress ?? 0) + snapshot.focusMinutes;
      writeStoredValue(POMODORO_GREENHOUSE_KEY, {
        ...greenhouse,
        dewDrops: greenhouse.dewDrops + Math.floor(totalMinutes / DEW_MINUTES),
        dewProgress: totalMinutes % DEW_MINUTES,
      });

      // 角色陪着一起完成的专注，记进和 TA 的聊天上下文（只记事实，不额外消耗请求）。
      if (snapshot.companionCharId && snapshot.companionCharId !== 'default_char') {
        try {
          upsertContextNote(snapshot.companionCharId, {
            id: `pomodoro-session-${snapshot.sessionId}`,
            source: 'pomodoro',
            title: '番茄钟陪伴',
            content: `一起专注了 ${snapshot.focusMinutes} 分钟 · ${task?.title ?? '自由专注时光'}`,
            detail: `你陪玩家用番茄钟一起专注了 ${snapshot.focusMinutes} 分钟，事项：${task?.title ?? '自由专注时光'}。`,
          });
        } catch (error) {
          console.warn('Could not record Pomodoro session in chat context.', error);
        }
      }
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
