import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanEncounterWord, encounterMatches, encounterTask, encounterDetail, isEncounterResult, type EncounterResult } from './wordEncounter';

test('encounters require the same word, not a synonym, with normal whitespace and case normalization', () => {
  assert.equal(encounterMatches('蓝色', '蓝色'), true);
  assert.equal(encounterMatches(' Blue ', 'ｂｌｕｅ'), true);
  assert.equal(encounterMatches('「天空」', '天空'), true);
  assert.equal(encounterMatches('天空', '蓝天'), false);
  for (const value of ['', '   ', '天空，大海', '天空\n大海', '一个特别特别特别特别特别特别特别特别特别长的句子', '❤️', undefined]) assert.throws(() => cleanEncounterWord(value));
});

test('AI sees revealed word pairs only, drops private metadata, and keeps recent history bounded', () => {
  const prompt = encounterTask([{ userWord: '天空', characterWord: '大海', draft: '本轮秘密蓝色', secret: '未揭晓答案' } as any]);
  assert.match(prompt, /天空/); assert.match(prompt, /大海/); assert.doesNotMatch(prompt, /本轮秘密蓝色|未揭晓答案|draft|secret/);
  assert.match(encounterTask([]), /第一轮/);
  const long = encounterTask(Array.from({ length: 20 }, (_, i) => ({ userWord: `玩家词${i}独特`, characterWord: `角色词${i}独特` })));
  assert.match(long, /第 21 轮/); assert.match(long, /玩家词19独特/); assert.doesNotMatch(long, /玩家词0独特/);
});

test('shared results preserve both columns and outcome; malformed or invented success records are rejected', () => {
  const result: EncounterResult = { id: 'a', actorId: 'char', actorName: '林渡', userName: '玩家', rounds: [{ userWord: '天空', characterWord: '大海' }, { userWord: '蓝色', characterWord: '蓝色' }], matched: true };
  assert.equal(isEncounterResult(JSON.parse(JSON.stringify(result))), true);
  const detail = encounterDetail(result);
  assert.match(detail, /第 1 轮｜玩家：天空｜林渡：大海/); assert.match(detail, /第 2 轮｜玩家：蓝色｜林渡：蓝色/);
  assert.match(detail, /手机小游戏记录/);
  assert.equal(isEncounterResult({ ...result, rounds: [{ userWord: '天空', characterWord: '大海' }] }), false);
  assert.equal(isEncounterResult({ ...result, rounds: [] }), false);
  assert.equal(isEncounterResult({ ...result, rounds: [null] }), false);
  assert.equal(isEncounterResult({ ...result, rounds: [{ userWord: '天空', characterWord: '大海' }], matched: false }), true);
});
