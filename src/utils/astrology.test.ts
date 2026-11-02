import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Body, EquatorFromVector, Horizon, Observer, RotateVector, Rotation_ECT_EQD, Spherical, VectorFromSphere } from 'astronomy-engine';
import {
  ASPECTS, PLANETS, angleDistance, birthInstant, calculateNatal, chartAxes, createNatalRecord,
  isNatalRecord, natalContext, natalShareText, planetaryLongitude, recoverNatalRecords, signIndex, type BirthProfile,
  ASTROLOGY_KEY, loadAstrology, updateAstrology,
} from './astrology';
import { removeStorageItem } from './dbStorage';

const profile = (overrides: Partial<BirthProfile> = {}): BirthProfile => ({
  id: 'fixture', name: '测试档案', date: '2000-01-01', time: '20:00', timeKnown: true,
  place: { name: '北京', latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai' }, fold: 'reject', ...overrides,
});
test('geocentric date-ecliptic solar and lunar longitudes agree with NASA/JPL Horizons to 0.03 degrees', () => {
  // Horizons quantities=31, center=500@399, UTC 2000-01-01T12:00:00; see calculation notes in the app.
  const date = new Date('2000-01-01T12:00:00Z');
  assert.ok(angleDistance(planetaryLongitude(Body.Sun, date), 280.3689092) < .03);
  assert.ok(angleDistance(planetaryLongitude(Body.Moon, date), 223.323786) < .03);
  const equinox = new Date('2024-03-20T03:06:00Z');
  assert.ok(angleDistance(planetaryLongitude(Body.Sun, equinox), 0) < .03);
});
test('birth clock conversion handles China historical DST, foreign zones and skipped/repeated times', () => {
  assert.equal(birthInstant(profile()).date.toISOString(), '2000-01-01T12:00:00.000Z');
  assert.equal(birthInstant(profile({ date: '1990-07-01', time: '12:00' })).offsetMinutes, 540);
  const ny = { name: '纽约', latitude: 40.7, longitude: -74, timeZone: 'America/New_York' };
  assert.throws(() => birthInstant(profile({ date: '2024-03-10', time: '02:30', place: ny })), /不存在/);
  assert.throws(() => birthInstant(profile({ date: '2024-11-03', time: '01:30', place: ny })), /两次/);
  assert.equal(birthInstant(profile({ date: '2024-11-03', time: '01:30', place: ny, fold: 'earlier' })).date.toISOString(), '2024-11-03T05:30:00.000Z');
  assert.equal(birthInstant(profile({ date: '2024-11-03', time: '01:30', place: ny, fold: 'later' })).date.toISOString(), '2024-11-03T06:30:00.000Z');
  assert.throws(() => birthInstant(profile({ date: '2001-02-29' })), /有效/);
  assert.throws(() => birthInstant(profile({ place: { ...ny, timeZone: 'invalid' } })), /时区/);
});
test('ascendant is the eastern horizon intersection and midheaven lies on the upper meridian across locations', () => {
  for (const [latitude, longitude] of [[0, 0], [39.9, 116.4], [-33.9, 151.2], [70, 20], [-70, -50]]) {
    for (const hour of [0, 6, 12, 18]) {
      const date = new Date(Date.UTC(2024, 6, 1, hour));
      const axes = chartAxes(date, latitude, longitude);
      const horizontal = (angle: number) => {
        const eqd = RotateVector(Rotation_ECT_EQD(date), VectorFromSphere(new Spherical(0, angle, 1), date));
        const { ra, dec } = EquatorFromVector(eqd);
        return Horizon(date, new Observer(latitude, longitude, 0), ra, dec);
      };
      const rising = horizontal(axes.ascendant), mc = horizontal(axes.midheaven);
      assert.ok(Math.abs(rising.altitude) < .001);
      assert.ok(rising.azimuth >= 0 && rising.azimuth <= 180, `${latitude}: must rise in the east`);
      assert.ok(Math.abs(Math.sin(mc.azimuth * Math.PI / 180)) < .001);
    }
  }
});
test('whole-sign chart uses all ten planets, valid houses and declared aspect orbs', () => {
  const chart = calculateNatal(profile());
  assert.equal(chart.planets.length, 10);
  assert.equal(chart.cusps.length, 12);
  assert.equal(chart.cusps[0], signIndex(chart.ascendant) * 30);
  for (const planet of chart.planets) {
    assert.ok(planet.house >= 1 && planet.house <= 12);
    assert.equal(planet.house, (signIndex(planet.longitude) - signIndex(chart.ascendant) + 12) % 12 + 1);
    assert.ok(PLANETS.some(body => body.id === planet.id));
  }
  for (const aspect of chart.aspects) {
    const definition = ASPECTS.find(candidate => candidate.id === aspect.kind);
    assert.ok(definition);
    assert.ok(aspect.orb <= definition.orb);
  }
  const solarLunar = chart.aspects.find(aspect => aspect.a === Body.Sun && aspect.b === Body.Moon);
  assert.equal(solarLunar?.kind, 'sextile');
  assert.ok(Math.abs(solarLunar.orb - 2.9548768) < .06);
  assert.equal(signIndex(-.01), 11);
  assert.equal(signIndex(360), 0);
  assert.equal(signIndex(30), 1);
  assert.ok(Math.abs(angleDistance(359.9, .1) - .2) < 1e-10);
  assert.ok(Math.abs(angleDistance(-720.1, 360.1) - .2) < 1e-10);
});
test('unknown time is local noon, not UTC noon, with explicit sampled sign candidates and aspect ranges', () => {
  const record = createNatalRecord(profile({ date: '2024-03-20', time: '04:50', timeKnown: false }), '');
  assert.equal(record.profile.time, '12:00');
  assert.equal(record.chart.utc, '2024-03-20T04:00:00.000Z');
  assert.equal(record.chart.noonReference, true);
  assert.ok(record.chart.planets[0].possibleSigns.includes(11));
  assert.ok(record.chart.planets[0].possibleSigns.includes(0));
  assert.ok(record.chart.aspects.every(aspect => aspect.dayRange && aspect.dayRange[0] <= aspect.dayRange[1]));
  assert.match(natalContext(record), /上升、天顶、全部宫位不可信/);
  assert.match(natalShareText(record), /每30分钟/);
});
test('saved records validate shape, preserve snapshots and recover pending attempts without modifying successful ones', () => {
  const input = profile(), record = createNatalRecord(input, '如何更好地照顾自己？');
  input.place.name = '已修改的档案';
  assert.equal(record.profile.place.name, '北京');
  assert.ok(isNatalRecord(JSON.parse(JSON.stringify(record))));
  assert.ok(!isNatalRecord({ ...record, chart: { ...record.chart, planets: record.chart.planets.slice(1) } }));
  assert.ok(!isNatalRecord({ ...record, chart: { ...record.chart, ascendant: NaN } }));
  record.interpretations = [
    { id: 'pending', reader: { mode: 'oracle' }, status: 'pending', text: '', createdAt: record.createdAt },
    { id: 'done', reader: { mode: 'character', actorId: 'fixture', actorName: '测试角色' }, status: 'done', text: '请把星盘当作思考的角度。', createdAt: record.createdAt },
  ];
  const [recovered] = recoverNatalRecords([record]);
  assert.equal(record.interpretations[0].status, 'pending');
  assert.equal(recovered.interpretations[0].status, 'error');
  assert.deepEqual(recovered.chart, record.chart);
  assert.deepEqual(recovered.interpretations[1], record.interpretations[1]);
  assert.match(natalShareText(recovered), /测试角色的解读/);
});
test('birth-profile and chart writes are durable, serialized, and surface storage failures without caching unsaved success', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  let fail = true;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail && key === ASTROLOGY_KEY) { fail = false; throw new Error('fixture storage quota exceeded'); }
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  } } });
  try {
    await assert.rejects(updateAstrology(store => ({ ...store, profiles: [profile()] })), /quota exceeded/);
    assert.equal(loadAstrology().profiles.length, 0);
    assert.equal(values.has(ASTROLOGY_KEY), false);
    await Promise.all(['first', 'second'].map(id => updateAstrology(store => ({ ...store, profiles: [...store.profiles, profile({ id })] }))));
    assert.equal(loadAstrology().profiles.length, 2);
    const record = createNatalRecord(profile(), '');
    await updateAstrology(store => ({ ...store, records: [record] }));
    await updateAstrology(store => ({ ...store, profiles: [] }));
    const persisted = JSON.parse(values.get(ASTROLOGY_KEY)!);
    assert.equal(persisted.profiles.length, 0);
    assert.deepEqual(persisted.records[0], record);
  } finally {
    await removeStorageItem(ASTROLOGY_KEY);
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
