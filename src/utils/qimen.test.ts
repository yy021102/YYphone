import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { initSync } from '@spensercai/qimen-wasm';
import { SearchSunLongitude } from 'astronomy-engine';
import {
  QIMEN_KEY, createQimenRecord, isQimenRecord, loadQimen, patchQimen, qimenContext, qimenNow,
  qimenShareText, recoverQimen, subscribeQimen, updateQimen, validateQimenInput,
} from './qimen';
import { removeStorageItem, setStorageItemsAtomically } from './dbStorage';

initSync({ module: readFileSync(new URL('../../node_modules/@spensercai/qimen-wasm/qimen_wasm_bg.wasm', import.meta.url)) });
const make = (date = '2024-01-01', time = '01:00:00') => createQimenRecord(date, time, '怎样更好地沟通？');

test('fixed Beijing civil clock is independent of host timezone and validates real dates and seconds', () => {
  assert.deepEqual(qimenNow(new Date('2024-01-01T16:01:02Z')), { date: '2024-01-02', time: '00:01:02' });
  for (const [date, time] of [['2024-02-30', '12:00'], ['1899-12-31', '12:00'], ['2101-01-01', '12:00'], ['2024-01-01', '24:00'], ['2024-01-01', '00:00:60']])
    assert.throws(() => validateQimenInput(date, time, ''));
  assert.throws(() => validateQimenInput('2024-01-01', '00:00', '问'.repeat(301)), /300/);
  assert.equal(make('2024-02-29', '00:00').time, '00:00:00');
  assert.equal(createQimenRecord('2024-01-01', '00:00', '   ').question, '此刻，我可以怎样更从容地面对眼前的事？');
});
test('Yang-one Jia-Zi and Yi-Chou fixtures preserve all layers, not just leaders', () => {
  const base = make('2024-01-01', '00:00').chart;
  assert.deepEqual(base.pillars, ['癸卯', '甲子', '甲子', '甲子']);
  assert.equal(base.dun, '阳遁'); assert.equal(base.ju, 1); assert.equal(base.yuan, '上元');
  assert.equal(base.palaces.map(p => p.earth).join(''), '戊己庚辛壬癸丁丙乙');
  assert.equal(base.starPalace, 1); assert.equal(base.doorPalace, 1);
  const c = make().chart;
  // Hand-derived fixed-ring reference: qimen-rs algorithm-sources.md, Yang-one / Yi-Chou example.
  assert.equal(c.pillars[3], '乙丑');
  assert.deepEqual(c.palaces.map(p => p.heaven.map(h => h.stem).join('')), ['乙','丙','丁','癸','','辛','庚','己壬','戊']);
  assert.deepEqual(c.palaces.map(p => p.stars.join('')), ['天英','天任','天柱','天心','','天辅','天冲','天芮天禽','天蓬']);
  assert.deepEqual(c.palaces.map(p => p.door), ['杜门','休门','死门','惊门',null,'伤门','生门','景门','开门']);
  assert.deepEqual(c.palaces.map(p => p.deity), ['白虎','腾蛇','九地','九天',null,'六合','太阴','玄武','值符']);
  assert.deepEqual(c.palaces[7].heaven[1], { stem: '壬', source: 5, hosted: true });
  assert.equal(c.palaces[1].hostedEarth, '壬');
});
test('center-origin chief remains Tian-Qin and duty door counts from original five before hosting', () => {
  const c = make('2024-01-11', '01:00').chart;
  assert.equal(c.dun, '阳遁'); assert.equal(c.ju, 5); assert.equal(c.pillars[3], '乙丑');
  assert.equal(c.leaderOrigin, 5); assert.equal(c.leaderStar, '天禽'); assert.equal(c.starPalace, 4);
  assert.equal(c.leaderDoor, '死门'); assert.equal(c.doorPalace, 6);
  const middle = make('2024-01-01', '07:00').chart;
  assert.equal(middle.pillars[3], '戊辰'); assert.equal(middle.doorRawPalace, 5); assert.equal(middle.doorPalace, 2);
});
test('Yin-nine Ren-Shen hosts the hour stem, reverses only deities and retains all nine heaven stems', () => {
  const c = make('2024-06-29', '16:00').chart;
  assert.equal(c.dun, '阴遁'); assert.equal(c.ju, 9); assert.equal(c.pillars[3], '壬申');
  assert.equal(c.palaces[4].earth, '壬'); assert.equal(c.starPalace, 2); assert.equal(c.doorPalace, 1);
  assert.deepEqual(c.palaces.map(p => p.deity), ['玄武','值符','六合','太阴',null,'九地','九天','白虎','腾蛇']);
  assert.equal(c.palaces.flatMap(p => p.heaven).length, 9);
  assert.equal(c.palaces.filter(p => p.stars.includes('天禽')).length, 1);
});
test('23:00 advances day and hour together, while solar terms switch at the actual second', () => {
  const before = make('2024-01-01', '22:59:59').chart, after = make('2024-01-01', '23:00:00').chart;
  assert.equal(before.pillars[2], '甲子'); assert.equal(after.pillars[2], '乙丑'); assert.equal(after.pillars[3], '丙子');
  assert.deepEqual(after.pillars, make('2024-01-02', '00:00:00').chart.pillars);
  const a = make('2024-01-06', '04:49:21').chart, b = make('2024-01-06', '04:49:22').chart;
  assert.equal(a.term, '冬至'); assert.equal(b.term, '小寒');
  assert.equal(a.ju, 7); assert.equal(b.ju, 8);
  assert.equal(b.yuan, '中元'); assert.equal(b.yuanHead, '己巳');
});
test('independent astronomy and Julian-day checks cover seasonal, day-boundary and year-range conventions', () => {
  for (const date of ['1900-01-01','1950-06-01','2000-01-07','2024-01-01','2100-12-31']) {
    const r = make(date, '12:00');
    const julianDay = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000 + 2440588);
    const index = ((julianDay + 49) % 60 + 60) % 60;
    assert.equal(r.chart.pillars[2], '甲乙丙丁戊己庚辛壬癸'[index % 10] + '子丑寅卯辰巳午未申酉戌亥'[index % 12]);
  }
  const term = make('2024-06-22', '12:00').chart.termStart;
  const engineInstant = Date.parse(term.replace(' ', 'T').replace(' +08:00', '+08:00'));
  const independent = SearchSunLongitude(90, new Date('2024-06-19T00:00Z'), 5);
  assert.ok(independent);
  assert.ok(Math.abs(engineInstant - independent.date.getTime()) < 120000, 'Summer solstice must agree within two minutes');
});
test('snapshots are complete, strictly validated and sharing excludes unfinished readings', () => {
  const r = make();
  assert.ok(isQimenRecord(JSON.parse(JSON.stringify(r))));
  assert.ok(!isQimenRecord({ ...r, chart: { ...r.chart, palaces: r.chart.palaces.slice(1) } }));
  assert.ok(!isQimenRecord({ ...r, chart: { ...r.chart, starPalace: 0 } }));
  assert.ok(!isQimenRecord({ ...r, interpretations: [{ status: 'done', text: '' }] }));
  r.interpretations = [
    { id: 'done', reader: { mode: 'character', actorId: 'fixture', actorName: '测试角色' }, status: 'done', text: '已完成的温柔提醒', createdAt: r.createdAt },
    { id: 'pending', reader: { mode: 'oracle' }, status: 'pending', text: '未完成的秘密片段', createdAt: r.createdAt },
  ];
  const context = qimenContext(r), share = qimenShareText(r);
  for (const text of ['UTC+08:00', '23:00', '旬首', '中五寄干', '不表示必定落空', '不是科学预测']) assert.ok(context.includes(text));
  assert.ok(share.includes('测试角色')); assert.ok(share.includes('已完成的温柔提醒')); assert.ok(!share.includes('未完成的秘密片段'));
  const recovered = recoverQimen([r]);
  assert.equal(recovered[0].interpretations[0].status, 'done'); assert.equal(recovered[0].interpretations[1].status, 'error');
  assert.equal(r.interpretations[1].status, 'pending');
});
test('durable queued history updates, interrupted readings, deletion and failed writes stay explicit', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string,string>();
  let deny = false, notifications = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (deny) throw new Error('fixture storage denied'); values.set(key, value); },
    removeItem: (key: string) => values.delete(key),
  } } });
  const unsubscribe = subscribeQimen(() => { notifications++; });
  try {
    await setStorageItemsAtomically({ [QIMEN_KEY]: [] });
    const a = make(), b = make('2024-06-29','16:00');
    await Promise.all([updateQimen(s => [a,...s]), updateQimen(s => [b,...s])]);
    assert.equal(loadQimen().length, 2); assert.equal(notifications, 2);
    await patchQimen(a.id, r => ({ ...r, interpretations: [{ id: 'pending', reader: { mode: 'oracle' }, status: 'pending', text: '', createdAt: r.createdAt }] }));
    await updateQimen(recoverQimen);
    assert.equal(loadQimen().find(r => r.id === a.id)!.interpretations[0].status, 'error');
    const snapshot = JSON.parse(values.get(QIMEN_KEY)!);
    deny = true;
    await assert.rejects(updateQimen(s => s.filter(r => r.id !== a.id)), /fixture storage denied/);
    assert.deepEqual(loadQimen(), snapshot);
    deny = false;
    await updateQimen(s => s.filter(r => r.id !== a.id));
    assert.deepEqual(loadQimen(), [b]);
    await assert.rejects(patchQimen('absent', r => r), /不存在/);
    await assert.rejects(updateQimen(s => [...s, b]), /无效/);
    assert.equal(JSON.parse(values.get(QIMEN_KEY)!).length, 1);
  } finally {
    unsubscribe(); deny = false; await removeStorageItem(QIMEN_KEY);
    if (previous) Object.defineProperty(globalThis,'window',previous); else Reflect.deleteProperty(globalThis,'window');
  }
});
