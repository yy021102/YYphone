import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BUILTIN_QNA_BANKS, buildShareText, exportBanks, findReusableAnswers, matchStats, normalizeCharacterAnswers,
  parseBankImport, type QnaRecord,
} from './qnaGame';

const bank = BUILTIN_QNA_BANKS[0];

const record = (): QnaRecord => ({
  id: 'r1', bankId: bank.id, bankTitle: bank.title, bankCategory: bank.category, emoji: bank.emoji,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', questions: bank.questions,
  userName: '我', userAnswers: { q1: '窝在家里放空', q2: '马上说开' }, people: [{ id: 'c1', name: '林渡' }],
  results: { c1: { status: 'done', answers: { q1: '窝在家里放空', q2: '先冷静再聊' } } },
});

test('built-in banks are well formed', () => {
  for (const item of BUILTIN_QNA_BANKS) {
    assert.ok(item.questions.length >= 8);
    assert.equal(new Set(item.questions.map(question => question.id)).size, item.questions.length);
    for (const question of item.questions) assert.equal(question.type === 'choice', question.options.length >= 2);
  }
});

test('export and import round-trip a bank', () => {
  const [imported] = parseBankImport(exportBanks([bank]));
  assert.equal(imported.title, bank.title);
  assert.deepEqual(imported.questions.map(question => question.text), bank.questions.map(question => question.text));
  assert.notEqual(imported.id, bank.id);
});

test('import accepts bare question lists and rejects empty input', () => {
  const [imported] = parseBankImport('["你好吗？", {"text":"选一个","options":["甲","乙"]}]');
  assert.deepEqual(imported.questions.map(question => question.type), ['text', 'choice']);
  assert.throws(() => parseBankImport('{"questions":[]}'));
  assert.throws(() => parseBankImport('not json'));
});

test('match stats only count answered choice questions', () => {
  assert.deepEqual(matchStats(record(), 'c1'), { matched: 1, total: 2, percent: 50 });
});

test('previous answers are reused by question wording and valid options only', () => {
  const found = findReusableAnswers([record()], bank.questions);
  assert.equal(found[0].matched, 2);
  const changed = [{ ...bank.questions[0], options: ['别的选项', '另一个选项'] }];
  assert.equal(findReusableAnswers([record()], changed).length, 0);
});

test('character answers are snapped onto the real options', () => {
  const answers = normalizeCharacterAnswers(bank.questions.slice(0, 3), [
    { id: 'q1', answer: 'B' }, { id: 'q2', answer: '先冷静再聊。' }, { id: 'q3', answer: '随缘' },
  ]);
  assert.deepEqual(answers, { q1: '出门探店逛街', q2: '先冷静再聊', q3: '随缘，想见就见' });
  assert.throws(() => normalizeCharacterAnswers(bank.questions, []));
});

test('share text lists every participant per question', () => {
  const text = buildShareText(record());
  assert.match(text, /1\. 理想的周末是？/);
  assert.match(text, /林渡：先冷静再聊/);
  assert.match(text, /1\/2 题选项一致/);
});
