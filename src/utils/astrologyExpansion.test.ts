import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Body } from 'astronomy-engine';
import {
  ASPECTS, ASTROLOGY_KEY, astrologyContext, astrologyRecordTitle, astrologyShareText, birthInstant, calculateNatal,
  createDaily, createNatalRecord, createSynastry, crossAspects, findAscendantTime, isAstrologyStudy,
  loadAstrology, localCalendarDate, planetaryPositions, recoverNatalRecords, signIndex, updateAstrology, updateAstrologyRecord,
  type BirthProfile, type PlanetId,
} from './astrology';
import { ASTROLOGY_CITIES, ASTROLOGY_PROVINCES } from './astrologyCities';
import { characterProfileFromProposal, parseCharacterBirthReply } from './astrologyCharacters';
import { removeStorageItem, setStorageItemsAtomically } from './dbStorage';

const profile = (id = 'a'): BirthProfile => ({
  id, name: id === 'a' ? '测试玩家' : '测试角色', date: '2000-01-01', time: '20:00', timeKnown: true,
  place: { ...ASTROLOGY_CITIES[0] }, fold: 'reject',
});
const source = '角色生于2000年1月1日，北京，性格温柔但有边界。';
const proposal = () => ({
  date: '2000-01-01', time: null, city: '北京', targetAscendant: 6, reason: '以协调与边界的创作印象选择天秤上升，不是现实判断。',
  assumedFields: ['time'], evidence: { date: '2000年1月1日', time: '', place: '北京' },
});
test('province groups are unique, cover all existing city centres once and keep accurate city-level coordinates', () => {
  assert.equal(ASTROLOGY_PROVINCES.length, 34);
  const grouped = ASTROLOGY_PROVINCES.flatMap(province => province.cities);
  assert.equal(grouped.length, ASTROLOGY_CITIES.length);
  assert.equal(new Set(grouped.map(city => city.name)).size, ASTROLOGY_CITIES.length);
  assert.deepEqual(grouped.find(city => city.name === '深圳'), ASTROLOGY_CITIES.find(city => city.name === '深圳'));
  assert.deepEqual(ASTROLOGY_PROVINCES.find(province => province.name === '广东省')?.cities.map(city => city.name), ['广州', '深圳']);
});
test('creative times genuinely produce all twelve requested rising signs without changing the configured birthday', () => {
  for (let target = 0; target < 12; target++) {
    const result = findAscendantTime(profile(), target);
    assert.equal(result.date, '2000-01-01');
    assert.equal(result.timeKnown, true);
    assert.equal(signIndex(calculateNatal(result).ascendant), target);
  }
  const ny = { ...profile(), date: '2024-11-03', place: { name: '纽约', latitude: 40.7, longitude: -74, timeZone: 'America/New_York' } };
  const result = findAscendantTime(ny, 4);
  assert.ok(Number.isFinite(birthInstant(result).date.getTime()));
  assert.equal(signIndex(calculateNatal(result).ascendant), 4);
  assert.throws(() => findAscendantTime(profile(), 12), /无效/);
});
test('character drafts preserve explicit settings, validate literal evidence and label every creative assumption', () => {
  const parsed = parseCharacterBirthReply(JSON.stringify(proposal()), source);
  const draft = characterProfileFromProposal(parsed, { id: 'actor', name: '测试角色' }, 'b');
  assert.equal(draft.actorId, 'actor');
  assert.equal(draft.date, '2000-01-01');
  assert.equal(signIndex(calculateNatal(draft).ascendant), 6);
  assert.deepEqual(draft.creative?.assumedFields, ['time']);
  const explicit = { ...proposal(), time: '07:30', targetAscendant: null, assumedFields: [], evidence: { ...proposal().evidence, time: '07:30' } };
  assert.equal(characterProfileFromProposal(parseCharacterBirthReply(JSON.stringify(explicit), `${source} 07:30`), { id: 'actor', name: '角色' }, 'b').time, '07:30');
  assert.throws(() => parseCharacterBirthReply(JSON.stringify(explicit), source), /不存在的出生依据/);
  assert.throws(() => parseCharacterBirthReply(JSON.stringify({ ...proposal(), date: '2001-01-01' }), source), /改写/);
  assert.throws(() => parseCharacterBirthReply(JSON.stringify({ ...explicit, time: '08:30' }), `${source} 07:30`), /改写/);
  assert.throws(() => parseCharacterBirthReply(JSON.stringify({ ...explicit, evidence: { ...explicit.evidence, time: '清晨' } }), `${source} 清晨`), /不足以核对/);
  const afternoon = { ...explicit, time: '19:30', evidence: { ...explicit.evidence, time: '晚上7点半' } };
  assert.equal(parseCharacterBirthReply(JSON.stringify(afternoon), `${source} 晚上7点半`).time, '19:30');
  assert.throws(() => parseCharacterBirthReply(JSON.stringify({ ...proposal(), targetAscendant: null }), source), /必须提供/);
  const partial = { ...parsed, assumedFields: [], evidence: { date: '1月1日', time: '', place: '' } };
  const partialDraft = characterProfileFromProposal(partial, { id: 'actor', name: '角色' }, 'b');
  assert.deepEqual(new Set(partialDraft.creative?.assumedFields), new Set(['date', 'time', 'place']));
});
test('cross-chart aspects evaluate every pair, allow same-name bodies and enforce exact orb thresholds', () => {
  const positions = (ids: PlanetId[], degrees: number[]) => ids.map((id, index) => ({ id, longitude: degrees[index], retrograde: false }));
  const aspects = crossAspects(positions([Body.Sun, Body.Moon], [0, 180]), positions([Body.Sun, Body.Moon, Body.Mercury], [90, 60, 120]));
  assert.equal(aspects.length, 6);
  assert.equal(aspects.find(aspect => aspect.a === Body.Sun && aspect.b === Body.Sun)?.kind, 'square');
  assert.ok(aspects.every(aspect => aspect.orb === 0));
  for (const aspect of ASPECTS) {
    const edge = aspect.angle === 180 ? aspect.angle - aspect.orb : aspect.angle + aspect.orb;
    assert.equal(crossAspects(positions([Body.Sun], [0]), positions([Body.Moon], [edge]))[0]?.kind, aspect.id);
    const outside = edge + (aspect.angle === 180 ? -.0001 : .0001);
    assert.equal(crossAspects(positions([Body.Sun], [0]), positions([Body.Moon], [outside])).length, 0);
  }
});
test('synastry stores independent snapshots and carries noon and creative limitations into AI, questions and sharing', () => {
  const a = { ...profile(), timeKnown: false };
  const b = characterProfileFromProposal(parseCharacterBirthReply(JSON.stringify(proposal()), source), { id: 'actor', name: '测试角色' }, 'b');
  const study = createSynastry(a, b, '怎样表达需要？');
  assert.ok(isAstrologyStudy(study));
  assert.equal(study.kind, 'synastry');
  study.readingMode = 'question';
  assert.match(astrologyRecordTitle(study), /星空问答/);
  const context = astrologyContext(study);
  assert.match(context, /全部宫位不可信/);
  assert.match(context, /角色创作设定/);
  assert.match(context, /A .*落 B 第/);
  assert.match(astrologyShareText(study), /怎样表达需要/);
  b.creative!.reason = '原档案已修改';
  a.place.name = '原地点已改';
  assert.ok(!astrologyContext(study).includes('原档案已修改'));
  assert.ok(!astrologyContext(study).includes('原地点已改'));
  assert.throws(() => createSynastry(a, a), /不同/);
  assert.ok(!isAstrologyStudy({ ...study, aspects: study.aspects.slice(1) }));
});
test('daily transits use the requested civil date and timezone at noon, not birthday noon or device UTC', () => {
  const study = createDaily(profile(), '2024-03-20', 'America/New_York', '如何安排今天？');
  assert.equal(study.kind, 'daily');
  if (study.kind !== 'daily') throw new Error('Expected daily fixture');
  assert.equal(study.utc, '2024-03-20T16:00:00.000Z');
  assert.deepEqual(study.transits, planetaryPositions(new Date(study.utc)));
  assert.deepEqual(study.aspects, crossAspects(study.first.chart.planets, study.transits));
  assert.ok(isAstrologyStudy(study));
  assert.match(astrologyContext(study), /不是全天不变/);
  assert.equal(localCalendarDate(new Date('2024-03-20T00:01:00Z'), 'America/New_York'), '2024-03-19');
  assert.throws(() => createDaily(profile(), '2024-02-30', 'Asia/Shanghai'), /有效/);
  assert.throws(() => createDaily(profile(), '2024-03-20', 'bad-zone'), /时区/);
});
test('legacy natal stores migrate losslessly and new study readings persist, recover and survive profile deletion', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  } } });
  try {
    const old = createNatalRecord(profile(), '');
    await setStorageItemsAtomically({ [ASTROLOGY_KEY]: { profiles: [profile()], records: [old] } });
    assert.deepEqual(loadAstrology().studies, []);
    assert.deepEqual(loadAstrology().records[0], old);
    const study = createSynastry(profile(), profile('b'));
    await updateAstrology(store => ({ ...store, studies: [study] }));
    await updateAstrologyRecord(study.id, record => ({ ...record, interpretations: [{ id: 'pending', reader: { mode: 'oracle' }, text: '', status: 'pending', createdAt: new Date().toISOString() }] }));
    await updateAstrology(store => ({ ...store, profiles: [], studies: recoverNatalRecords(store.studies) }));
    const saved = loadAstrology();
    assert.deepEqual(saved.records[0], old);
    assert.equal(saved.studies[0].interpretations[0].status, 'error');
    assert.equal(saved.studies[0].first.profile.name, '测试玩家');
    assert.equal(JSON.parse(values.get(ASTROLOGY_KEY)!).studies.length, 1);
  } finally {
    await removeStorageItem(ASTROLOGY_KEY);
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});
