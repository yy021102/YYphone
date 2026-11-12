export interface DailyTaskState {
  id: string; category?: 'daily' | 'temp'; isDoneToday: boolean;
  lastCompletedDate?: string; endedAt?: string;
}
export interface TaskSessionDate { taskId?: string; dateStr: string }

/** Migrate old completion flags using dated sessions; totals and history never reset. */
export function refreshDailyTasks<T extends DailyTaskState>(tasks: T[], records: TaskSessionDate[], today: string): T[] {
  const latest = new Map<string, string>();
  for (const record of records) if (record.taskId && record.dateStr > (latest.get(record.taskId) ?? '')) latest.set(record.taskId, record.dateStr);
  let changed = false;
  const next = tasks.map(task => {
    if (task.category !== 'daily') return task;
    const lastCompletedDate = [task.lastCompletedDate ?? '', latest.get(task.id) ?? ''].sort().at(-1)!;
    const isDoneToday = !task.endedAt && lastCompletedDate === today;
    if (task.isDoneToday === isDoneToday && (task.lastCompletedDate ?? '') === lastCompletedDate) return task;
    changed = true;
    return { ...task, isDoneToday, ...(lastCompletedDate ? { lastCompletedDate } : {}) };
  });
  return changed ? next : tasks;
}
