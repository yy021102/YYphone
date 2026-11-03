import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { BUILTIN_THOUGHT_PRESETS, isThoughtPreset, isThoughtPresetList, isThoughtSnapshot, makeThoughtSnapshot, previousThoughtStates, roundThoughtSnapshot, thoughtInstructions, validateThoughtResponse } from './thoughtPresets';
import { requestChatReply } from './chatReply';

const classic = () => structuredClone(BUILTIN_THOUGHT_PRESETS[0]);
const status = () => structuredClone(BUILTIN_THOUGHT_PRESETS[1]);
const fields = { outfit: '浅色外套', action: '坐在窗边读消息', affection: '有些期待' };
const at = '2026-11-03T14:00:00Z';

test('preset schemas retain the thought field and reject duplicate, reserved and malformed keys', () => {
  for (const preset of BUILTIN_THOUGHT_PRESETS) assert.ok(isThoughtPreset(preset));
  assert.ok(isThoughtPresetList([{ ...status(), id: 'my-status' }]));
  assert.equal(isThoughtPresetList([status()]), false);
  assert.equal(isThoughtPresetList([{ ...status(), id: 'x' }, { ...status(), id: 'x' }]), false);
  assert.equal(isThoughtPreset({ ...status(), fields: [] }), false);
  for (const key of ['constructor', '__proto__', 'prototype', 'time', 'characterName', 'fields', 'bad key', '中文']) {
    assert.equal(isThoughtPreset({ ...status(), fields: [...status().fields, { key, label: '测试', instruction: '' }] }), false);
  }
  assert.equal(isThoughtPreset({ ...status(), fields: [...status().fields, status().fields[0]] }), false);
  assert.equal(isThoughtPreset({ ...status(), height: 701 }), false);
  assert.equal(isThoughtPreset({ ...status(), name: ' ' }), false);
});

test('snapshot copies preset and data so later preset edits cannot rewrite history', () => {
  const preset = status();
  const values = { ...fields };
  const saved = makeThoughtSnapshot(preset, values, '很高兴见到你。', '测试角色', at);
  preset.css = 'body{color:red}'; preset.fields[0].label = '已改名'; values.outfit = '已换衣服';
  assert.ok(isThoughtSnapshot(saved));
  assert.equal(saved.values.outfit, fields.outfit);
  assert.equal(saved.preset.fields[0].label, '今日穿着');
  assert.notEqual(saved.preset.css, preset.css);
  assert.equal(isThoughtSnapshot({ ...saved, values: {} }), false);
  assert.equal(isThoughtSnapshot({ ...saved, values: { ...saved.values, unexpected: {} } }), false);
  assert.equal(makeThoughtSnapshot(preset, values, '心声。', '角'.repeat(250), at).characterName.length, 250);
  assert.throws(() => makeThoughtSnapshot(status(), {}, '心声', '角色', at), /不完整/);
});

test('direct replies keep status separate from spoken messages and propagate one round status', () => {
  const result = validateThoughtResponse({ speakerId: 'a', thought: '想和你说话。', thoughtStatus: fields, reply: ['你好', { text: '在做什么' }] }, status(), 'a', false);
  assert.deepEqual(result.thoughtStatus, fields);
  assert.deepEqual((result.reply as Array<unknown>)[0], '你好');
  assert.deepEqual((result.reply as Array<Record<string, unknown>>)[1].thoughtStatus, fields);
  assert.throws(() => validateThoughtResponse({ reply: ['你好'] }, status(), 'a', false), /缺少独立/);
  assert.throws(() => validateThoughtResponse({ thoughtStatus: { ...fields, outfit: '' }, reply: ['你好'] }, status(), 'a', false), /今日穿着/);
  assert.throws(() => validateThoughtResponse({ thoughtStatus: { ...fields, extra: '未知' }, reply: ['你好'] }, status(), 'a', false), /仅包含/);
});

