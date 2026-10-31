import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCalendarData, entriesOnDate, isCalendarData } from './calendarData';
import { blankPeriodLog, daysBetween, defaultPeriodTracking, isPeriodTracking, periodLogs, periodOverview, savePeriodLogs, shiftDay, validPeriodDate } from './periodTracking';

test('legacy spans and notes are retained, edits split actual dates and preserve unrelated calendar settings', () => {
  const data = { ...emptyCalendarData(), visibleCharacterIds: ['a'], entries: [{ id: 'old', kind: 'period' as const, date: '2026-10-01', endDate: '2026-10-05', title: '有点累' }, { id: 'todo', kind: 'todo' as const, date: '2026-10-03', title: '看书' }] };
  const logs = periodLogs(data);
  assert.equal(logs.length, 5); assert.equal(logs[2].note, '有点累');
  const next = savePeriodLogs(data, logs.map(log => log.date === '2026-10-03' ? { ...log, flow: undefined, symptoms: ['腹痛'] } : log));
  assert.equal(entriesOnDate(next.entries, '2026-10-03').some(e => e.kind === 'period'), false);
  assert.equal(next.entries.filter(e => e.kind === 'period').length, 2);
  assert.equal(periodLogs(next).find(l => l.date === '2026-10-03')?.flow, undefined);
  assert.deepEqual(periodLogs(next).find(l => l.date === '2026-10-03')?.symptoms, ['腹痛']);
  assert.deepEqual(next.visibleCharacterIds, ['a']); assert.equal(next.entries.find(e => e.id === 'todo')?.title, '看书');
  assert.equal(data.entries.length, 2);
  assert.equal(isCalendarData(JSON.parse(JSON.stringify(next))), true);
});

test('spotting and symptoms alone are not shared as menstruation; removing a record does not resurrect old spans', () => {
  const data = savePeriodLogs(emptyCalendarData(), [{ ...blankPeriodLog('2026-10-20'), spotting: true, symptoms: ['头痛'], note: '今天的感受' }]);
  assert.equal(data.entries.length, 0); assert.equal(periodLogs(data).length, 1);
  const actual = savePeriodLogs(data, [{ ...periodLogs(data)[0], flow: 'light' }]);
  assert.equal(actual.entries.length, 1);
  const cleared = savePeriodLogs(actual, []);
  assert.equal(periodLogs(cleared).length, 0); assert.equal(cleared.entries.length, 0);
});

test('predictions use recent intervals, stay out of actual calendar entries, and never roll overdue dates forward', () => {
  const logs = ['2026-08-01', '2026-08-30', '2026-09-28'].flatMap(date => Array.from({ length: 5 }, (_, i) => ({ ...blankPeriodLog(shiftDay(date, i)), flow: 'medium' as const })));
  const data = savePeriodLogs(emptyCalendarData(), logs);
  const overview = periodOverview(data, '2026-10-31');
  assert.equal(overview.cycleLength, 29); assert.equal(overview.periodLength, 5);
  assert.equal(overview.predictedStart, '2026-10-27'); assert.equal(overview.predictedEnd, '2026-10-31');
  assert.equal(entriesOnDate(data.entries, '2026-10-27').length, 0);
  assert.equal(periodOverview({ ...data, periodTracking: { ...data.periodTracking!, predictions: false } }, '2026-10-31').predictedStart, undefined);
  const manual = periodOverview({ ...data, periodTracking: { ...data.periodTracking!, useHistory: false, cycleLength: 30, periodLength: 6 } }, '2026-10-31');
  assert.equal(manual.predictedStart, '2026-10-28'); assert.equal(manual.periodLength, 6);
  assert.equal(periodOverview(emptyCalendarData(), '2026-10-31').predictedStart, undefined);
});

test('date arithmetic and import validation reject impossible dates, invalid ranges and duplicate day logs', () => {
  assert.equal(shiftDay('2028-02-28', 1), '2028-02-29');
  assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
  assert.equal(validPeriodDate('2026-02-30'), false);
  assert.equal(isPeriodTracking(defaultPeriodTracking()), true);
  assert.equal(isCalendarData({ ...emptyCalendarData(), periodTracking: { ...defaultPeriodTracking(), cycleLength: 0 } }), false);
  const log = blankPeriodLog('2026-10-31');
  assert.equal(isPeriodTracking({ ...defaultPeriodTracking(), logs: [log, log] }), false);
  assert.equal(isPeriodTracking({ ...defaultPeriodTracking(), logs: [{ ...log, flow: 'unknown' }] }), false);
});