test('group status belongs to each actual speaker and cannot leak through the main speaker fallback', () => {
  const b = { ...fields, outfit: '蓝色衬衣' };
  const result = validateThoughtResponse({ speakerId: 'a', thoughtStatus: fields, reply: [
    { speakerId: 'a', text: '你好' }, { speakerId: 'b', text: '我也在', thoughtStatus: b },
    { speakerId: 'b', text: '再聊一会儿' }, { kind: 'narration', text: '夜色很安静。' },
  ] }, status(), 'a', true);
  const reply = result.reply as Array<Record<string, unknown>>;
  assert.deepEqual(reply[0].thoughtStatus, fields);
  assert.deepEqual(reply[2].thoughtStatus, b);
  assert.equal(reply[3].thoughtStatus, undefined);
  assert.throws(() => validateThoughtResponse({ speakerId: 'a', thoughtStatus: fields, reply: [{ speakerId: 'b', text: '你好' }] }, status(), 'a', true), /b 缺少/);
  assert.throws(() => validateThoughtResponse({ speakerId: 'a', thoughtStatus: fields, reply: [{ speakerId: 'a', text: '你好', thoughtStatus: b }] }, status(), 'a', true), /互相冲突/);
  assert.throws(() => validateThoughtResponse({ speakerId: 'a', reply: [{ speakerId: 'b', text: '你好', thoughtStatus: b }] }, status(), 'a', true), /主要角色 a 缺少/);
});

test('classic needs no extra status; rich status remains Chinese and has bounded content', () => {
  const result = { thought: '很开心。', reply: ['你好'] };
  assert.equal(validateThoughtResponse(result, classic(), 'a', false), result);
  assert.throws(() => validateThoughtResponse({ ...result, thought: '好'.repeat(4001) }, classic(), 'a', false), /4000/);
  assert.throws(() => validateThoughtResponse({ ...result, thoughtStatus: { ...fields, outfit: 'blue coat' } }, status(), 'a', false), /简体中文/);
  assert.throws(() => validateThoughtResponse({ ...result, thoughtStatus: { ...fields, outfit: '衣'.repeat(4001) } }, status(), 'a', false), /非空字符串/);
});

test('latest state context excludes private thoughts and unrelated speakers while preserving current fields', () => {
  const card = makeThoughtSnapshot(status(), fields, '不该注入的秘密', '甲', at);
  const messages = [
    { senderId: 'a', thoughtCard: card },
    { senderId: 'other', thoughtCard: { ...card, values: { ...card.values, outfit: '别人的衣服' } } },
    { senderId: 'a', thoughtCard: { ...card, values: { ...card.values, outfit: '新的外套' } } },
  ];
  const context = previousThoughtStates(status(), messages, ['a']);
  assert.match(context, /新的外套/);
  assert.doesNotMatch(context, /不该注入的秘密|别人的衣服|thought"/);
  assert.equal(previousThoughtStates(classic(), messages, ['a']), '');
  assert.equal(roundThoughtSnapshot({ senderId: 'a', replyBatchId: 'r' }, [{ senderId: 'b', replyBatchId: 'r', thoughtCard: card }]), undefined);
  assert.equal(roundThoughtSnapshot({ senderId: 'a', replyBatchId: 'r' }, [{ senderId: 'a', replyBatchId: 'r', thoughtCard: card }]), card);
});

test('generation prompt separates virtual status from actions and does not send display markup to AI', () => {
  const prompt = thoughtInstructions(status());
  assert.match(prompt, /thoughtStatus/); assert.match(prompt, /outfit/); assert.match(prompt, /简体中文/);
  assert.match(prompt, /不能读取玩家真实数据/); assert.match(prompt, /不能因此操作/);
  assert.ok(!prompt.includes(status().html)); assert.ok(!prompt.includes(status().css));
});

test('chat API retries a missing status before returning a fully validated round', async () => {
  const responses = [
    { reply: ['你好'], speakerId: 'a', thought: '想念你。' },
    { reply: ['你好'], speakerId: 'a', thought: '想念你。', thoughtStatus: fields },
  ];
  const calls: string[] = [];
  const fetchMock = mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    calls.push(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] }), { status: 200 });
  });
  const warning = mock.method(console, 'warn', () => {});
  try {
    const result = await requestChatReply([{ role: 'user', content: '你好' }], { endpoint: 'http://127.0.0.1:39123/v1', apiKey: 'fixture-key' },
      () => {}, { defaultSpeakerId: 'a', namesById: { a: ['甲'] } }, { requireThought: true, chineseThoughts: true, thoughtPreset: status() });
    assert.equal(calls.length, 2); assert.deepEqual(result.thoughtStatus, fields);
    assert.match(calls[1], /thoughtStatus/); assert.equal(warning.mock.callCount(), 1);
  } finally { fetchMock.mock.restore(); warning.mock.restore(); }
});
